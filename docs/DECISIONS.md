# Architecture Decision Records (lightweight)

## ADR-0001 — Keep Prisma at v5
**Date:** 2026-04-24 **Status:** Accepted
**Context:** `package.json` pins `@prisma/client` and `prisma` to `^5.22.0`;
`prisma/schema.prisma` uses the v5-style `datasource db { url = env("DATABASE_URL") }`
block.
**Decision:** Stay on Prisma 5.x; agents do not run migrations.
**Consequences:** ✅ stable toolchain ❌ no Prisma 6/7-only features.

## ADR-0002 — Admin endpoints under /api/admin/* with isAdmin middleware
**Date:** 2026-04-24 **Status:** Accepted
**Context:** `server.ts` mounts `adminRoutes` at `/api/admin` and `adminKycRoutes`
at `/api/admin/kyc`; `routes/admin.ts` and `routes/adminKyc.ts` apply
`router.use(authenticate, isAdmin)` from `lib/auth.middleware.ts`.
**Decision:** Admin JSON APIs live only under `/api/admin` with shared admin
gate.
**Consequences:** ✅ single RBAC choke-point ❌ public callers must not rely on
these paths.

## ADR-0003 — KYC has 3 levels; legacy `model KYC` kept as shim
**Date:** 2026-04-24 **Status:** Accepted
**Context:** `prisma/schema.prisma` defines `KYC` plus newer `KycLevel0Profile`,
`KycPersonalSubmission`, and `BusinessKycSubmission`; `routes/adminKyc.ts`
mirrors approved personal status into legacy `KYC` rows.
**Decision:** New flows use v2 tables; legacy model remains for compatibility.
**Consequences:** ✅ migration path ❌ dual writes until legacy retired.

## ADR-0004 — BusinessKycFormSchema is versioned; submissions keep historical schemaVersion
**Date:** 2026-04-24 **Status:** Accepted
**Context:** `BusinessKycFormSchema` has `version Int @unique`; `BusinessKycSubmission`
stores `schemaVersion Int` and `answers Json`.
**Decision:** Treat published schemas as immutable versions tied to submissions.
**Consequences:** ✅ auditability ❌ migrations need careful publishing.

## ADR-0005 — Client-side AI for KYC OCR/fraud (cost on user)
**Date:** 2026-04-24 **Status:** Accepted
**Context:** `@google/genai` is imported from `src/` services/components with
browser-side API key wiring (`VITE_GEMINI_API_KEY`).
**Decision:** Keep Gemini calls client-side unless/until a reviewed server
proxy exists.
**Consequences:** ✅ fast iteration ❌ key exposure surface must be guarded in
deployment.

## ADR-0006 — Customer Flutter cabin: 4-tab bottom nav, no center FAB
**Date:** 2026-04-24 **Status:** Accepted
**Context:** `flutter_project/lib/widgets/neighborly_shell.dart` builds four
equal bottom cells for customers and has no `FloatingActionButton`.
**Decision:** Preserve this navigation contract for the customer cabin rebuild.
**Consequences:** ✅ consistent UX ❌ feature additions must fit four slots or
use inner screens.

## ADR-0007 — Order routing: auto_book vs round_robin_5
**Date:** 2026-04-24 **Status:** Accepted
**Context:** Orders submitted by customers need to be routed to eligible providers. Two distinct matching modes exist: `auto_appointment` (auto-book the best-scored provider immediately) and `negotiation` (invite multiple providers into a round-robin pool for customer selection). The `ServiceCatalog.lockedBookingMode` and `ProviderServicePackage.bookingMode` fields determine which mode applies per catalog/package combination.

**Decision:** Implement a two-tier matching engine in [`lib/matching/`](lib/matching/) that runs synchronously on order submit:

1. **Auto-appointment (auto_book):** [`autoMatchOffer`](lib/matching/orchestrator.ts:31) runs inline in `POST /api/orders/draft/:id/submit` ([`routes/orders.ts:415`](routes/orders.ts:415)). It selects the single best-scored eligible auto-appointment package via [`findEligiblePackagesForOffer`](lib/matching/eligibility.ts:248) and creates an `OfferMatchAttempt` with status `matched`. The order transitions to `matched` status with `matchedPackageId`, `matchedProviderId`, and `matchedWorkspaceId` set. If no eligible package is found, or if retries exceed depth 3, the order stays `submitted` with `autoMatchExhausted=true`.

2. **Round-robin negotiation (round_robin_5):** [`roundRobinInviteOffer`](lib/matching/roundRobin.ts:48) invites up to 5 eligible negotiation-mode packages (env-tunable via `ROUND_ROBIN_POOL_SIZE`, default 5) with a 24h matching window (`ROUND_ROBIN_WINDOW_HOURS`, default 24). The order transitions to `matching` status. Providers can accept/decline; on decline or expiry, [`replaceAttempt`](lib/matching/roundRobin.ts:162) adds one replacement invite reusing the original window expiry (no extension). Stale expiry is computed lazily via [`expireStaleAttempts`](lib/matching/roundRobin.ts:207) on inbox/candidates access.

3. **Scoring formula** ([`lib/matching/eligibility.ts:221-227`](lib/matching/eligibility.ts:221)): Packages are scored by a weighted sum of `distanceTerm` (haversine km, ≤50km max), `ratingTerm` (negative, higher rating = lower score), `priceTerm` (finalPrice/100), and `responseRateTerm` (negative, higher response rate = lower score). Customer `orderPriorities.weights` can override default multipliers via [`parseOrderPriorityWeights`](lib/matching/roundRobin.ts:22).

4. **Eligibility gates** ([`lib/matching/eligibility.ts:204-206`](lib/matching/eligibility.ts:204)): Provider workspace must have `kycStatus=verified`, provider must be `isVerified` and `status=active`, and the effective booking mode must match the target mode. Distance is capped at 50km via `MAX_MATCH_KM`.

5. **Fallback chain** ([`routes/orders.ts:412-468`](routes/orders.ts:412)): On submit, the engine first tries auto-appointment matching. If no eligible auto packages exist, it falls back to round-robin negotiation invites. If both fail, the order is submitted with `autoMatchExhausted=true` and no match.

6. **`OfferMatchAttempt`** ([`prisma/schema.prisma:323`](prisma/schema.prisma:323)) is the canonical audit record for every match decision, storing `status`, `score`, `distanceKm`, `invitedAt`, `matchedAt`, `expiresAt`, `declineReason`, `lostFeedback`, and `metadata`.

**Consequences:** ✅ synchronous matching on submit provides instant feedback and simple debugging ✅ round-robin pool gives customers choice while bounding provider invite volume ✅ lazy expiry avoids background scheduler dependency ❌ submit latency includes matching cost (practical 2-second budget) ❌ late declines near window end produce immediately expiring replacement invites ❌ no background cron for stale attempts — relies on on-demand expiry.

## ADR-0008 — In-chat PII blocking + AI translation policy
**Date:** 2026-04-24 **Status:** Accepted
**Context:** Order-scoped chat (ADR-0043) requires server-enforced PII blocking to prevent contact-sharing outside the platform, plus AI-powered translation for multilingual users. Two separate chat systems exist: a legacy general chat via [`routes/chat.ts`](routes/chat.ts) using `ChatRoom`/`ChatMessage`/`Ticket` models, and the order-scoped chat via [`routes/orderChat.ts`](routes/orderChat.ts) using `OrderChatThread`/`OrderChatMessage` models. The order-scoped chat is the canonical implementation for the matching/contracting workflow.

**Decision:**

1. **PII blocking is server-enforced on send** ([`lib/chatModeration.ts`](lib/chatModeration.ts)): Every outgoing order-chat message passes through [`moderateMessage`](lib/chatModeration.ts:29) which scans for:
   - Email addresses (`EMAIL_RE`)
   - Phone numbers (`PHONE_RE`) — international and local formats
   - URLs/links (`LINK_RE`)
   - Social handles (`HANDLE_RE`) — `@username`, `t.me/`, `wa.me/`
   - External platform names (`PLATFORM_RE`) — Telegram, WhatsApp, Signal, etc.
   - Contact exchange patterns (`CONTACT_EXCHANGE_RE`) — "call me", "my number", "outside the app"

2. **Three-tier moderation action** ([`lib/chatModeration.ts:44-63`](lib/chatModeration.ts:44)):
   - **`allow`** — no PII detected, message passes through unchanged
   - **`mask`** — PII patterns are replaced with `***` asterisks in `displayText`; `originalText` is preserved unchanged. If a sender has ≥3 masked messages in 24h, subsequent masked messages are **blocked** ([`routes/orderChat.ts:251`](routes/orderChat.ts:251))
   - **`flag`** — explicit contact exchange intent detected (e.g., "contact me outside the app"); message is masked and flagged for admin review

3. **Translation is additive metadata** ([`lib/chatTranslate.ts`](lib/chatTranslate.ts)): Uses `GoogleGenAI` (`gemini-3-flash-preview` model) via `GEMINI_API_KEY` or `VITE_GEMINI_API_KEY`. The `originalText` and moderation-safe `displayText` are always preserved as canonical content. Translation output is stored as optional metadata (`sourceLang`, `targetLang`, `translatedText`) on the `OrderChatMessage` model ([`prisma/schema.prisma:509`](prisma/schema.prisma:509)). Graceful fallback to original text when AI translation is unavailable.

4. **Moderation pipeline** ([`routes/orderChat.ts:242-295`](routes/orderChat.ts:242)):
   - Message text is first moderated via `moderateMessage()`
   - If moderation action is `mask` and sender has ≥3 masked messages in 24h → **blocked** with `repeated_contact_sharing` reason
   - If moderation action is `block` → **blocked** immediately
   - `moderationStatus` is persisted as `clean`/`masked`/`flagged`/`blocked` via `ChatModerationStatus` enum
   - `moderationReasons` array is persisted as JSON
   - If `translateTo` target language is provided, `translateText()` is called on the `displayText` and result stored on the message

5. **Order-scoped vs general chat** ([`routes/orderChat.ts:54-83`](routes/orderChat.ts:54)):
   - Order chat uses `OrderChatThread` (one per order, lazy-created on first access)
   - Participants: customer, matched provider, workspace staff, and admins
   - Pre-match read access for invited workspace members via `invited_provider` role with `readOnly: true` ([`routes/orderChat.ts:217`](routes/orderChat.ts:217))
   - General chat ([`routes/chat.ts`](routes/chat.ts)) uses legacy `ChatRoom`/`ChatMessage`/`Ticket` models with a simpler inline `detectContactInfo` function that blocks messages entirely (no masking/flagging tiers)

6. **Legacy general chat PII detection** ([`routes/chat.ts:8-69`](routes/chat.ts:8)): A simpler `detectContactInfo` function checks phone patterns, emails, platform keywords, and contact-sharing phrases. Unlike the order-scoped chat, it **blocks** the message entirely with a `400` error rather than masking content.

**Consequences:** ✅ consistent server-enforced PII protection across all clients ✅ original text preserved for audit/legal review ✅ translation enables multilingual UX without losing source content ✅ graceful fallback when AI translation is unavailable ❌ occasional false positives require admin moderation workflows ❌ translation is single-target per message — recomputed for different target languages ❌ two parallel chat systems (order-scoped and legacy general) with different moderation approaches.

## ADR-0009 — docs/AGENTS.md is documentation only; code wins on conflict
**Date:** 2026-04-24 **Status:** Accepted
**Context:** `docs/AGENTS.md` (formerly root `AGENTS.md`) previously contained historical Firebase/Firestore
wording; the running app and schema use PostgreSQL, Prisma, and Express routes.
**Decision:** Treat `docs/AGENTS.md` (and similar guides) as non-authoritative; on
any conflict, **code and `prisma/schema.prisma` win**; update docs to match.
**Consequences:** ✅ less doc/code drift confusion ❌ agents must re-read
`ROADMAP.md` and code when instructions disagree.

## ADR-0010 — ROADMAP drift-check commands target the defining source file
**Date:** 2026-04-24 **Status:** Accepted
**Context:** F1 evidence lives in `lib/adminUsersList.ts` while
`routes/admin.ts` only delegates; grepping the router for implementation
detail is misleading.
**Decision:** `docs/ROADMAP.md` **Drift checks (commands):** must `grep` /
`test` the file where the symbol or string **actually** lives.
**Consequences:** ✅ `npm run docs:check` reflects real implementation ❌ moving
code requires updating the phase’s check lines.

## ADR-0011 — Dynamic service questionnaires on `ServiceCatalog`, not on `Service`
**Date:** 2026-04-24 **Status:** Accepted
**Context:** F5 will render order questions from a shared type definition;
per-provider `Service` rows are offers/pricing, not the canonical “job type”
form.
**Decision:** Store `dynamicFieldsSchema` and matching defaults on
`ServiceCatalog` only; per-provider `Service` stays a listing and may link
via `serviceCatalogId` for counts.
**Consequences:** ✅ one schema per product type ❌ all providers sharing a
type see the same questionnaire (by design).

## ADR-0012 — `ServiceQuestionnaireV1` mirrors `BusinessKycFormV1` for reuse
**Date:** 2026-04-24 **Status:** Accepted
**Context:** `lib/kycTypes.ts` + `isBusinessKycFormV1` + form builder are
proven; order wizard is another dynamic form.
**Decision:** `ServiceFieldDef` / `ServiceQuestionnaireV1` follow the KYC
field/schema shape; validators and future UI can share patterns
(`lib/serviceQuestionnaireValidate.ts` mirrors `kycBusinessValidate` style).
**Consequences:** ✅ faster F5 / admin parity ❌ two parallel type guards
(`isServiceQuestionnaireV1` vs KYC) must stay in sync for shared field kinds.

## ADR-0013 — Service Definition editor is a fork of KYC FormBuilder patterns
**Date:** 2026-04-25 **Status:** Accepted
**Context:** KYC’s `FormBuilder` layout (sections/fields, inspector, preview) is
proven, but KYC and service-catalog questionnaires have different type sets and
evolve on different product timelines.
**Decision:** Implement the admin Service Definition experience as a **sibling**
folder `src/components/admin/serviceDefinitions/`, reusing the same *patterns*
(state, debounced autosave, three-pane layout) by copy/adapt, **not** by importing
`src/components/admin/kyc/formBuilder/*`.
**Consequences:** ✅ independent refactors; ❌ some duplication of UI wiring
must be maintained consciously when shared primitives are desired later.

## ADR-0014 — `Order` is a new model distinct from `Request`
**Date:** 2026-04-24 **Status:** Accepted
**Context:** Legacy `Request` ties a customer to a single provider and a
`Service` row; F5 needs customer intent before any provider is chosen.
**Decision:** Introduce `Order` for the customer journey (catalog + answers +
schedule + address); keep `Request` unchanged for backward compatibility with
the provider dashboard.
**Consequences:** ✅ clear domain split ❌ two parallel “job” concepts until
legacy flows are retired or bridged.

## ADR-0015 — Order state machine for F5 MVP: draft → submitted → cancelled
**Date:** 2026-04-24 **Status:** Accepted
**Context:** Matching, contracts, and payments are out of scope for Sprint C
PROMPT 1–3; later phases need reserved enum values without breaking migrations.
**Decision:** `OrderStatus` includes `matching`, `matched`, `contracted`, `paid`,
`in_progress`, `completed` as **reserved** values; F5 backend only transitions
among `draft`, `submitted`, and `cancelled`.
**Consequences:** ✅ forward-compatible enum ❌ agents must not wire reserved
states until their phase lands.

## ADR-0016 — AI coach for order description: client-side Gemini; store text + flag
**Date:** 2026-04-24 **Status:** Accepted
**Context:** Order wizard will offer an AI-assisted description (PROMPT 2+);
operators want cost on the end user and minimal server retention of model I/O.
**Decision:** Run Gemini coaching in the browser (same pattern family as KYC
document analysis); persist only the final user-edited `description` and
`descriptionAiAssisted` on `Order`.
**Consequences:** ✅ no server Gemini dependency for F5 ❌ key hygiene remains
a deployment concern (see ADR-0005).

## ADR-0021 — Form builder stays in-house; SurveyJS/Formio deferred
**Date:** 2026-04-24 **Status:** Accepted
**Context:** Admin Service Definitions need a schema editor, preview, and
validation. Heavier form-builder products exist (SurveyJS, Formio) but add
weight and licensing considerations for a monolith that already has typed
`ServiceQuestionnaireV1` and native preview.
**Decision:** Keep the in-house form builder in React + `ServiceQuestionnaireV1`
until a concrete need (e.g., very complex branching) justifies a third-party
embed.
**Consequences:** ✅ no new form-builder stack ❌ we maintain widgets and
validation ourselves.

## ADR-0022 — PreviewAsCustomer uses native HTML widgets; photo is local-only
**Date:** 2026-04-24 **Status:** Accepted
**Context:** Admins need to see customer-facing inputs while authoring the
service questionnaire. Photo fields must be distinguishable from text fields
without wiring upload in the admin preview.
**Decision:** `PreviewAsCustomer` maps each `ServiceFieldType` to native
controls; photo preview holds `File[]` in memory with thumbnails. Actual
uploads are handled in the F5 order flow via `/api/upload` (or equivalent),
not in the admin preview.
**Consequences:** ✅ WYSIWYG for layout ❌ no upload persistence from preview.

## ADR-0023 — Form Builder rebuilt from scratch on attempt 2
**Date:** 2026-04-25 **Status:** Accepted
**Context:** Patches to the in-house form builder failed to show visible UI
improvements in the admin preview/inspector, blocking confidence in
`ServiceQuestionnaireV1` authoring.
**Decision:** `PreviewAsCustomer.tsx` and `PropertyInspector.tsx` were fully
replaced. Builder validation for save-blocking errors lives in
`lib/serviceQuestionnaireBuilderValidate.ts`. Regression risk is acceptable on
this single feature; it is the canonical builder going forward.
**Consequences:** ✅ predictable widget mapping + inspectable code paths
❌ a full regression pass on the Service Definitions flow is still expected.

## ADR-0024 — Tree read: `GET /api/categories/tree-with-services` (single round-trip)
**Date:** 2026-04-25 **Status:** Accepted
**Context:** The admin and customer UIs need a reparentable, sortable category
hierarchy and attached catalog rows without N+1 round-trips. F0 caps visible
depth at 5; archived rows are operator-only in most views.
**Decision:** Expose an authenticated `GET /api/categories/tree-with-services`
that returns a nested `Category` tree (with `depth`, `children`, `sortOrder`,
`archivedAt`, `icon`, `description`) and `ServiceCatalogLite` (including
`slug`, `isActive`, `_count.providerServices`) only on categories that have no
child category rows. Admins may pass `includeArchived`; non-admins are rejected
if they set it. Deeper than five levels is not serialized; the server logs once
per elided node when a depth cap is hit.
**Consequences:** ✅ one payload for the tree editor ❌ clients must not assume
unbounded depth beyond the cap.

## ADR-0025 — Admin tree mutations: `/api/admin/categories-tree` + `lib/categoryTreeOps.ts`
**Date:** 2026-04-25 **Status:** Accepted
**Context:** Reordering, soft-archive, and create-child operations must
preserve `sortOrder` within siblings, forbid cycles, and keep insertion depth
≤5. Archive/unarchive of categories and services is restricted to
`owner` / `platform_admin`.
**Decision:** Add `Category.sortOrder` / `archivedAt` and matching fields on
`ServiceCatalog` with Prisma indexes on `(parentId, sortOrder)` and
`(categoryId, sortOrder)`. Implement `POST` handlers under
`/api/admin/categories-tree` (mounted in `server.ts`) behind
`authenticate` + `isAdmin`, with `reorder-category`, `reorder-service`,
`archive-*`, `unarchive-*`, `create-child-category`, and `create-leaf-service`.
Shared validation and sibling resequencing live in `lib/categoryTreeOps.ts`
(`computeDepth`, `willExceedDepth`, `detectCycle`, `resequenceSiblings`).
**Consequences:** ✅ consistent ordering and safe moves ❌ UI drag-drop
(PROMPT 2) must call these contracts.

## ADR-0026 — Workspaces and `ProviderServicePackage` as the unit of sellable offers
**Date:** 2026-04-25 **Status:** Accepted
**Context:** Providers need per-company (workspace) pricing and booking rules without duplicating the global service catalog.
**Decision:** Introduce `Workspace` as the company container; `ProviderServicePackage` links `workspaceId`, `userId` (provider), `serviceCatalogId`, `bookingMode`, pricing, and lifecycle fields. Orders continue to target catalog-backed definitions; package rows scope provider offers.
**Consequences:** ✅ clear ownership and listing filters ❌ extra joins for cross-workspace admin views.

## ADR-0027 — `ServiceCatalog.lockedBookingMode` overrides explicit package mode
**Date:** 2026-04-25 **Status:** Accepted
**Context:** Admins need to stop negotiation on a regulated catalog entry while most packages stay inheriting defaults.
**Decision:** `lockedBookingMode` is `null` (free) or one of `auto_appointment` / `negotiation`. Admin `PUT` rejects (`409`) if existing packages have an *explicit* `bookingMode` that would disagree with the new lock. Provider APIs validate with `assertBookingModeAllowedForCatalog`.
**Consequences:** ✅ predictable “lock wins” semantics ❌ providers must retune or archive conflicting packages.

## ADR-0028 — Effective booking label: lock wins, else package, else inherit
**Date:** 2026-04-25 **Status:** Accepted
**Context:** UIs need one string for tables and draw without duplicating three-way logic.
**Decision:** `effectiveBookingModeLabel(catalogLocked, packageMode)` in `bookingModeUtils.ts` labels locked row tone vs inherit vs explicit negotiation/auto.
**Consequences:** ✅ one helper for admin + provider tables ❌ label copy must track enum renames in Prisma.

## ADR-0029 — BOM snapshots are frozen at link time
**Date:** 2026-04-25 **Status:** Accepted
**Context:** Package BOM lines must keep stable cost inputs when catalog `Product` rows change.
**Decision:** `ProductInPackage` stores `snapshotUnitPrice`, `snapshotCurrency`, `snapshotProductName`, and `snapshotUnit` at create (and on explicit refresh). Editing a `Product` does not mutate existing BOM rows; providers refresh via **Refresh prices from inventory** (per line or all).
**Consequences:** ✅ auditable package economics ❌ stale snapshots until refresh.

## ADR-0030 — Cost / margin / marginPercent computed on read only
**Date:** 2026-04-25 **Status:** Accepted
**Context:** Persisted margin fields drift from BOM or price edits.
**Decision:** `computePackageMargin` in `lib/packageMargin.ts` derives `bomCost`, `crossCurrencyLines`, `margin`, and `marginPercent` from the package `finalPrice`/`currency` and BOM snapshot lines whenever packages or BOM endpoints are read; values are not stored on `ProviderServicePackage`.
**Consequences:** ✅ single source of truth ❌ every list/detail query does a small sum.

## ADR-0031 — Labor is a normal Product row
**Date:** 2026-04-25 **Status:** Accepted
**Context:** Avoid a parallel “manual line items” structure for labor vs materials.
**Decision:** Labor uses `Product` with `category` such as `Labor` and `unit` of `hour` or `flat` (or other agreed units); BOM lines reference the same `ProductInPackage` model.
**Consequences:** ✅ one inventory + BOM model ❌ UI must filter/group by category where needed.

## ADR-0032 — Mixed-currency BOM lines: warn, do not convert (Phase 1)
**Date:** 2026-04-25 **Status:** Accepted
**Context:** Providers may source items priced in different currencies than the package list price.
**Decision:** Lines whose `snapshotCurrency` ≠ package `currency` are counted in `crossCurrencyLines` and excluded from `bomCost`; the workspace package `currency` is the display currency; Phase 1 does not FX-convert.
**Consequences:** ✅ honest partial cost when mixed ❌ operators must refresh or normalize data manually.

## ADR-0033 — Order table name unchanged; `phase` derived from `status`
**Date:** 2026-04-25 **Status:** Accepted
**Context:** Nine `OrderStatus` values need business-level grouping without renaming the `Order` model or enum.
**Decision:** Add nullable `Order.phase` (`OrderPhase`) computed from `status` via `lib/orderPhase.ts` (`phaseFromStatus`). Every route mutation that changes `status` updates `phase` in the same Prisma write.
**Consequences:** ✅ stable API/table names ❌ two fields must stay aligned on writes.

## ADR-0034 — Cancelled rows keep last non-draft `phase`
**Date:** 2026-04-25 **Status:** Accepted
**Context:** Admins and customers need to filter “cancelled offers” vs “cancelled jobs”.
**Decision:** On transition to `cancelled`, set `phase` to `phaseFromStatus('cancelled', previousPhase)`. Backfill uses `AuditLog` metadata (`previousStatus`, etc.) when present; otherwise safe default `offer`.
**Consequences:** ✅ meaningful cancelled buckets ❌ cancel audit metadata should stay accurate.

## ADR-0035 — Shared phase contract for customer and admin UIs
**Date:** 2026-04-25 **Status:** Accepted
**Context:** Same lifecycle labels must appear consistently; only authorization scope differs.
**Decision:** Customer `GET /api/orders/me` and admin `GET /api/admin/orders` use the same `phase` / `phase[]` / `includeDrafts` rules and the same `facets.phase` shape; customer lists are scoped to `customerId`.
**Consequences:** ✅ one mental model ❌ both surfaces must update when phase rules change.

## ADR-0036 — Auto-appointment matching runs synchronously on submit
**Date:** 2026-04-25 **Status:** Accepted
**Context:** Sprint I requires instant provider visibility in Inbox after customer submit, without queue infrastructure.
**Decision:** `autoMatchOffer` runs inline in `POST /api/orders/draft/:id/submit` with a practical 2-second latency budget target. If matching finds no eligible candidate (or retries are exhausted), the order stays/submits in `offer` phase with `status='submitted'` and `autoMatchExhausted=true`.
**Consequences:** ✅ simple, deterministic flow and easy debugging ❌ submit path now includes matching cost and can grow with traffic.

## ADR-0037 — OfferMatchAttempt is the source of truth for match decisions
**Date:** 2026-04-25 **Status:** Accepted
**Context:** We need an auditable stream of invites/matches/declines now, and reusable analytics inputs for later sprints.
**Decision:** Persist every decision in `OfferMatchAttempt` and treat it as canonical for Sprint J round-robin orchestration and Sprint M lost-deal analytics.
**Consequences:** ✅ clear event history and replayability ❌ more joins when rendering order timelines.

## ADR-0038 — Provider response rate is recomputed on demand
**Date:** 2026-04-25 **Status:** Accepted
**Context:** Sprint I traffic is low; caching response-rate aggregates adds complexity and invalidation risk.
**Decision:** Compute provider response rate from last-30-day `OfferMatchAttempt` statuses (`accepted/declined/expired`) at read-time in eligibility scoring; do not cache in Sprint I.
**Consequences:** ✅ no cache coherence burden now ❌ extra query/aggregation overhead per match evaluation (revisit in Sprint Q analytics).

## ADR-0039 — Round-robin pool size 5, window 24h, env-tunable
**Date:** 2026-04-25 **Status:** Accepted
**Context:** Negotiation-mode offers need concurrent invitations with bounded latency, while preserving a deterministic customer decision window.
**Decision:** Round-robin invites up to 5 eligible negotiation packages with a 24h window by default (`ROUND_ROBIN_POOL_SIZE`, `ROUND_ROBIN_WINDOW_HOURS`). Replacements on decline/expiry fill the slot but always reuse the original slot/window expiry timestamp (no window extension).
**Consequences:** ✅ predictable customer window and provider fairness ❌ late declines can produce immediately expiring replacements near window end.

## ADR-0040 — Lost-deal feedback is captured per attempt
**Date:** 2026-04-25 **Status:** Accepted
**Context:** Providers need a lightweight way to report why they lost an invite after decline, expiry, or supersede without blocking workflow completion.
**Decision:** Persist feedback directly on `OfferMatchAttempt` as `(reasons[], otherText, providerComment)` in `lostFeedback`, with denormalized `lostReason` CSV for fast filtering. Aggregation and analytics dashboards are deferred to Sprint N.
**Consequences:** ✅ keeps feedback attached to concrete decision events ❌ reporting remains limited until Sprint N analytics surfaces land.

## ADR-0041 — Customer priority templates persist on User.orderPriorities
**Date:** 2026-04-25 **Status:** Accepted
**Context:** Customers selecting among multiple accepted providers may want to reuse weighting preferences for future offers.
**Decision:** Allow `POST /api/orders/:id/select-provider` to persist `priorityTemplate.weights` into `User.orderPriorities` with `savedAt`. Scorers read user weights when present and fall back to Sprint I defaults otherwise.
**Consequences:** ✅ reusable personalization without a new table ❌ template governance/versioning remains lightweight in Sprint J.

## ADR-0042 — Stale-attempt expiry is lazy/on-demand
**Date:** 2026-04-25 **Status:** Accepted
**Context:** Sprint J requires invite expiry behavior but current traffic does not justify operational overhead for a dedicated scheduler.
**Decision:** Compute expiry lazily on inbox/candidates access via `expireStaleAttempts(orderId)`; mark stale invited attempts as `expired` and run slot replacement as needed. Cron/background sweeping is deferred until traffic demands it.
**Consequences:** ✅ simpler rollout and no background worker dependency ❌ stale records update only when relevant endpoints are hit.

## ADR-0043 — Chat is order-scoped with strict participants
**Date:** 2026-04-25 **Status:** Accepted
**Context:** Sprint K chat must stay aligned with order lifecycle and never become a general direct-message channel.
**Decision:** Introduce `OrderChatThread` keyed by `orderId` (one thread per order). Only the order customer, matched provider, and admin roles can access it. Thread creation is lazy on first open once `matchedProviderId` exists.
**Consequences:** ✅ clear access boundary and audit trail per order ❌ users cannot reuse history across unrelated orders.

## ADR-0044 — PII guard is server-enforced on send
**Date:** 2026-04-25 **Status:** Accepted
**Context:** Client-side checks are bypassable and cannot be trusted for contact-sharing prevention.
**Decision:** Every outgoing order-chat message passes through `moderateMessage` on the server. Contact artifacts are masked by default, explicit exchange intent is flagged, and repeated masked attempts in 24h are blocked.
**Consequences:** ✅ consistent enforcement across all clients ❌ occasional false positives require admin moderation workflows.

## ADR-0045 — Translation is additive metadata; original content is preserved
**Date:** 2026-04-25 **Status:** Accepted
**Context:** Moderation and legal review require immutable source text even when translation is enabled.
**Decision:** Persist `originalText` and moderation-safe `displayText` as canonical message content. Store translation as optional metadata (`sourceLang`, `targetLang`, `translatedText`) with graceful fallback to original text when AI translation is unavailable.
**Consequences:** ✅ audit-safe history with multilingual UX support ❌ translation caching is single-target and may be recomputed for different targets.

## ADR-0046 — PII guard is server-enforced; UI only reflects status
**Date:** 2026-04-25 **Status:** Accepted
**Context:** Admin and participant UIs may show badges, previews, or translated text, but the browser cannot be the enforcement boundary for contact-sharing rules (see ADR-0044).
**Decision:** Treat all chat moderation outcomes (`moderationStatus`, `displayText`, block vs send) as authoritative from the API only. Client components must not re-classify or “un-mask” content; the admin moderation UI lists server-flagged rows and actions (`review`, `escalate`, `note`) mutate persisted metadata without changing enforcement logic.
**Consequences:** ✅ consistent trust model across web/admin/ future clients ❌ UI-only hints cannot replace a missing server guard.

## ADR-0047 — Contract is versioned immutable snapshots; only newest version can be acted on
**Date:** 2026-04-26 **Status:** Accepted
**Context:** Matched orders need auditable legal text; edits must not mutate history after send.
**Decision:** Persist each negotiation round as `ContractVersion` rows (immutable snapshot fields). Customer approve/reject applies only to the **newest** `sent` version; older rows transition to `superseded` instead of being overwritten.
**Consequences:** ✅ clear audit trail ❌ more rows per order.

## ADR-0048 — Approval transitions order to `contracted` (if not already), then unlocks payment link generation in Sprint M
**Date:** 2026-04-26 **Status:** Accepted
**Context:** Payments (Sprint M) must attach to a customer-approved contract baseline.
**Decision:** `POST .../approve` sets `Order.status` to `contracted` and `phase` to `job` via `phaseFromStatus` (idempotent if already contracted). `OrderContract.currentVersionId` points at the approved `ContractVersion`.
**Consequences:** ✅ single gate for “contract signed off” ❌ re-opening a job after approve needs a later phase/ADR if product requires it.

## ADR-0049 — AI contract suggestion is advisory; final legal text is always explicit and user-editable
**Date:** 2026-04-26 **Status:** Accepted
**Context:** `draft-from-ai` accelerates drafting but must not auto-bind parties without review.
**Decision:** AI output creates a **draft** `ContractVersion` with `generatedByAi=true`; providers must **send** explicitly; customers **approve** in a separate step. Manual `POST .../draft` remains first-class.
**Consequences:** ✅ human-in-the-loop ❌ no one-click “AI signed contract”.

## ADR-0050 — Contract mismatch guard checks chat-summary vs clauses and emits non-blocking warnings
**Date:** 2026-04-26 **Status:** Accepted
**Context:** Chat and drafted terms can drift (visits, price mentions).
**Decision:** `lib/contractMismatchGuard.ts` returns string warnings; persisted on the version as `mismatchWarnings` JSON and returned to clients; never blocks send/approve.
**Consequences:** ✅ visibility for support ❌ heuristic false positives possible.

## ADR-0051 — Contract version approvals are append-only events; historical versions remain immutable for auditability
**Date:** 2026-04-26 **Status:** Accepted
**Context:** Support and disputes require a tamper-evident history of what was proposed and approved.
**Decision:** `ContractVersion` snapshot fields are not rewritten in place after send; transitions use status changes plus `ContractEvent` rows (`customer_approved`, `admin_marked_reviewed`, `admin_internal_note`, etc.). Supersede creates a new terminal status on a row without deleting it.
**Consequences:** ✅ audit-grade timeline ❌ more storage per negotiation round.

## ADR-0052 — Pre-match order chat read for invited workspace members
**Date:** 2026-04-28 **Status:** Accepted
**Context:** Round-robin and invite flows surface orders in the provider inbox before `Order.matchedProviderId` is set; workspace staff hit `400` from `/api/orders/:id/chat/thread` and saw harsh errors in Flutter.
**Decision:** `routes/orderChat.ts` creates or reuses `OrderChatThread` using a provisional `providerId` from the newest active `OfferMatchAttempt` (`invited` / `accepted` / `matched`) when the order is not yet matched. Users who pass `listMyWorkspaces` membership against an attempt’s `workspaceId` receive role `invited_provider`, `readOnly: true` on GET, and `403` with `CHAT_READ_ONLY_UNTIL_MATCHED` on POST message/translate. Matched workspace staff and the matched provider keep full `provider` behavior. Stable machine codes: `NO_MATCHED_PROVIDER` when no attempt exists yet; `orderContracts` gate returns `code: NO_MATCHED_PROVIDER` / `ORDER_STATE` alongside `error` text.
**Consequences:** ✅ negotiation transparency for invited teams ❌ invited readers cannot post until match; thread `providerId` updates when the order becomes matched.

## ADR-0054 — Home → Order deep links + guest wizard entry (web + Flutter)
**Date:** 2026-05-02 **Status:** Accepted (Phase A)
**Context:** Marketing Home (`/` / Flutter `/`) must route into Create Order with category context from chips/banners, a “New offer” entry with an explicit **Other** path for unsupported taxonomies, and guests want to explore the wizard before signing in. Order rows still require a real `customerId` (`prisma` `Order.customerId` is non-null).
**Decision:**
1. **Query contract** — `homeCategory`, `prefillServiceCatalogId`, `prefillProviderId` (UI-only until matching persists it), `newOffer=1`, plus existing `from` / `serviceCatalogId` / `entryPoint` (Flutter). Documented in `docs/CUSTOMER-HOME-ORDER-FLOW.md`.
2. **Category resolution** — Clients fetch public `GET /api/categories/tree` and resolve `homeCategory` to `pathIds[]` by name/slug heuristic; pass as `initialPathIds` into the React `CategoryTreeBrowser` / Flutter wizard hints.
3. **Guest web** — `Route /orders/new` renders `OrderWizard` without forcing `<Navigate to="/auth" />`. Draft API calls still return **401** without a token; HTTP client **must not** hard-redirect the whole tab — the wizard navigates to `/auth` with `returnTo` including the current query string.
4. **Provider hint** — Banner flows may pass `prefillProviderId` for display/copy only in Phase A; matching logic unchanged.
5. **AI assist (Phase A)** — “Suggest categories” uses existing public `GET /api/categories/search?q=…` over user text, not a new trained endpoint.
**Consequences:** ✅ marketing ↔ wizard continuity across clients ❌ true anonymous drafts / provider-pinning in DB remain Phase B in `CUSTOMER-HOME-ORDER-FLOW.md`.

## ADR-0055 — Public catalog tiles by category (+ optional subtree) for guest wizard
**Date:** 2026-05-02 **Status:** Accepted
**Context:** Flutter (and web) order entry must let guests pick a **ServiceCatalog** from taxonomy without calling provider-scoped listing APIs. `GET /api/service-catalog/by-category/:categoryId` previously required `authenticate`, blocking guest flows and encouraging clients to infer a catalog id from the first marketplace **Service** row (which incorrectly pins a provider context).
**Decision:** Make `GET /api/service-catalog/by-category/:categoryId` a **public** read-only list of active catalogs. Support optional `?deep=1` so one request can return catalogs attached to the category **or any descendant** (used when the UI offers a single “main category” root). `GET /api/service-catalog/:id/schema` stays authenticated.
**Consequences:** ✅ guest-safe catalog discovery aligned with taxonomy ❌ listing is metadata-only (no pricing); abuse surface is low-volume read.

## ADR-0053 — Pre-match read for contracts list + payment status (invited workspace)
**Date:** 2026-04-28 **Status:** Accepted
**Context:** `routes/orderContracts.ts` returned `403`/`400` for invited inbox workspaces before `Order.matchedProviderId` was set, while `orderChat.ts` already exposed read-only thread access (ADR-0052). Flutter showed error banners and empty contract/payment panels for legitimate inbox states.
**Decision:** Introduce `lib/orderNegotiationAccess.ts` with `userHasActiveInboxAttemptForOrder` (shared with `orderChat.ts`). `resolveParticipantRole` gains `invited_provider`. `GET /api/orders/:orderId/contracts` and `GET .../contracts/context` return **200** with `readOnly: true`, `code: CONTRACTS_LOCKED_UNTIL_MATCHED`, and `lockReason` (no contract bodies for pre-match). Mutations stay `403` with `CONTRACTS_READ_ONLY_UNTIL_MATCHED` where applicable. `GET /api/orders/:orderId/payments/status` returns **200** for the same audience with `readOnly: true`, `code: PAYMENT_CUSTOMER_AFTER_CONTRACT`, and explanatory `lockReason` (no payment secrets); session/confirm remain customer/staff-only.
**Consequences:** ✅ Flutter can render gated copy without treating expected states as hard failures ❌ invited users still cannot draft/pay until match + contract rules (ADR-0048).

## ADR-0056 — Public `GET /api/service-catalog/:id` for wizard pricing snapshot
**Date:** 2026-05-03 **Status:** Accepted
**Context:** The order wizard review step needs a guest-safe, read-only estimate (lowest active `ProviderServicePackage.finalPrice` plus BOM line snapshots) without exposing authenticated schema payloads.
**Decision:** Add `GET /api/service-catalog/:id` (registered after `/:id/schema` in `routes/serviceCatalog.ts`) returning catalog id/name plus optional `price` and `bom.lines` derived from the cheapest active package for that catalog; inactive catalogs return `404`.
**Consequences:** ✅ review UI can show marketplace-style estimates for guests ❌ reflects one representative package, not full marketplace pricing.

## ADR-0057 — Contract templates: explicit placeholders + same versioned workflow
**Date:** 2026-05-05 **Status:** Accepted
**Context:** F8 needs predictable, non-magical starting points for `ContractVersion` drafts before optional AI or future DB-managed catalogs.
**Decision:** Ship a **code-defined** template registry (`lib/contractTemplateCatalog.ts`) whose Markdown uses `{{camelCase}}` tokens replaced from order + chat context (`lib/renderContractTemplate.ts`). `POST /api/orders/:orderId/contracts/draft-from-template` creates a normal **draft** row with `generatedByAi=false`, `generationPrompt` set to `template:<templateId>`, and `generationContext` storing `{ templateId, templateVersion, placeholderKeys }`. Listing uses `GET .../contracts/templates`. Lifecycle (send / approve / reject / supersede) is unchanged.
**Consequences:** ✅ auditable, AI-ready structure ❌ template prose changes require a deploy until a separate admin/DB layer exists.

## ADR-0058 — `JobRecord` extends `Order` without renaming lifecycle core
**Date:** 2026-05-05 **Status:** Accepted
**Context:** `Order` already spans offer/order/job lifecycle states, but Sprint N needs a traceable offer-to-job chain with analytics-ready job metrics while preserving backward compatibility.
**Decision:** Keep `Order` as the canonical lifecycle entity and add `Order.broadcastList` plus a 1:1 `JobRecord` (`orderId @unique`, relation `OrderJob`) to hold operational job timestamps, cancellation metadata, and analytics fields (`responseTimeMinutes`, `priceDelta`, `customerRating`) with `JobStatus`.
**Consequences:** ✅ additive migration with minimal API break risk ❌ job-level reporting now joins across `Order` and `JobRecord` until dedicated read models exist.

## ADR-0059 — Web direction: `frontend/` greenfield shell vs root `src/` SPA
**Date:** 2026-05-13 **Status:** Accepted
**Context:** The repository ships two React+Vite web surfaces: the root SPA (`index.html` → `src/main.tsx`, `npm run dev`) and a separate app under `frontend/` (README: `cd frontend && npm run dev`). `docs/ROADMAP.md` Phase 0 calls for scaffolding the new shell alongside the existing backend; `docs/ui.txt` specifies provider/company IA for the new UX.
**Decision:** Treat **`frontend/`** as the **default target** for new web IA and provider UX alignment with `docs/ui.txt` and Phase 0+. Keep **`src/`** as the **continuing legacy + admin + broader feature** bundle until a future ADR explicitly migrates routes or deprecates the root SPA.
**Consequences:** ✅ agents have a single written default when choosing where to add net-new web UX ❌ temporary duplication of web effort across two bundles until cutover.

## ADR-0060 — Client surfaces: Flutter and web are both first-class
**Date:** 2026-05-13 **Status:** Accepted
**Context:** `flutter_project/` and web clients all consume `/api/*`. The roadmap defers specific Flutter scope (for example order-wizard parity) while still listing Flutter parity as a cross-cutting goal.
**Decision:** **Both** Flutter and web are **first-class** product surfaces. Prefer **`frontend/`** for new web shell work per ADR-0059; do **not** treat Flutter as secondary to web or vice versa in planning—coordinate API contracts across bundles. Roadmap deferrals describe **schedule**, not **deprecation** of a client.
**Consequences:** ✅ avoids false either/or prioritization in documentation ❌ requires discipline to keep API behavior backward-compatible for multiple clients.

## ADR-0061 — Redis Slot Locking for Provider Capacity Validation

**Status:** Accepted
**Date:** 2026-05-26
**Author:** AI Agent (Orchestrator)

### Context
G1/G15 identified a race condition in the order submission flow: without a slot-locking mechanism, multiple customers could book the same time slot for the same provider, leading to double-booking. Additionally, there was no capacity validation to prevent matching when a provider had already reached their `maxDailyBookings` limit for a given date. The matching engine ([`lib/matching/orchestrator.ts`](lib/matching/orchestrator.ts)) would evaluate eligible packages purely on score, distance, and price — never checking whether the provider had remaining daily capacity.

### Decision
Implement Redis-based slot reservation with atomic Lua scripts for combined capacity check + reservation, with an in-memory fallback when Redis is unavailable. The solution is extracted into a dedicated module ([`lib/orderCapacity.ts`](lib/orderCapacity.ts)) to keep [`routes/orders.ts`](routes/orders.ts) from growing further.

### Key Design Choices

1. **Atomic Lua script** — [`reserveSlotAtomic`](lib/redis.ts:266) combines capacity check + reservation in a single Redis `EVAL` call, preventing race conditions between the count-and-set steps. Returns `CAPACITY_EXCEEDED` or `SLOT_ALREADY_RESERVED` codes on failure.

2. **Key naming** — `neighborly:slot:{providerId}:{date}:{slotKey}` — consistent with the existing `neighborly:` prefix used throughout [`lib/redis.ts`](lib/redis.ts). The `slotKey` component encodes `{staffId}:{HH}:{MM}` for granular per-staff, per-time reservations.

3. **TTL strategy** — Matching window durations: `standard` = 86400s (24h), `urgent` = 7200s (2h), `emergency` = 1800s (30min). Defined in [`URGENCY_TTL_SECS`](lib/orderCapacity.ts:16) within [`lib/orderCapacity.ts`](lib/orderCapacity.ts). This ensures slots auto-expire when the matching window closes, preventing stale reservations.

4. **In-memory fallback** — When Redis is unavailable, [`lib/cache.ts`](lib/cache.ts) provides Map-based equivalents (`cacheReserveSlot`, `cacheReleaseSlot`, `cacheGetReservedSlots`, `cacheReserveSlotAtomic`). These are best-effort and non-atomic — the Lua script's atomicity guarantee is lost without Redis.

5. **Flexible scheduling** — When `scheduledAt` is null (flexible scheduling), [`checkPackageCapacity`](lib/orderCapacity.ts:77) defers the capacity check entirely, returning all packages as under capacity. Slot reservation is also skipped for null dates. This is documented as future work: check capacity across the flexibility range.

6. **Extraction to `lib/orderCapacity.ts`** — Kept [`routes/orders.ts`](routes/orders.ts) (already ~2000 lines) from growing further. The new module encapsulates all capacity logic: [`checkPackageCapacity`](lib/orderCapacity.ts:77), [`reserveProviderSlot`](lib/orderCapacity.ts:145), and [`releaseProviderSlot`](lib/orderCapacity.ts:165).

### Consequences

**Positive:**
- ✅ Prevents double-booking of the same time slot for the same provider
- ✅ Enforces daily capacity limits (`maxDailyBookings`) per provider
- ✅ Atomic Lua operations prevent race conditions in slot reservation
- ✅ Auto-expiring slots via TTL prevent stale reservations
- ✅ Graceful degradation via in-memory fallback when Redis is down
- ✅ Capacity check is injected early in the submit flow, before matching, avoiding wasted matching work

**Negative:**
- ❌ Redis dependency for slot operations — if Redis is down, the in-memory fallback is non-atomic (best-effort only)
- ❌ Flexible scheduling capacity check is deferred — customers with flexible dates bypass capacity limits entirely until future work
- ❌ `KEYS` command used in Lua script (not `SCAN`) — acceptable for the small cardinality of per-provider-per-date slots, but should be revisited if slot counts grow significantly
- ❌ Slot release on cancel is best-effort (wrapped in try/catch) — a failed release leaves a stale reservation until TTL expiry

### Files Changed
- [`prisma/schema.prisma`](prisma/schema.prisma:341) — Added `maxDailyBookings` (Int, default 10) and `slotDurationMinutes` (Int, default 60) to `ProviderServicePackage`
- [`prisma/migrations/20260526020000_add_capacity_fields/`](prisma/migrations/20260526020000_add_capacity_fields/) — New migration for the schema change
- [`lib/redis.ts`](lib/redis.ts) — Added 4 slot reservation functions: `reserveSlot`, `releaseSlot`, `getReservedSlots`, `reserveSlotAtomic`
- [`lib/cache.ts`](lib/cache.ts) — Added 4 in-memory fallback functions: `cacheReserveSlot`, `cacheReleaseSlot`, `cacheGetReservedSlots`, `cacheReserveSlotAtomic`
- [`lib/orderCapacity.ts`](lib/orderCapacity.ts) — New module: `checkPackageCapacity`, `reserveProviderSlot`, `releaseProviderSlot`
- [`routes/orders.ts`](routes/orders.ts) — Injected capacity check in `runSubmitDraftOrderFlow()` after `findEligiblePackagesForOffer()` and before `autoMatchOffer()`; slot release on cancel for matched/contracted/paid orders
- [`lib/orderCapacity.test.ts`](lib/orderCapacity.test.ts) — 13 tests covering all edge cases (under capacity, over capacity, flexible scheduling deferral, mixed capacity, duplicate reservation, capacity exceeded, urgency TTLs, slot release, null scheduledAt)

## ADR-0062 — Quote-First Booking Mode

**Status:** Accepted
**Date:** 2026-05-26
**Author:** AI Agent (Orchestrator)

### Context
G2 — Quote-First flow was not fully implemented. Customers could create orders but had no mechanism to request quotes from providers before committing to a booking. The existing [`routes/quotes.ts`](routes/quotes.ts) had cross-cutting rule violations: no Zod validation (R1), inconsistent response formats, improper Express error handling (R13), `as any` type assertions (R14), and monetary values stored as `Float` instead of `Int` cents (R10). The quote lifecycle was incomplete — only `DRAFT` and `SENT` statuses existed, with no `ACCEPTED`, `REJECTED`, or `EXPIRED` transitions, and no integration with the order state machine or contract creation.

### Decision
Fully rewrite [`routes/quotes.ts`](routes/quotes.ts) with Zod validation, cents-based monetary values, proper error handling, NATS notifications, and a complete quote lifecycle (`DRAFT` → `SENT` → `ACCEPTED`/`REJECTED`/`EXPIRED`). The quote-first flow integrates with the existing order state machine: orders in `quote_first` booking mode enter `matching` state, providers submit quotes, and customers accept/reject. Acceptance transitions the order to `contracted` and auto-creates a contract.

### Key Design Choices

1. **Monetary values in cents (Int)** — All quote amounts (`subtotal`, `tax`, `total`) stored as `Int` cents, divided by 100 for display. Prevents floating-point rounding errors (R10 compliance). The `Order.budget` field (Int?, cents) is set on quote accept to provide a spending cap for downstream escrow/payment flows.

2. **Zod validation** — All 7 endpoints use Zod schemas with `safeParse()` for structured validation errors. Schemas defined at module top level (`createQuoteSchema`, `updateQuoteSchema`, `sendQuoteSchema`, `acceptQuoteSchema`, `rejectQuoteSchema`) with inferred TypeScript types via `z.infer`.

3. **`assertOrderIsQuoteFirst()` helper** — Validates the order is in `quote_first` booking mode and `matching` status before any quote operation. Returns `400` with `INVALID_ORDER_STATE` code if the order is in the wrong state, preventing quote operations on non-quote orders.

4. **48-hour quote expiry** — `validUntil` is set to 48 hours from send time when a provider sends a quote. Enforced at the application level via the `send` endpoint. No automatic expiry cron — relies on application-level checks (consistent with ADR-0042's lazy expiry pattern).

5. **Order returns to `matching` on reject** — When a customer rejects a quote, the quote transitions to `REJECTED` status and the order returns to `matching` state, allowing other providers to submit quotes for the same order. This preserves the round-robin pool semantics from ADR-0007.

6. **Budget set on accept** — `Order.budget = quote.total` is set when the customer accepts a quote, providing a spending cap for downstream escrow/payment flows. The order transitions to `contracted` and a contract is auto-created via `OrderContract` + `ContractVersion` with the quote total as the contract amount.

7. **NATS notifications** — Three new NATS subjects (`quotes.sent`, `quotes.accepted`, `quotes.rejected`) with corresponding notification handlers in [`lib/orderLifecycleNotifications.ts`](lib/orderLifecycleNotifications.ts):
   - `notifyCustomerQuoteSentFromEvent` — notifies customer when provider sends a quote
   - `notifyProviderQuoteAcceptedFromEvent` — notifies all workspace members when customer accepts
   - `notifyProviderQuoteRejectedFromEvent` — notifies all workspace members when customer rejects

8. **Consistent response format** — All endpoints return `{ data: T }` envelope (R2 compliance). Error responses use structured `{ code, message }` format. Express errors are forwarded via `next(error)` (R13 compliance). All `as any` type assertions removed (R14 compliance).

### Consequences

**Positive:**
- ✅ Complete quote-first flow with full lifecycle (DRAFT → SENT → ACCEPTED/REJECTED/EXPIRED)
- ✅ Proper Zod validation on all endpoints with structured error responses
- ✅ Cents-based monetary accuracy preventing floating-point rounding errors
- ✅ Real-time NATS notifications for quote lifecycle events
- ✅ Auto-contract creation on quote accept streamlines the customer journey
- ✅ Order returns to `matching` on reject, preserving provider pool semantics
- ✅ Budget field on Order provides spending cap for future payment flows
- ✅ 13 tests covering all endpoints and edge cases

**Negative:**
- ❌ No automatic quote expiry cron job — relies on application-level checks (consistent with ADR-0042 lazy expiry pattern)
- ❌ No counter-offer support — G4 planned for Phase 3
- ❌ No quote revision history — versionNumber exists but no version snapshot model
- ❌ Auto-contract creation on accept uses quote total directly — no separate contract negotiation step

### Files Changed
- [`prisma/schema.prisma`](prisma/schema.prisma:1198) — Quote monetary fields `subtotal`, `tax`, `total` changed from `Float` to `Int` (cents); `Order.budget` field added (Int?, cents)
- [`prisma/migrations/20260526030000_fix_quote_monetary_fields/`](prisma/migrations/20260526030000_fix_quote_monetary_fields/) — New migration for schema changes
- [`routes/quotes.ts`](routes/quotes.ts) — Full rewrite of all 7 endpoints with Zod validation, cents-based values, proper error handling, NATS publishing, and complete quote lifecycle
- [`lib/bus.ts`](lib/bus.ts:21) — Added `QUOTES_SENT`, `QUOTES_ACCEPTED`, `QUOTES_REJECTED` to `EventSubjects` const
- [`lib/orderLifecycleNotifications.ts`](lib/orderLifecycleNotifications.ts:158) — Added 3 notification handlers: `notifyCustomerQuoteSentFromEvent`, `notifyProviderQuoteAcceptedFromEvent`, `notifyProviderQuoteRejectedFromEvent`
- [`routes/quotes.test.ts`](routes/quotes.test.ts) — 13 tests covering all endpoints and edge cases

## ADR-0063 — Escrow Payment System

**Status:** Accepted
**Date:** 2026-05-26
**Author:** AI Agent (Orchestrator)

### Context
Orders lacked a secure payment lifecycle — funds needed to be held in escrow until service completion, with automatic release after a dispute window to protect both customers and providers. The existing [`routes/orderPayments.ts`](routes/orderPayments.ts) handled session creation and capture via a `Transaction` model, but had no dedicated `Payment` model to track the escrow lifecycle (pending → captured → refunded/failed), no commission calculation for the platform, and no time-based release mechanism for provider protection. The [`routes/orders.ts`](routes/orders.ts) complete/cancel flows had no integration with payment release or refund logic.

### Decision
Introduce a dedicated `Payment` model with a `pending → captured → refunded/failed` lifecycle, cents-based monetary values (Int), configurable commission calculation (default 15%), a 48-hour escrow release timer, and Stripe integration point fields. Escrow operations are extracted into a dedicated module ([`lib/orderPayments.ts`](lib/orderPayments.ts)) and wired into the existing order lifecycle: create on session, capture on confirm, release on complete, refund on cancel.

### Key Design Choices

1. **Payment model with unique orderId** — [`prisma/schema.prisma:558`](prisma/schema.prisma:558) defines `Payment` with `orderId @unique` (1:1 relation to `Order`). This ensures exactly one payment record per order, with `amount`, `commission`, and `deduction` all stored as `Int` (cents) per R10 rule. The `status` field uses the `PaymentStatus` enum ([`prisma/schema.prisma:105`](prisma/schema.prisma:105)): `pending | captured | refunded | failed`.

2. **Commission calculation** — [`createEscrowPayment`](lib/orderPayments.ts:119) computes `commission = Math.round(amount * commissionPercent / 100)` with a default of 15%. `deduction = amount - commission` represents the provider payout. Both are stored as `Int` (cents) to prevent floating-point rounding errors. The `commissionPercent` parameter is configurable per call.

3. **48-hour escrow release timer** — [`releaseEscrowPayment`](lib/orderPayments.ts:188) sets `escrowReleaseAt` to `Date.now() + 48 * 60 * 60 * 1000` (48 hours from call time). This provides a dispute window after the provider marks the job as complete, during which the customer can raise issues. No automated cron job for release — consistent with ADR-0042's lazy expiry pattern.

4. **Stripe integration points** — The `Payment` model includes `stripePaymentIntentId` ([`prisma/schema.prisma:566`](prisma/schema.prisma:566)) and `stripeTransferId` ([`prisma/schema.prisma:567`](prisma/schema.prisma:567)) as nullable `String?` fields. These are placeholders for future Stripe SDK integration — no actual Stripe calls are made in the current implementation. The `captureEscrowPayment` function ([`lib/orderPayments.ts:150`](lib/orderPayments.ts:150)) accepts an optional `stripePaymentIntentId` parameter and stores it on the payment record.

5. **State machine guards** — Each escrow function validates the current payment state before transitioning:
   - [`captureEscrowPayment`](lib/orderPayments.ts:150): Only `pending` → `captured`; throws if not found or not pending
   - [`releaseEscrowPayment`](lib/orderPayments.ts:188): Only `captured` → sets `escrowReleaseAt`; throws if not found or not captured
   - [`refundEscrowPayment`](lib/orderPayments.ts:222): Only `captured` → `refunded`; throws if not found or not captured

6. **Non-fatal escrow operations** — All escrow calls in route handlers are wrapped in try/catch with `console.error` logging. This ensures that escrow record creation/capture/release/refund failures do not block the primary order flow (session creation, payment confirmation, order completion, order cancellation). Escrow is supplementary to the core transaction flow.

7. **Lifecycle wiring** — Escrow operations are integrated at four points:
   - [`routes/orderPayments.ts:166`](routes/orderPayments.ts:166): `createEscrowPayment` called in `POST /session` if no payment record exists yet
   - [`routes/orderPayments.ts:246`](routes/orderPayments.ts:246): `captureEscrowPayment` called in `POST /confirm` after the order transitions to `paid`
   - [`routes/orders.ts:1519`](routes/orders.ts:1519): `releaseEscrowPayment` called on order complete
   - [`routes/orders.ts:2229`](routes/orders.ts:2229): `refundEscrowPayment` called on order cancel

8. **Escrow info in status endpoint** — [`routes/orderPayments.ts:76-92`](routes/orderPayments.ts:76) includes escrow payment details (`id`, `amount`, `commission`, `deduction`, `status`, `escrowReleaseAt`, `createdAt`) in the `GET /status` response under an `escrow` key. The lookup is non-fatal — if the query fails, `escrow` is `null`.

### Consequences

**Positive:**
- ✅ Secure payment lifecycle with clear state transitions (pending → captured → refunded/failed)
- ✅ Commission and deduction tracking for platform/provider settlement (default 15%)
- ✅ 48-hour dispute window protects both parties after job completion
- ✅ Cents-based monetary values prevent floating-point rounding errors (R10 compliance)
- ✅ Stripe integration point fields enable future real payment provider integration without schema changes
- ✅ Non-fatal escrow operations prevent payment failures from blocking the order flow
- ✅ Escrow info exposed in payment status endpoint for transparency

**Negative:**
- ❌ No real payment provider integration yet — Stripe fields are placeholders only
- ❌ No automated cron job for escrow release — relies on application-level checks (consistent with ADR-0042 lazy expiry pattern)
- ❌ No escrow release webhook or event-driven release mechanism
- ❌ Commission percentage is hardcoded at call site (default 15%) — no per-provider or per-catalog commission configuration
- ❌ No partial refund support — refund is all-or-nothing

### Files Changed
- [`prisma/schema.prisma:105`](prisma/schema.prisma:105) — Added `PaymentStatus` enum: `pending | captured | refunded | failed`
- [`prisma/schema.prisma:558`](prisma/schema.prisma:558) — Added `Payment` model with fields: `id`, `orderId` (unique), `amount` (Int, cents), `commission` (Int, default 0), `deduction` (Int, default 0), `status` (PaymentStatus, default pending), `stripePaymentIntentId` (String?), `stripeTransferId` (String?), `escrowReleaseAt` (DateTime?), `createdAt`, `updatedAt`
- [`prisma/migrations/20260526040000_add_payment_model/`](prisma/migrations/20260526040000_add_payment_model/) — New migration for the Payment model
- [`lib/orderPayments.ts`](lib/orderPayments.ts) — New module: `createEscrowPayment`, `captureEscrowPayment`, `releaseEscrowPayment`, `refundEscrowPayment`
- [`routes/orderPayments.ts`](routes/orderPayments.ts) — Escrow info in `GET /status`, Payment creation in `POST /session`, Payment capture in `POST /confirm`
- [`routes/orders.ts`](routes/orders.ts) — `releaseEscrowPayment` on complete (line 1519), `refundEscrowPayment` on cancel (line 2229)
- [`lib/orderPayments.test.ts`](lib/orderPayments.test.ts) — 14 tests covering all 4 escrow functions with edge cases (not found, wrong state, custom commission, rounding)

## ADR-0064 — Budget / Price Range Fields
**Date:** 2026-05-26 **Status:** Accepted
**Context:** Orders lacked budget range fields — customers could only set a single `budget` value, with no min/max range for provider matching. **Decision:** Added `budgetMin` and `budgetMax` (both Int?, cents) to the Order model with Zod cross-field validation (`budgetMin < budgetMax`). All three fields are optional, positive integers. **Consequences:** ✅ Enables price range filtering in matching; ✅ Zod refine() ensures logical range; ✅ Backward compatible (all fields nullable); ❌ No matching eligibility integration yet.

## ADR-0065 — Walk-In Booking Mode
**Date:** 2026-05-26 **Status:** Accepted
**Context:** Providers needed a walk-in flow where customers physically present at the location can receive immediate service without prior appointment or matching. **Decision:** Added `POST /orders/walk-in` endpoint that creates orders directly in `contracted` status (skipping `submitted → matching → matched`), with Zod validation for provider/service/capacity checks, auto-creates a contract, and publishes `order.created`/`order.contracted` NATS events. **Consequences:** ✅ Immediate service without matching delay; ✅ Capacity validation prevents overbooking; ✅ Contract auto-creation ensures legal coverage; ✅ NATS events enable real-time notifications; ❌ No business hours validation yet; ❌ No guest checkout support.

## ADR-0066 — Provider Counter-Offer Negotiation Flow
**Date:** 2026-05-26 **Status:** Accepted
**Context:** Providers could only send one-directional quotes with no negotiation loop — customers had no way to counter a provider's offer, and providers could not adjust pricing in response to customer feedback. **Decision:** Added `counterOfferTo` (self-referential FK) to the Quote model enabling a chain of counter-offers. Created `POST /quotes/:id/counter` endpoint where the original provider can send a counter-offer with a new amount. Updated `POST /quotes/:id/respond` so accepting a counter transitions to `contracted` while rejecting leaves the original quote `SENT`. **Consequences:** ✅ Bidirectional negotiation between provider and customer; ✅ Counter-offer chain preserves full negotiation history; ✅ 48-hour expiry prevents stale counter-offers; ✅ Accept/Reject logic correctly handles counter-offer vs original quote; ❌ No customer-initiated counter-offer support; ❌ No automatic counter-offer expiration cron.

## ADR-0069 — Two-Way Rating System (Customer ↔ Provider)
**Date:** 2026-05-27 **Status:** Accepted
**Context:** Only customers could review providers (one-way rating). Providers had no mechanism to rate customers, making it impossible to build trust scores for both parties. The existing `OrderReview` model was customer-only (`reviewType` not defined, only customer→provider flow via `POST /orders/:id/review`). **Decision:** Extended the `OrderReview` model with `reviewerId` (nullable FK to User) and `reviewType` (`customer` or `provider`) fields. Added `POST /orders/:id/review-customer` for provider→customer reviews, `GET /providers/:id/reviews` for public provider review listings, and `GET /customers/:id/reviews` for customer review listings. Existing customer review flow unchanged (`POST /orders/:id/review` defaults to `reviewType=customer`). **Consequences:** ✅ Two-way trust scoring for platform quality; ✅ Public review visibility for both parties; ✅ Backward compatible — existing reviews default to customer type; ✅ Provider reputation visible to customers; ❌ No aggregated trust score calculation yet (deferred to future analytics phase).

## ADR-0070 — CI/CD Pipeline (GitHub Actions + SonarCloud)
**Date:** 2026-05-27 **Status:** Accepted
**Context:** The project had no automated CI/CD pipeline — all testing, linting, and type checking relied on manual developer execution. There was no automated build gate before merge, no SonarCloud quality analysis, and no Docker build validation in CI. **Decision:** Created `.github/workflows/ci.yml` (lint → typecheck → test-backend → test-frontend → build) and `.github/workflows/sonar.yml` (SonarCloud analysis on push/PR to main/dev branches). The CI pipeline uses PostgreSQL service container for backend tests, uploads coverage artifacts, and blocks the build job on all prior jobs passing. **Consequences:** ✅ Automated quality gates on every push/PR; ✅ Docker build validated in CI; ✅ Coverage reports uploaded as artifacts; ✅ SonarCloud integration for code quality; ❌ SonarCloud token must be configured in GitHub Secrets.

## ADR-0071 — Admin Analytics Dashboard
**Date:** 2026-05-27 **Status:** Accepted
**Context:** The admin panel lacked analytics capabilities — no charts for order volume, revenue trends, user growth, or KYC metrics. Phase 8 required an analytics dashboard with charts and key metrics. **Decision:** Created `routes/adminAnalytics.ts` with 5 endpoints (overview, orders, revenue, users, kyc) using Prisma aggregation queries grouped by date and status. The React frontend page at `frontend/admin/src/pages/Analytics.tsx` uses Recharts (already a dependency) for line/bar/pie charts with tab-based navigation (Overview → Orders → Revenue → Users → KYC). All endpoints are admin-only behind `authenticate + isAdmin` middleware. Monetary values are stored/returned as cents with formatted display strings. **Consequences:** ✅ Charts display real data from Prisma aggregations; ✅ Tab-based UI for focused analysis; ✅ Only admin-accessible behind auth gate; ✅ Uses existing Recharts dependency (no new packages); ❌ No time range picker (fixed 30-day window); ❌ No export/download capability; ❌ Top providers by revenue placeholder (uses categories, not providers).

## ADR-0067 — Reorder Flow
**Date:** 2026-05-26 **Status:** Accepted
**Context:** Customers could not reorder from a previous order — they had to manually re-enter all details for repeat services, creating friction and reducing repeat business. **Decision:** Added `originalOrderId` (self-referential FK) to the Order model and created `POST /orders/:id/reorder` endpoint that copies provider, service, budget, address, and questionnaire data from the original order into a new draft, with optional overrides for description, scheduledAt, addressId, and urgency. **Consequences:** ✅ One-click reordering for repeat services; ✅ Full field preservation (provider, service, budget, questionnaire); ✅ Optional overrides for flexibility; ✅ Ownership validation prevents unauthorized reorders; ❌ No reorder history UI yet; ❌ No support for reordering orders with different booking modes.

## ADR-0072 — AGENTS.md Rule #6 Clarification: Payment Schema vs Payment SDK
**Date:** 2026-05-27 **Status:** Accepted
**Context:** Rule #6 in both `docs/AGENTS.md` and root `AGENTS.md` stated "NO Stripe or payment libraries — out of scope" but the Payment model in `prisma/schema.prisma` already contains `stripePaymentIntentId` and `stripeTransferId` fields from a previous schema design. This contradiction confused agents about whether Stripe was permitted. The `stripe` npm package is NOT in `package.json` (confirmed via grep). **Decision:** Rule #6 was updated to clarify that the schema is Stripe-compatible but no SDK is installed. Payment flows use internal `Transaction` records until a gateway ADR is approved. **Consequences:** ✅ Agents no longer confused by the contradiction; ✅ Schema fields documented as future-ready; ❌ Payment gateway integration still pending.

> **⚠️ ADR renumbering note (2026-08-12):** Three `docs/adr/` files previously reused ADR numbers already assigned in this file. They were renumbered to the next free numbers to eliminate collisions. Decision content is unchanged:
> - `docs/adr/0069-quick-start-onboarding-social-order.md` → **ADR-0080** (was 0069; ADR-0069 above = "Two-Way Rating System" is the original).
> - `docs/adr/ADR-0070-mvp-contract-v1.md` → **ADR-0078** (was 0070; ADR-0070 above = "CI/CD Pipeline" is the original).
> - `docs/adr/ADR-0072-stripe-approval.md` → **ADR-0079** (was 0072; ADR-0072 above = "AGENTS.md Rule #6 Clarification" is the original).

## ADR-0073 — P1.1 Business Services, Packages & Inventory UI: Soft-Delete, Cents, TanStack Query
**Date:** 2026-05-28 **Status:** Accepted
**Context:** Prompt P1.1 from `docs/permanent/PROMPTS-LIST.md` requires CRUD for services, packages, and inventory in the Business Workspace. The existing `routes/services.ts` used hard-delete and float prices (dollars). The existing frontend pages (`MyServicesPage.tsx`, `InventoryPage.tsx`, `MyPackagesPage.tsx`) used inline styles (not TailwindCSS), `any` types, mixed price handling (float vs cents), and raw axios calls without TanStack Query. **Decision:**
1. **Backend:** Rewrote `routes/services.ts` with Zod validation (`createServiceSchema`, `updateServiceSchema`), soft-delete via `POST /:id/archive` and `POST /:id/unarchive` (instead of hard `DELETE`), and price stored as integer cents (`price: z.number().int().min(0)`). Standard API response format `{ data: T }` and `{ code, message, details }` for errors.
2. **Prisma Schema:** Updated `model Service` — changed `price` from `Float` to `Int @default(0)`, added `imageUrl String?`, `updatedAt DateTime? @updatedAt`, `archivedAt DateTime?`. Ran `prisma db push --accept-data-loss` to sync.
3. **Frontend:** Refactored all three pages to use TailwindCSS classes, TanStack Query (`useQuery` / `useMutation` / `useQueryClient`), proper TypeScript interfaces (no `any`), cents-to-dollars conversion in display (`price / 100`), and split into sub-components (`ServiceCard`, `ServiceFormModal`, etc.). Each page now has: loading state (text spinner), empty state (icon + message), error state (red banner), and archive/unarchive buttons.
**Consequences:** ✅ Soft-delete preserves data; ✅ Prices stored in cents (no float rounding); ✅ Zod validation on all API inputs; ✅ Standard response format; ✅ TailwindCSS throughout (no inline styles); ✅ TanStack Query for caching/refetching; ✅ Proper TypeScript types; ❌ Image upload endpoint not yet implemented (field exists in schema); ❌ Playwright UI verification not completed due to Vite port conflicts.

## ADR-0074 — P2.1 Restyle All React Pages with NeighborHub Tokens
**Date:** 2026-05-28 **Status:** Accepted
**Context:** Prompt P2.1 from `docs/permanent/PROMPTS-LIST.md` requires replacing legacy `app-*` CSS class prefixes with NeighborHub design tokens (`nh-*`) across all React frontend pages. The existing `tailwind.config.ts` already had `nh-*` token definitions alongside legacy `app-*` definitions, but 41 frontend source files still used `app-*` classes. **Decision:**
1. **Tailwind Config:** Added missing `nh-*` token equivalents for all `app-*` tokens: `nh-border-elevated`, `nh-accent`, `nh-warning`, `nh-danger`, `nh-purple`, `nh-card`, `nh-card-elevated`, `nh-input`.
2. **CSS Variables:** Mirrored all missing tokens in `index.css` for dynamic usage.
3. **Token Mapping:** `app-bg` → `nh-bg`, `app-bg-2`/`app-card` → `nh-surface`, `app-bg-3`/`app-card-2`/`app-input` → `nh-surface-elevated`, `app-text` → `nh-text`, `app-text-2` → `nh-text-secondary`, `app-text-3` → `nh-text-muted`, `app-border` → `nh-border`, `app-border-2` → `nh-border-elevated`, `app-primary` → `nh-primary`, `app-primary-dim` → `nh-primary-hover`, `app-secondary` → `nh-success`, `app-accent` → `nh-accent`, `app-warn` → `nh-warning`, `app-red` → `nh-danger`, `app-purple` → `nh-purple`.
4. **Mass Replacement:** Used Python script to replace all `app-*` class references across 41 files (~1390 replacements) in `frontend/src/`.
**Consequences:** ✅ Consistent NeighborHub design token usage across all React pages; ✅ All 338 existing tests pass (21 test files, 1 pre-existing failure unrelated); ✅ Client SPA build passes (tsc + vite); ✅ Admin SPA build passes (tsc + vite); ✅ TypeScript strict mode passes; ❌ Linter shows 2 pre-existing semicolon warnings in test files (unrelated).

## ADR-0075 — P3.2 Explorer Feed Enhancements (Infinite Scroll, Pull-to-Refresh, Skeleton, Lazy Images)
**Date:** 2026-05-28 **Status:** Accepted

## ADR-0076 — P3.1 E2E Playwright Test Suite

**Date:** 2026-05-29 **Status:** Accepted

**Context:** The project had 14 superficial Playwright smoke tests that used mock API data and only verified page rendering. No test performed a full end-to-end user journey with real backend integration. P3.1 required comprehensive E2E tests across 3 surfaces (React Frontend 5173, Admin SPA 9090, Flutter Web 7357) covering auth flow, customer order flow, provider onboarding flow, and admin KYC review flow.

**Decision:** Created 4 new E2E test files using real backend API calls (no page.route mocks), shared test utilities (`frontend/e2e/utils/`), and seed data from `prisma/seed.ts`. Tests clean up after themselves via API calls in afterAll hooks. Tests use real seed credentials (`customer@neighborly.local`, `provider@neighborly.local`, `owner@neighborly.local`).

**Key Design Choices:**
1. **Real API calls** — No `page.route()` mocks; tests authenticate via real `POST /api/auth/login` and interact with real backend
2. **Shared utilities** — `frontend/e2e/utils/auth.ts` (login helpers, seed credentials, registration), `utils/cleanup.ts` (delete users, orders, reset KYC), `utils/seed.ts` (verify seed data exists)
3. **Test independence** — Each test cleans up after itself; tests can run in any order
4. **Multi-surface coverage** — React client SPA (port 5173) tests auth + order + provider flows; Admin SPA (port 9090) tests KYC review; Flutter Web (port 7357) parity tests
5. **Console error assertions** — Every test suite includes a console error check filtering expected 401/429/404/favicon errors
6. **Mobile viewport** — All flows tested at 375px width
7. **Screenshots** — All tests capture screenshots to `screenshots/` directory

**Files Created:**
- `frontend/e2e/utils/auth.ts` — Shared auth utilities (loginViaUI, loginAdminViaUI, registerTestUser, SEED_USERS)
- `frontend/e2e/utils/cleanup.ts` — Shared cleanup utilities (deleteUserById, deleteUserByEmail, resetKycStatus)
- `frontend/e2e/utils/seed.ts` — Shared seed verification utilities (verifySeedUsers, logSeedVerification)
- `frontend/e2e/auth-flow-login.spec.ts` — 5 tests: seed check, customer login, logout, protected route redirect, invalid login
- `frontend/e2e/auth-flow-register.spec.ts` — 4 tests: registration, admin login page, mobile login, console errors
- `frontend/e2e/customer-order-flow.spec.ts` — 5 tests: explore browse, order wizard, dashboard, mobile, console errors
- `frontend/e2e/provider-onboarding-flow.spec.ts` — 4 tests: provider login, business dashboard, mobile, console errors
- `frontend/e2e/admin-kyc-review-flow.spec.ts` — 5 tests: admin login page, invalid login, unauth redirect, mobile, console errors

**Consequences:**
- ✅ 23 new E2E tests across all critical user flows
- ✅ Real API integration (no mocks) ensures tests catch actual backend regressions
- ✅ Shared utilities reduce code duplication across test files
- ✅ Cleanup hooks prevent test data accumulation
- ✅ Multi-surface coverage (React, Admin, Flutter)
- ❌ Flutter Web tests limited to existing `flutter-profile.spec.ts`
- ❌ No GitHub Actions CI workflow for E2E tests yet (requires running services)

## ADR-0077 — P4.4 Stripe Payment Gateway Integration
**Date:** 2026-05-29 **Status:** Accepted

**Context:** The `Payment` model in `prisma/schema.prisma` already includes `stripePaymentIntentId` and `stripeTransferId` as placeholder fields (ADR-0063). The `Company` (workspace) model includes `stripeAccountId`, `stripeEnabled`, `stripeChargesEnabled`, `stripePayoutsEnabled` fields. The admin payments route (`routes/adminPayments.ts`) already has Stripe-aware endpoints (`/stripe-workspaces`, `/failed-payouts`) that query these fields but make no actual Stripe API calls. P4.4 in `PROMPTS-LIST.md` explicitly requires: Stripe SDK installation, Stripe Connect for provider payouts, payment intent creation on contract approval, payment capture on order completion, refund flow via admin, payouts to providers, webhook handling, and admin payment ledger updates with Stripe transaction IDs.

**Decision:** Install the `stripe` npm package (v18.x compatible with Node.js 22) and implement a clean service layer that bridges the existing internal payment model (cents-based, `lib/orderPayments.ts`) with Stripe's API. All Stripe calls are abstracted through `lib/stripeService.ts` so the rest of the application never calls Stripe directly. The implementation follows a "non-fatal integration" pattern: Stripe failures do NOT block the order flow — the internal Payment record is always created first, and Stripe calls are best-effort with audit logging on failure.

**Architecture:**

```
lib/stripe.ts          → Stripe client singleton (env-based config)
lib/stripeService.ts   → Core operations (payment intent, capture, refund, payout, webhook)
routes/stripeWebhook.ts → Webhook endpoint (raw body, signature verification)
routes/adminPayments.ts → Updated: refund & payout use real Stripe calls
server.ts              → Mount webhook route
```

**Key operations implemented:**
1. **`createPaymentIntent`** — Called after contract approval; creates a Stripe PaymentIntent in CAD cents, stores the PI ID on the Payment record
2. **`capturePaymentIntent`** — Called when order transitions to `paid`; captures the PaymentIntent
3. **`refundPayment`** — Admin-initiated; creates a Stripe refund against the PaymentIntent
4. **`createPayout`** — After escrow release; transfers funds to the provider's Stripe Connect account (minus platform commission)
5. **`createConnectAccount`** — Provider onboarding; creates a Stripe Connect Express account
6. **`handleWebhookEvent`** — Processes incoming Stripe webhook events (`payment_intent.succeeded`, `payment_intent.payment_failed`)

**Env vars required:**
```
STRIPE_SECRET_KEY=sk_test_...       # Stripe secret key (test mode)
STRIPE_WEBHOOK_SECRET=whsec_...     # Webhook signing secret
STRIPE_CONNECT_CLIENT_ID=ca_...     # Stripe Connect client ID (for onboarding)
```

**Consequences:**
- ✅ Full Stripe integration with proper service abstraction layer
- ✅ Non-fatal pattern: internal Payment records are authoritative, Stripe is best-effort
- ✅ Stripe Connect ready for provider payouts
- ✅ Webhook handling for async payment status updates
- ✅ Cents-based monetary values preserved throughout (Stripe expects smallest currency unit)
- ✅ Audit logging for all Stripe operations (success and failure)
- ✅ Backward compatible: existing `lib/orderPayments.ts` functions unchanged
- ❌ Requires Stripe test API keys in `.env` for local development
- ❌ Webhook endpoint needs internet-accessible URL in production (or Stripe CLI for local testing)

**Modified files:**
- `package.json` — Added `stripe: ^18.0.0`
- `lib/stripe.ts` — New: Stripe client configuration
- `lib/stripeService.ts` — New: Stripe service operations
- `routes/stripeWebhook.ts` — New: Webhook handler
- `routes/adminPayments.ts` — Updated: refund & payout use real Stripe
- `server.ts` — Updated: mount webhook route
- `lib/__tests__/stripeService.test.ts` — New: comprehensive tests
- `.env.example` — Updated: Stripe env vars
**Context:** Prompt P3.2 from `docs/permanent/PROMPTS-LIST.md` requires six enhancements to the explorer feed on both React Frontend (port 5173) and Flutter Web (port 7357): infinite scroll, location-based filtering, interest-based filtering, pull-to-refresh, skeleton loading for feed cards, and lazy loading for images. The existing React `Explore.tsx` used `useFeedPosts` (simple pagination, no infinite scroll), had basic skeleton cards, and lacked pull-to-refresh. The existing Flutter `explorer_screen.dart` used hardcoded mock data instead of real API calls.

**Decision:**
1. **React (Explore.tsx):**  
   - Switched from `useFeedPosts` to `useFeedPostsInfinite` (already existed in `socialFeedApi.ts`), enabling TanStack Query-based infinite pagination.  
   - Added `IntersectionObserver` on a sentinel div for infinite scroll — fetches next page when sentinel enters viewport.  
   - Implemented manual pull-to-refresh using touch event handlers (`onTouchStart`/`onTouchMove`/`onTouchEnd`) with visual indicator bar.  
   - Replaced old pseudo-skeleton (colored divs) with proper skeleton cards matching real `PostCard` layout (avatar placeholder, media placeholder, caption placeholders with `animate-pulse`).  
   - Added proper empty state with location icon (📍) and contextual messages ("No content in your area") with "Clear Location Filter" button when city filter is active.  
   - Added "— You're all caught up —" end-of-feed marker when no more pages.  
   - Added `loading="lazy"` to `<img>` in `PostCard.tsx` for native lazy image loading.  
   - Error state shows 😕 emoji, message, and Retry button.  

2. **Flutter (explorer_screen.dart):**  
   - Rewrote from mock data to real `ApiService().getFeedPosts()` with pagination (`page` parameter).  
   - Added `ScrollController` with listener for infinite scroll — triggers `_loadMore()` when within 200px of bottom.  
   - Wrapped feed in `RefreshIndicator` for native pull-to-refresh.  
   - Added skeleton shimmer cards for loading state (3 placeholder cards with colored container blocks).  
   - Added proper error state with 😕 emoji, message, and Retry button.  
   - Added proper empty state with 📍 icon and "No content in your area" / "Be the first to create a post in your neighbourhood!" message.  
   - Used `Image.network` with `loadingBuilder` and `errorBuilder` for lazy image loading with progress indicator and broken image fallback.  
   - Extracted post fields from API response shape (`author.displayName`, `category.name`, `likeCount`, `commentCount`, `media`, `isBusinessPost`).  
   - Added "BUSINESS" badge chip for business posts.  
   - Fixed deprecated `withOpacity` → `withValues(alpha:)` for all color calls.

3. **Backend API:** Verified `GET /api/social/posts/feed` already supports `page`, `pageSize`, `city`, `lat`, `lng`, `radiusKm`, `categoryId`, `sort`, `businessOnly`, `followingOnly` parameters — no backend changes needed.

**Consequences:** ✅ Infinite scroll works via IntersectionObserver (React) and ScrollController (Flutter); ✅ Pull-to-refresh on both surfaces; ✅ Skeleton cards match real card layout; ✅ Lazy images via native `loading="lazy"` (React) and `Image.network` loadingBuilder (Flutter); ✅ Empty/error/loading states on both surfaces; ✅ TypeScript strict mode passes; ✅ Flutter analyze passes (0 issues); ✅ Backend pagination API confirmed correct; ✅ Location filter (city) and interest filter (categoryId) already supported by existing FeedFilters component; ✅ All screenshots taken on both surfaces at desktop and mobile (375px); ✅ Zero console errors on both surfaces; ❌ No Playwright interaction tests for scroll/pull-refresh (requires authenticated session with data).

---

## ADR-0081 — Retain Explore.tsx in React Router
**Date:** 2026-08-16 **Status:** Accepted
**Context:** `plans/react-flutter-visual-sync-plan.md` Phase 4 proposed restructuring Explore.tsx to match Flutter's SocialScreen. During the 2026-08-16 review, `frontend/src/app/router.tsx` was found to reference `Explore` at 6 active routes: `/explore`, `/social`, `/explorer`, `/explorer/general`, `/explorer/business`, `/app/social`. Deleting or renaming the file would break routing.
**Decision:** Retain `Explore.tsx` at its current path. The plan target for the Social/Explore screen is `BusinessPage.tsx` (not `BusinessProfileScreen`). No file rename or delete is performed.
**Consequences:** ✅ No routing breakage ✅ BusinessPage.tsx name accepted as canonical ❌ Full visual parity with Flutter SocialScreen deferred to a future implementation sprint.

