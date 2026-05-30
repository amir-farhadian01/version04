# Glossary (domain nouns)

Alphabetical short definitions grounded in this repo's code and docs.
Each entry includes a definition, example, cross-references to related terms,
relevant ADR(s), and source file(s).

---

### Admin
**Definition:** A `User` with role `platform_admin`, `support`, or `finance` who accesses the admin dashboard at `/api/admin/*` endpoints. Admins manage users, KYC submissions, orders, contracts, payments, and system configuration.
**Example:** An admin reviews a flagged KYC personal submission via [`AdminKyc.tsx`](frontend/src/pages/admin/AdminKyc.tsx) and approves it, which triggers a NATS `kyc.personal.submitted` event.
**See also:** [`User`](#user), [`UserRole`](#userrole), [`AuditLog`](#auditlog)
**ADR:** [`ADR-0002`](docs/DECISIONS.md) — Admin endpoints under `/api/admin/*` with `isAdmin` middleware
**Source:** [`routes/admin.ts`](routes/admin.ts) — Admin route definitions

---

### AuditLog
**Definition:** Prisma model storing `action`, `resourceType`, `resourceId`, optional `metadata` JSON for compliance review. Every state-changing operation in the admin panel writes an audit trail row.
**Example:** When an admin changes a user's role from `customer` to `provider`, an `AuditLog` row is created with `action: "role_change"`, `resourceType: "User"`, `resourceId: user.id`, and `metadata: { from: "customer", to: "provider" }`.
**See also:** [`User`](#user), [`Admin`](#admin), [`KycReviewAuditLog`](#kycreviewauditlog)
**ADR:** [`ADR-0034`](docs/DECISIONS.md) — Cancelled rows keep last non-draft `phase` (uses AuditLog metadata)
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:632) — Model definition

---

### Auto-appointment
**Definition:** A `BookingMode` where matching runs synchronously on order submission, instantly pairing the customer with the best eligible provider without negotiation. The `autoMatchOffer` function runs inline in `POST /api/orders/draft/:id/submit`.
**Example:** A customer submits a plumbing order; the system immediately finds an eligible provider and sets `Order.status` to `matched` with `Order.phase` set to `order`.
**See also:** [`BookingMode`](#bookingmode), [`OfferMatchAttempt`](#offermatchattempt), [`Round-robin pool`](#round-robin-pool)
**ADR:** [`ADR-0036`](docs/DECISIONS.md) — Auto-appointment matching runs synchronously on submit
**Source:** [`lib/matching/orchestrator.ts`](lib/matching/orchestrator.ts) — Matching orchestration

---

### Auto-book
**Definition:** Planned matching mode (F6); not implemented in source as of roadmap pass. Intended to automatically assign providers to requests without manual intervention.
**Example:** A future flow where a recurring cleaning service is auto-booked every two weeks without customer re-submission.
**See also:** [`Match`](#match), [`Round-robin pool`](#round-robin-pool)
**ADR:** [`ADR-0007`](docs/DECISIONS.md) — Placeholder for order routing
**Source:** [`docs/ROADMAP.md`](docs/ROADMAP.md) — Roadmap reference

---

### B2BConnection
**Definition:** Prisma model linking two `Company` records as business-to-business partners (contractor/subcontractor). Stores `type` (contractor, subcontractor), `specialPrice`, and `status`.
**Example:** Company A (a general contractor) creates a B2BConnection with Company B (an electrician) as a subcontractor with a special negotiated rate.
**See also:** [`Company`](#company), [`Workspace`](#workspace)
**ADR:** Not yet covered by an ADR
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:668) — Model definition

---

### BillOfMaterials (BOM)
**Definition:** The set of `ProductInPackage` rows linked to a `ProviderServicePackage`. Each line snapshots the product name, unit price, currency, and unit at the time of linking (see ADR-0029). Cost/margin is computed on read via `computePackageMargin`.
**Example:** A "House Painting" package BOM includes 10L of paint (snapshot $40/L), 2 rolls of tape ($5/roll), and 3 hours of labor ($50/hour).
**See also:** [`ProviderServicePackage`](#providerservicepackage), [`ProductInPackage`](#productinpackage), [`Product`](#product)
**ADR:** [`ADR-0029`](docs/DECISIONS.md) — BOM snapshots are frozen at link time; [`ADR-0030`](docs/DECISIONS.md) — Cost/margin computed on read
**Source:** [`lib/packageMargin.ts`](lib/packageMargin.ts) — Margin computation

---

### BookingMode
**Definition:** Enum (`auto_appointment`, `negotiation`, `inherit_from_catalog`) controlling how an order for a `ProviderServicePackage` is matched. `auto_appointment` triggers synchronous matching; `negotiation` uses round-robin invites; `inherit_from_catalog` defers to the `ServiceCatalog.lockedBookingMode`.
**Example:** A package with `bookingMode: "negotiation"` will create `OfferMatchAttempt` rows in `invited` status and wait for the customer to pick a provider.
**See also:** [`ProviderServicePackage`](#providerservicepackage), [`ServiceCatalog`](#servicecatalog), [`OfferMatchAttempt`](#offermatchattempt)
**ADR:** [`ADR-0027`](docs/DECISIONS.md) — `lockedBookingMode` overrides explicit package mode; [`ADR-0028`](docs/DECISIONS.md) — Effective booking label
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:93) — Enum definition

---

### Bulletin
**Definition:** Planned weekly market digest (F10); not present in schema. Intended to aggregate trending services, provider highlights, and local demand patterns.
**Example:** A weekly email to providers showing "Top 5 most-requested services in your area this week."
**See also:** [`Feed`](#feed), [`Post`](#post)
**ADR:** Not yet covered by an ADR
**Source:** [`docs/ROADMAP.md`](docs/ROADMAP.md) — Roadmap reference

---

### BusinessKycFormSchema
**Definition:** Versioned JSON form definition (`version Int @unique`) driving provider business KYC. Each version is immutable once published; submissions reference the `schemaVersion` they were created against.
**Example:** Version 1 defines fields for business name, license number, insurance details; Version 2 adds a field for tax ID. A submission using Version 1 retains the original schema shape.
**See also:** [`BusinessKycSubmission`](#businesskycsubmission), [`KYC L0 / L1 / L2`](#kyc-l0--l1--l2)
**ADR:** [`ADR-0004`](docs/DECISIONS.md) — BusinessKycFormSchema is versioned
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:822) — Model definition

---

### BusinessKycSubmission
**Definition:** Prisma model holding a provider's business KYC answers (`answers Json`, `uploads Json`) linked to a specific `BusinessKycFormSchema` version. Includes `inquiryResults`, `expiryFlags`, and standard `KycStatus` workflow.
**Example:** A plumbing company submits their business license and insurance documents via the KYC form; an admin reviews and sets status to `approved`.
**See also:** [`BusinessKycFormSchema`](#businesskycformschema), [`KycStatus`](#kycstatus), [`KycReviewAuditLog`](#kycreviewauditlog)
**ADR:** [`ADR-0003`](docs/DECISIONS.md) — KYC has 3 levels; [`ADR-0004`](docs/DECISIONS.md) — Versioned schemas
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:834) — Model definition

---

### BusinessTrustScore
**Definition:** Prisma model storing a workspace's aggregated trust metrics: `kycVerified`, `licenseVerified`, `insuranceVerified`, `avgRating`, and computed `totalScore`. Used for provider ranking and eligibility in matching.
**Example:** A provider with KYC approved, license verified, and 4.8 avg rating has `totalScore: 98`, making them highly eligible for matching.
**See also:** [`BusinessVerification`](#businessverification), [`Company`](#company), [`OfferMatchAttempt`](#offermatchattempt)
**ADR:** Not yet covered by an ADR
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:962) — Model definition

---

### BusinessVerification
**Definition:** Prisma model tracking a workspace's license and insurance verification status. Stores document URLs, verification timestamps, and admin reviewer ID.
**Example:** An admin uploads a verified license document for a workspace, setting `licenseVerifiedAt` and `verifiedByAdminId`.
**See also:** [`BusinessTrustScore`](#businesstrustscore), [`Company`](#company), [`KYC L0 / L1 / L2`](#kyc-l0--l1--l2)
**ADR:** Not yet covered by an ADR
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:947) — Model definition

### Business Client
**Definition:** A **Client** who has upgraded their account through business KYC and gained access to a **Business Workspace** within the Client App/Web surface. Business Clients can manage services, staff, CRM, inventory, finance, scheduling, quotes, invoices, and campaigns. This is the product-level term; the backend may use `provider`, `business_owner`, or other role enums internally.
**Example:** Alice, a Client, completes business KYC and becomes a Business Client. She now sees a "My Business" tab and can manage her plumbing services, staff, and customer relationships.
**See also:** [`Client`](#client), [`Workspace`](#workspace), [`Company`](#company)
**ADR:** Not yet covered by an ADR
**Source:** [`docs/ROADMAP.md`](docs/ROADMAP.md) — Product documentation

---

### Business Workspace
**Definition:** A capability subset within the **Client App/Web** surface, available only to **Business Clients**. The Business Workspace is NOT a separate product or surface — it is the upgraded Client's environment for managing their business operations: services, staff, CRM, inventory, finance, scheduling, quotes, invoices, and campaigns. In the backend, this maps to a `Company` record with associated `CompanyUser` memberships.
**Example:** Alice (Business Client) opens the Business Workspace to view her service packages, check her appointment calendar, and send an invoice to a customer — all within the same Client App/Web application.
**See also:** [`Business Client`](#business-client), [`Company`](#company), [`Workspace`](#workspace)
**ADR:** [`ADR-0026`](docs/DECISIONS.md) — Workspaces and ProviderServicePackage
**Source:** [`docs/ROADMAP.md`](docs/ROADMAP.md) — Product documentation

---

### Category
**Definition:** Hierarchical catalog node with optional `parentId` and self-relation `children`. Categories organize `ServiceCatalog` entries into a browsable tree with max depth 5. Supports `sortOrder`, `archivedAt`, `icon`, and `description`.
**Example:** "Home Services" → "Plumbing" → "Pipe Repair" is a 3-level category path. The admin tree API returns nested children with depth tracking.
**See also:** [`ServiceCatalog`](#servicecatalog), [`Category tree`](#category-tree)
**ADR:** [`ADR-0024`](docs/DECISIONS.md) — Tree read: `GET /api/categories/tree-with-services`; [`ADR-0025`](docs/DECISIONS.md) — Admin tree mutations
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:593) — Model definition

---

### Category tree
**Definition:** The nested `Category` hierarchy returned by `GET /api/categories/tree-with-services`, including `depth`, `children`, `sortOrder`, `archivedAt`, `icon`, `description`, and `ServiceCatalogLite` entries on leaf categories.
**Example:** A frontend category browser renders the tree as an expandable sidebar, loading all categories and their associated services in a single round-trip.
**See also:** [`Category`](#category), [`ServiceCatalog`](#servicecatalog)
**ADR:** [`ADR-0024`](docs/DECISIONS.md) — Single round-trip tree read
**Source:** [`lib/categoryTreeOps.ts`](lib/categoryTreeOps.ts) — Tree operations

---

### Chat
**Definition:** User messaging system with two tiers: (1) legacy `ChatRoom`/`ChatMessage` for general discussion, and (2) `OrderChatThread`/`OrderChatMessage` for order-scoped conversations with PII moderation and translation.
**Example:** A customer and matched provider communicate via `OrderChatThread`; messages are moderated for contact info and optionally translated.
**See also:** [`OrderChatThread`](#orderchatthread), [`OrderChatMessage`](#orderchatmessage), [`PII guard`](#pii-guard)
**ADR:** [`ADR-0043`](docs/DECISIONS.md) — Order-scoped chat; [`ADR-0044`](docs/DECISIONS.md) — PII guard server-enforced
**Source:** [`routes/chat.ts`](routes/chat.ts) — Chat routes; [`routes/orderChat.ts`](routes/orderChat.ts) — Order-scoped chat routes

---

### ChatMessage
**Definition:** Legacy Prisma model for general chat messages within a `ChatRoom`. Stores `senderId`, `senderName`, `senderRole`, `text`, and `timestamp`.
**Example:** A user posts "Hello" in a public category chat room.
**See also:** [`ChatRoom`](#chatroom), [`OrderChatMessage`](#orderchatmessage)
**ADR:** Not yet covered by an ADR
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:894) — Model definition

---

### ChatMessageType
**Definition:** Enum (`text`, `system`) distinguishing user-written messages from system-generated notifications in order chat.
**Example:** When a contract is approved, a `system`-type message is inserted: "Contract version 2 was approved by the customer."
**See also:** [`OrderChatMessage`](#orderchatmessage), [`ChatModerationStatus`](#chatmoderationstatus)
**ADR:** [`ADR-0045`](docs/DECISIONS.md) — Translation is additive metadata
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:108) — Enum definition

---

### ChatModerationStatus
**Definition:** Enum (`clean`, `masked`, `blocked`, `flagged`) applied to each `OrderChatMessage` after server-side moderation. `masked` redacts contact data in `displayText`; `blocked` prevents delivery; `flagged` marks for admin review.
**Example:** A message containing "Call me at 555-1234" is stored with `moderationStatus: "masked"` and `displayText: "Call me at [REDACTED]"`.
**See also:** [`OrderChatMessage`](#orderchatmessage), [`PII guard`](#pii-guard)
**ADR:** [`ADR-0044`](docs/DECISIONS.md) — PII guard is server-enforced on send; [`ADR-0046`](docs/DECISIONS.md) — UI only reflects status
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:113) — Enum definition

---

### ChatRoom
**Definition:** Legacy Prisma model for general-purpose chat rooms, optionally linked to a `Category`. Stores `name`, `lastMessage`, and `lastMessageAt`.
**Example:** A "Plumbing Discussion" chat room linked to the Plumbing category where providers and customers can interact.
**See also:** [`ChatMessage`](#chatmessage), [`Category`](#category)
**ADR:** Not yet covered by an ADR
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:884) — Model definition

---

### Company
**Definition:** Provider organization profile. Links to `User` owner and optional `businessKycSubmissions`. Can be of type `solo` (individual provider) or `business` (organization with multiple members). Stores profile info, social links, location, and KYC status.
**Example:** "Amir's Plumbing Inc." is a `business`-type Company owned by user Amir, with 5 employees, verified KYC, and 3 active service packages.
**See also:** [`CompanyUser`](#companyuser), [`Workspace`](#workspace), [`BusinessKycSubmission`](#businesskycsubmission)
**ADR:** [`ADR-0026`](docs/DECISIONS.md) — Workspaces and ProviderServicePackage
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:221) — Model definition

---

### CompanyUser
**Definition:** Join table linking `User` to `Company` with a `role` string (`owner`, `admin`, `member`, `staff`, `client`). Composite primary key on `(companyId, userId)`.
**Example:** User Jane is added as an `admin` of "Amir's Plumbing Inc." via a `CompanyUser` row, giving her access to the company's workspace dashboard.
**See also:** [`Company`](#company), [`User`](#user), [`Workspace`](#workspace)
**ADR:** [`ADR-0026`](docs/DECISIONS.md) — Workspaces and ProviderServicePackage
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:255) — Model definition

---

### Contract
**Definition:** Legacy Prisma model representing a financial/legal record between `customerId` and `providerId`, with signing booleans, `amount`, `commissionAmount`, and `status` string. Being superseded by the `OrderContract`/`ContractVersion` system.
**Example:** A legacy contract between customer Alice and provider Bob for $500 plumbing work, with `clientSigned: true` and `providerSigned: true`.
**See also:** [`OrderContract`](#ordercontract), [`ContractVersion`](#contractversion)
**ADR:** [`ADR-0053`](docs/DECISIONS.md) — Pre-match contracts
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:609) — Model definition

---

### ContractActionType
**Definition:** Enum of all possible contract lifecycle events: `provider_sent`, `customer_approved`, `customer_rejected`, `customer_requested_edit`, `provider_superseded`, `admin_override`, `admin_marked_reviewed`, `admin_internal_note`.
**Example:** When a customer approves a contract version, a `ContractEvent` is created with `actionType: "customer_approved"`.
**See also:** [`ContractEvent`](#contractevent), [`ContractVersionStatus`](#contractversionstatus)
**ADR:** [`ADR-0051`](docs/DECISIONS.md) — Approvals are append-only events
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:128) — Enum definition

---

### ContractEvent
**Definition:** Prisma model recording every action on an `OrderContract`'s versions. Stores `actorId`, `actorRole`, `actionType` (from `ContractActionType`), optional `note` and `metadata` JSON. Append-only for auditability.
**Example:** A timeline of events: `provider_sent` → `customer_approved` → `admin_marked_reviewed`, each with timestamps and actor info.
**See also:** [`OrderContract`](#ordercontract), [`ContractActionType`](#contractactiontype), [`ContractVersion`](#contractversion)
**ADR:** [`ADR-0051`](docs/DECISIONS.md) — Append-only events for auditability
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:577) — Model definition

---

### Contract mismatch guard
**Definition:** Logic in `lib/contractMismatchGuard.ts` that compares chat discussion summaries against drafted contract clauses, returning non-blocking warnings when discrepancies are found (e.g., price mentioned in chat differs from contract amount).
**Example:** A provider and customer discussed "$450" in chat, but the contract draft says "$500". The mismatch guard emits a warning: "Chat mentions $450 but contract shows $500."
**See also:** [`ContractVersion`](#contractversion), [`OrderChatThread`](#orderchatthread)
**ADR:** [`ADR-0050`](docs/DECISIONS.md) — Contract mismatch guard checks chat-summary vs clauses
**Source:** [`lib/contractMismatchGuard.ts`](lib/contractMismatchGuard.ts) — Mismatch detection

---

### Contract template
**Definition:** Code-defined Markdown templates in `lib/contractTemplateCatalog.ts` with `{{camelCase}}` placeholders. `POST /api/orders/:orderId/contracts/draft-from-template` creates a draft `ContractVersion` from a template, with `generatedByAi=false` and `generationPrompt` set to `template:<templateId>`.
**Example:** A "Standard Service Agreement" template with placeholders `{{customerName}}`, `{{serviceDescription}}`, `{{price}}` that are replaced from order context.
**See also:** [`ContractVersion`](#contractversion), [`OrderContract`](#ordercontract)
**ADR:** [`ADR-0057`](docs/DECISIONS.md) — Contract templates with explicit placeholders
**Source:** [`lib/contractTemplateCatalog.ts`](lib/contractTemplateCatalog.ts) — Template registry

---

### ContractVersion
**Definition:** Immutable snapshot of title, terms, policies, scope, dates, and amount for one negotiation round. Status driven by `ContractVersionStatus` (draft → sent → approved | rejected | superseded). Each version is append-only once sent.
**Example:** Version 1 is drafted and sent to the customer; the customer requests edits; Version 2 is created with updated terms; Version 1 is superseded.
**See also:** [`OrderContract`](#ordercontract), [`ContractVersionStatus`](#contractversionstatus), [`Superseded version`](#superseded-version)
**ADR:** [`ADR-0047`](docs/DECISIONS.md) — Versioned immutable snapshots; [`ADR-0049`](docs/DECISIONS.md) — AI contract suggestion is advisory
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:545) — Model definition

---

### ContractVersionStatus
**Definition:** Enum (`draft`, `sent`, `approved`, `rejected`, `superseded`) tracking the lifecycle of a single `ContractVersion`. Only the newest `sent` version can be acted upon; older versions transition to `superseded`.
**Example:** A version moves from `draft` → `sent` (provider sends) → `approved` (customer approves), or `draft` → `sent` → `superseded` (newer version replaces it).
**See also:** [`ContractVersion`](#contractversion), [`Superseded version`](#superseded-version)
**ADR:** [`ADR-0047`](docs/DECISIONS.md) — Versioned immutable snapshots
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:120) — Enum definition

---

### Customer
**Definition:** See [`Client`](#client). The term "Customer" appears in legacy code and some Prisma models (e.g., `Order.customerId`). In product documentation, the preferred term is **Client**.
**See also:** [`Client`](#client), [`Business Client`](#business-client)
**ADR:** Not yet covered by an ADR
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:330) — `Order.customerId` field

---

### Customer priority templates
**Definition:** Weighting preferences stored on `User.orderPriorities` JSON that influence provider scoring during matching. Customers can save and reuse templates across orders via `POST /api/orders/:id/select-provider`.
**Example:** A customer sets weights: `{ proximity: 0.5, rating: 0.3, price: 0.2 }` to prioritize nearby providers.
**See also:** [`OfferMatchAttempt`](#offermatchattempt), [`Round-robin pool`](#round-robin-pool)
**ADR:** [`ADR-0041`](docs/DECISIONS.md) — Customer priority templates persist on `User.orderPriorities`
**Source:** [`lib/matching/eligibility.ts`](lib/matching/eligibility.ts) — Scoring logic

---

### Dispute
**Definition:** Prisma model linked 1:1 to an `Order` when a customer raises a dispute after job completion. Stores `reason` and creation timestamp.
**Example:** After a provider completes a painting job with poor quality, the customer creates a Dispute with reason "Work was incomplete and paint is peeling."
**See also:** [`Order`](#order), [`OrderReview`](#orderreview), [`JobRecord`](#jobrecord)
**ADR:** Not yet covered by an ADR
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:482) — Model definition

---

### Feed
**Definition:** Social content stream of `Post` entries from providers and businesses, visible to customers. Posts can be `VIDEO`, `PHOTO`, or `TEXT` type with reactions and comments.
**Example:** A landscaping provider posts a "Before and After" photo of a garden makeover, which appears in customer feeds.
**See also:** [`Post`](#post), [`PostReaction`](#postreaction), [`PostComment`](#postcomment)
**ADR:** Not yet covered by an ADR
**Source:** [`routes/feed.ts`](routes/feed.ts) — Feed routes

---

### Flagged message
**Definition:** Chat message marked for admin review due to explicit contact-exchange intent (e.g., "contact me on ..."). The `moderationStatus` is set to `flagged` and the message is still delivered but flagged in the admin moderation queue.
**Example:** A message saying "Email me at john@gmail.com for a discount" is flagged and appears in the admin chat moderation panel.
**See also:** [`ChatModerationStatus`](#chatmoderationstatus), [`Masked message`](#masked-message), [`PII guard`](#pii-guard)
**ADR:** [`ADR-0044`](docs/DECISIONS.md) — PII guard is server-enforced on send
**Source:** [`lib/chatModeration.ts`](lib/chatModeration.ts) — Moderation logic

---

### Invoice
**Definition:** Prisma model for billing, linked to a `Company` (workspace) and optionally an `Order` and `User` (customer). Status driven by `InvoiceStatus` enum (`DRAFT`, `SENT`, `PAID`, `OVERDUE`, `CANCELLED`). Stores `lineItems` JSON, `subtotal`, `tax`, `total`, and `pdfUrl`.
**Example:** After a job is completed, the workspace generates an invoice for $500 with line items for labor and materials, then marks it as `SENT`.
**See also:** [`InvoiceStatus`](#invoicestatus), [`Order`](#order), [`Company`](#company)
**ADR:** Not yet covered by an ADR
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:1018) — Model definition

---

### InvoiceStatus
**Definition:** Enum (`DRAFT`, `SENT`, `PAID`, `OVERDUE`, `CANCELLED`) tracking the lifecycle of an `Invoice`.
**Example:** An invoice transitions from `DRAFT` → `SENT` (emailed to customer) → `PAID` (payment received).
**See also:** [`Invoice`](#invoice), [`Transaction`](#transaction)
**ADR:** Not yet covered by an ADR
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:921) — Enum definition

---

### Job
**Definition:** A confirmed engagement between a customer and a provider. In the order lifecycle it maps to `OrderStatus` values `contracted`, `paid`, `in_progress`, `completed`, `disputed`, or `closed`. The stored `Order.phase` is `job` once past matching/negotiation. Extended by `JobRecord` for operational metrics.
**Example:** A plumbing order that has been contracted, paid, and is now in progress has `phase: "job"` and `status: "in_progress"`.
**See also:** [`Order`](#order), [`OrderPhase`](#orderphase), [`JobRecord`](#jobrecord)
**ADR:** [`ADR-0033`](docs/DECISIONS.md) — Order phase derived from status; [`ADR-0058`](docs/DECISIONS.md) — JobRecord extends Order
**Source:** [`lib/orderPhase.ts`](lib/orderPhase.ts) — Phase derivation

---

### JobRecord
**Definition:** Prisma model with 1:1 relation to `Order` holding operational job timestamps (`scheduledStartAt`, `actualStartAt`, `completedAt`, `cancelledAt`), cancellation metadata, and analytics fields (`responseTimeMinutes`, `priceDelta`, `customerRating`). Status driven by `JobStatus` enum.
**Example:** A completed painting job has `JobRecord.status: "completed"`, `actualStartAt: 2026-05-23T09:00Z`, `completedAt: 2026-05-23T17:00Z`, `priceDelta: 0`.
**See also:** [`Order`](#order), [`Job`](#job), [`JobStatus`](#jobstatus)
**ADR:** [`ADR-0058`](docs/DECISIONS.md) — JobRecord extends Order
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:445) — Model definition

---

### JobStatus
**Definition:** Enum (`scheduled`, `in_progress`, `completed`, `disputed`, `cancelled`) tracking the operational state of a `JobRecord`.
**Example:** A job moves from `scheduled` → `in_progress` (provider checks in) → `completed` (provider marks done).
**See also:** [`JobRecord`](#jobrecord), [`OrderStatus`](#orderstatus)
**ADR:** [`ADR-0058`](docs/DECISIONS.md) — JobRecord extends Order
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:79) — Enum definition

---

### KYC (legacy)
**Definition:** Legacy Prisma model (`KYC`) with `type` (personal, business) and `status` string. Kept as a shim for backward compatibility; new flows use `KycLevel0Profile`, `KycPersonalSubmission`, and `BusinessKycSubmission`.
**Example:** When a personal KYC submission is approved, the admin route mirrors the status into the legacy `KYC` row for backward-compatible reads.
**See also:** [`KycLevel0Profile`](#kyclevel0profile), [`KycPersonalSubmission`](#kycpersonalsubmission), [`BusinessKycSubmission`](#businesskycsubmission)
**ADR:** [`ADR-0003`](docs/DECISIONS.md) — KYC has 3 levels; legacy model kept as shim
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:772) — Model definition

---

### KYC L0 / L1 / L2
**Definition:** Three-level KYC system: Level 0 (`KycLevel0Profile`) gates contact/address verification; Level 1 (`KycPersonalSubmission`) requires identity document review with AI fraud analysis; Level 2 (`BusinessKycSubmission`) handles business verification with versioned form schemas.
**Example:** A new provider completes L0 (email + phone verification), then L1 (uploads ID and selfie for AI analysis), then L2 (submits business license and insurance docs).
**See also:** [`KycLevel0Profile`](#kyclevel0profile), [`KycPersonalSubmission`](#kycpersonalsubmission), [`BusinessKycSubmission`](#businesskycsubmission)
**ADR:** [`ADR-0003`](docs/DECISIONS.md) — KYC has 3 levels; [`ADR-0005`](docs/DECISIONS.md) — Client-side AI for KYC OCR/fraud
**Source:** [`routes/adminKyc.ts`](routes/adminKyc.ts) — Admin KYC routes

---

### KycLevel0Profile
**Definition:** Prisma model for KYC Level 0: email/phone verification timestamps, address capture and verification, and admin acknowledgment. 1:1 relation to `User`.
**Example:** A user verifies their email (`emailVerifiedAt` set) and phone (`phoneVerifiedAt` set), then provides an address that an admin acknowledges (`adminAcknowledgedAt` set).
**See also:** [`KYC L0 / L1 / L2`](#kyc-l0--l1--l2), [`KycPersonalSubmission`](#kycpersonalsubmission)
**ADR:** [`ADR-0003`](docs/DECISIONS.md) — KYC has 3 levels
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:782) — Model definition

---

### KycPersonalSubmission
**Definition:** Prisma model for KYC Level 1: identity document submission with `idDocumentType` (national_id, passport, drivers_license), document photos (`idFrontUrl`, `idBackUrl`, `selfieUrl`), AI analysis results (`aiAnalysis` JSON), and standard `KycStatus` workflow.
**Example:** A provider uploads their passport front/back and a selfie; the AI analysis returns `recommendation: "approve"` with `confidence: 0.95`; an admin reviews and sets status to `approved`.
**See also:** [`KYC L0 / L1 / L2`](#kyc-l0--l1--l2), [`KycStatus`](#kycstatus), [`KycReviewAuditLog`](#kycreviewauditlog)
**ADR:** [`ADR-0003`](docs/DECISIONS.md) — KYC has 3 levels; [`ADR-0005`](docs/DECISIONS.md) — Client-side AI for KYC OCR/fraud
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:797) — Model definition

---

### KycReviewAuditLog
**Definition:** Prisma model recording every status change on KYC submissions. Stores `submissionType` (`KycSubmissionType`), `submissionId`, `actorId`, `fromStatus`, `toStatus`, optional `note`, and `metadata` JSON.
**Example:** When an admin rejects a personal KYC submission, a log entry records `fromStatus: "pending"`, `toStatus: "rejected"`, `note: "ID document is illegible"`.
**See also:** [`KycPersonalSubmission`](#kycpersonalsubmission), [`BusinessKycSubmission`](#businesskycsubmission), [`KycStatus`](#kycstatus)
**ADR:** [`ADR-0003`](docs/DECISIONS.md) — KYC has 3 levels
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:857) — Model definition

---

### KycStatus
**Definition:** Enum (`draft`, `pending`, `approved`, `rejected`, `resubmit_requested`) applied to KYC submissions (personal and business). Drives the review workflow.
**Example:** A submission starts as `draft`, is submitted as `pending`, an admin reviews and sets `resubmit_requested` with notes, the user resubmits, and finally it's `approved`.
**See also:** [`KycPersonalSubmission`](#kycpersonalsubmission), [`BusinessKycSubmission`](#businesskycsubmission)
**ADR:** [`ADR-0003`](docs/DECISIONS.md) — KYC has 3 levels
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:38) — Enum definition

---

### KycSubmissionType
**Definition:** Enum (`level0`, `personal`, `business`) identifying which KYC tier a `KycReviewAuditLog` entry refers to.
**Example:** A `KycReviewAuditLog` with `submissionType: "personal"` indicates the action was on a `KycPersonalSubmission`.
**See also:** [`KycReviewAuditLog`](#kycreviewauditlog), [`KYC L0 / L1 / L2`](#kyc-l0--l1--l2)
**ADR:** [`ADR-0003`](docs/DECISIONS.md) — KYC has 3 levels
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:46) — Enum definition

---

### LegalPolicy
**Definition:** Prisma model storing legal documents (Terms of Service, Privacy Policy, etc.) with `title`, `content`, and `version` string.
**Example:** The "Terms of Service" version 2.1 is stored as a `LegalPolicy` row and displayed on the signup page.
**See also:** [`Page`](#page), [`SystemConfig`](#systemconfig)
**ADR:** Not yet covered by an ADR
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:906) — Model definition

---

### Lost-deal feedback
**Definition:** Provider-submitted structured reasons (`lostReason`, `lostFeedback`) attached to `OfferMatchAttempt` rows in `superseded`, `declined`, or `expired` states. Used to improve future matching priorities.
**Example:** A provider declines an invite and provides feedback: `{ reasons: ["too_far", "busy"], otherText: "Scheduling conflict", providerComment: "Can't do next week" }`.

**See also:** [`OfferMatchAttempt`](#offermatchattempt), [`Round-robin pool`](#round-robin-pool)
**ADR:** [`ADR-0040`](docs/DECISIONS.md) — Lost-deal feedback is captured per attempt
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:323) — `OfferMatchAttempt.lostFeedback` field

---

### Masked message
**Definition:** A chat message whose `displayText` has been redacted by the PII guard to remove contact information (phone numbers, emails, addresses). The original content is preserved in `originalText` for audit; the UI renders `displayText` instead.
**Example:** A message "Call me at 555-1234" is stored with `originalText: "Call me at 555-1234"` and `displayText: "Call me at [REDACTED]"`.
**See also:** [`ChatModerationStatus`](#chatmoderationstatus), [`Flagged message`](#flagged-message), [`PII guard`](#pii-guard)
**ADR:** [`ADR-0044`](docs/DECISIONS.md) — PII guard is server-enforced on send
**Source:** [`lib/chatModeration.ts`](lib/chatModeration.ts) — Moderation logic

---

### Match
**Definition:** The outcome of a successful matching process where a customer's order is paired with a provider. Represented by an `OfferMatchAttempt` with status `accepted` and the `Order.status` transitioning to `matched`.
**Example:** A plumbing order is matched when the customer accepts an offer from a provider, setting `Order.status: "matched"` and `Order.phase: "order"`.
**See also:** [`OfferMatchAttempt`](#offermatchattempt), [`MatchAttemptStatus`](#matchattemptstatus), [`Order`](#order)
**ADR:** [`ADR-0037`](docs/DECISIONS.md) — OfferMatchAttempt is the source of truth for match decisions
**Source:** [`lib/matching/orchestrator.ts`](lib/matching/orchestrator.ts) — Matching orchestration

---

### MatchAttemptStatus
**Definition:** Enum (`invited`, `accepted`, `declined`, `expired`, `superseded`, `cancelled`) tracking the lifecycle of an `OfferMatchAttempt`. Drives the matching state machine and eligibility for replacement.
**Example:** An attempt starts as `invited`, the provider declines -> `declined`, or the customer accepts -> `accepted`, or the window expires -> `expired`.
**See also:** [`OfferMatchAttempt`](#offermatchattempt), [`Round-robin pool`](#round-robin-pool)
**ADR:** [`ADR-0037`](docs/DECISIONS.md) — OfferMatchAttempt is the source of truth
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:68) — Enum definition

---

### MediaAsset
**Definition:** Prisma model for uploaded media files (images, documents). Stores `filename`, `mimeType`, `size`, `url`, `thumbnailUrl`, and `uploadedById`. Used by KYC submissions, order photos, and general uploads.
**Example:** A provider uploads their ID document; the file is stored as a `MediaAsset` with `mimeType: "image/jpeg"`, `size: 245000`, and a generated thumbnail URL.
**See also:** [`KycPersonalSubmission`](#kycpersonalsubmission), [`Order photos for validation`](#order-photos-for-validation)
**ADR:** Not yet covered by an ADR
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:980) — Model definition

---

### ModerationStatus
**Definition:** See [`ChatModerationStatus`](#chatmoderationstatus). Applied to each `OrderChatMessage` after server-side PII scanning.
**See also:** [`ChatModerationStatus`](#chatmoderationstatus), [`PII guard`](#pii-guard)
**ADR:** [`ADR-0044`](docs/DECISIONS.md) — PII guard is server-enforced on send
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:113) — Enum definition

---

### NATS
**Definition:** Asynchronous message bus used for order lifecycle events, contract events, and notification dispatch. Subjects follow the pattern `orders.<event>`, `contracts.<event>`, `kyc.<event>`. Connected via `getNats()` in `lib/bus.ts`.
**Example:** When an order is submitted, a NATS message is published on `orders.submitted` with the order ID, which triggers notification creation for the customer.
**See also:** [`Order lifecycle notifications`](#order-lifecycle-notifications)
**ADR:** Not yet covered by an ADR
**Source:** [`lib/bus.ts`](lib/bus.ts) — NATS connection and publish logic

---

### Redis Cache

**Definition:** A Redis-based caching layer implemented in [`lib/redis.ts`](lib/redis.ts) using the `ioredis` library. Provides key-value cache with configurable TTL, graceful degradation (falls back to in-memory `Map` when Redis is unavailable), lazy connection (`lazyConnect: true`), and retry strategy (up to 3 attempts with exponential backoff: 200ms, 400ms, 600ms). All keys are prefixed with `neighborly:`.
**Usage:** This is the **primary cache module**. All other modules should import `getRedis` from `lib/redis.ts`, not from `lib/cache.ts` directly.
**See also:** [Location cache](#location-cache), [In-memory cache](#in-memory-cache)
**Source:** [`lib/redis.ts`](lib/redis.ts) — Redis connection manager

---

### Location Cache

**Definition:** A Redis GEO-based location caching system implemented in [`lib/locationCache.ts`](lib/locationCache.ts). Provides real-time provider proximity features including `setUserLocation()` (Haversine debounce with 50m threshold, Redis GEO index), `getNearbyProviders()` (Redis GEO `georadius` with 60s cache TTL), `startLocationFlusher()` (background interval batch-writing dirty locations to PostgreSQL every 5 minutes), and `flushDirtyLocations()` (batch transaction with retry logic, max 3 attempts). Also supports order and workspace location caching.
**Configuration:** Environment variables: `LOCATION_DEBOUNCE_METERS` (default 50), `LOCATION_FLUSH_INTERVAL_MS` (default 300000), `LOCATION_CACHE_TTL_SECONDS` (default 300), `LOCATION_GEO_CACHE_TTL` (default 60), `LOCATION_REVERSE_GEO_TTL` (default 3600).
**Redis GEO keys:** `user:locations`, `provider:locations`. Dirty set key: `user:location:dirty`.
**See also:** [Redis cache](#redis-cache), [GEO spatial query](#geo-spatial-query)
**Source:** [`lib/locationCache.ts`](lib/locationCache.ts) — Location cache implementation

---

### GEO Spatial Query

**Definition:** Geospatial queries performed using Redis GEO commands (`GEOADD`, `GEORADIUS`, `GEORADIUSBYMEMBER`) via [`lib/locationCache.ts`](lib/locationCache.ts). Used to find nearby providers within a given radius. The system uses the Haversine formula to calculate distances and debounce location updates.
**See also:** [Location cache](#location-cache), [Redis cache](#redis-cache)
**Source:** [`lib/locationCache.ts`](lib/locationCache.ts) — GEO query implementation

---

### Negotiation
**Definition:** A `BookingMode` where matching uses round-robin invitations to a pool of eligible providers. Providers receive `OfferMatchAttempt` rows in `invited` status; the customer reviews offers and selects one. Contrast with `auto_appointment`.
**Example:** A customer submits a cleaning order with `bookingMode: "negotiation"`; 5 nearby providers are invited, and the customer picks the best offer.
**See also:** [`BookingMode`](#bookingmode), [`Round-robin pool`](#round-robin-pool), [`OfferMatchAttempt`](#offermatchattempt)
**ADR:** [`ADR-0007`](docs/DECISIONS.md) — Placeholder for order routing; [`ADR-0039`](docs/DECISIONS.md) — Round-robin pool size 5
**Source:** [`lib/matching/roundRobin.ts`](lib/matching/roundRobin.ts) — Round-robin logic

---

### Notification
**Definition:** Prisma model for user-facing notifications. Stores `userId`, `type` string, `title`, `body`, `data` JSON, `readAt` timestamp, and `createdAt`. Created by NATS consumers in `lib/orderLifecycleNotifications.ts`.
**Example:** A customer receives a notification: "Your order #123 has been matched with a provider" with `type: "order.matched"`.
**See also:** [`Order lifecycle notifications`](#order-lifecycle-notifications), [`NATS`](#nats)
**ADR:** Not yet covered by an ADR
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:1056) — Model definition

---

### Offer
**Definition:** See [`OfferMatchAttempt`](#offermatchattempt). The primary matching entity; each row represents one provider's invitation to bid on an order.
**See also:** [`OfferMatchAttempt`](#offermatchattempt), [`Match`](#match)
**ADR:** [`ADR-0037`](docs/DECISIONS.md) — OfferMatchAttempt is the source of truth
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:290) — Model definition

---

### OfferMatchAttempt
**Definition:** Prisma model representing a single provider's invitation to match with an order. Stores `orderId`, `workspaceId`, `status` (MatchAttemptStatus), `score`, `rank`, `invitedAt`, `respondedAt`, `expiresAt`, `lostFeedback` JSON, and relations to `Order` and `Company`. Central to the matching state machine.
**Example:** A round-robin pool creates 5 `OfferMatchAttempt` rows for a plumbing order; provider #2 accepts, setting `status: "accepted"` and linking the order to that workspace.
**See also:** [`MatchAttemptStatus`](#matchattemptstatus), [`Round-robin pool`](#round-robin-pool), [`Order`](#order)
**ADR:** [`ADR-0037`](docs/DECISIONS.md) — Source of truth for match decisions; [`ADR-0039`](docs/DECISIONS.md) — Pool size 5; [`ADR-0040`](docs/DECISIONS.md) — Lost-deal feedback
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:290) — Model definition

---

### OfferStatus
**Definition:** See [`MatchAttemptStatus`](#matchattemptstatus). The status field on `OfferMatchAttempt` that drives the matching lifecycle.
**See also:** [`OfferMatchAttempt`](#offermatchattempt), [`MatchAttemptStatus`](#matchattemptstatus)
**ADR:** [`ADR-0037`](docs/DECISIONS.md) — OfferMatchAttempt is the source of truth
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:68) — Enum definition

---

### Order
**Definition:** Core Prisma model representing a service request from a customer to a provider. Stores `customerId`, `workspaceId` (matched provider), `serviceCatalogId`, `description`, `descriptionAiAssisted`, `schemaSnapshot` JSON, `photos` JSON, `status` (OrderStatus), `phase` (derived OrderPhase), `entryPoint` (OrderEntryPoint), `priorityWeights` JSON, and lifecycle timestamps. Central entity connecting customers, providers, contracts, payments, and jobs.
**Example:** A customer creates an order for "Pipe repair" with description "Kitchen sink leaking", uploads 3 photos, submits it, and the system matches with a plumbing provider.
**See also:** [`OrderStatus`](#orderstatus), [`OrderPhase`](#orderphase), [`OrderEntryPoint`](#orderentrypoint), [`JobRecord`](#jobrecord), [`Dispute`](#dispute)
**ADR:** [`ADR-0014`](docs/DECISIONS.md) — Order is a new model distinct from Request; [`ADR-0015`](docs/DECISIONS.md) — Order state machine; [`ADR-0033`](docs/DECISIONS.md) — Phase derived from status
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:330) — Model definition

---

### OrderChatMessage
**Definition:** Prisma model for messages within an `OrderChatThread`. Extends the chat concept with `moderationStatus` (ChatModerationStatus), `displayText` (redacted version), `originalText`, `sourceLang`, `targetLang`, `translatedText`, and `messageType` (ChatMessageType).
**Example:** A provider sends "Can you confirm the address?" in the order chat; the message is moderated for PII and optionally translated for the customer.
**See also:** [`OrderChatThread`](#orderchatthread), [`ChatModerationStatus`](#chatmoderationstatus), [`ChatMessageType`](#chatmessagetype)
**ADR:** [`ADR-0043`](docs/DECISIONS.md) — Order-scoped chat; [`ADR-0044`](docs/DECISIONS.md) — PII guard; [`ADR-0045`](docs/DECISIONS.md) — Translation
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:509) — Model definition

---

### OrderChatThread
**Definition:** Prisma model representing a chat conversation scoped to an `Order`. 1:1 relation to `Order`. Stores `orderId` (unique), `createdAt`, and `updatedAt`. Participants are strictly the order's customer and the matched/invited workspace members.
**Example:** After an order is matched, an `OrderChatThread` is created linking the customer and the provider's workspace for direct messaging.
**See also:** [`OrderChatMessage`](#orderchatmessage), [`Order`](#order), [`Chat`](#chat)
**ADR:** [`ADR-0043`](docs/DECISIONS.md) — Order-scoped chat with strict participants
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:499) — Model definition

---

### OrderContract
**Definition:** Prisma model linking an `Order` to its contract versions. 1:1 relation to `Order`. Stores `orderId` (unique), `currentVersionId` (points to active `ContractVersion`), `createdAt`, and `updatedAt`. The parent entity for `ContractVersion` and `ContractEvent` rows.
**Example:** An order has an `OrderContract` with 3 versions; `currentVersionId` points to version 3 (the latest sent version).
**See also:** [`ContractVersion`](#contractversion), [`ContractEvent`](#contractevent), [`Order`](#order)
**ADR:** [`ADR-0047`](docs/DECISIONS.md) — Versioned immutable snapshots; [`ADR-0048`](docs/DECISIONS.md) — Approval transitions order to contracted
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:530) — Model definition

---

### OrderEntryPoint
**Definition:** Enum (`wizard`, `quick_order`, `reorder`, `admin`) indicating how an order was created. Used for analytics and funnel optimization.
**Example:** An order created through the standard wizard flow has `entryPoint: "wizard"`; a reorder from order history has `entryPoint: "reorder"`.
**See also:** [`Order`](#order), [`Guest wizard`](#guest-wizard)
**ADR:** [`ADR-0014`](docs/DECISIONS.md) — Order is a new model distinct from Request
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:105) — Enum definition

---

### OrderPhase
**Definition:** Derived enum (`draft`, `order`, `job`, `cancelled`) computed from `Order.status` via `phaseFromStatus()`. `draft` covers `draft`/`submitted`/`cancelled_draft`; `order` covers `matched`/`contracted`/`paid`; `job` covers `in_progress`/`completed`/`disputed`/`closed`; `cancelled` covers any cancelled status.
**Example:** An order with `status: "matched"` has `phase: "order"`; an order with `status: "in_progress"` has `phase: "job"`.
**See also:** [`OrderStatus`](#orderstatus), [`Order`](#order), [`Job`](#job)
**ADR:** [`ADR-0033`](docs/DECISIONS.md) — Phase derived from status; [`ADR-0034`](docs/DECISIONS.md) — Cancelled rows keep last non-draft phase; [`ADR-0035`](docs/DECISIONS.md) — Shared phase contract
**Source:** [`lib/orderPhase.ts`](lib/orderPhase.ts) — Phase derivation

---

### OrderReview
**Definition:** Prisma model for customer ratings and reviews on completed orders. 1:1 relation to `Order`. Stores `rating` (Int), `reviewText`, and `createdAt`.
**Example:** After a plumbing job is completed, the customer rates 5 stars with review "Excellent work, very professional."
**See also:** [`Order`](#order), [`Dispute`](#dispute), [`JobRecord`](#jobrecord)
**ADR:** Not yet covered by an ADR
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:473) — Model definition

---

### OrderStatus
**Definition:** Enum (`draft`, `submitted`, `matched`, `contracted`, `paid`, `in_progress`, `completed`, `disputed`, `closed`, `cancelled_draft`, `cancelled_submitted`, `cancelled_matched`, `cancelled_contracted`, `cancelled_paid`, `cancelled_in_progress`) covering the full order lifecycle. Each `cancelled_*` variant preserves the phase at cancellation time.
**Example:** An order transitions: `draft` -> `submitted` -> `matched` -> `contracted` -> `paid` -> `in_progress` -> `completed`.
**See also:** [`Order`](#order), [`OrderPhase`](#orderphase), [`JobStatus`](#jobstatus)
**ADR:** [`ADR-0015`](docs/DECISIONS.md) — Order state machine; [`ADR-0033`](docs/DECISIONS.md) — Phase derived from status; [`ADR-0034`](docs/DECISIONS.md) — Cancelled rows keep last phase
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:53) — Enum definition

---

### Page
**Definition:** Prisma model for CMS-style pages (About, Contact, FAQ, etc.). Stores `slug` (unique), `title`, `content`, `published`, and lifecycle fields.
**Example:** The "About Us" page is stored as a `Page` with `slug: "about"`, `published: true`, and HTML content.
**See also:** [`LegalPolicy`](#legalpolicy), [`SystemConfig`](#systemconfig)
**ADR:** Not yet covered by an ADR
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:916) — Model definition

---

### PII guard
**Definition:** Server-enforced middleware in `lib/chatModeration.ts` that scans every `OrderChatMessage` for personally identifiable information (phone numbers, emails, addresses) before storage. Sets `moderationStatus` and `displayText` accordingly. Cannot be bypassed by the client.
**Example:** A message containing "Email me at john@gmail.com" is intercepted; the PII guard sets `moderationStatus: "masked"` and redacts the email in `displayText`.
**See also:** [`ChatModerationStatus`](#chatmoderationstatus), [`Masked message`](#masked-message), [`Flagged message`](#flagged-message)
**ADR:** [`ADR-0044`](docs/DECISIONS.md) — PII guard is server-enforced on send; [`ADR-0046`](docs/DECISIONS.md) — UI only reflects status
**Source:** [`lib/chatModeration.ts`](lib/chatModeration.ts) — PII scanning logic

---

### Post
**Definition:** Prisma model for social feed content. Stores `authorId`, `type` (PostType: VIDEO, PHOTO, TEXT), `content`, `mediaUrl`, `thumbnailUrl`, and lifecycle fields. Part of the Feed feature.
**Example:** A landscaping provider creates a `PHOTO` post showing a garden transformation with a description and before/after images.
**See also:** [`Feed`](#feed), [`PostComment`](#postcomment), [`PostReaction`](#postreaction), [`PostType`](#posttype)
**ADR:** Not yet covered by an ADR
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:700) — Model definition

---

### PostComment
**Definition:** Prisma model for comments on `Post` entries. Stores `postId`, `authorId`, `content`, and `createdAt`.
**Example:** A customer comments "Beautiful work!" on a provider's garden transformation post.
**See also:** [`Post`](#post), [`PostReaction`](#postreaction), [`Feed`](#feed)
**ADR:** Not yet covered by an ADR
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:720) — Model definition

---

### PostReaction
**Definition:** Prisma model for likes/reactions on `Post` entries. Stores `postId`, `userId` (composite unique), and `createdAt`.
**Example:** A customer likes a provider's post; a `PostReaction` row is created with the post and user IDs.
**See also:** [`Post`](#post), [`PostComment`](#postcomment), [`Feed`](#feed)
**ADR:** Not yet covered by an ADR
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:711) — Model definition

---

### PostType
**Definition:** Enum (`VIDEO`, `PHOTO`, `TEXT`) indicating the media type of a `Post`.
**Example:** A post with `type: "VIDEO"` includes a video URL; a `type: "PHOTO"` post includes an image URL.
**See also:** [`Post`](#post), [`Feed`](#feed)
**ADR:** Not yet covered by an ADR
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:100) — Enum definition

---

### Product
**Definition:** Prisma model representing a sellable item in a workspace's inventory. Stores `companyId`, `name`, `description`, `unitPrice`, `currency`, `unit`, `sku`, `category`, and lifecycle fields. Used in BOM lines via `ProductInPackage`.
**Example:** "Premium Latex Paint - 1 Gallon" is a Product with `unitPrice: 39.99`, `currency: "CAD"`, `unit: "gallon"`, `sku: "PAINT-001"`.
**See also:** [`ProductInPackage`](#productinpackage), [`BillOfMaterials`](#billofmaterials), [`ProviderServicePackage`](#providerservicepackage)
**ADR:** [`ADR-0031`](docs/DECISIONS.md) — Labor is a normal Product row
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:735) — Model definition

---

### ProductInPackage
**Definition:** Join table linking `Product` to `ProviderServicePackage` with a snapshot of the product's name, unit price, currency, and unit at link time. Each row represents one line item in the BOM. Supports `quantity` and `notes`.
**Example:** A "House Painting" package includes 10 units of "Premium Latex Paint" via a `ProductInPackage` row with `quantity: 10` and `snapshotUnitPrice: 39.99`.
**See also:** [`ProviderServicePackage`](#providerservicepackage), [`Product`](#product), [`BillOfMaterials`](#billofmaterials)
**ADR:** [`ADR-0029`](docs/DECISIONS.md) — BOM snapshots are frozen at link time
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:755) — Model definition

---

### Provider
**Definition:** An internal operational role within a **Business Workspace**, representing a staff member who delivers services, receives order invitations, drafts contracts, and completes jobs. "Provider" is NOT a product-level user type — it is a backend implementation detail (Prisma `UserRole` enum value). At the product level, all end users are either **Client** or **Business Client**; the term "provider" describes a function within a Business Workspace, not a separate user category.
**Example:** Bob is a staff member of "Alice's Plumbing Inc." (a Business Client's workspace). Bob's backend `UserRole` is `provider`, but to customers, Bob appears as a staff member of the Business Client's company.
**See also:** [`Business Client`](#business-client), [`Business Workspace`](#business-workspace), [`Company`](#company), [`ProviderServicePackage`](#providerservicepackage)
**ADR:** [`ADR-0026`](docs/DECISIONS.md) — Workspaces and ProviderServicePackage
**Source:** [`routes/providers.ts`](routes/providers.ts) — Provider routes

---

### ProviderServicePackage
**Definition:** Prisma model representing a sellable service package offered by a workspace. Stores `companyId`, `serviceCatalogId`, `name`, `description`, `bookingMode` (BookingMode), `currency`, `basePrice`, `depositRequired`, `depositAmount`, `duration`, and lifecycle fields. Linked to `ProductInPackage` rows for BOM and `OfferMatchAttempt` for matching.
**Example:** "Basic House Painting - Interior" is a package with `basePrice: 499.99`, `currency: "CAD"`, `bookingMode: "negotiation"`, and a BOM including paint, tape, and labor.
**See also:** [`ServiceCatalog`](#servicecatalog), [`BillOfMaterials`](#billofmaterials), [`ProductInPackage`](#productinpackage), [`BookingMode`](#bookingmode)
**ADR:** [`ADR-0026`](docs/DECISIONS.md) — Workspaces and ProviderServicePackage; [`ADR-0027`](docs/DECISIONS.md) — lockedBookingMode override
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:270) — Model definition

---

### Request
**Definition:** Legacy Prisma model predating `Order`. Being superseded by the Order model per ADR-0014. Some routes still reference `Request` for backward compatibility.
**Example:** Old API endpoints may still return `Request` data, but new development uses `Order` exclusively.
**See also:** [`Order`](#order)
**ADR:** [`ADR-0014`](docs/DECISIONS.md) — Order is a new model distinct from Request
**Source:** [`routes/requests.ts`](routes/requests.ts) — Legacy request routes

---

### Round-robin invitation
**Definition:** The process of inviting a subset of eligible providers (pool size 5, configurable via `ROUND_ROBIN_POOL_SIZE` env var) to bid on an order. Implemented by `roundRobinInviteOffer` in `lib/matching/roundRobin.ts`. Each invitation creates an `OfferMatchAttempt` row.
**Example:** When a plumbing order is submitted with `bookingMode: "negotiation"`, the system picks the top 5 eligible providers and creates `OfferMatchAttempt` rows for each.
**See also:** [`Round-robin pool`](#round-robin-pool), [`OfferMatchAttempt`](#offermatchattempt), [`Negotiation`](#negotiation)
**ADR:** [`ADR-0039`](docs/DECISIONS.md) — Round-robin pool size 5, window 24h, env-tunable
**Source:** [`lib/matching/roundRobin.ts`](lib/matching/roundRobin.ts) — Invitation logic

---

### Round-robin pool
**Definition:** The set of eligible providers selected for a round-robin matching cycle. Size defaults to 5, tunable via `ROUND_ROBIN_POOL_SIZE` env var. Providers are scored and ranked using `parseOrderPriorityWeights` and eligibility criteria. Pool has a 24-hour window before expiry.
**Example:** For a cleaning order, the pool consists of the top 5 cleaning providers within 10km, scored by proximity, rating, and response rate.
**See also:** [`Round-robin invitation`](#round-robin-invitation), [`OfferMatchAttempt`](#offermatchattempt), [`Stale-attempt expiry`](#stale-attempt-expiry)
**ADR:** [`ADR-0039`](docs/DECISIONS.md) — Pool size 5, window 24h, env-tunable
**Source:** [`lib/matching/roundRobin.ts`](lib/matching/roundRobin.ts) — Pool logic

---

### Schedule
**Definition:** Prisma model for provider availability and appointment scheduling. Stores `workspaceId`, `dayOfWeek`, `startTime`, `endTime`, `isAvailable`, and `effectiveFrom`/`effectiveTo` date ranges.
**Example:** A plumbing provider sets availability: Monday-Friday 9:00-17:00, Saturday 10:00-14:00 via `Schedule` rows.
**See also:** [`Workspace`](#workspace), [`JobRecord`](#jobrecord)
**ADR:** Not yet covered by an ADR
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:1030) — Model definition

---

### Service
**Definition:** See [`ServiceCatalog`](#servicecatalog). The primary entity for defining what services are available on the platform.
**See also:** [`ServiceCatalog`](#servicecatalog), [`ServiceDefinition`](#servicedefinition)
**ADR:** [`ADR-0011`](docs/DECISIONS.md) — Dynamic service questionnaires on ServiceCatalog
**Source:** [`routes/services.ts`](routes/services.ts) — Service routes

---

### ServiceCatalog
**Definition:** Prisma model defining a service type available on the platform. Stores `categoryId`, `name`, `description`, `dynamicFieldsSchema` JSON (service questionnaire), `lockedBookingMode`, `sortOrder`, `published`, and lifecycle fields. Each catalog entry can have multiple `ProviderServicePackage` offerings from different workspaces.
**Example:** "Pipe Repair" is a `ServiceCatalog` entry under the "Plumbing" category with a dynamic questionnaire asking about pipe type, leak severity, and access constraints.
**See also:** [`Category`](#category), [`ProviderServicePackage`](#providerservicepackage), [`ServiceQuestionnaireV1`](#servicequestionnairev1)
**ADR:** [`ADR-0011`](docs/DECISIONS.md) — Dynamic service questionnaires on ServiceCatalog; [`ADR-0027`](docs/DECISIONS.md) — lockedBookingMode
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:618) — Model definition

---

### ServiceDefinition
**Definition:** Prisma model for admin-defined service type configurations. Stores `name`, `description`, `fields` JSON (questionnaire fields), `categoryId`, and lifecycle fields. Used by the admin service definition editor.
**Example:** An admin creates a "Plumbing Service Definition" with fields for issue type, urgency, and property access instructions.
**See also:** [`ServiceCatalog`](#servicecatalog), [`Form builder`](#form-builder)
**ADR:** [`ADR-0013`](docs/DECISIONS.md) — Service Definition editor is a fork of KYC FormBuilder
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:645) — Model definition

---

### ServiceQuestionnaireV1
**Definition:** Prisma model for versioned service questionnaires, mirroring `BusinessKycFormV1` structure. Stores `serviceCatalogId`, `version` (unique per catalog), `schema` JSON, `published`, and lifecycle fields. Enables questionnaire versioning independent of catalog changes.
**Example:** Version 1 of a plumbing questionnaire asks "What type of pipe?"; Version 2 adds "How urgent is the issue?" while keeping the same `ServiceCatalog` reference.
**See also:** [`ServiceCatalog`](#servicecatalog), [`Form builder`](#form-builder), [`BusinessKycFormSchema`](#businesskycformschema)
**ADR:** [`ADR-0012`](docs/DECISIONS.md) — ServiceQuestionnaireV1 mirrors BusinessKycFormV1
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:680) — Model definition

---

### StaffRole
**Definition:** Enum (`owner`, `admin`, `member`, `staff`, `client`) defining the role of a `User` within a `Company` via the `CompanyUser` join table.
**Example:** A company owner has role `owner`; a team member has role `staff`; an external collaborator has role `client`.
**See also:** [`CompanyUser`](#companyuser), [`Company`](#company), [`UserRole`](#userrole)
**ADR:** [`ADR-0026`](docs/DECISIONS.md) — Workspaces and ProviderServicePackage
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:255) — `CompanyUser.role` field

---

### Status (User)
**Definition:** Enum (`ACTIVE`, `INACTIVE`, `SUSPENDED`, `BANNED`) on the `User` model controlling account state. Suspended/banned users cannot log in or perform actions.
**Example:** A user who violates terms of service has their status set to `SUSPENDED` by an admin, preventing login.
**See also:** [`User`](#user), [`UserRole`](#userrole), [`Admin`](#admin)
**ADR:** Not yet covered by an ADR
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:33) — Enum definition

---

### Superseded version
**Definition:** A `ContractVersion` whose status is `superseded`, meaning a newer version has replaced it. Only the newest `sent` version can be acted upon; all previous versions are immutable and marked `superseded` for audit trail.
**Example:** Version 1 of a contract is sent; the provider creates Version 2 with updated terms; Version 1 automatically becomes `superseded`.
**See also:** [`ContractVersion`](#contractversion), [`ContractVersionStatus`](#contractversionstatus)
**ADR:** [`ADR-0047`](docs/DECISIONS.md) — Versioned immutable snapshots; [`ADR-0051`](docs/DECISIONS.md) — Append-only events
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:120) — `ContractVersionStatus.superseded`

---

### SystemConfig
**Definition:** Prisma model for key-value system configuration. Stores `key` (unique), `value` JSON, and `description`. Used for feature flags, dependency catalog, and platform-wide settings.
**Example:** A `SystemConfig` row with `key: "dependencyCatalog"` stores the JSON list of third-party service URLs and their health status.
**See also:** [`Dependency catalog`](#dependency-catalog), [`LegalPolicy`](#legalpolicy)
**ADR:** Not yet covered by an ADR
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:937) — Model definition

---

### Ticket
**Definition:** Prisma model for customer support tickets. Stores `userId`, `subject`, `description`, `status` string, `priority` string, and lifecycle fields.
**Example:** A customer creates a support ticket: "Payment not processed" with `priority: "high"` and `status: "open"`.
**See also:** [`User`](#user), [`Dispute`](#dispute)
**ADR:** Not yet covered by an ADR
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:1071) — Model definition

---

### Transaction
**Definition:** Prisma model for financial transactions. Stores `companyId`, `orderId` (optional), `type` string, `amount`, `currency`, `status` string, `paymentMethod`, and lifecycle fields.
**Example:** A payment of $500 for a completed plumbing job is recorded as a `Transaction` with `type: "payment"`, `amount: 500.00`, `currency: "CAD"`, `status: "completed"`.
**See also:** [`Invoice`](#invoice), [`Order`](#order), [`Workspace finance`](#workspace-finance)
**ADR:** Not yet covered by an ADR
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:1086) — Model definition

---

### User
**Definition:** Core Prisma model representing all platform users. Stores `email` (unique), `passwordHash`, `name`, `role` (UserRole), `status` (ACTIVE/INACTIVE/SUSPENDED/BANNED), `phone`, `avatarUrl`, `orderPriorities` JSON, and lifecycle fields. Related to `Company` via `CompanyUser`, to `Order` as customer or provider, and to KYC submissions.
**Example:** Alice signs up as a customer with `role: "customer"`, `status: "ACTIVE"`, and `email: "alice@example.com"`.
**See also:** [`UserRole`](#userrole), [`Status (User)`](#status-user), [`Customer`](#customer), [`Provider`](#provider), [`Admin`](#admin)
**ADR:** [`ADR-0002`](docs/DECISIONS.md) — Admin endpoints; [`ADR-0041`](docs/DECISIONS.md) — Customer priority templates
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:175) — Model definition

---

### UserAddress
**Definition:** Prisma model storing user addresses. Stores `userId`, `label` (home, work, etc.), `street`, `city`, `province`, `postalCode`, `country`, `lat`, `lng`, and `isDefault`.
**Example:** A customer saves their home address: "123 Main St, Toronto, ON, M5V 2T6" with `isDefault: true` and geocoded coordinates.
**See also:** [`User`](#user), [`KycLevel0Profile`](#kyclevel0profile)
**ADR:** Not yet covered by an ADR
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:196) — Model definition

---

### UserRole
**Definition:** Enum (`customer`, `provider`, `platform_admin`, `support`, `finance`) defining the platform-wide role of a `User`. Drives route access via `isAdmin` and role-checking middleware.
**Example:** A user with `role: "provider"` can create service packages and receive order invitations; a user with `role: "platform_admin"` can access the admin dashboard.
**See also:** [`User`](#user), [`Status (User)`](#status-user), [`Admin`](#admin), [`Provider`](#provider), [`Client`](#client)
**ADR:** [`ADR-0002`](docs/DECISIONS.md) — Admin endpoints under `/api/admin/*`
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:28) — Enum definition
> **Note:** The `UserRole` enum values (`customer`, `provider`, etc.) are **backend implementation details**. Product documentation uses the terms **Client**, **Business Client**, and **Admin/Support** instead. See [`Client`](#client) and [`Business Client`](#business-client) for the product-level terminology.


### UtilityLink
**Definition:** Prisma model for external utility links (banking, insurance, fuel, government, etc.). Stores `title`, `url`, `description`, `category`, `logoUrl`, `commissionRate`, `clickCount`, and lifecycle fields. Used for the utility links feature in the admin panel.
**Example:** A "TD Bank" utility link with category "BANK" and commission rate 2.5% is displayed in the customer app; each click increments `clickCount`.
**See also:** [`UtilityLinkClick`](#utilitylinkclick), [`Admin`](#admin)
**ADR:** Not yet covered by an ADR
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:993) — Model definition

---

### UtilityLinkClick
**Definition:** Prisma model tracking clicks on `UtilityLink` entries. Stores `linkId`, optional `userId`, `clickedAt` timestamp, and `userAgent`.
**Example:** When a customer clicks the "TD Bank" utility link, a `UtilityLinkClick` row is created recording the click time and browser user agent.
**See also:** [`UtilityLink`](#utilitylink), [`User`](#user)
**ADR:** Not yet covered by an ADR
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:1009) — Model definition

---

### WebAuthnCredential
**Definition:** Prisma model for passwordless authentication credentials (WebAuthn/Passkeys). Stores `userId`, `credentialID` (unique), `credentialPublicKey`, `counter` (BigInt), and `transports` JSON string.
**Example:** A user registers a passkey on their iPhone; the credential public key and counter are stored for future authentication challenges.
**See also:** [`User`](#user), [`UserRole`](#userrole)
**ADR:** Not yet covered by an ADR
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:210) — Model definition

---

### Workspace
**Definition:** Informal term for a company operating context; closest entity is `Company` plus `CompanyUser` memberships. Workspaces own `ProviderServicePackage` rows, `Product` inventory, `Invoice` records, and `OfferMatchAttempt` entries. See also **Business Workspace** for the product-level term.
**Example:** "Amir's Plumbing Inc." is a workspace with 3 employees, 5 active service packages, and a product inventory of 20 items.
**See also:** [`Business Workspace`](#business-workspace), [`Company`](#company), [`CompanyUser`](#companyuser), [`ProviderServicePackage`](#providerservicepackage)
**ADR:** [`ADR-0026`](docs/DECISIONS.md) — Workspaces and ProviderServicePackage
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:221) — `Company` model (closest entity)

---

### WorkspaceSocialRole
**Definition:** Prisma model for social/community roles within a workspace. Stores `workspaceId`, `userId`, `grantedById`, and lifecycle fields.
**Example:** A workspace admin grants the "community_manager" social role to a team member, giving them permissions to manage the workspace's social media presence.
**See also:** [`Workspace`](#workspace), [`Company`](#company), [`CompanyUser`](#companyuser)
**ADR:** Not yet covered by an ADR
**Source:** [`prisma/schema.prisma`](prisma/schema.prisma:1041) — Model definition

---

### AI coach (order description)
**Definition:** Client-side Gemini-powered feature that assists customers in writing order descriptions. Runs in the browser (same pattern as KYC document analysis). Persists only the final user-edited `description` and `descriptionAiAssisted` flag on `Order`.
**Example:** A customer types "I need help with my kitchen sink" and clicks "AI Assist"; Gemini suggests a detailed description which the customer edits before submitting.
**See also:** [`Order`](#order), [`KYC L0 / L1 / L2`](#kyc-l0--l1--l2)
**ADR:** [`ADR-0016`](docs/DECISIONS.md) — AI coach for order description: client-side Gemini
**Source:** [`frontend/src/services/orders.ts`](frontend/src/services/orders.ts) — Order service

---

### Form builder
**Definition:** In-house React-based form builder used for KYC form schemas and service questionnaires. Uses a three-pane layout (sections/fields, inspector, preview) with debounced autosave. Implemented as sibling folders for KYC and Service Definitions.
**Example:** An admin uses the form builder to create a business KYC form with fields for business name, license number, and insurance details.
**See also:** [`BusinessKycFormSchema`](#businesskycformschema), [`ServiceQuestionnaireV1`](#servicequestionnairev1)
**ADR:** [`ADR-0021`](docs/DECISIONS.md) — Form builder stays in-house; [`ADR-0023`](docs/DECISIONS.md) — Form Builder rebuilt from scratch
**Source:** [`frontend/src/components/admin/kyc/`](frontend/src/components/admin/kyc/) — KYC form builder components

---

### PreviewAsCustomer
**Definition:** React component that maps each `ServiceFieldType` to native HTML controls for admin preview of customer-facing inputs. Photo fields hold `File[]` in memory with thumbnails; actual uploads happen in the order flow.
**Example:** An admin designing a plumbing questionnaire uses PreviewAsCustomer to see how the "Describe the issue" text field and "Upload a photo" field will appear to customers.
**See also:** [`ServiceQuestionnaireV1`](#servicequestionnairev1), [`Form builder`](#form-builder)
**ADR:** [`ADR-0022`](docs/DECISIONS.md) — PreviewAsCustomer uses native HTML widgets
**Source:** [`frontend/src/components/admin/serviceDefinitions/`](frontend/src/components/admin/serviceDefinitions/) — Service definition components

---

### Stale-attempt expiry
**Definition:** Lazy/on-demand computation of expired `OfferMatchAttempt` rows. `expireStaleAttempts(orderId)` marks invited attempts as `expired` and runs slot replacement when inbox or candidates endpoints are accessed. No background scheduler.
**Example:** A provider's invitation window expires; the next time the customer views their order, `expireStaleAttempts` runs, marks the attempt as `expired`, and invites the next eligible provider.
**See also:** [`OfferMatchAttempt`](#offermatchattempt), [`Round-robin pool`](#round-robin-pool)
**ADR:** [`ADR-0042`](docs/DECISIONS.md) — Stale-attempt expiry is lazy/on-demand
**Source:** [`lib/matching/roundRobin.ts`](lib/matching/roundRobin.ts) — Expiry logic

---

### Provider response rate
**Definition:** Metric computed on demand from last-30-day `OfferMatchAttempt` statuses (`accepted`, `declined`, `expired`). Used in eligibility scoring for matching. Not cached in Sprint I.
**Example:** A provider who accepted 8 out of 10 invitations in the last 30 days has an 80% response rate, boosting their eligibility score.
**See also:** [`OfferMatchAttempt`](#offermatchattempt), [`MatchAttemptStatus`](#matchattemptstatus)
**ADR:** [`ADR-0038`](docs/DECISIONS.md) — Provider response rate is recomputed on demand
**Source:** [`lib/matching/eligibility.ts`](lib/matching/eligibility.ts) — Eligibility scoring

---

### Mixed-currency BOM
**Definition:** BOM lines whose `snapshotCurrency` differs from the package `currency`. These lines are counted in `crossCurrencyLines` and excluded from `bomCost` in Phase 1. No FX conversion is performed.
**Example:** A Canadian package priced in CAD includes a US-sourced product with snapshot price $50 USD. The line is flagged as `crossCurrencyLines: true` and excluded from the computed BOM cost.
**See also:** [`BillOfMaterials`](#billofmaterials), [`ProductInPackage`](#productinpackage), [`ProviderServicePackage`](#providerservicepackage)
**ADR:** [`ADR-0032`](docs/DECISIONS.md) — Mixed-currency BOM lines: warn, do not convert
**Source:** [`lib/packageMargin.ts`](lib/packageMargin.ts) — Margin computation

---

### Guest wizard
**Definition:** Order creation flow accessible to unauthenticated users. Guests can browse categories and fill the order wizard, but draft API calls return 401 without a token. The wizard navigates to `/auth` with `returnTo` preserving the current query string.
**Example:** An unauthenticated user browses to `/orders/new?homeCategory=plumbing`, fills in the wizard, and is prompted to sign in before the draft can be saved.
**See also:** [`Order`](#order), [`ServiceCatalog`](#servicecatalog), [`Category`](#category)
**ADR:** [`ADR-0054`](docs/DECISIONS.md) — Home → Order deep links + guest wizard entry; [`ADR-0055`](docs/DECISIONS.md) — Public catalog tiles
**Source:** [`routes/orders.ts`](routes/orders.ts) — Order routes

---

### Effective booking mode
**Definition:** The resolved booking mode for a `ProviderServicePackage` after applying the override hierarchy: `ServiceCatalog.lockedBookingMode` wins if set, else the package's explicit `bookingMode`, else `inherit_from_catalog` defaults to the catalog's mode. Computed by `effectiveBookingModeLabel`.
**Example:** A package has `bookingMode: "inherit_from_catalog"` and the catalog has `lockedBookingMode: "auto_appointment"`. The effective mode is `auto_appointment`.
**See also:** [`BookingMode`](#bookingmode), [`ServiceCatalog`](#servicecatalog), [`ProviderServicePackage`](#providerservicepackage)
**ADR:** [`ADR-0027`](docs/DECISIONS.md) — lockedBookingMode overrides; [`ADR-0028`](docs/DECISIONS.md) — Effective booking label
**Source:** [`lib/bookingModeUtils.ts`](lib/bookingModeUtils.ts) — Booking mode utilities

---

### Chat translation
**Definition:** Additive metadata on `OrderChatMessage` storing `sourceLang`, `targetLang`, and `translatedText`. Original content is preserved in `originalText` for audit. Translation is computed on demand with graceful fallback to original text when unavailable.
**Example:** A Spanish-speaking customer sends "Hola, ¿cuándo puedes venir?"; the system translates to English and stores `translatedText: "Hello, when can you come?"` with `sourceLang: "es"`, `targetLang: "en"`.
**See also:** [`OrderChatMessage`](#orderchatmessage), [`PII guard`](#pii-guard)
**ADR:** [`ADR-0045`](docs/DECISIONS.md) — Translation is additive metadata; original content preserved
**Source:** [`lib/chatTranslate.ts`](lib/chatTranslate.ts) — Translation logic

---

### KYC AI analysis
**Definition:** Client-side Gemini-powered analysis of identity documents for KYC Level 1 submissions. Returns `KycAiAnalysis` with fraud indicators, OCR name extraction, name match verification, and a recommendation (`approve`, `reject`, `manual_review`).
**Example:** A provider uploads their passport; the AI analysis returns `isLikelyFraud: false`, `ocrName: "John Doe"`, `nameMatchesProfile: true`, `recommendation: "approve"`, `confidence: 0.95`.
**See also:** [`KycPersonalSubmission`](#kycpersonalsubmission), [`KYC L0 / L1 / L2`](#kyc-l0--l1--l2)
**ADR:** [`ADR-0005`](docs/DECISIONS.md) — Client-side AI for KYC OCR/fraud
**Source:** [`lib/kycTypes.ts`](lib/kycTypes.ts) — `KycAiAnalysis` type definition

---

### Order negotiation access
**Definition:** Shared access control logic in `lib/orderNegotiationAccess.ts` determining what operations invited workspace members can perform on an order before matching. Used by both `orderChat.ts` and `orderContracts.ts` routes.
**Example:** An invited provider's team member can read the order chat (read-only) and view contract status, but cannot send messages or draft contracts until the order is matched.
**See also:** [`OrderChatThread`](#orderchatthread), [`OrderContract`](#ordercontract), [`OfferMatchAttempt`](#offermatchattempt)
**ADR:** [`ADR-0052`](docs/DECISIONS.md) — Pre-match order chat read; [`ADR-0053`](docs/DECISIONS.md) — Pre-match contracts list
**Source:** [`lib/orderNegotiationAccess.ts`](lib/orderNegotiationAccess.ts) — Access control

---

### Dependency catalog
**Definition:** Per-environment dependency catalog stored in `SystemConfig.dependencyCatalog` JSON. Admin-editable list of third-party service URLs and their status. Shape defined by `DependencyCatalogV1` in `lib/dependencyCatalog.ts`.
**Example:** The dependency catalog lists the Gemini API endpoint, NATS server URL, and Google Maps API URL with their current health status.
**See also:** [`SystemConfig`](#systemconfig), [`NATS`](#nats)
**ADR:** Not yet covered by an ADR
**Source:** [`lib/dependencyCatalog.ts`](lib/dependencyCatalog.ts) — Type definitions

---

### KYC expiry flags
**Definition:** JSON metadata on `BusinessKycSubmission` tracking when KYC documents and verifications expire. Used to trigger re-verification workflows. Computed by `lib/kycExpiryFlags.ts`.
**Example:** A business license expires on 2027-01-01; the expiry flags record this date and the system can alert the provider to renew before expiry.
**See also:** [`BusinessKycSubmission`](#businesskycsubmission), [`KYC L0 / L1 / L2`](#kyc-l0--l1--l2)
**ADR:** [`ADR-0003`](docs/DECISIONS.md) — KYC has 3 levels
**Source:** [`lib/kycExpiryFlags.ts`](lib/kycExpiryFlags.ts) — Expiry computation

---

### KYC business inquiry
**Definition:** External business registry lookup results stored on `BusinessKycSubmission.inquiryResults` JSON. Performed by `lib/kycInquiry/index.ts` to validate business registration details.
**Example:** A provider submits their business number; the inquiry system looks up the registry and returns the business name, status, and address for cross-validation.
**See also:** [`BusinessKycSubmission`](#businesskycsubmission), [`KYC L0 / L1 / L2`](#kyc-l0--l1--l2)
**ADR:** [`ADR-0003`](docs/DECISIONS.md) — KYC has 3 levels
**Source:** [`lib/kycInquiry/index.ts`](lib/kycInquiry/index.ts) — Business inquiry logic

---

### Order lifecycle notifications
**Definition:** NATS-triggered notification creation for order and contract lifecycle events. Consumers registered in `startNatsNotificationConsumers` handle `orders.matched`, `orders.completed`, and `contracts.approved` subjects to create `Notification` rows.
**Example:** When an order is matched, the `notifyCustomerOrderMatchedFromEvent` handler creates a notification: "Your order has been matched with a provider."
**See also:** [`NATS`](#nats), [`Notification`](#notification), [`Order`](#order)
**ADR:** Not yet covered by an ADR
**Source:** [`lib/orderLifecycleNotifications.ts`](lib/orderLifecycleNotifications.ts) — Notification handlers

---

### Category breadcrumbs
**Definition:** Computed path from root to a given category node, used for navigation display. Implemented in `lib/categoryBreadcrumbs.ts`.
**Example:** For a "Pipe Repair" category under "Plumbing" under "Home Services", the breadcrumb is "Home Services > Plumbing > Pipe Repair".
**See also:** [`Category`](#category), [`Category tree`](#category-tree)
**ADR:** [`ADR-0024`](docs/DECISIONS.md) — Tree read
**Source:** [`lib/categoryBreadcrumbs.ts`](lib/categoryBreadcrumbs.ts) — Breadcrumb computation

---

### Service tree view
**Definition:** Combined view of categories and their associated service catalogs, used by the admin panel for managing the service taxonomy. Implemented in `lib/categoryServiceTreeView.ts`.
**Example:** An admin sees a tree: "Home Services > Plumbing > [Pipe Repair, Drain Cleaning]" where the leaf items are `ServiceCatalog` entries.
**See also:** [`Category tree`](#category-tree), [`ServiceCatalog`](#servicecatalog)
**ADR:** [`ADR-0024`](docs/DECISIONS.md) — Tree read with services
**Source:** [`lib/categoryServiceTreeView.ts`](lib/categoryServiceTreeView.ts) — Tree view logic

---

### Order snapshot
**Definition:** The `schemaSnapshot` JSON field on `Order` that captures the `ServiceCatalog.dynamicFieldsSchema` at the time of order creation. Ensures the questionnaire structure is preserved even if the catalog schema changes later.
**Example:** A customer fills a plumbing questionnaire; the schema is snapshotted into `Order.schemaSnapshot` so the admin can see exactly what questions were asked.
**See also:** [`Order`](#order), [`ServiceCatalog`](#servicecatalog)
**ADR:** [`ADR-0011`](docs/DECISIONS.md) — Dynamic service questionnaires on ServiceCatalog
**Source:** [`lib/orderSnapshot.ts`](lib/orderSnapshot.ts) — Snapshot logic

---

### Order photos for validation
**Definition:** Photo uploads attached to an `Order` during the wizard flow, stored in the `photos` JSON field. Used by providers to assess the job before accepting. Validated by `lib/orderPhotosForValidate.ts`.
**Example:** A customer uploads 3 photos of a leaking pipe; the provider reviews them before accepting the order.
**See also:** [`Order`](#order), [`MediaAsset`](#mediaasset)
**ADR:** Not yet covered by an ADR
**Source:** [`lib/orderPhotosForValidate.ts`](lib/orderPhotosForValidate.ts) — Photo validation

---

### Workspace finance
**Definition:** Aggregated financial view for a workspace, built by `lib/buildProviderWorkspaceFinance.ts`. Combines transactions, invoices, and package data into a unified finance dashboard.
**Example:** A workspace owner views their finance dashboard showing total income, outstanding invoices, and per-package profitability.
**See also:** [`Workspace`](#workspace), [`Invoice`](#invoice), [`Transaction`](#transaction)
**ADR:** Not yet covered by an ADR
**Source:** [`lib/buildProviderWorkspaceFinance.ts`](lib/buildProviderWorkspaceFinance.ts) — Finance aggregation

---

### Contract draft from AI
**Definition:** AI-generated contract version created via `POST /api/orders/:orderId/contracts/draft-from-ai`. Creates a **draft** `ContractVersion` with `generatedByAi=true`. Providers must explicitly **send** and customers **approve** in separate steps. No auto-binding.
**Example:** A provider clicks "Draft with AI" for a plumbing order; the system generates a contract draft with terms based on the order description and chat history.
**See also:** [`ContractVersion`](#contractversion), [`Contract template`](#contract-template)
**ADR:** [`ADR-0049`](docs/DECISIONS.md) — AI contract suggestion is advisory; human-in-the-loop
**Source:** [`routes/orderContracts.ts`](routes/orderContracts.ts) — Contract routes

---

### Admin overview stats
**Definition:** Aggregated statistics for the admin dashboard, typed as `AdminOverviewStats` in `lib/adminOverviewStats.ts`. Includes counts of users, orders, revenue, and platform activity.
**Example:** The admin dashboard shows "1,234 total users, 567 orders this month, $45,678 total revenue" computed from the `AdminOverviewStats` type.
**See also:** [`Admin`](#admin), [`AuditLog`](#auditlog)
**ADR:** [`ADR-0002`](docs/DECISIONS.md) — Admin endpoints
**Source:** [`lib/adminOverviewStats.ts`](lib/adminOverviewStats.ts) — Stats type

---

### Admin users list
**Definition:** Paginated, filterable list of platform users for the admin panel. Typed as `AdminUserRow` in `lib/adminUsersTypes.ts` and fetched via `lib/adminUsersList.ts`.
**Example:** An admin views all users, filters by role `provider`, and sees a table with name, email, status, and KYC status.
**See also:** [`Admin`](#admin), [`User`](#user), [`UserRole`](#userrole)
**ADR:** [`ADR-0002`](docs/DECISIONS.md) — Admin endpoints
**Source:** [`lib/adminUsersList.ts`](lib/adminUsersList.ts) — User listing logic

---

### Admin orders list
**Definition:** Admin-facing order listing with phase filtering, pagination, and detailed order information. Typed as `AdminOrderListItem` in `lib/adminOrdersList.ts`.
**Example:** An admin views all orders in the `job` phase, filters by `in_progress` status, and sees customer/provider details and current contract info.
**See also:** [`Admin`](#admin), [`Order`](#order), [`OrderPhase`](#orderphase)
**ADR:** [`ADR-0035`](docs/DECISIONS.md) — Shared phase contract for customer and admin UIs
**Source:** [`lib/adminOrdersList.ts`](lib/adminOrdersList.ts) — Order listing logic

---

### Admin user detail
**Definition:** Detailed view of a single user for the admin panel, including profile, KYC status, order history, and account actions. Typed in `lib/adminUserDetail.ts`.
**Example:** An admin clicks on a user to see their full profile, KYC submission history, recent orders, and ability to suspend or change role.
**See also:** [`Admin`](#admin), [`User`](#user), [`KYC L0 / L1 / L2`](#kyc-l0--l1--l2)
**ADR:** [`ADR-0002`](docs/DECISIONS.md) — Admin endpoints
**Source:** [`lib/adminUserDetail.ts`](lib/adminUserDetail.ts) — User detail logic
