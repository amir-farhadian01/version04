# ADR-0083: Delivery and driver operations foundation

- Status: Accepted
- Date: 2026-09-11

## Context

Neighborly orders, jobs, staff scheduling, payments, and audit records already exist, but they do not model delivery consent or delivery execution. Reusing `Order.status`, `JobRecord`, `Payment`, or `Order.assignedStaffId` would couple delivery to service delivery and payment settlement, make driver consent ambiguous, and risk changing escrow or provider payout behavior.

The existing `Schedule` model is suitable for time windows if delivery windows are explicitly separated from legacy service-booking windows. `StaffSlotBlock` can reserve accepted planned work across workspaces, but its table and the `subcontractor_assignments` table are present in the Prisma schema without normal migration-history coverage.

Phase 1 must be safe to deploy while disabled, preserve tenant boundaries, and avoid customer contact disclosure. It must also leave a narrow provider seam for a future freight or transport company without pretending that a carrier integration, fleet, or carrier marketplace exists.

## Decision

### Aggregate boundaries

- Add a default-false `Company.deliveryOperationsEnabled` capability.
- Add `SchedulePurpose.service | delivery`; existing rows default to `service`, and legacy booking queries filter explicitly to `service`.
- Model an existing workspace principal as a `BusinessDriver`; no new account and no global driver role are created.
- Keep `DriverEngagementType.hourly | long_term` independent from relationship status, availability mode, presence, and assignment state.
- Store compensation proposals as immutable `DriverCompensationTermVersion` rows. Every initial term and revision requires driver acceptance. The last accepted version remains effective until a replacement is accepted.
- Create exactly one `Fulfillment` per `Order`, owned by `Order.matchedWorkspaceId`.
- Store every dispatch attempt as a durable `DeliveryAssignment`. A manager can offer or replace work, but only the driver can accept it.

### State and concurrency

Fulfillment states are:

`unassigned -> assigned -> accepted -> picked_up -> in_transit -> delivered`

Rejection returns a fulfillment to `unassigned`. `failed`, `cancelled`, `unable_to_deliver`, and `delivered` are terminal. Before pickup, a manager may replace an offered or accepted assignment with a required bounded reason; the old attempt becomes `revoked`.

Commands run in serializable transactions with a maximum of three retries for retryable Prisma conflicts. `BusinessDriver`, `Fulfillment`, and `DeliveryAssignment` carry optimistic versions. A conditional update that affects zero rows returns `VERSION_CONFLICT`; duplicate or stale commands never silently succeed.

Accepted planned assignments reserve a `StaffSlotBlock`. Rejection, revocation, cancellation, failure, inability to deliver, or completion releases the reservation while assignment and audit history remain durable.

### Eligibility and privacy

The driver candidate must be the company owner or a current `CompanyUser`. Assignment and acceptance both verify an active relationship, an active user, a profile photo, an approved personal KYC submission, an accepted compensation version, delivery-schedule coverage for scheduled drivers, and no overlapping cross-workspace slot block.

Managers are limited to the company owner or a `CompanyUser` whose workspace role is `owner` or `admin`. Global support and finance roles receive no implicit access. Driver-self operations are limited to `BusinessDriver.userId === authenticated userId`. Foreign nested identifiers return a generic 404.

Pickup and drop-off are immutable versioned address snapshots containing only static address fields and optional coordinates. Customer phone and email are neither stored in the snapshots nor selected into delivery payloads. Before assignment acceptance, a driver sees only city and province when present. Precise snapshots are serialized only after acceptance.

### Provider seam

`FulfillmentProviderKind` reserves `internal_driver | external_carrier`, while the Phase 1 provider registry contains only the `internal` key. API attempts to use any other provider return `PROVIDER_NOT_SUPPORTED`. This is the only freight/transport extension point in Phase 1.

### Non-goals and isolation

Delivery completion does not update the order, job, payment, escrow-release schedule, Stripe objects, transactions, or provider payout state. Earnings calculation, payroll, tax, classification, GPS, proof of delivery, customer tracking, route optimization, fleet/vehicle management, external carriers, and Flutter UI are deferred.

Audit and optional NATS events contain identifiers, states, actors, versions, and timestamps only. They do not contain addresses or compensation components.

## Alternatives considered

1. Reuse `Order.status` and `assignedStaffId`. Rejected because service/job state and delivery state have different actors, consent, retries, privacy, and terminal outcomes.
2. Add a global driver role or separate driver account. Rejected because a driver is a workspace relationship for an existing principal and may belong to multiple workspaces.
3. Let managers auto-accept assignments. Rejected because it removes consent and would disclose precise addresses before the driver acts.
4. Create a new availability calendar. Rejected for Phase 1 because purpose-tagged `Schedule` windows plus shared slot blocks provide the required semantics with less duplication.
5. Build carrier/fleet abstractions now. Rejected as speculative scope; only a provider-kind/key seam is retained.

## Migration and rollback boundaries

The legacy reconciliation migration creates `staff_slot_blocks` and `subcontractor_assignments` only when absent. If either exists, it verifies required columns and compatible types and aborts on an incompatible shape. It never drops, renames, coerces, or rewrites data.

The delivery migration only adds enums, columns, tables, constraints, and indexes. No workspace is enabled automatically. Application rollback consists of unmounting the new routers and leaving the capability false. Database rollback is deliberately non-destructive: retain the new tables and columns until a separately reviewed archival/removal migration is approved. Neither migration may be applied to staging, production, or any real-data database as part of this milestone.

## Consequences

Delivery commands are auditable and isolated from commerce settlement. Explicit acceptance and redaction are enforceable at one service boundary. The cost is additional state-machine and concurrency code, and future external-carrier work must define its own consent, organization, fleet, regulatory, and privacy model rather than extending the internal driver implementation by assumption.
