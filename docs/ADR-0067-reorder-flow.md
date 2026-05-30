# Architecture Decision Record

## ADR-0067 — Reorder Flow

**Status:** Accepted
**Date:** 2026-05-26
**Author:** AI Agent (Orchestrator)

### Context

Customers frequently need to re-book the same service from a provider they've used before — for example, scheduling another cleaning session with the same cleaner, or ordering another painting job from a trusted painter. Previously, there was no way to duplicate a previous order; customers had to manually re-enter all details (provider, service, budget, address, questionnaire answers, photos) from scratch, creating significant friction and reducing repeat business.

The G5 requirement called for a one-click reorder flow where a customer can create a new draft order pre-populated with all data from a previous order, with optional overrides for fields that may change between bookings (description, scheduled date, address, urgency).

### Decision

Add an `originalOrderId` (self-referential foreign key) to the `Order` model enabling a reorder chain. Create `POST /orders/:id/reorder` endpoint that copies provider, service, budget, address, questionnaire, and photo data from the original order into a new draft, with optional overrides for `description`, `scheduledAt`, `addressId`, and `urgency`.

### Key Design Choices

1. **Self-referential Order relation** ([`prisma/schema.prisma:503-505`](prisma/schema.prisma:503)) — `originalOrderId` (optional `String?`, `@unique`, mapped to `original_order_id`) is a self-referential foreign key on the `Order` model. The `originalOrder` relation points to the original order being reordered, and `reorders` is the inverse collection. The `@unique` constraint ensures each order can only be the source of one reorder chain, preventing branching. This enables a linear chain: `Order A → originalOrderId: null` (original), `Order B → originalOrderId: A.id` (reorder), `Order C → originalOrderId: B.id` (re-reorder), etc.

2. **Zod validation schema** ([`routes/orders.ts:67-72`](routes/orders.ts:67)) — `reorderSchema` validates all optional override fields: `description` (string, 20-500 chars), `scheduledAt` (ISO datetime string), `addressId` (UUID), and `urgency` (OrderUrgency enum). All fields are optional — if omitted, the original order's values are used.

3. **Ownership validation** ([`routes/orders.ts:2418-2421`](routes/orders.ts:2418)) — Only the customer who owns the original order can reorder from it. The endpoint verifies `original.customerId !== userId` and returns `403 FORBIDDEN` if a different user attempts to reorder. This prevents unauthorized duplication of other customers' orders.

4. **Matched provider requirement** ([`routes/orders.ts:2423-2426`](routes/orders.ts:2423)) — The original order must have a `matchedProviderId` set. If the original order was never matched with a provider (e.g., it's still in `draft` or `submitted` status), the endpoint returns `400 BAD_REQUEST`. This ensures reorders only work for orders that were actually fulfilled (or at least matched).

5. **Fields copied from original order** ([`routes/orders.ts:2428-2452`](routes/orders.ts:2428)) — The following fields are copied verbatim from the original order:
   - `serviceCatalogId` — the service type
   - `matchedProviderId` — the provider who fulfilled the original order
   - `matchedWorkspaceId` — the provider's workspace
   - `matchedPackageId` — the package selected
   - `budget`, `budgetMin`, `budgetMax` — all budget fields in cents
   - `locationLat`, `locationLng` — geolocation coordinates
   - `scheduleFlexibility` — the flexibility setting
   - `schemaSnapshot` — the questionnaire schema snapshot
   - `answers` — the questionnaire answers from the original order
   - `photos` — the photo references from the original order

6. **Optional overrides** ([`routes/orders.ts:2435-2447`](routes/orders.ts:2435)) — The customer can override:
   - `description` — defaults to `original.description` if not provided
   - `address` — defaults to `original.address` if `addressId` not provided; uses the provided address UUID otherwise
   - `scheduledAt` — defaults to `undefined` (not set) if not provided; uses the provided datetime otherwise
   - `urgency` — defaults to `undefined` (not set) if not provided; uses the provided enum value otherwise

7. **`entryPoint: 'reorder'` setting** ([`routes/orders.ts:2443`](routes/orders.ts:2443)) — The new order is created with `entryPoint: OrderEntryPoint.reorder`, distinguishing it from orders created via the wizard, explorer, or other entry points. This enables analytics on reorder adoption and conversion rates.

8. **`originalOrderId` linkage** ([`routes/orders.ts:2444`](routes/orders.ts:2444)) — The new order is linked to the original via `originalOrderId: original.id`, creating a traceable reorder chain. The `@unique` constraint on `originalOrderId` ensures each order can only be reordered once (no branching), but the chain can continue: the reorder itself can be reordered again.

9. **Draft status** ([`routes/orders.ts:2445`](routes/orders.ts:2445)) — The new order is created in `draft` status, giving the customer a chance to review and modify the pre-populated data before submitting. This is consistent with the standard order creation flow where orders start as drafts.

10. **No NATS event on creation** — Unlike order creation via the wizard or walk-in endpoints, the reorder endpoint does not publish a NATS event. The reorder creates a draft, and the customer must explicitly submit it (via the existing submit flow) before any matching or notification occurs. This avoids premature notifications for unsubmitted drafts.

### Consequences

**Positive:**
- ✅ One-click reordering for repeat services — customers can quickly re-book from a previous order
- ✅ Full field preservation — provider, service, budget, questionnaire answers, photos, and location are all copied
- ✅ Optional overrides for flexibility — customers can change description, date, address, or urgency without affecting the original
- ✅ Ownership validation prevents unauthorized reorders — only the original customer can reorder
- ✅ Traceable reorder chain via `originalOrderId` self-referential relation
- ✅ Entry point tracking (`entryPoint: 'reorder'`) enables analytics on reorder adoption
- ✅ Draft status allows review before submission — consistent with standard order flow
- ✅ 11 new tests covering all reorder edge cases (74 total, all passing)

**Negative:**
- ❌ No reorder history UI yet — customers cannot see which orders they've reordered or view the reorder chain
- ❌ No support for reordering orders with different booking modes — the reorder copies the matched provider/package directly, bypassing the matching engine
- ❌ `@unique` constraint on `originalOrderId` prevents branching — an order can only be the source of one reorder chain
- ❌ No notification for reorder creation — the customer must remember to submit the draft
- ❌ No support for reordering with a different provider — the reorder always uses the original matched provider

### Files Changed

- [`prisma/schema.prisma:503-505`](prisma/schema.prisma:503) — Added `originalOrderId` (String?, `@unique`), `originalOrder` (self-referential relation), and `reorders` (inverse collection) to the `Order` model
- [`prisma/migrations/20260526080000_add_reorder_flow/`](prisma/migrations/20260526080000_add_reorder_flow/) — New migration for the schema change
- [`routes/orders.ts:67-72`](routes/orders.ts:67) — `reorderSchema` Zod validation schema with optional override fields
- [`routes/orders.ts:2403-2462`](routes/orders.ts:2403) — `POST /orders/:id/reorder` endpoint handler with ownership validation, field copying, and optional overrides
- [`routes/orders.test.ts`](routes/orders.test.ts) — 11 new tests covering reorder creation, validation, ownership checks, and edge cases
