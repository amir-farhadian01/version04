# Architecture Decision Record

## ADR-0065 — Walk-In Booking Mode

**Status:** Accepted
**Date:** 2026-05-26
**Author:** AI Agent (Orchestrator)

### Context

The platform supports multiple booking modes — `booking` (standard matching), `direct_booking` (auto-appointment), `hybrid`, and `quote_first` (G2). However, there was no mechanism for **walk-in** scenarios where a customer physically arrives at a provider's location and needs immediate service without going through the matching/negotiation pipeline.

Key requirements for the walk-in flow:

1. **Skip matching entirely** — No `submitted → matching → matched` state transitions. The order should go directly to `contracted` status upon creation.
2. **Immediate service** — The `scheduledAt` is set to the current timestamp (now), reflecting that the customer is present and ready for service.
3. **Provider/service validation** — The endpoint must verify the provider exists and is active, the service catalog is active, and the provider offers the requested service via an active `ProviderServicePackage`.
4. **Capacity validation** — The provider's `maxDailyBookings` must not be exceeded for the current day, preventing overbooking.
5. **Contract auto-creation** — Since the order skips directly to `contracted`, a contract must be created automatically as part of the order creation transaction.
6. **NATS events** — Both `order.created` and `order.contracted` events must be published to enable real-time notifications.

### Decision

Add `POST /orders/walk-in` endpoint that creates orders directly in `contracted` status, bypassing the entire matching/negotiation lifecycle. The endpoint performs Zod validation, provider/service/capacity checks, and auto-creates a contract within a single Prisma transaction.

### Key Design Choices

1. **Zod validation schema** ([`routes/orders.ts:58-65`](routes/orders.ts:58)) — `walkInOrderSchema` validates `providerId` (UUID), `serviceCatalogId` (UUID), `packageId` (UUID, optional), `description` (min 20 chars), `addressId` (UUID), and `urgency` (defaults to `standard`). All required fields are validated before any database operations.

2. **Direct `contracted` status** ([`routes/orders.ts:786-787`](routes/orders.ts:786)) — The order is created with `status: OrderStatus.contracted` and `phase: phaseFromStatus(OrderStatus.contracted)`, skipping the normal `draft → submitted → matching → matched → contracted` pipeline. This is the defining characteristic of the walk-in flow.

3. **Provider validation** ([`routes/orders.ts:700-710`](routes/orders.ts:700)) — The provider must exist (`404` if not found) and have `status: 'active'` (`400` if inactive). This prevents walk-in bookings for deactivated or suspended providers.

4. **Service catalog validation** ([`routes/orders.ts:712-722`](routes/orders.ts:712)) — The service catalog must exist (`404` if not found) and have `isActive: true` (`400` if inactive). This ensures the service is currently offered on the platform.

5. **Package validation** ([`routes/orders.ts:724-755`](routes/orders.ts:724)) — The endpoint queries `ProviderServicePackage` with `providerId`, `serviceCatalogId`, and `isActive: true`. If `packageId` is provided, it filters to that specific package. Returns `400` with a descriptive error if no active package is found.

6. **Capacity check** ([`routes/orders.ts:757-768`](routes/orders.ts:757)) — Uses [`checkPackageCapacity`](lib/orderCapacity.ts:77) from the existing capacity module (ADR-0061) with `scheduledAt` set to `new Date()` (immediate). Returns `409` with `CAPACITY_EXCEEDED` code if the provider has reached their `maxDailyBookings` limit for today.

7. **Atomic transaction** ([`routes/orders.ts:771-838`](routes/orders.ts:771)) — The entire order creation, contract creation, contract version creation, contract event logging, and audit logging happen within a single `prisma.$transaction()`. This ensures atomicity — if any step fails, the entire operation rolls back.

8. **Contract auto-creation** ([`routes/orders.ts:796-826`](routes/orders.ts:796)) — Since the order goes directly to `contracted`, a contract is mandatory. The transaction creates:
   - `OrderContract` linked to the order
   - `ContractVersion` (version 1, status `draft`, title `Walk-in service — {serviceCatalogId}`)
   - `ContractEvent` with `admin_internal_note` action recording the auto-creation
   - Updates `OrderContract.currentVersionId` to point at the new version

9. **NATS events** ([`routes/orders.ts:840-854`](routes/orders.ts:840)) — Two events are published outside the transaction (NATS is non-fatal):
   - `order.created` — includes `bookingMode: 'walk_in'` for downstream consumers
   - `order.contracted` — signals that the order is immediately ready for service

10. **Response includes full order data** ([`routes/orders.ts:856-869`](routes/orders.ts:856)) — After creation, the endpoint fetches the order with `matchedProvider`, `matchedWorkspace`, and `matchedPackage` relations, returning a complete `orderToCustomerJson` response with status `201`.

11. **Authentication required** ([`routes/orders.ts:684`](routes/orders.ts:684)) — The endpoint is behind `router.use(authenticate)`, ensuring only authenticated users can create walk-in orders. The `userId` from the JWT token is used as the `customerId`.

### Consequences

**Positive:**
- ✅ Immediate service without matching delay — customers physically present can be served instantly
- ✅ Capacity validation prevents overbooking — providers cannot exceed `maxDailyBookings` for walk-ins
- ✅ Contract auto-creation ensures legal coverage for every walk-in order
- ✅ NATS events (`order.created`, `order.contracted`) enable real-time notifications and downstream processing
- ✅ Atomic transaction guarantees data consistency across order, contract, and audit log
- ✅ Zod validation provides structured error responses for malformed requests
- ✅ Provider/service/package validation prevents invalid bookings
- ✅ 7 tests covering all validation edge cases (63 total, all passing)

**Negative:**
- ❌ No business hours validation — walk-in orders can be created at any time, even outside the provider's operating hours
- ❌ No guest checkout support — the endpoint requires authentication, so walk-in customers without an account cannot create orders directly
- ❌ No matching/negotiation phase means the customer cannot compare multiple providers or negotiate pricing
- ❌ Contract is auto-created with empty `termsMarkdown` — providers must manually update contract terms after creation
- ❌ `scheduledAt` is set to `new Date()` at creation time, not reflecting the actual walk-in time if there's a queue delay

### Files

- [`routes/orders.ts:58-65`](routes/orders.ts:58) — `walkInOrderSchema` Zod validation schema
- [`routes/orders.ts:686-874`](routes/orders.ts:686) — `POST /orders/walk-in` endpoint handler
- [`routes/orders.ts:771-838`](routes/orders.ts:771) — Atomic transaction creating order + contract + audit log
- [`routes/orders.ts:840-854`](routes/orders.ts:840) — NATS event publishing (`order.created`, `order.contracted`)
- [`routes/orders.ts:856-869`](routes/orders.ts:856) — Response serialization with related entities
- [`lib/orderCapacity.ts:77`](lib/orderCapacity.ts:77) — `checkPackageCapacity` used for capacity validation
- [`routes/orders.test.ts:858-1042`](routes/orders.test.ts:858) — `simulateWalkInOrder` test helper
- [`routes/orders.test.ts:1044-1162`](routes/orders.test.ts:1044) — 7 walk-in tests covering all edge cases
