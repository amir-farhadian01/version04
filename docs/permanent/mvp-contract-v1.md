# Neighborly MVP Contract — v1.0 Launchable Journey

**Status:** Proposed | **Date:** 2026-08-11 (final correction) | **Author:** MVP Scope Architect

---

## 1. PRIMARY USERS
- **Customer** — authenticated, onboarding completed, KYC Level 0 acknowledged by admin. Capability: **verified in source** (`routes/auth.ts:120-660`, `routes/adminKyc.ts:84-236`). Runtime: **unverified at runtime**.
- **Business Provider** — authenticated, onboarding completed, KYC Level 1 personal + Level 2 business approved by admin. Capability: **verified in source** (`routes/adminKyc.ts:279-752`). Runtime: **unverified at runtime**.

## 2. START CONDITION
Customer is authenticated with an active JWT (`routes/auth.ts:661` — `GET /auth/me`), role set to `CUSTOMER` via onboarding (`routes/auth.ts:438` — `POST /auth/onboarding`), KYC level 0 acknowledged. At least one provider with approved KYC and a published `ServiceCatalog` record exists. No active order is in progress for this customer.

## 3. END CONDITION (MVP v1)
Provider accepts a matched order via `POST /api/orders/:id/accept-invite` (`routes/orders.ts:2460`). A `Contract` record is created (`lib/contractDraft.ts`). Both customer and provider can retrieve the order via `GET /api/orders/:id` (`routes/orders.ts:2170`). Admin can see the accepted order via `GET /api/admin/orders` (`routes/adminOrders.ts`).

### MVP v1.1 Decision Gate
**Current repository contains Stripe SDK and Stripe-related code (`lib/stripe.ts` imports the `stripe` npm package; `lib/stripeService.ts` — 594 lines — provides full Stripe integration for payments, refunds, payouts, and Connect accounts) despite the project prohibition stated in `AGENTS.md` ("NO payment gateway SDK installed").**

Payment architecture (including start-job, complete, escrow capture, and Stripe integration status) requires explicit human approval and a separately approved ADR before implementation or release. MVP v1.1 scope is deferred pending that approval.

## 4. EXACT SCREENS / ROUTES INVOLVED (from router declarations)

### Client SPA (port 5173) — `frontend/src/app/router.tsx`

| # | Real Route | Component | File:Line | MVP Role |
|---|-----------|-----------|-----------|----------|
| 1 | `/auth/login` | `Login` | `router.tsx:104` | Customer login |
| 2 | `/explore` | `Explore` | `router.tsx:85` | Service browsing |
| 3 | `/services/:id` | `ServiceDetail` | `router.tsx:86` | Service detail |
| 4 | `/order/new` | `OrderWizard` | `router.tsx:105` | Order creation |
| 5 | `/orders/:id` | `OrderDetail` | `router.tsx:106` | Order tracking |
| 6 | `/app/orders` | `CustomerDashboard` | `router.tsx:115` | Customer order list |
| 7 | `/business/:workspaceId` (index) | `BusinessDashboard` | `router.tsx:133` | Provider inbox |

### Admin SPA (port 9090) — `frontend/admin/src/router.tsx`

| # | Real Route | Component | File:Line | MVP Role |
|---|-----------|-----------|-----------|----------|
| 8 | `/login` | `admin/pages/Login.tsx` | admin router | Admin login |
| 9 | `/kyc` | `admin/pages/Kyc.tsx` | admin router | KYC review |
| 10 | `/orders` | `admin/pages/Orders.tsx` | admin router | Admin orders |

## 5. EXACT API ENDPOINTS (from router declarations)

| # | Full Endpoint | File:Line | MVP Role | Runtime |
|---|---------------|-----------|----------|---------|
| 1 | `POST /api/auth/register` | `routes/auth.ts:120` | Registration | unverified at runtime |
| 2 | `POST /api/auth/login` | `routes/auth.ts:235` | Login | unverified at runtime |
| 3 | `POST /api/auth/onboarding` | `routes/auth.ts:438` | Role selection | unverified at runtime |
| 4 | `GET /api/auth/me` | `routes/auth.ts:661` | Session check | unverified at runtime |
| 5 | `GET /api/services` | `routes/services.ts:32` | Browse catalog | unverified at runtime |
| 6 | `GET /api/services/:id` | `routes/services.ts:69` | Service detail | unverified at runtime |
| 7 | `POST /api/orders/draft` | `routes/orders.ts:908` | Create draft | unverified at runtime |
| 8 | `PUT /api/orders/draft/:id` | `routes/orders.ts:1021` | Update draft | unverified at runtime |
| 9 | `POST /api/orders/draft/:id/submit` | `routes/orders.ts:1110` | Submit for matching | unverified at runtime |
| 10 | `GET /api/orders/me` | `routes/orders.ts:1258` | Customer order list | unverified at runtime |
| 11 | `GET /api/orders/provider/me` | `routes/orders.ts:1530` | Provider inbox | unverified at runtime |
| 12 | `GET /api/orders/:id` | `routes/orders.ts:2170` | Order detail | unverified at runtime |
| 13 | `POST /api/orders/:id/accept-invite` | `routes/orders.ts:2460` | Provider accepts | unverified at runtime |
| 14 | `GET /api/orders/:id/status` | `routes/orders.ts:1402` | Status check | unverified at runtime |
| 15 | `GET /api/admin/kyc/level0` | `routes/adminKyc.ts:84` | Admin level 0 queue | unverified at runtime |
| 16 | `POST /api/admin/kyc/level0/:userId/acknowledge` | `routes/adminKyc.ts:236` | Approve level 0 | unverified at runtime |
| 17 | `GET /api/admin/kyc/personal` | `routes/adminKyc.ts:279` | Admin personal KYC queue | unverified at runtime |
| 18 | `POST /api/admin/kyc/personal/:id/review` | `routes/adminKyc.ts:477` | Approve/reject personal | unverified at runtime |
| 19 | `GET /api/admin/kyc/business` | `routes/adminKyc.ts:531` | Admin business KYC queue | unverified at runtime |
| 20 | `POST /api/admin/kyc/business/:id/review` | `routes/adminKyc.ts:752` | Approve/reject business | unverified at runtime |
| 21 | `GET /api/admin/orders` | `routes/adminOrders.ts` | Admin order list | unverified at runtime |

**Route mounting:** `server.ts:95` (`/api/auth`), `server.ts:98` (`/api/services`), `server.ts:108` (`/api/orders`), `server.ts:175` (`/admin/kyc`).

**Excluded from MVP v1 (deferred to v1.1 pending payment ADR):**
- `POST /api/orders/:id/start-job` (`routes/orders.ts:1745`)
- `POST /api/orders/:id/complete` (`routes/orders.ts:1642`)
- Payment record creation (`lib/orderPayments.ts`)
- All Stripe SDK integration (`lib/stripe.ts`, `lib/stripeService.ts`)

## 6. DATA THAT MUST PERSIST

| Entity | Key Fields | Prisma Model | Status |
|--------|-----------|-------------|--------|
| User (customer) | id, email, passwordHash, role, kycLevel, onboardingCompleted | `User` (`prisma/schema.prisma`) | verified in source |
| User (provider) | id, email, passwordHash, role, kycLevel, onboardingCompleted | `User` (`prisma/schema.prisma`) | verified in source |
| Company | id, ownerId, name, address, kycStatus | `Company` (`prisma/schema.prisma`) | verified in source |
| KYC Personal | userId, status, documents | KycPersonal model | verified in source |
| KYC Business | companyId, status, documents | KycBusiness model | verified in source |
| ServiceCatalog | id, providerId, name, description, basePrice | `ServiceCatalog` (`prisma/schema.prisma`) | verified in source |
| Order | id, customerId, providerId, serviceId, phase | `Order` (`prisma/schema.prisma`) | verified in source |
| Contract | id, orderId, customerId, providerId, status, terms | `Contract` (`prisma/schema.prisma`) | verified in source |

## 7. INTENTIONALLY EXCLUDED FROM MVP

| Exclusion | Rationale | Target |
|-----------|-----------|--------|
| Walk-in booking mode (ADR-0065) | Adds unscheduled path complexity | Phase 2 |
| Provider counter-offer (ADR-0066) | Negotiation loop not needed for v1 | Phase 2 |
| Reorder flow (ADR-0067) | Recurring orders out of scope | Phase 3 |
| Budget price range (ADR-0064) | Fixed pricing simplifies MVP | Phase 2 |
| Escrow auto-release cron (ADR-0063) | Payment infrastructure deferred | MVP v1.1 |
| Start-job / complete / payment lifecycle | Requires human-approved payment ADR | MVP v1.1 |
| Stripe SDK integration | Present in repo (`lib/stripe.ts`, `lib/stripeService.ts`) but prohibited by `AGENTS.md` — requires ADR | MVP v1.1 |
| Chat/messaging during order | Chat files frozen per project rules | Post-MVP |
| Social layer / feed | Not required for transaction completion | Phase 4 |
| Flutter mobile app | Web-only MVP on React frontend | Post-MVP |
| Analytics / Metabase | Not needed for first transaction | Phase 3 |
| Multi-provider matching UI | Matching engine exists (`lib/matching/`, frozen) but provider-selection UX deferred | Phase 3 |
| Service packages / BOM | Flat pricing | Phase 2 |
| Invoice PDF generation | Requires completion flow | MVP v1.1 |

## 8. ACCEPTANCE TESTS (User-Visible Outcomes)

| # | Test | Expected Outcome |
|---|------|------------------|
| AT-1 | New user registers, selects "Customer" role, completes onboarding | Lands on customer-facing screen with navigation |
| AT-2 | Customer browses services at `/explore`, selects one, views detail at `/services/:id` | Service detail shows provider name, price, description |
| AT-3 | Customer creates order at `/order/new`: enters description, submits | Order created as draft, then submitted for matching |
| AT-4 | Provider logs in, visits `/business/:workspaceId`, sees matched order in inbox | Business dashboard shows the order with accept button |
| AT-5 | Provider accepts order via `POST /orders/:id/accept-invite` | Order phase advances, contract record created |
| AT-6 | Customer views accepted order at `/orders/:id` | Order detail shows accepted status and contract |
| AT-7 | Admin approves provider KYC (level 0 → personal → business) via `/kyc` | Provider KYC level advances, provider eligible for matching |
| AT-8 | Admin sees accepted order at `/orders` | Admin orders page shows order with correct phase |

## 9. RELEASE BLOCKERS vs POST-MVP BACKLOG

### Release Blockers (MVP v1)

| Blocker | Source | Why |
|---------|--------|-----|
| `POST /api/orders/draft` creates valid draft | `routes/orders.ts:908` | No order = no MVP |
| `POST /api/orders/draft/:id/submit` transitions to submitted | `routes/orders.ts:1110` | Order must enter matching queue |
| `POST /api/orders/:id/accept-invite` works for provider | `routes/orders.ts:2460` | MVP v1 end state |
| KYC approval flow (admin level 0/1/2) | `routes/adminKyc.ts` | Providers need approval to receive orders |
| No 500 errors or blank pages on all 10 screens | Router files (see §4) | User-facing surfaces must render |

### Post-MVP Backlog

| Item | Priority |
|------|----------|
| Start-job / complete / payment lifecycle | MVP v1.1 (pending payment ADR) |
| Stripe SDK architecture decision | MVP v1.1 (pending human approval) |
| Chat during active order | P2 |
| Flutter mobile app | P2 |
| Email/SMS notifications | P2 |
| Service packages / BOM pricing | P3 |
| Provider counter-offer | P3 |
| Walk-in booking mode | P3 |
| Reorder / recurring orders | P4 |
| Invoice PDF generation | P4 |

## 10. REQUIREMENT-TO-FILE TABLE

| Requirement | File(s) |
|-------------|---------|
| Customer registration + login | `routes/auth.ts:120,235` |
| Customer onboarding | `routes/auth.ts:438` |
| Session check | `routes/auth.ts:661` |
| Customer login page | `frontend/src/app/router.tsx:104` → `frontend/src/pages/auth/Login` |
| Service browsing | `frontend/src/app/router.tsx:85` → `frontend/src/pages/public/Explore` |
| Service catalog API | `routes/services.ts:32` |
| Service detail API | `routes/services.ts:69` |
| Service detail page | `frontend/src/app/router.tsx:86` → `frontend/src/pages/public/ServiceDetail` |
| Order wizard page | `frontend/src/app/router.tsx:105` → `frontend/src/pages/order/OrderWizard` |
| Order draft creation | `routes/orders.ts:908` |
| Order draft update | `routes/orders.ts:1021` |
| Order draft submit | `routes/orders.ts:1110` |
| Customer order list | `routes/orders.ts:1258` |
| Customer dashboard page | `frontend/src/app/router.tsx:115` → `frontend/src/pages/customer/Dashboard` |
| Order detail page | `frontend/src/app/router.tsx:106` → `frontend/src/pages/order/OrderDetail` |
| Provider inbox | `routes/orders.ts:1530` |
| Provider dashboard page | `frontend/src/app/router.tsx:133` → `frontend/src/pages/business/BusinessDashboard` |
| Provider accept invite | `routes/orders.ts:2460` |
| Order status check | `routes/orders.ts:1402` |
| Order detail API | `routes/orders.ts:2170` |
| Order phase state machine | `lib/orderPhase.ts` |
| Contract creation on accept | `lib/contractDraft.ts`, `lib/contractEvents.ts` |
| Admin KYC level 0 | `routes/adminKyc.ts:84,236` |
| Admin KYC personal | `routes/adminKyc.ts:279,477` |
| Admin KYC business | `routes/adminKyc.ts:531,752` |
| Admin KYC page | `frontend/admin/src/router.tsx` → `frontend/admin/src/pages/Kyc.tsx` |
| Admin order list API | `routes/adminOrders.ts` |
| Admin orders page | `frontend/admin/src/router.tsx` → `frontend/admin/src/pages/Orders.tsx` |
| Admin login page | `frontend/admin/src/router.tsx` → `frontend/admin/src/pages/Login.tsx` |
| Route mounting | `server.ts:95,98,108,175` |
| Prisma schema | `prisma/schema.prisma` |
| Auth middleware + JWT | `lib/auth.middleware.ts`, `lib/jwt.ts` |
| Matching engine (frozen) | `lib/matching/` |
| Stripe SDK code (excluded from MVP, requires ADR) | `lib/stripe.ts`, `lib/stripeService.ts` |

---

## 11. FIVE IMPLEMENTATION TASKS — MVP v1 Only

| # | Task | Sole Owner | Depends On |
|---|------|-----------|------------|
| **T1** | Verify auth pipeline via API: `POST /auth/register` → `POST /auth/login` → `POST /auth/onboarding` → `GET /auth/me`. Confirm status codes and response shapes. Source: `routes/auth.ts`. | **Backend** | — |
| **T2** | Verify auth UI on port 5173: `/auth/login` → onboarding redirect → `/app/orders` (CustomerDashboard). Confirm no blank pages, no console errors. Source: `frontend/src/app/router.tsx:104,115`. | **Frontend** | T1 |
| **T3** | Verify order creation flow: `POST /orders/draft` → `PUT /orders/draft/:id` → `POST /orders/draft/:id/submit`. Confirm phase transitions to submitted. Verify service catalog endpoints return real data. Source: `routes/orders.ts`, `routes/services.ts`. | **Backend** | T2 |
| **T4** | Verify provider acceptance: `GET /orders/provider/me` → `POST /orders/:id/accept-invite`. Confirm phase advances and contract created. Source: `routes/orders.ts:1530,2460`, `lib/contractDraft.ts`. | **Backend** | T3 |
| **T5** | Verify admin KYC approval (all three levels) and admin order visibility at port 9090 `/orders`. Source: `routes/adminKyc.ts`, `routes/adminOrders.ts`, `frontend/admin/src/router.tsx`. | **Admin Frontend** | T4 |