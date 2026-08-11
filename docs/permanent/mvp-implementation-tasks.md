# MVP Implementation Tasks — Neighborly v1.0

**Created:** 2026-08-11 (final correction) | **Derived from:** `docs/permanent/mvp-contract-v1.md`

**MVP v1 scope:** Customer registration → browse service → create draft → submit → matching → provider accepts invitation. Payment, start-job, and completion are deferred to MVP v1.1.

---

## TASK 1: Verify Auth Pipeline (Backend API)

**Sole Owner:** Backend

### Instructions
Verify the auth pipeline end-to-end via direct API calls:

1. `POST /api/auth/register` (`routes/auth.ts:120`) — register a new customer user. Verify 201 response with valid user data.
2. `POST /api/auth/login` (`routes/auth.ts:235`) — login with the new credentials. Verify 200 response with JWT token.
3. `POST /api/auth/onboarding` (`routes/auth.ts:438`) — complete onboarding with `role: "CUSTOMER"`. Verify 200 response with `onboardingCompleted: true`.
4. `GET /api/auth/me` (`routes/auth.ts:661`) — verify session returns correct role and kycLevel.

### Acceptance Criteria
- No 500 errors from any auth endpoint.
- JWT token is valid and usable for subsequent authenticated requests.
- Onboarding persists role selection correctly.
- Response shapes match expected format.

### Files
- `routes/auth.ts` — lines 120, 235, 438, 661
- `lib/auth.middleware.ts` — JWT verification middleware
- `lib/jwt.ts` — token generation

### Dependencies
- PostgreSQL running (localhost:5432)
- Backend running (localhost:8080)

---

## TASK 2: Verify Auth UI Screens (Frontend, port 5173)

**Sole Owner:** Frontend
**Depends On:** TASK 1 (backend auth endpoints confirmed working)

### Instructions
Verify the auth UI screens render and function correctly using Playwright:

1. Open `http://localhost:5173/auth/login` (`frontend/src/app/router.tsx:104` → `Login` component).
2. Register a new customer user via the UI.
3. Verify redirect to onboarding flow.
4. Complete onboarding (select "Customer" role).
5. Verify redirect to `/app/orders` (`frontend/src/app/router.tsx:115` → `CustomerDashboard`).
6. Take screenshots at each step.
7. Check browser console for errors.

### Acceptance Criteria
- No blank pages on any auth screen.
- All form fields render and accept input.
- Redirects work correctly (login → onboarding → `/app/orders`).
- Console has zero unhandled errors.
- Mobile viewport (375px) renders without layout breakage.

### Files
- `frontend/src/app/router.tsx:104` — `/auth/login` → `Login`
- `frontend/src/app/router.tsx:115` — `/app/orders` → `CustomerDashboard`
- `frontend/src/pages/auth/Login.tsx`
- `frontend/src/pages/customer/Dashboard.tsx`

### Dependencies
- Frontend dev server running (localhost:5173)
- Backend running (localhost:8080)

---

## TASK 3: Verify Order Creation Flow (Backend)

**Sole Owner:** Backend
**Depends On:** TASK 2 (customer authenticated and on dashboard)

### Instructions
Verify the service catalog and order creation flow:

1. `GET /api/services` (`routes/services.ts:32`) — verify paginated list with provider names and pricing.
2. `GET /api/services/:id` (`routes/services.ts:69`) — verify full detail with provider info.
3. `POST /api/orders/draft` (`routes/orders.ts:908`) — create a draft order. Verify 201 with order data and phase `draft`.
4. `PUT /api/orders/draft/:id` (`routes/orders.ts:1021`) — update the draft with description, scheduled date, service details. Verify 200.
5. `POST /api/orders/draft/:id/submit` (`routes/orders.ts:1110`) — submit the draft for matching. Verify order phase transitions to `submitted`.
6. `GET /api/orders/me` (`routes/orders.ts:1258`) — verify customer order list includes the submitted order.

### Acceptance Criteria
- Service catalog returns at least one service with real data (not empty array).
- Draft creation returns 201 with correct order shape.
- Draft submit transitions phase from `draft` to `submitted`.
- Customer order list includes the new order.
- No 500 errors from any endpoint.

### Files
- `routes/orders.ts` — lines 908, 1021, 1110, 1258
- `routes/services.ts` — lines 32, 69
- `lib/orderPhase.ts` — phase state machine

### Dependencies
- At least one approved provider with a published `ServiceCatalog` record must exist.
- If no services exist, seed one via `npx tsx prisma/seed.ts`.

---

## TASK 4: Verify Provider Acceptance (Backend)

**Sole Owner:** Backend
**Depends On:** TASK 3 (submitted order exists)

### Instructions
Verify the provider-side acceptance flow — **this is the MVP v1 end state**:

1. `GET /api/orders/provider/me` (`routes/orders.ts:1530`) — verify provider inbox shows the submitted order.
2. `POST /api/orders/:id/accept-invite` (`routes/orders.ts:2460`) — accept the order. Verify:
   - Order phase advances past `submitted`.
   - A `Contract` record is created (`lib/contractDraft.ts`).
3. `GET /api/orders/:id` (`routes/orders.ts:2170`) — verify order detail shows updated phase and contract.
4. `GET /api/orders/:id/status` (`routes/orders.ts:1402`) — verify status endpoint returns the accepted phase.

### Excluded from this task (deferred to MVP v1.1):
- `POST /api/orders/:id/start-job` (`routes/orders.ts:1745`)
- `POST /api/orders/:id/complete` (`routes/orders.ts:1642`)
- Payment record lifecycle (`lib/orderPayments.ts`)
- All Stripe SDK integration (`lib/stripe.ts`, `lib/stripeService.ts`)

### Acceptance Criteria
- Provider inbox returns submitted orders scoped to provider's services.
- Accept-invite advances order phase and creates contract.
- Order detail shows accepted status and contract reference.
- No 500 errors from any endpoint.
- No Stripe SDK or payment code is invoked.

### Files
- `routes/orders.ts` — lines 1530, 2460, 2170, 1402
- `lib/orderPhase.ts` — phase state machine
- `lib/contractDraft.ts` — contract creation
- `lib/contractEvents.ts` — contract lifecycle events
- `lib/matching/` — DO NOT TOUCH (frozen)

### Dependencies
- A submitted order from TASK 3.
- An approved provider user with a published service.
- Matching engine (`lib/matching/`) — must match the order to the provider.

---

## TASK 5: Verify Admin KYC and Order Visibility

**Sole Owner:** Admin Frontend
**Depends On:** TASK 4 (accepted order exists, provider KYC needs approval)

### Instructions
Verify admin-side KYC approval and order visibility:

**KYC flow (Backend API):**
1. `GET /api/admin/kyc/level0` (`routes/adminKyc.ts:84`) — verify users needing level 0 acknowledgment.
2. `POST /api/admin/kyc/level0/:userId/acknowledge` (`routes/adminKyc.ts:236`) — acknowledge. Verify kycLevel advances.
3. `GET /api/admin/kyc/personal` (`routes/adminKyc.ts:279`) — verify pending personal KYC list.
4. `POST /api/admin/kyc/personal/:id/review` (`routes/adminKyc.ts:477`) — approve. Verify status → APPROVED.
5. `GET /api/admin/kyc/business` (`routes/adminKyc.ts:531`) — verify pending business KYC list.
6. `POST /api/admin/kyc/business/:id/review` (`routes/adminKyc.ts:752`) — approve. Verify status → APPROVED.

**KYC flow (Admin Frontend, port 9090):**
7. Login at `http://localhost:9090/login` (`frontend/admin/src/router.tsx` → `Login`).
8. Navigate to `/kyc` (`frontend/admin/src/router.tsx` → `Kyc.tsx`).
9. Verify three tabs (Level 0, Personal, Business) render with data.
10. Approve a provider through all three KYC levels via the UI.
11. Take screenshots at each step.

**Admin orders (Backend API + Frontend):**
12. `GET /api/admin/orders` (`routes/adminOrders.ts`) — verify the accepted order from TASK 4 appears.
13. Navigate to `/orders` (`frontend/admin/src/router.tsx` → `Orders.tsx`).
14. Verify the orders table shows the accepted order with correct phase.
15. Take screenshots.

### Acceptance Criteria
- Admin API returns KYC lists for all three levels.
- KYC approval advances user's kycLevel correctly.
- Admin KYC page renders all three tabs without blank screens or errors.
- Admin orders page shows accepted order with real data.
- No 500 errors from any admin endpoint.
- Console has zero unhandled errors.

### Files
- `routes/adminKyc.ts` — lines 84, 236, 279, 477, 531, 752
- `routes/adminOrders.ts` — admin orders listing
- `frontend/admin/src/router.tsx` → `Login`, `Kyc.tsx`, `Orders.tsx`

### Dependencies
- Admin API running on port 9090.
- At least one user with pending KYC at each level.
- An accepted order from TASK 4 for order visibility test.