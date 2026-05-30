# Architecture Decision Record

## ADR-0066 — Provider Counter-Offer Negotiation Flow

**Status:** Accepted
**Date:** 2026-05-26
**Author:** AI Agent (Orchestrator)

### Context

The quote-first booking mode (ADR-0062) introduced a complete quote lifecycle (`DRAFT` → `SENT` → `ACCEPTED`/`REJECTED`/`EXPIRED`) but was strictly one-directional: providers sent quotes and customers could only accept or reject them. There was no mechanism for:

1. **Bidirectional negotiation** — If a customer found a quote too expensive, they had no way to signal a desired price, and the provider had no way to adjust their offer in response.
2. **Counter-offer chain** — Providers could not send revised pricing after the initial quote was sent, forcing them to wait for rejection and re-enter the quote flow from scratch.
3. **Negotiation history** — There was no record of pricing iterations, making it impossible to trace how a final agreed price was reached.

The G4 requirement called for a provider-initiated counter-offer flow where the original provider can submit a revised quote with a new amount, and the customer can accept or reject that counter-offer independently of the original quote.

### Decision

Add a self-referential `counterOfferTo` field to the `Quote` model enabling a chain of counter-offers. Create `POST /quotes/:id/counter` endpoint where the original provider can send a counter-offer with a new amount. Update `POST /quotes/:id/respond` so accepting a counter transitions to `contracted` while rejecting leaves the original quote `SENT`.

### Key Design Choices

1. **Self-referential Quote relation** ([`prisma/schema.prisma:1251-1253`](prisma/schema.prisma:1251)) — `counterOfferTo` (optional `String?`, mapped to `counter_offer_to`) is a self-referential foreign key on the `Quote` model. The `counterOfferToQuote` relation points to the original quote being countered, and `counterOffers` is the inverse collection. This enables a chain: `Quote A → counterOfferTo: null` (original), `Quote B → counterOfferTo: A.id` (counter-offer), `Quote C → counterOfferTo: B.id` (counter-counter-offer), etc.

2. **Zod validation schema** ([`routes/quotes.ts:43-46`](routes/quotes.ts:43)) — `counterOfferSchema` validates `amount` (positive integer in cents) and optional `description` (min 10 chars). The amount replaces the original quote's `total` — the counter-offer is a new quote with its own pricing.

3. **Provider-only authorization** ([`routes/quotes.ts:752-758`](routes/quotes.ts:752)) — Only the provider who created the original quote can submit a counter-offer. The endpoint verifies `originalQuote.createdById !== userId` and returns `403 FORBIDDEN` if a different provider attempts to counter. This prevents other providers from interfering in an active negotiation.

4. **Status gate** ([`routes/quotes.ts:744-750`](routes/quotes.ts:744)) — Only quotes in `SENT` status can be countered. If the quote has already been accepted, rejected, or expired, the endpoint returns `400 INVALID_STATE`. This prevents counter-offers on finalized quotes.

5. **Order state validation** ([`routes/quotes.ts:708-714`](routes/quotes.ts:708)) — The order must be in `matching` status and the effective booking mode must resolve to `quote_first`. This prevents counter-offers on orders that have already transitioned to `contracted` or are in a different booking mode.

6. **Version numbering** ([`routes/quotes.ts:760-766`](routes/quotes.ts:760)) — The counter-offer gets an incremented `versionNumber` based on the highest existing version for the order. This provides a clear ordering of the negotiation history.

7. **48-hour expiry** ([`routes/quotes.ts:783`](routes/quotes.ts:783)) — Counter-offers inherit the same 48-hour `validUntil` window as original quotes (consistent with ADR-0062). The expiry is set at creation time relative to `Date.now()`.

8. **NATS `quote.countered` event** ([`routes/quotes.ts:792-805`](routes/quotes.ts:792)) — A new NATS subject `quote.countered` is published with `quoteId`, `originalQuoteId`, `orderId`, `workspaceId`, `providerId`, `customerId`, `amount`, and `currency`. The publish is wrapped in try/catch (non-fatal) consistent with the existing NATS pattern.

9. **Updated respond logic for counter-offers** ([`routes/quotes.ts:866-932`](routes/quotes.ts:866)) — The `POST /quotes/:id/respond` endpoint was updated to handle counter-offers differently from original quotes:
   - **Accept** ([`routes/quotes.ts:866-910`](routes/quotes.ts:866)): Accepting a counter-offer transitions the order to `contracted` (same as accepting an original quote). All other pending quotes for the order are rejected.
   - **Reject** ([`routes/quotes.ts:913-932`](routes/quotes.ts:913)): When rejecting a counter-offer (a quote with `counterOfferTo` set), the **original quote remains in `SENT` status** so the customer can still accept it. When rejecting an original quote (no `counterOfferTo`), the order returns to `matching` state as before. This is the critical behavioral difference: rejecting a counter-offer does not end the negotiation — it falls back to the previous offer.

10. **No customer-initiated counter-offer** — The current implementation only supports provider-initiated counter-offers. Customers cannot send counter-offers to providers. This is documented as a future enhancement.

11. **No automatic expiry cron** — Consistent with ADR-0042's lazy expiry pattern, there is no background cron for counter-offer expiry. The 48-hour `validUntil` is set at creation time but not actively enforced by a scheduler.

### Consequences

**Positive:**
- ✅ Bidirectional negotiation between provider and customer — providers can adjust pricing in response to customer feedback
- ✅ Counter-offer chain preserves full negotiation history via self-referential `counterOfferTo` relation
- ✅ 48-hour expiry prevents stale counter-offers from lingering indefinitely
- ✅ Accept/Reject logic correctly handles counter-offer vs original quote — rejecting a counter-offer falls back to the previous offer rather than ending the negotiation
- ✅ Provider-only authorization prevents other providers from interfering in active negotiations
- ✅ Version numbering provides clear ordering of negotiation iterations
- ✅ NATS `quote.countered` event enables real-time notifications for counter-offer events
- ✅ 10 new tests covering all counter-offer edge cases (23 total, all passing)

**Negative:**
- ❌ No customer-initiated counter-offer support — customers cannot propose their own price
- ❌ No automatic counter-offer expiration cron — relies on application-level checks (consistent with ADR-0042 lazy expiry pattern)
- ❌ No counter-offer limit — a provider could theoretically send an unlimited number of counter-offers, potentially spamming the customer
- ❌ No notification handler for `quote.countered` event yet — the NATS event is published but no consumer is registered to send push notifications

### Files Changed

- [`prisma/schema.prisma:1251-1253`](prisma/schema.prisma:1251) — Added `counterOfferTo` (String?, optional), `counterOfferToQuote` (self-referential relation), and `counterOffers` (inverse collection) to the `Quote` model
- [`prisma/migrations/20260526050000_add_counter_offer_to_quote/`](prisma/migrations/20260526050000_add_counter_offer_to_quote/) — New migration for the schema change
- [`routes/quotes.ts:43-46`](routes/quotes.ts:43) — `counterOfferSchema` Zod validation schema
- [`routes/quotes.ts:666-811`](routes/quotes.ts:666) — `POST /quotes/:id/counter` endpoint handler
- [`routes/quotes.ts:813-945`](routes/quotes.ts:813) — Updated `POST /quotes/:id/respond` endpoint with counter-offer-aware accept/reject logic
- [`lib/bus.ts:64`](lib/bus.ts:64) — Added `QUOTE_COUNTERED: 'quote.countered'` to `EventSubjects`
- [`routes/quotes.test.ts:613-769`](routes/quotes.test.ts:613) — `simulateCounterOffer` and `simulateRespondToQuote` test helpers
- [`routes/quotes.test.ts:1335-1655`](routes/quotes.test.ts:1335) — 10 counter-offer tests covering creation, validation, accept, and reject scenarios
