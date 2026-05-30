# Architecture Decision Record

## ADR-0064 — Budget / Price Range Fields

**Status:** Accepted
**Date:** 2026-05-26
**Author:** AI Agent (Orchestrator)

### Context

Orders previously had only a single `budget` field (Int?, cents), set on quote accept (see ADR-0062). This was insufficient for two key use cases:

1. **Customer price range input** — Customers creating an order need to specify a minimum and maximum budget range (e.g., "$200–$800") rather than a single fixed value. This enables the matching engine to filter providers whose pricing falls within the customer's acceptable range.

2. **Provider matching eligibility** — The matching engine ([`lib/matching/eligibility.ts`](lib/matching/eligibility.ts)) needs price range data to determine which provider packages are eligible for a given order. A single `budget` value doesn't express the customer's flexibility.

The existing `budget` field (set on quote accept) serves a different purpose — it represents the agreed-upon spending cap after a quote is accepted. The new `budgetMin` and `budgetMax` fields serve the pre-match, order-creation phase.

### Decision

Add `budgetMin` and `budgetMax` (both `Int?`, cents) to the `Order` model, with Zod cross-field validation ensuring `budgetMin < budgetMax` when both are provided. All three budget fields (`budget`, `budgetMin`, `budgetMax`) are optional, positive integers stored in cents.

### Key Design Choices

1. **Cents-based monetary values** ([`prisma/schema.prisma:492-494`](prisma/schema.prisma:492)) — `budget`, `budgetMin`, `budgetMax` are all `Int?` (cents). Display values are divided by 100. Consistent with ADR-0062 and ADR-0063's monetary convention.

2. **Zod cross-field validation** ([`routes/orders.ts:44-56`](routes/orders.ts:44)) — The `budgetSchema` uses Zod's `.refine()` to enforce `budgetMin < budgetMax` when both fields are present. If only one of the two is provided, no cross-field validation is applied (the single field is validated independently as a positive integer).

3. **Optional fields** — All three budget fields (`budget`, `budgetMin`, `budgetMax`) are nullable and optional. This ensures backward compatibility with existing orders that have no budget data. The schema allows any combination of null/values.

4. **Three endpoints updated** ([`routes/orders.ts:315-365`](routes/orders.ts:315), [`routes/orders.ts:837-851`](routes/orders.ts:837), [`routes/orders.ts:986-1011`](routes/orders.ts:986)):
   - `POST /api/orders/draft/:id/submit` — Reads `budgetMin`/`budgetMax` from the order's existing data during submission
   - `PUT /api/orders/draft/:id` — Accepts `budgetMin`/`budgetMax` in the update payload with Zod validation
   - `PUT /api/orders/:id` — Accepts `budgetMin`/`budgetMax` in the update payload with Zod validation

5. **GET response includes all budget fields** ([`routes/orders.ts:248-251`](routes/orders.ts:248)) — The order serialization includes `budget`, `budgetMin`, and `budgetMax` (all nullable), so clients can display the full price range.

6. **Prefill support** ([`routes/orders.ts:694-697`](routes/orders.ts:694)) — The draft creation endpoint accepts `budgetMin`/`budgetMax` in the prefill payload, allowing the order wizard to set initial budget range values.

7. **No matching eligibility integration yet** — The `budgetMin`/`budgetMax` fields are persisted and validated but not yet consumed by the matching engine ([`lib/matching/eligibility.ts`](lib/matching/eligibility.ts)). This is deferred to a future phase when price-range-based provider filtering is implemented.

### Consequences

**Positive:**
- ✅ Customers can specify a price range (min/max) when creating orders
- ✅ Zod `refine()` ensures logical range validation (`budgetMin < budgetMax`)
- ✅ Backward compatible — all fields are nullable, existing orders unaffected
- ✅ Cents-based monetary accuracy consistent with ADR-0062 and ADR-0063
- ✅ Prefill support enables the order wizard to set initial budget range values
- ✅ 12 new tests covering all validation edge cases (45 total, all passing)

**Negative:**
- ❌ No matching eligibility integration yet — `budgetMin`/`budgetMax` are stored but not used for provider filtering
- ❌ Three budget fields (`budget`, `budgetMin`, `budgetMax`) may cause confusion about which to use when — `budget` is the post-quote spending cap, `budgetMin`/`budgetMax` are the pre-match price range
- ❌ Cross-field validation only applies when both `budgetMin` and `budgetMax` are provided — single-field scenarios have no range validation

### Files

- [`prisma/schema.prisma:492-494`](prisma/schema.prisma:492) — `model Order` with `budgetMin` (Int?) and `budgetMax` (Int?) fields
- [`prisma/migrations/20260526040000_add_budget_range_fields/`](prisma/migrations/20260526040000_add_budget_range_fields/) — New migration adding `budget_min` and `budget_max` columns
- [`routes/orders.ts:44-56`](routes/orders.ts:44) — Zod `budgetSchema` with `.refine()` cross-field validation
- [`routes/orders.ts:248-251`](routes/orders.ts:248) — GET response serialization including all budget fields
- [`routes/orders.ts:315-365`](routes/orders.ts:315) — Submit endpoint reading budget fields from order data
- [`routes/orders.ts:694-697`](routes/orders.ts:694) — Draft creation prefill support for budget fields
- [`routes/orders.ts:837-851`](routes/orders.ts:837) — PUT `/draft/:id` update with budget validation
- [`routes/orders.ts:986-1011`](routes/orders.ts:986) — PUT `/:id` update with budget validation
- [`routes/orders.test.ts:662-781`](routes/orders.test.ts:662) — 12 tests covering budget validation, serialization, and edge cases
