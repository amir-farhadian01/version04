# ADR-0079: Stripe Connect Approved as Payment Gateway
- **Status:** accepted
- **Date:** 2026-08-11
- **Decision Maker:** CEO (Amir Farhadian)

## Context
The repository contained Stripe SDK code (`lib/stripe.ts`, `lib/stripeService.ts` — 594 lines of integration code) while AGENTS.md rule #6 explicitly prohibited any payment gateway SDK. This contradiction needed resolution before MVP payment flows could be implemented.

AGENTS.md rule #6 previously stated: "NO payment gateway SDK installed — do NOT add any payment gateway SDK without an approved ADR and architect sign-off." The code existed but was in a limbo state — neither active nor removed.

## Decision
**CEO approved Stripe Connect as the official payment gateway on 2026-08-11.**

- `lib/stripe.ts` and `lib/stripeService.ts` are now active and in production scope
- All payment flows use Stripe Connect for automatic commission splitting
- Business Clients onboard via Stripe Connect OAuth
- Platform commission is auto-deducted from each transaction
- Customer payments are held in escrow until job completion

## Alternatives Considered

| Alternative | Pros | Cons | Verdict |
|-------------|------|------|---------|
| **Stripe Connect (chosen)** | Auto commission split, OAuth onboarding, escrow, mature API | Vendor lock-in | ✅ ACCEPTED |
| Remove Stripe, use internal only | No external dependency | No real payment processing, no escrow, high fraud risk | ❌ REJECTED |
| PayPal Business | Well-known brand | No escrow, less flexible commission splitting | ❌ REJECTED (secondary only) |
| Manual bank transfers | Zero fees | No automation, high admin overhead, not scalable | ❌ REJECTED |

## Consequences

✅ **Positive:**
- Full escrow payment flow: customer pays → funds held → job completed → provider paid minus commission
- Automatic commission splitting — no manual reconciliation
- Business Client onboarding via Stripe Connect OAuth (pre-filled from KYC data)
- PCI compliance handled by Stripe
- Existing 594 lines of integration code are now production-grade

❌ **Trade-offs / Risks:**
- Stripe vendor lock-in (mitigated by adapter pattern for secondary gateways)
- Stripe fees (~2.9% + $0.30 per transaction) — factored into platform commission
- Stripe Connect onboarding requires business bank account verification

## Rollback Strategy
If Stripe becomes unavailable or unsuitable:
1. Migrate to PayPal Business via the adapter pattern in `lib/stripeService.ts`
2. Internal `Transaction` records remain the source of truth — no data loss
3. All payment references are stored in DB independent of Stripe

## Related Documents
- `AGENTS.md` (root) — rule #6 updated
- `docs/AGENTS.md` — rule #6 updated
- `docs/memory/decision-history.md` — decision logged
- `lib/stripe.ts` — Stripe SDK initialization
- `lib/stripeService.ts` — Stripe Connect integration (594 lines)