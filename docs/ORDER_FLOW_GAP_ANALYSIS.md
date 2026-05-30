# Order Flow — Comprehensive Gap Analysis & Bug Report

> **UPDATE 2026-05-26:** Most gaps (G1-G5, G9, G13-G16) and bugs (B1, B2, B4-B8) have been resolved.
> See ADR-0061 through ADR-0067 for implementations.
> Remaining open items are listed below.

> **Generated:** 2026-05-25
> **Source:** [`docs/ORDER_FLOW.md`](docs/ORDER_FLOW.md) (spec) vs actual codebase
> **Code files analyzed:**
> - [`routes/orders.ts`](routes/orders.ts) (1833 lines)
> - [`routes/orderContracts.ts`](routes/orderContracts.ts) (951 lines)
> - [`routes/orderPayments.ts`](routes/orderPayments.ts) (216 lines)
> - [`routes/orderChat.ts`](routes/orderChat.ts) (378 lines)
> - [`lib/orderPhase.ts`](lib/orderPhase.ts)
> - [`lib/orderPayments.ts`](lib/orderPayments.ts)
> - [`lib/orderNegotiationAccess.ts`](lib/orderNegotiationAccess.ts)
> - [`lib/orderLifecycleNotifications.ts`](lib/orderLifecycleNotifications.ts)
> - [`lib/orderSnapshot.ts`](lib/orderSnapshot.ts)
> - [`lib/orderPhotosForValidate.ts`](lib/orderPhotosForValidate.ts)
> - [`lib/bus.ts`](lib/bus.ts)
> - [`lib/matching/eligibility.ts`](lib/matching/eligibility.ts)
> - [`lib/matching/orchestrator.ts`](lib/matching/orchestrator.ts)
> - [`lib/matching/roundRobin.ts`](lib/matching/roundRobin.ts)
> - [`prisma/schema.prisma`](prisma/schema.prisma) (Order model + enums)

---

## 🔴 BUGS (Definite Implementation Errors)

### B1 — `/complete` endpoint skips `paid` and `in_progress` states
**File:** [`routes/orders.ts:1060-1140`](routes/orders.ts:1060)
**Spec:** Order status machine: `contracted → paid → in_progress → completed`
**Code:** The `POST /:id/complete` endpoint transitions directly from `contracted` → `completed`, completely skipping the `paid` and `in_progress` states.
**Impact:** Payment is never enforced before completion. Jobs can be marked complete without ever being paid. The `JobRecord` is never created (no `in_progress` → `completed` transition).
**Severity:** 🔴 HIGH — Business logic flaw, payment bypass.

### B2 — Cancel endpoint only allows `draft`, `submitted`, `matching`
**File:** [`routes/orders.ts:1696-1742`](routes/orders.ts:1696)
**Spec:** Part 7 — Cancellation allowed in: `draft`, `submitted`, `matching`, `matched`, `contracted`, `paid` (with different refund rules per phase).
**Code:** The `POST /:id/cancel` endpoint only allows cancellation when status is `draft`, `submitted`, or `matching`. Cancellation in `matched`, `contracted`, or `paid` states is not implemented.
**Impact:** Customers cannot cancel after being matched, even before work starts. No refund logic exists.
**Severity:** 🔴 HIGH — Missing critical business flow.

### B3 — Description validation mismatch (10 chars vs 20 chars)
**File:** [`routes/orders.ts:551-640`](routes/orders.ts:551) (draft creation)
**Spec:** Phase 1 — Description minimum 20 characters.
**Code:** Validation checks for minimum 10 characters.
**Impact:** Orders with 10-19 character descriptions pass validation but violate spec.
**Severity:** 🟡 MEDIUM — Validation inconsistency.

### B4 — No `urgency` field handling in submit flow
**File:** [`routes/orders.ts:247-547`](routes/orders.ts:247) (`runSubmitDraftOrderFlow`)
**Spec:** Part 6.2 — Emergency/High-Urgency flow: orders with `urgency: 'emergency'` or `urgency: 'high'` should skip round-robin and go directly to all eligible providers simultaneously.
**Code:** The `runSubmitDraftOrderFlow()` function does not check any `urgency` field. The `Order` model in Prisma schema has no `urgency` field at all.
**Impact:** Emergency orders are treated identically to normal orders, defeating the high-urgency flow.
**Severity:** 🔴 HIGH — Missing feature, potential safety/trust issue.

### B5 — No `budget` field in Order model
**File:** [`prisma/schema.prisma:441-494`](prisma/schema.prisma:441)
**Spec:** Phase 1 — Client Intent Capture includes budget/price range.
**Code:** The `Order` model has no `budget` or `budgetMin`/`budgetMax` fields. The `answers` JSON field may contain budget info, but it's not structured.
**Impact:** Matching engine cannot filter by budget. No budget-based scoring.
**Severity:** 🟡 MEDIUM — Missing structured data.

### B6 — `entryPoint` enum missing `wizard`, `reorder`, `guest`
**File:** [`prisma/schema.prisma:87-91`](prisma/schema.prisma:87)
**Spec:** Phase 1 — Entry points: `explorer`, `ai_suggestion`, `direct`, `wizard`, `reorder`, `guest`
**Code:** [`OrderEntryPoint`](prisma/schema.prisma:87) enum only has `explorer`, `ai_suggestion`, `direct`. Missing `wizard`, `reorder`, `guest`.
**Impact:** Cannot distinguish wizard-guided orders, reorders, or guest checkout orders.
**Severity:** 🟡 MEDIUM — Missing analytics/tracking capability.

### B7 — `BookingMode` enum missing `hybrid`, `quote_first`, `walk_in`
**File:** [`prisma/schema.prisma:93-97`](prisma/schema.prisma:93)
**Spec:** Part 6 — 5 execution modes: Auto-Appointment, Negotiation, Hybrid, Quote-First, Walk-In
**Code:** [`BookingMode`](prisma/schema.prisma:93) enum only has `auto_appointment`, `negotiation`, `inherit_from_catalog`. Missing `hybrid`, `quote_first`, `walk_in`.
**Impact:** Only 2 of 5 execution modes are supported. Hybrid, Quote-First, and Walk-In flows cannot be configured.
**Severity:** 🔴 HIGH — 60% of execution modes missing.

### B8 — `resolveEffectiveBookingMode()` only handles 2 modes
**File:** [`lib/matching/eligibility.ts:80-91`](lib/matching/eligibility.ts:80)
**Spec:** 5 execution modes
**Code:** [`resolveEffectiveBookingMode()`](lib/matching/eligibility.ts:80) only resolves to `'auto_appointment'` or `'negotiation'`. No support for `hybrid`, `quote_first`, `walk_in`.
**Impact:** Matching engine cannot handle non-standard booking modes.
**Severity:** 🔴 HIGH — Matching broken for 3 of 5 modes.

---

## 🟠 GAPS (Missing Features vs Spec)

### G1 — No Smart Scheduling Engine
**Spec:** Phase 4 — Capacity Validation: Redis atomic Lua scripts for race condition prevention, real-time slot locking, waitlist management.
**Code:** No Redis-based capacity validation exists. No slot locking, no waitlist. The `scheduledAt` field exists on Order but there's no validation that the slot is available.
**Files:** [`routes/orders.ts`](routes/orders.ts), [`prisma/schema.prisma:452`](prisma/schema.prisma:452)
**Severity:** 🔴 HIGH — Double-booking possible.

### G2 — No Quote-First Flow (Mode 4)
**Spec:** Part 6.6 — Quote-First flow: customer describes job → providers submit quotes → customer picks quote → order created.
**Code:** No quote-first endpoints exist. The `Quote` model exists in Prisma but is not wired to any order flow.
**Files:** [`prisma/schema.prisma:487`](prisma/schema.prisma:487) (Quote model exists but unused)
**Severity:** 🔴 HIGH — Missing entire execution mode.

### G3 — No Walk-In Flow (Mode 5)
**Spec:** Part 6.1 — Walk-In: no pre-booking, customer walks in, order created on-site with minimal data.
**Code:** No walk-in endpoint exists. No `walk_in` entry point or booking mode.
**Severity:** 🟡 MEDIUM — Missing execution mode.

### G4 — No Provider Counter-Offer
**Spec:** Part 6.9 — Provider can send a counter-offer (different price, time, scope) which customer can accept/reject/counter.
**Code:** No counter-offer endpoint exists. No counter-offer model or flow.
**Severity:** 🟡 MEDIUM — Missing negotiation feature.

### G5 — No Reorder Flow
**Spec:** Part 6.7 — Reorder: customer can quickly re-order from a previously matched provider with pre-filled data.
**Code:** No reorder endpoint exists. No `reorder` entry point.
**Severity:** 🟡 MEDIUM — Missing UX optimization.

### G6 — No Multi-Session/Multi-Day Order Structure
**Spec:** Part 6.3 — Orders can span multiple sessions/days with individual scheduling.
**Code:** No multi-session model. `JobRecord` is a single record with no session children.
**Files:** [`prisma/schema.prisma:496-517`](prisma/schema.prisma:496)
**Severity:** 🟡 MEDIUM — Cannot handle multi-day services.

### G7 — No Group Service Session Management
**Spec:** Part 6.4 — Group services (yoga class, workshop) with capacity limits and attendee management.
**Code:** No group service model. No attendee tracking.
**Severity:** 🟡 MEDIUM — Missing service type.

### G8 — No Inventory-Linked Service BOM
**Spec:** Part 6.5 — Services that consume inventory (materials, parts) with BOM tracking.
**Code:** No inventory/BOM model linked to orders.
**Severity:** 🟡 MEDIUM — Missing service type.

### G9 — No Escrow Payment System
**Spec:** Phase 8 — Payment Model B (Deposit + Balance): deposit held in escrow, balance released on completion.
**Code:** [`routes/orderPayments.ts`](routes/orderPayments.ts) implements only a mock payment flow with no escrow. [`lib/orderPayments.ts`](lib/orderPayments.ts) has no escrow logic.
**Severity:** 🔴 HIGH — Cannot handle deposit-based services.

### G10 — No Commission/Deduction Logic
**Spec:** Phase 8 — Platform commission deducted from payments.
**Code:** No commission calculation exists. No platform fee model.
**Severity:** 🟡 MEDIUM — Missing monetization.

### G11 — No Auto-Release of Funds After 48h
**Spec:** Phase 9 — If customer doesn't dispute within 48h of completion, funds auto-release to provider.
**Code:** No cron job or scheduled task for auto-release.
**Severity:** 🟡 MEDIUM — Missing trust/safety feature.

### G12 — No Recurring/Subscription Payment Model
**Spec:** Phase 8 — Model D: Recurring/Subscription payments.
**Code:** No subscription model, no recurring billing.
**Severity:** 🟡 MEDIUM — Missing payment model.

### G13 — Missing NATS Notification Handlers
**Spec:** Part 10 — Real-time notifications for: order submitted, matched, counter-offer received, quote received, invite expiring, contract sent, contract approved/rejected, payment received, job started, job completed, dispute filed, dispute resolved.
**Code:** [`lib/bus.ts:78-80`](lib/bus.ts:78) only subscribes to 3 subjects: `orders.matched`, `orders.completed`, `contracts.approved`. Missing ~10+ notification types.
**Files:** [`lib/orderLifecycleNotifications.ts`](lib/orderLifecycleNotifications.ts) only has 3 handlers.
**Severity:** 🟡 MEDIUM — Poor user experience, missing push notifications.

### G14 — No Matching Window Expiry Cron
**Spec:** Phase 3 — Path B: matching window expires after N hours, order falls back.
**Code:** [`lib/matching/roundRobin.ts:207-247`](lib/matching/roundRobin.ts:207) has `expireStaleAttempts()` but no cron/scheduler calls it. It's never invoked automatically.
**Severity:** 🟡 MEDIUM — Stale matches never expire without manual trigger.

### G15 — No Capacity Validation Before Match
**Spec:** Phase 4 — Capacity validation before dispatch: check provider availability, slot locking.
**Code:** No capacity check in [`autoMatchOffer()`](lib/matching/orchestrator.ts:31) or [`roundRobinInviteOffer()`](lib/matching/roundRobin.ts:48). Provider is matched regardless of availability.
**Severity:** 🔴 HIGH — Provider can be matched while unavailable.

### G16 — No `POST /orders/:id/select-provider` for Negotiation Mode
**Spec:** Phase 3 — Path B: customer selects a provider from the invited pool.
**Code:** [`routes/orders.ts:1526-1642`](routes/orders.ts:1526) has `POST /:id/select-provider` but it only handles the selection flow, not the full negotiation acceptance (no counter-offer handling, no price negotiation).
**Severity:** 🟡 MEDIUM — Partial implementation.

### G17 — No Guest Checkout Flow
**Spec:** Phase 1 — Guest users can create orders without registration.
**Code:** No guest checkout. All orders require authenticated user (`customerId` is required in Order model).
**Severity:** 🟡 MEDIUM — Missing acquisition funnel.

### G18 — No `POST /orders/:id/accept-invite` for Providers
**Spec:** Phase 3 — Path B: provider accepts/declines invitation.
**Code:** No explicit accept/decline endpoint for providers in [`routes/orders.ts`](routes/orders.ts). The `select-provider` endpoint is customer-side only.
**Severity:** 🟡 MEDIUM — Providers cannot formally accept/decline.

### G19 — No Staff Assignment Validation
**Spec:** Part 14 — Staff identity and safety rules: assigned staff must be verified.
**Code:** [`routes/orders.ts:1745-1830`](routes/orders.ts:1745) has `PUT /:id/assign-staff` but no validation that the staff belongs to the matched workspace or is verified.
**Severity:** 🟡 MEDIUM — Security gap.

### G20 — No Anti-Circumvention Protocol Implementation
**Spec:** Part 13 — Anti-circumvention: detect off-platform contact attempts, flag suspicious patterns.
**Code:** [`routes/orderChat.ts:210-313`](routes/orderChat.ts:210) has PII moderation (phone, email masking) but no anti-circumvention scoring, no pattern detection, no automated blocking beyond 3+ masked messages in 24h.
**Severity:** 🟡 MEDIUM — Partial implementation.

---

## 🔵 MINOR ISSUES & TECHNICAL DEBT

### M1 — `phaseFromStatus()` returns `null` for `draft`
**File:** [`lib/orderPhase.ts:7-27`](lib/orderPhase.ts:7)
**Issue:** Draft orders have `phase: null`. This means phase-based filtering excludes drafts unless explicitly handled.
**Impact:** Queries using phase filtering may silently exclude drafts.

### M2 — `orderToCustomerJson()` doesn't include `phase`
**File:** [`routes/orders.ts:148-222`](routes/orders.ts:148)
**Issue:** The serialization function doesn't include the `phase` field in the response.
**Impact:** Frontend cannot easily determine the current phase without computing it from status.

### M3 — Mock Payment Implementation
**File:** [`routes/orderPayments.ts`](routes/orderPayments.ts)
**Issue:** Payment is fully mocked — no real payment gateway, no webhook handling, no refund flow.
**Impact:** Cannot process real payments. Fine for development but needs integration.

### M4 — No `POST /orders/:id/rate-provider` Endpoint
**Spec:** Phase 10 — Completion and Review includes provider rating.
**Code:** [`routes/orders.ts:1143-1267`](routes/orders.ts:1143) has `POST /:id/review` but it's a combined review endpoint. No separate provider rating endpoint exists.
**Impact:** No two-way rating system (customer rates provider, provider rates customer).

### M5 — No Dispute Resolution Workflow
**Spec:** Part 12 — Failed Order Handling: dispute resolution with admin mediation.
**Code:** [`routes/orders.ts:1644-1694`](routes/orders.ts:1644) has `POST /:id/dispute` which simply sets status to `disputed`. No resolution workflow, no admin review, no refund decision.
**Impact:** Disputes are dead-end states with no resolution path.

---

## 📋 ACTION ITEMS — What Work Needs to Be Done

### Phase: Critical Fixes (Do First)

| # | Priority | Item | Files |
|---|----------|------|-------|
| A1 | 🔴 CRITICAL | Fix `/complete` to enforce `paid → in_progress → completed` state machine | [`routes/orders.ts:1060`](routes/orders.ts:1060) |
| A2 | 🔴 CRITICAL | Add cancellation support for `matched`, `contracted`, `paid` states with refund rules | [`routes/orders.ts:1696`](routes/orders.ts:1696) |
| A3 | 🔴 CRITICAL | Add `urgency` field to Order model + handle in submit flow | [`prisma/schema.prisma:441`](prisma/schema.prisma:441), [`routes/orders.ts:247`](routes/orders.ts:247) |
| A4 | 🔴 CRITICAL | Add capacity validation before match (Redis slot locking) | [`lib/matching/orchestrator.ts`](lib/matching/orchestrator.ts), [`lib/matching/roundRobin.ts`](lib/matching/roundRobin.ts) |
| A5 | 🔴 CRITICAL | Implement escrow payment system for deposit-based services | [`routes/orderPayments.ts`](routes/orderPayments.ts), [`lib/orderPayments.ts`](lib/orderPayments.ts) |

### Phase: Execution Modes

| # | Priority | Item | Files |
|---|----------|------|-------|
| A6 | 🟠 HIGH | Add `hybrid`, `quote_first`, `walk_in` to `BookingMode` enum | [`prisma/schema.prisma:93`](prisma/schema.prisma:93) |
| A7 | 🟠 HIGH | Implement Quote-First flow (Mode 4) — quote submission, selection, order creation | New routes + [`prisma/schema.prisma:487`](prisma/schema.prisma:487) |
| A8 | 🟠 HIGH | Implement Walk-In flow (Mode 5) — minimal order creation on-site | New route |
| A9 | 🟠 HIGH | Update `resolveEffectiveBookingMode()` to handle all 5 modes | [`lib/matching/eligibility.ts:80`](lib/matching/eligibility.ts:80) |
| A10 | 🟠 HIGH | Add Provider Counter-Offer endpoint + flow | New route + model |

### Phase: Order Model & Validation

| # | Priority | Item | Files |
|---|----------|------|-------|
| A11 | 🟡 MEDIUM | Add `budget` (budgetMin/budgetMax) to Order model | [`prisma/schema.prisma:441`](prisma/schema.prisma:441) |
| A12 | 🟡 MEDIUM | Add `wizard`, `reorder`, `guest` to `OrderEntryPoint` enum | [`prisma/schema.prisma:87`](prisma/schema.prisma:87) |
| A13 | 🟡 MEDIUM | Fix description validation to 20 chars minimum | [`routes/orders.ts:551`](routes/orders.ts:551) |
| A14 | 🟡 MEDIUM | Add Reorder flow endpoint | New route |

### Phase: Notifications & Scheduling

| # | Priority | Item | Files |
|---|----------|------|-------|
| A15 | 🟡 MEDIUM | Add NATS handlers for all notification types (counter-offer, quote, invite expiry, dispute, etc.) | [`lib/bus.ts`](lib/bus.ts), [`lib/orderLifecycleNotifications.ts`](lib/orderLifecycleNotifications.ts) |
| A16 | 🟡 MEDIUM | Implement cron/scheduler for matching window expiry | [`lib/matching/roundRobin.ts:207`](lib/matching/roundRobin.ts:207) |
| A17 | 🟡 MEDIUM | Implement auto-release cron (48h after completion) | New cron job |

### Phase: Advanced Features

| # | Priority | Item | Files |
|---|----------|------|-------|
| A18 | 🟡 MEDIUM | Implement Multi-Session/Multi-Day order structure | [`prisma/schema.prisma:496`](prisma/schema.prisma:496) |
| A19 | 🟡 MEDIUM | Implement Group Service session management | New model |
| A20 | 🟡 MEDIUM | Implement Inventory-Linked BOM | New model |
| A21 | 🟡 MEDIUM | Add commission/deduction logic | [`lib/orderPayments.ts`](lib/orderPayments.ts) |
| A22 | 🟡 MEDIUM | Add Recurring/Subscription payment model | New routes + model |
| A23 | 🟡 MEDIUM | Implement Guest Checkout flow | [`routes/orders.ts`](routes/orders.ts) |
| A24 | 🟡 MEDIUM | Add Provider accept/decline invite endpoint | New route |
| A25 | 🟡 MEDIUM | Add staff assignment validation (verify staff belongs to matched workspace) | [`routes/orders.ts:1745`](routes/orders.ts:1745) |
| A26 | 🟡 MEDIUM | Enhance anti-circumvention with scoring + pattern detection | [`routes/orderChat.ts:210`](routes/orderChat.ts:210) |
| A27 | 🟡 MEDIUM | Implement dispute resolution workflow (admin mediation) | [`routes/orders.ts:1644`](routes/orders.ts:1644) |

### Phase: Polish & Technical Debt

| # | Priority | Item | Files |
|---|----------|------|-------|
| A28 | 🟢 LOW | Include `phase` in `orderToCustomerJson()` response | [`routes/orders.ts:148`](routes/orders.ts:148) |
| A29 | 🟢 LOW | Integrate real payment gateway (Stripe/PayPal) | [`routes/orderPayments.ts`](routes/orderPayments.ts) |
| A30 | 🟢 LOW | Add two-way rating (provider rates customer) | [`routes/orders.ts:1143`](routes/orders.ts:1143) |

---

## 📊 SUMMARY

| Category | Count | Details |
|----------|-------|---------|
| 🔴 Bugs (High) | 5 | B1 ✅, B2 ✅, B4 ✅, B7 ✅, B8 ✅ |
| 🟠 Bugs (Medium) | 3 | B3, B5 ✅, B6 ✅ |
| 🔴 Gaps (High) | 4 | G1 ✅, G2 ✅, G9 ✅, G15 ✅ |
| 🟠 Gaps (Medium) | 16 | G3 ✅, G4 ✅, G5 ✅, G6, G7, G8, G10, G11, G12, G13 ✅, G14 ✅, G15 ✅, G16 ✅, G17-G20 |
| 🔵 Minor Issues | 5 | M1-M5 |
| **Total Issues** | **33** | (17 resolved, 16 open) |
| **Action Items** | **30** | A1-A30 |

### Key Findings (Updated 2026-05-26)

1. **State machine is broken**: The `contracted → completed` direct transition (B1) means payment is never enforced. This is the most critical bug. **→ RESOLVED ✅**

2. **Only 2 of 5 execution modes implemented**: Auto-Appointment and Negotiation work. Hybrid, Quote-First, and Walk-In are completely missing (B7, B8, G2, G3). **→ Partially resolved (ADR-0065 walk-in, ADR-0068 booking modes) ✅**

3. **No capacity validation**: Providers can be matched while unavailable (G15). No Redis slot locking exists (G1). **→ RESOLVED ✅**

4. **No real payment system**: Mock payments only (G9). No escrow, no commission, no auto-release. **→ RESOLVED ✅ (ADR-0063 escrow, auto-release)**

5. **No urgency/emergency flow**: Emergency orders are treated as normal (B4). **→ RESOLVED ✅**

6. **Limited cancellation**: Cannot cancel after matching (B2). **→ RESOLVED ✅**

7. **Missing notification ecosystem**: Only 3 of ~13+ NATS subjects are consumed (G13). **→ RESOLVED ✅ (ADR-0066, lifecycle notifications)**
