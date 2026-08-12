# Plan Status Report — 12 Project Plans vs Current Repository

**Date:** 2026-08-12
**Repository:** `amir-farhadian01/version04` (local checkout `/home/amir/version04`, HEAD `9964a88`)
**Method:** Read-only audit of `plans/`, `docs/`, `routes/`, `prisma/`, `frontend/src/`, `frontend/admin/`, `flutter_project/`, `lib/`, `server.ts`, `docker-compose.yml`, `.env.example`, and test files. No application code was modified.

> ⚠️ **Headline finding:** The 13 files under `plans/` are dated **2026-05-23 → 2026-05-25**. The repository has been under active development since then (git history through **2026-08-11**, culminating in commit `50537ce` "feat: MVP 100% complete — all 4 gaps closed, team sign-off"). **10 of the 12 workstreams are fully implemented in code**, 2 are partially done, and the remaining work is almost entirely **documentation reconciliation** rather than feature code.

---

## 1. Status Summary

| # | Plan | Status | Primary evidence |
|---|------|--------|------------------|
| 1 | order-flow-bugfix-plan.md | ✅ **DONE** | `OrderUrgency`, `BookingMode` enums; `Order` fields (`entryPoint`, `urgency`, `phase`, `assignedStaffId`, `postId`, `matchingExpiresAt`, budget); `Dispute`/`Quote`/`GroupServiceSession` models; `routes/quotes.ts`, `guestCheckout.ts`, `orderSessions.ts`, `groupSessions.ts`, `subcontractor.ts`, `adminDisputes.ts`; `lib/rateLimiter.ts`; `scripts/autoReleaseEscrow.js`, `matchingWindowExpiry.js` |
| 2 | platform-circumvention-prevention-plan.md | ✅ **DONE** | `lib/chatModeration.ts` applied in `routes/chat.ts` (general chat), `routes/orderChat.ts`, `routes/adminChat.ts`; admin `Moderation.tsx` + `ContentModeration.tsx`; contact masking in `routes/companies.ts` |
| 3 | monetization-plan.md | ✅ **DONE** | `Order.postId`; `Quote`, `WorkspaceCustomerNote`, `WorkspaceSocialRole` models; `routes/workspaceCrm.ts`, `workspaceFinance.ts`, `workspaceSocial.ts`, `invoices.ts`; React CRM/Finance/Clients pages; `orderable` flag in `routes/posts.ts` |
| 4 | admin-separation-plan.md | ✅ **DONE** | `frontend/admin/` separate SPA; `mountAdminApiRoutes()` in `server.ts`; `neighborly-admin-auth` store key |
| 5 | business-page-staff-assignment-plan.md | ✅ **DONE** | `PackageStaffAssignment`, `BusinessPortfolio`, `BusinessHours`, `StaffSlotBlock`, `SubcontractorAssignment` models; `routes/businessPage.ts`, `staff.ts`, `schedules.ts`, `staffSchedule.ts`, `subcontractor.ts` |
| 6 | staff-identity-display-plan.md | ✅ **DONE** | `Order.assignedStaffId`; `ProviderServicePackage.photoRequired`; `frontend/src/components/business/StaffIdentityCard.tsx` |
| 7 | home-intelligence-admin-content-plan.md | ✅ **DONE** | `routes/homeIntelligence.ts`, `homeContent.ts`, `homeScreen.ts`, `adminHomeContent.ts`; 9 new models (`HomeNewsArticle`, `HomeContentConfig`, `ServiceRateByLocation`, `DemandAnalytics`, …); `lib/privacyThreshold.ts`; admin `HomeContent.tsx`, `UtilityLinks.tsx` |
| 8 | social-layer-plan.md | ✅ **DONE** | `Story`, `StoryViewer`, `Follow` models; `routes/stories.ts`, `follow.ts`, `socialFeed.ts`, `feed.ts`; Flutter `features/feed/`; React social pages |
| 9 | react-flutter-visual-sync-plan.md | 🟡 **PARTIALLY DONE** | `PhoneContainer`/`StatusBar`/`BottomNav` exist; `BusinessPage.tsx` exists (named differently than planned `BusinessProfile.tsx`); `Explore.tsx` still present; **no visual-parity regression evidence** |
| 10 | flutter-profile-redesign-plan.md | ✅ **DONE** | `UserAddress`, `UserCar` models; `routes/userAddresses.ts`, `userCars.ts`; Flutter `addresses_screen.dart`, `cars_screen.dart`, dark/light theme, glassmorphic `bottom_nav.dart` |
| 11 | redis-location-cache-implementation.md | ✅ **DONE** | `lib/redis.ts`, `lib/locationCache.ts`; `docker-compose.yml` redis service; `.env.example` REDIS/LOCATION vars; `server.ts` flusher |
| 12 | doc-fix-plan.md + doc-update-plan.md | 🟡 **PARTIALLY DONE** | `files/` deleted ✅; `docs/PORTS.md` fixed ✅; `ROADMAP.md`/`FEATURES.md`/`GLOSSARY.md` rewritten ✅; **root `PORTS.md` NOT fixed ❌** |

---

## 2. Detailed Findings

### 1. order-flow-bugfix-plan.md — ✅ DONE

The 42-issue / 7-phase plan has been implemented. Evidence:

- **Prisma schema (`prisma/schema.prisma`):** `OrderUrgency` enum (L115), `BookingMode` enum (L98), `Order` model (L578) now contains `entryPoint`, `urgency`, `status`, `phase`, `assignedStaffId`, `postId`, `matchingExpiresAt`, `budget`/`budgetMin`/`budgetMax`, `isMultiSession`/`totalSessions`/`completedSessions`. `Dispute` (L706), `Quote` (L1471), `GroupServiceSession` (L1777), `GroupSessionAttendee` (L1796).
- **Routes:** `routes/orders.ts` (2961 lines) has `POST /:id/accept-invite` (L2460), `POST /:id/select-provider` (L2340), plus `quotes.ts`, `guestCheckout.ts`, `orderSessions.ts`, `groupSessions.ts`, `subcontractor.ts`, `adminDisputes.ts`, `invoices.ts`, `orderPayments.ts`.
- **Infra/cron:** `lib/rateLimiter.ts` (Phase 0), `scripts/autoReleaseEscrow.js` (G9 escrow) and `scripts/matchingWindowExpiry.js` (G14) — both imported in `server.ts` (L18-19) and wired to cron intervals (L406-418).
- **Supporting libs:** `lib/orderBom.ts`, `orderCapacity.ts`, `orderTimeEstimate.ts`, `commissionTracking.ts`, `trustScore.ts`, `businessHours.ts`, `orderLifecycleNotifications.ts`, `invoiceGenerator.ts`.
- **ADRs:** `docs/DECISIONS.md` (ADR-0061…0072) and `docs/ADR-0063…0068-*.md` (escrow, budget, walk-in, counter-offer, reorder, customer-dashboard).
- **Tests:** `routes/orders.test.ts` (47 KB), `routes/quotes.test.ts` (52 KB), `routes/guestCheckout.test.ts`, `routes/adminDisputes.test.ts`, `routes/orders.status.test.ts`, `routes/bookingMode.test.ts`, `routes/__tests__/orders.draft.test.ts`, `routes/__tests__/serviceSearch.test.ts`, plus 12 `lib/*.test.ts` files.

**Residual:** `docs/ORDER_FLOW_GAP_ANALYSIS.md` still carries its **2026-05-26** header "16 open items" — this is a stale documentation marker, not a code gap. Several "open" items (G17 guest checkout, G19 disputes, provider invite, staff-assignment validation) are now implemented.

### 2. platform-circumvention-prevention-plan.md — ✅ DONE

- `lib/chatModeration.ts` + `lib/chatTranslate.ts` exist.
- `moderateMessage()` is now applied in **general chat** (`routes/chat.ts` L4, L47, L211) — closing the plan's "#1 critical" gap — as well as `routes/orderChat.ts` (L242) and `routes/socialFeed.ts`, `routes/workspaceSocial.ts`.
- `ChatModerationStatus` enum (schema L165) and `ChatMessage.moderationStatus` field (schema L1268).
- Admin moderation UI: `frontend/admin/src/pages/Moderation.tsx` and `ContentModeration.tsx`.
- Business-profile contact masking: `routes/companies.ts` — `maskContactFieldsIfNeeded()` + `hasContractedOrderWithWorkspace()` (L6, L17, L37, L68, L92, L115).

### 3. monetization-plan.md — ✅ DONE

- `Order.postId` → `Post` relation (schema L615); `Post` has `serviceCatalogId` + `linkedService` + `isBusinessPost` (L905+).
- Post→Order bridge: `routes/posts.ts` exposes `orderable` via `checkOrderable()` (L48-52, L80-82).
- `Quote` (L1471), `WorkspaceCustomerNote` (L1505), `WorkspaceSocialRole` (L1523).
- `routes/workspaceCrm.ts`, `workspaceFinance.ts`, `workspaceSocial.ts`, `invoices.ts`.
- React business pages: `CRMPage.tsx`, `Finance.tsx`, `Clients.tsx`, `ClientDetail.tsx`, `Invoices.tsx`; `lib/buildProviderWorkspaceFinance.ts`, `lib/workspaceAccess.ts`.

### 4. admin-separation-plan.md — ✅ DONE

- `frontend/admin/` is a separate Vite SPA (`index.html`, `vite.config.ts`, `tsconfig.json`, `src/`).
- `server.ts` `mountAdminApiRoutes()` (L159-179) mounts only admin routes on `adminApp` (port 9090).
- Admin auth store uses `neighborly-admin-auth` (`frontend/admin/src/store/authStore.ts`).

### 5. business-page-staff-assignment-plan.md — ✅ DONE

- Models: `PackageStaffAssignment` (L468), `BusinessPortfolio` (L1365), `BusinessHours` (L1380), `StaffSlotBlock` (L1727), `SubcontractorAssignment` (L1693).
- Routes: `businessPage.ts`, `staff.ts`, `schedules.ts`, `staffSchedule.ts`, `subcontractor.ts`.
- React: `StaffManagement.tsx`, `StaffScheduling.ts`, `CalendarManager.tsx`.
- Flutter: `widgets/staff_conflict_alert.dart`, `widgets/multi_workspace_schedule_widget.dart`, `widgets/subcontractor_assignment_sheet.dart`.

### 6. staff-identity-display-plan.md — ✅ DONE

- `Order.assignedStaffId` + `assignedStaff` relation (schema L604-605); `User.ordersAsAssignedStaff` (L89).
- `ProviderServicePackage.photoRequired` (schema L449).
- `frontend/src/components/business/StaffIdentityCard.tsx`.

### 7. home-intelligence-admin-content-plan.md — ✅ DONE

- Routes: `homeIntelligence.ts`, `homeContent.ts`, `homeScreen.ts`, `adminHomeContent.ts`, `adminUtilityLinks.ts`.
- Models (schema): `HomeBanner` (1558), `HomeNewsArticle` (1573), `WeatherConfig` (1593), `TrafficAlertSource` (1604), `SafetyAlert` (1614), `LocalInsightConfig` (1629), `HomeContentConfig` (1642), `ServiceRateByLocation` (1657), `DemandAnalytics` (1673).
- `lib/privacyThreshold.ts` (privacy-by-default thresholds).
- Admin UI: `frontend/admin/src/pages/HomeContent.tsx`, `UtilityLinks.tsx`; Client UI: `frontend/src/pages/public/HomeScreen.tsx`, `frontend/src/pages/home/HomePage.tsx`, `NewsArticlePage.tsx`.

### 8. social-layer-plan.md — ✅ DONE

- Models: `Story` (1048), `StoryViewer` (1073), `Follow` (1085); `Post.categoryId` (L908, mandatory).
- Routes: `stories.ts`, `follow.ts`, `socialFeed.ts`, `feed.ts`, `posts.ts`.
- Flutter: `features/feed/` (`feed_screen.dart`, `post_card.dart`, `business_card.dart`, `stories_row.dart`).
- React: `frontend/src/pages/social/PostDetailPage.tsx`, `frontend/src/pages/home/MyPostsTab.tsx`.
- **In-flight (uncommitted):** `scripts/test-social-feed.sh` + `docs/permanent/social-feed-full-test.md` (35-task Playwright suite) + `docs/permanent/task-state/social-feed-full-test-state.json` are untracked in `git status` — an active QA workstream on the social feed.

### 9. react-flutter-visual-sync-plan.md — 🟡 PARTIALLY DONE

- Present: `frontend/src/components/ui/phone/` (`PhoneContainer.tsx`, `StatusBar.tsx`, `BottomNav.tsx`) with matching CSS variables in `frontend/src/index.css`; `frontend/src/pages/public/BusinessPage.tsx`.
- Gaps: (a) the plan called for `BusinessProfile.tsx` — the repo uses `BusinessPage.tsx` (naming drift); (b) the plan's decision to "remove the Explore tab" was **not** applied — `frontend/src/pages/public/Explore.tsx` still exists; (c) no visual-regression/screenshot evidence exists in the repo certifying pixel parity. "Visually indistinguishable" is unverifiable without a side-by-side Playwright comparison, which is not present.

### 10. flutter-profile-redesign-plan.md — ✅ DONE

- Models: `UserAddress` (L1303), `UserCar` (L1321), `User.cars` relation (L91).
- Routes: `userAddresses.ts`, `userCars.ts` (both mounted in `server.ts` L131-132).
- Flutter: `lib/screens/addresses_screen.dart`, `lib/screens/cars_screen.dart`; `lib/theme/app_theme.dart` has `AppColorsLight` + `darkTheme` + `lightTheme` (L27, L48, L108); `ThemeMode` persistence in `main.dart` (L173); `lib/widgets/bottom_nav.dart` is glassmorphic (`BackdropFilter` + `ImageFilter.blur`, L47-50).

### 11. redis-location-cache-implementation.md — ✅ DONE

- `lib/redis.ts` (ioredis connection manager), `lib/locationCache.ts` (GEO + flusher), `lib/cache.ts` retained as in-memory fallback.
- `docker-compose.yml`: redis service (L131-144), `REDIS_HOST`/`REDIS_PORT` env (L167-168), `depends_on: redis` (L179), `redis_data` volume (L371).
- `.env.example`: `REDIS_HOST/PORT/PASSWORD/DB` (L56-60) + `LOCATION_*` cache vars (L62-68).
- `server.ts`: `getRedis` (L13) and `startLocationFlusher`/`stopLocationFlusher` (L17, L424, L433).

**Residual:** root `PORTS.md` still states "Redis removed … cache is in-memory" — see §3 contradictions.

### 12. doc-fix-plan.md + doc-update-plan.md — 🟡 PARTIALLY DONE

**Applied:**
- `files/` directory deleted (no longer in repo root).
- `docs/PORTS.md` updated to "Redis is actively used via lib/redis.ts … lib/cache.ts is a drop-in in-memory fallback" (doc-fix issues 1-2), Dozzle = 8899 (issue 5), Traefik dashboard = 9191.
- `docs/ROADMAP.md` rewritten to v3.0.0 with the simplified user model (Public Visitor / Client / Business Client / Admin-Support).
- `docs/FEATURES.md` and `docs/GLOSSARY.md` updated with "Business Client" / "Business Workspace" terminology (verified: `GLOSSARY.md` has `### Business Client` L115, `### Business Workspace` L124, `### Provider` L715, `### UserRole` L876, `### Workspace` L912).

**Not applied (code/doc gap):**
- **root `PORTS.md`** (the file `AGENTS.md` points agents to) still contains the **old** text: "Redis removed. Cache is in-memory (`lib/cache.ts`)" (L42), "cache is in-memory (no Redis needed)" (L17), Dozzle = 8888 (vs 8899), Traefik dashboard = 8080 (vs 9191). This directly contradicts `docs/PORTS.md` and the deployed `docker-compose.yml`.

---

## 3. Contradictions Identified

| # | Contradiction | Files | Severity |
|---|---------------|-------|----------|
| C1 | Redis status — root `PORTS.md` says "Redis removed / in-memory", but `lib/redis.ts` + `docker-compose.yml` + `docs/PORTS.md` confirm Redis is deployed and active | `PORTS.md` (root) vs `docs/PORTS.md`, `docker-compose.yml`, `lib/redis.ts` | 🔴 High (misleads ops/agents) |
| C2 | Dozzle port — root `PORTS.md` = 8888 vs `docs/PORTS.md` = 8899 | `PORTS.md` vs `docs/PORTS.md` | 🟡 Medium |
| C3 | Traefik dashboard port — root `PORTS.md` = 8080 vs `docs/PORTS.md` = 9191 | `PORTS.md` vs `docs/PORTS.md` | 🟡 Medium |
| C4 | "MVP 100% complete, no remaining tasks" (`ROADMAP.md` v3.0.0) vs `ORDER_FLOW_GAP_ANALYSIS.md` header "16 open items" (last updated 2026-05-26) | `docs/ROADMAP.md` vs `docs/ORDER_FLOW_GAP_ANALYSIS.md` | 🟡 Medium (stale doc) |
| C5 | Doc version skew — `docs/AGENTS.md` v3.1.0 vs `docs/ROADMAP.md` v3.0.0 | `docs/AGENTS.md` vs `docs/ROADMAP.md` | 🟢 Low |
| C6 | ADR numbering collisions — `ADR-0070` = "MVP contract v1" (`docs/adr/`) vs "CI/CD Pipeline" (`docs/DECISIONS.md` L670); `ADR-0072` = "Stripe approval" (`docs/adr/`) vs "AGENTS.md Rule #6 Clarification" (`docs/DECISIONS.md` L674) | `docs/adr/` vs `docs/DECISIONS.md` | 🟡 Medium (traceability) |
| C7 | ROADMAP stack lists Redis + NATS (L80-81) while root `PORTS.md` claims Redis removed — internal ROADMAP/doc inconsistency | `docs/ROADMAP.md` vs `PORTS.md` | 🟡 Medium |

---

## 4. Code Gaps vs Documentation Gaps (separated)

**Code gaps (feature/implementation not present):**
1. React `BusinessProfile` page is named `BusinessPage.tsx` (visual-sync plan named it `BusinessProfile.tsx`); the "remove Explore tab" decision was not applied — `Explore.tsx` remains. *(Low severity — cosmetic/scope drift, not broken functionality.)*
2. No visual-regression artifact certifying React↔Flutter pixel parity exists. *(QA gap, not code gap.)*
3. Uncommitted in-flight work: `scripts/test-social-feed.sh`, `docs/permanent/social-feed-full-test.md`, `docs/permanent/task-state/social-feed-full-test-state.json` (untracked in `git status`). *(Process gap.)*

**Documentation gaps (docs stale/inconsistent, no code change needed):**
- root `PORTS.md` (C1, C2, C3) — misleading Redis/port info.
- `ORDER_FLOW_GAP_ANALYSIS.md` (C4) — stale "16 open" marker.
- `docs/AGENTS.md` vs `docs/ROADMAP.md` version skew (C5).
- ADR numbering collisions (C6).
- `plans/` directory is described as "legacy planning docs" but contains plans that are now implemented — should be annotated or archived to prevent re-execution of already-done work.

---

## 5. Recent MVP Tasks — Implementation Status (verified)

| Task / Workstream | Status | Evidence |
|-------------------|--------|----------|
| Quick-Start Package (OAuth, onboarding, feed, order flow) Tasks 1-14 | ✅ Implemented | Commit `4da076a`; `flutter_project/lib/screens/onboarding/`; `routes/auth.ts`; decision-history 2026-08-07 |
| Stripe Connect approval + integration | ✅ Implemented | `lib/stripe.ts`, `lib/stripeService.ts`, `routes/stripeWebhook.ts`; ADR-0072 (`docs/adr/`), decision-history 2026-08-11 |
| MVP scope expanded to full flow | ✅ Implemented | `docs/ROADMAP.md` v3.0.0; commit `50537ce`; decision-history 2026-08-11 |
| Admin SPA separation | ✅ Implemented | `frontend/admin/`; `mountAdminApiRoutes()` |
| Social feed (Phase 2) | ✅ Implemented | `routes/socialFeed.ts`, `stories.ts`, `follow.ts`, `feed.ts`; Flutter `features/feed/` |
| Business workspace (Phase 6) | ✅ Implemented | `routes/workspace*.ts`; React business pages; Flutter business widgets |
| Admin content management (Phase 8) | ✅ Implemented | `routes/adminHomeContent.ts`, `adminUtilityLinks.ts`, `adminMedia.ts`; admin `HomeContent.tsx` |
| Transport (Phase 9) | ✅ Starter code | Commit `9964a88` "fix(transport)"; transport API present |

---

## 6. Assumptions (explicit)

- **A1:** "Done" is asserted from **code + test-file presence and import wiring** (schema fields, route mounts, lib imports, test files), not from re-running the full suite, which was **not** executed to avoid touching the local PostgreSQL database / migrations. Statuses that depend on runtime behavior (e.g., test *pass/fail*, Playwright screenshots) are marked as "verification outstanding" where applicable.
- **A2:** The `lib/matching/` directory remains frozen (rule #1) — the audit confirmed only `eligibility.ts`, `orchestrator.ts`, `roundRobin.ts` exist and no plan-modified matching logic was introduced.
- **A3:** The 13 files in `plans/` are treated as the canonical "requested work" even though `docs/AGENTS.md` says "do NOT read old plan files — obsolete."
- **A4:** `src/` (legacy) and chat files (`routes/orderChat.ts` is chat-adjacent but was confirmed already migrated to `chatModeration`) are assumed out of scope for new work per absolute rules.

---

## 7. Stop Conditions (Hard Gates — do NOT proceed past these without explicit human approval)

| Trigger | Action |
|---------|--------|
| **Prisma migration required** | STOP. `prisma migrate dev`/`deploy` is blocked pending approval. Current schema is already at the target state for all 12 plans; no further migration is required. |
| **Production data could be affected** | STOP. No bulk backfill, seed on prod, or destructive writes without approval. |
| **Payment / Stripe behavior must change** | STOP. Stripe is CEO-approved (ADR-0072). Any change to `lib/stripe.ts`, `lib/stripeService.ts`, `routes/stripeWebhook.ts`, or commission/escrow math requires a new ADR + architect sign-off. |
| **Secret / credential must change** | STOP. `JWT_SECRET`, `DATABASE_URL`, `REDIS_PASSWORD`, Stripe keys must never be committed or rotated without approval. |
| **Existing ADR conflicts with requested roadmap** | STOP. ADR-0070 (MVP scope, superseded) and ADR-0072 (Stripe) are decision records; any roadmap that reverses them must go back to the Human Approval Gate. |

---

## 8. Definition of Done (for the remaining work)

- [ ] root `PORTS.md` corrected and reconciled with `docs/PORTS.md` + `docker-compose.yml`.
- [ ] Stale docs (`ORDER_FLOW_GAP_ANALYSIS.md`, `plans/`) annotated or archived.
- [ ] ADR numbering collisions resolved (C6).
- [ ] Uncommitted social-feed test work committed with passing results.
- [ ] React↔Flutter visual-parity verification (Playwright, side-by-side screenshots) produced for the visual-sync plan.
- [ ] No application code changed during this audit (verified).
