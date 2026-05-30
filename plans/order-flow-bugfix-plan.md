# Order Flow — Phased Implementation Plan

> **Generated:** 2026-05-25 (Updated)
> **Source:** [`docs/ORDER_FLOW.md`](../docs/ORDER_FLOW.md) (spec) vs actual codebase
> **Gap Analysis:** [`docs/ORDER_FLOW_GAP_ANALYSIS.md`](../docs/ORDER_FLOW_GAP_ANALYSIS.md) (33 issues, 30 action items)
> **External References:**
>   - [`NEIGHBORLY_IMPLEMENTATION_PLAN2.md`](../../movaghat/NEIGHBORLY_IMPLEMENTATION_PLAN2.md) — Sprint-by-sprint prompts
>   - [`NEIGHBORLY_GAP_ANALYSIS.md`](../../movaghat/NEIGHBORLY_GAP_ANALYSIS.md) — Full platform audit (42 issues)
> **This plan addresses all 42 issues across 7 phases (0–6).**

---

## 🧱 CROSS-CUTTING REQUIREMENTS (Apply to ALL Phases)

The following requirements apply to **every** implementation step across all phases. They are listed once here and referenced throughout.

### R1 — Zod Input Validation
Every new or modified API endpoint **must** use Zod schemas for input validation (AGENTS.md Rule 17). No raw `req.body` access without `.parse()`. Place schemas at the top of each route file or in a dedicated `lib/` module if shared.

### R2 — Standard Response Format
Every API response **must** follow the format `{ data: T }` for success and `{ code: string, message: string, details?: Record<string, unknown> }` for errors (AGENTS.md Rule 18).

### R3 — Tests Required
All new/modified endpoints and lib modules **must** have corresponding tests with ≥70% coverage (AGENTS.md Rule 15). Tests should cover:
- Happy path (successful request/response)
- Validation errors (malformed input)
- Authorization errors (unauthenticated/unauthorized)
- Edge cases (empty results, boundary values)

### R4 — ADR Creation
Every new feature (escrow, quotes, walk-in, recurring payments, etc.) **must** have a corresponding Architecture Decision Record added to [`docs/DECISIONS.md`](../docs/DECISIONS.md) before any code is written (AGENTS.md Rule 22). Use the existing ADR format:
```
## ADR-NNNN — Title
**Date:** YYYY-MM-DD **Status:** Proposed
**Context:** ...
**Decision:** ...
**Consequences:** ...
```

### R5 — File Size Limit
No file should exceed 500 lines (AGENTS.md Rule 25). When modifying [`routes/orders.ts`](../routes/orders.ts) (currently **1833 lines**), extract logical sections into separate route files. Suggested splits:
- `routes/orderLifecycle.ts` — submit, start-job, complete, cancel
- `routes/orderDrafts.ts` — draft CRUD
- `routes/orderInvites.ts` — accept/decline invite, select-provider
- `routes/orderDisputes.ts` — dispute endpoints
- `routes/orderRatings.ts` — rating endpoints

### R6 — Read Before Edit
Before any file is modified, it **must** be read in full first (AGENTS.md Rule 8). This applies to both new files being created (read existing similar files for patterns) and existing files being edited. No file should be edited based on assumptions about its current content.

### R7 — TypeScript Strict Mode
After each phase, run `npm run typecheck` and fix **all** TypeScript errors to zero. The project uses strict TypeScript mode. No `// @ts-ignore` or `// @ts-expect-error` comments are permitted unless explicitly approved by the architect.

### R8 — Linter Passes
After each phase, run `npm run lint` and fix **all** errors and warnings to zero. No lint warnings are acceptable in production code. Configure the linter if needed to match project conventions.

### R9 — ROADMAP.md Updates
If a feature status changes (e.g., from "planned" to "in progress" to "completed"), update [`docs/ROADMAP.md`](../docs/ROADMAP.md) accordingly. This ensures the project roadmap stays synchronized with actual implementation progress.

### R10 — Monetary Values as Cents (Integer)
All monetary values in Prisma models and API payloads **must** be stored as integers representing cents. Never use `Float` for currency amounts. Examples:
- `$10.00` → `1000` (cents)
- `$149.99` → `14999` (cents)
- `$0.50` → `50` (cents)
- Commission percentages remain as `Float` (they are ratios, not currency amounts)

When reviewing Prisma schema changes in this plan, convert any `Float` monetary fields to `Int` (cents). Update API serialization to convert cents to display units where needed.

### R11 — Dates in UTC ISO 8601
All datetime fields **must** use UTC ISO 8601 format. In Prisma, all `DateTime` fields are already UTC. In API responses, ensure dates are serialized as ISO 8601 strings (e.g., `2026-05-25T22:00:00.000Z`). Never use local time or non-standard date formats in API payloads or database storage.

### R12 — No console.log in Production Code
No `console.log` statements are permitted in any production code. Use a proper logging mechanism:
- For route handlers: use `req.log` or a structured logger
- For lib modules: inject a logger or use the project's logging utility
- `console.error` is acceptable in `server.ts` top-level error handlers only
- `console.log` is acceptable in test files and scripts only

### R13 — Async Functions with try/catch and next(error)
Every async route handler **must** wrap its body in `try/catch` and pass errors to `next(error)`. Pattern:
```typescript
router.post('/path', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // ... handler logic
  } catch (error) {
    next(error);
  }
});
```
This ensures unhandled promise rejections are caught by Express error middleware rather than crashing the process.

### R14 — No TypeScript `any` Type
The `any` type is **forbidden** in all production code. Use proper types and interfaces:
- Use `unknown` instead of `any` when the type is truly not known
- Use generics where appropriate
- Define explicit interfaces for request/response shapes
- Use `z.infer<typeof schema>` for Zod-inferred types
- If a third-party library lacks types, create a minimal `.d.ts` declaration file

### R15 — All Imports Use `.js` Extension
All TypeScript/JavaScript imports **must** use the `.js` extension (AGENTS.md Rule 5). Examples:
```typescript
// ✅ Correct
import { foo } from './bar.js';
import { baz } from '../lib/utils.js';

// ❌ Incorrect
import { foo } from './bar';
import { baz } from '../lib/utils';
```

### R16 — Constants as const enums or as const Objects with JSDoc
All constants **must** be defined as either `const enum` or `as const` objects with JSDoc comments. Examples:
```typescript
/** Order status values used in state machine transitions */
export const ORDER_STATUSES = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  MATCHING: 'matching',
  // ...
} as const;

// Or with const enum:
/** Supported booking modes for service catalog */
export const enum BookingMode {
  auto_appointment = 'auto_appointment',
  negotiation = 'negotiation',
  hybrid = 'hybrid',
  quote_first = 'quote_first',
  walk_in = 'walk_in',
}
```

### R17 — Conventional Git Commits
All git commits **must** follow the conventional commit format (AGENTS.md Rule 21):
```
type(scope): description
```
Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`, `style`
Examples:
- `feat(orders): add start-job endpoint for paid-to-in_progress transition`
- `fix(orders): expand cancel to allow matched/contracted/paid states`
- `test(quotes): add 4 test cases for quote submission endpoint`
- `docs(decisions): add ADR for escrow payment system`

### R18 — Playwright UI Verification (Frontend Changes Only)
If any frontend changes are made as part of this plan, **Playwright UI verification with the full 12-step protocol** is required (AGENTS.md Rule 12). See [`docs/AGENTS.md`](../docs/AGENTS.md) for the complete UI Verification Protocol. Tests must be done by opening the real browser URL, not by calling APIs directly.

### R19 — Screenshots Saved to screenshots/
All Playwright UI verification screenshots **must** be saved to the `screenshots/` directory with descriptive, sequential names. Pattern:
```
screenshots/NNNN-description.png
```
Examples: `screenshots/9090-01-login-page.png`, `screenshots/9090-02-invalid-login.png`

### R20 — Mobile Viewport Testing (Frontend Changes Only)
For any frontend changes, the Playwright UI verification **must** include mobile viewport testing at **375px width** (AGENTS.md Rule 12). This ensures responsive design works correctly on mobile devices.

---

## 📋 Issue-to-Phase Mapping

| ID | Severity | Phase | Source | Description |
|----|----------|-------|--------|-------------|
| **S1** | 🔴 CRITICAL | PHASE 0 | GAP | Rate limiting on ALL endpoints |
| **S4/F9** | 🔴 CRITICAL | PHASE 0 | GAP | Email normalization + normalizedEmail field |
| **S3** | 🟠 HIGH | PHASE 0 | GAP | CSP headers disabled |
| **T1** | 🟠 HIGH | PHASE 0 | GAP | Coverage below 70% threshold |
| **T2** | 🟠 HIGH | PHASE 0 | GAP | No E2E Playwright tests |
| **B1** | 🔴 HIGH | PHASE 1 | ORDER_FLOW | `/complete` skips `paid`/`in_progress` |
| **B2** | 🔴 HIGH | PHASE 1 | ORDER_FLOW | Cancel only allows draft/submitted/matching |
| **B4** | 🔴 HIGH | PHASE 1 | ORDER_FLOW | No `urgency` field |
| **B7** | 🔴 HIGH | PHASE 1 | ORDER_FLOW | `BookingMode` enum missing values |
| **B8** | 🔴 HIGH | PHASE 1 | ORDER_FLOW | `resolveEffectiveBookingMode()` limited |
| **G1** | 🔴 HIGH | PHASE 2 | ORDER_FLOW | No Smart Scheduling Engine |
| **G15** | 🔴 HIGH | PHASE 2 | ORDER_FLOW | No capacity validation before match |
| **G2** | 🔴 HIGH | PHASE 2 | ORDER_FLOW | No Quote-First flow |
| **G9** | 🔴 HIGH | PHASE 2 | ORDER_FLOW | No Escrow payment system |
| **B3** | 🟡 MEDIUM | PHASE 3 | ORDER_FLOW | Description validation 10 vs 20 chars |
| **B5** | 🟡 MEDIUM | PHASE 3 | ORDER_FLOW | No `budget` field |
| **B6** | 🟡 MEDIUM | PHASE 3 | ORDER_FLOW | `entryPoint` enum missing values |
| **G3** | 🟡 MEDIUM | PHASE 3 | ORDER_FLOW | No Walk-In flow |
| **G4** | 🟡 MEDIUM | PHASE 3 | ORDER_FLOW | No Provider Counter-Offer |
| **G5** | 🟡 MEDIUM | PHASE 3 | ORDER_FLOW | No Reorder flow |
| **G6** | 🟡 MEDIUM | PHASE 3 | ORDER_FLOW | No Multi-Session structure |
| **G7** | 🟡 MEDIUM | PHASE 3 | ORDER_FLOW | No Group Service management |
| **G8** | 🟡 MEDIUM | PHASE 3 | ORDER_FLOW | No Inventory-Linked BOM |
| **G10** | 🟡 MEDIUM | PHASE 3 | ORDER_FLOW | No Commission logic |
| **G11** | 🟡 MEDIUM | PHASE 3 | ORDER_FLOW | No Auto-release after 48h |
| **G12** | 🟡 MEDIUM | PHASE 3 | ORDER_FLOW | No Recurring payments |
| **G13** | 🟡 MEDIUM | PHASE 3 | ORDER_FLOW | Missing NATS handlers |
| **G14** | 🟡 MEDIUM | PHASE 3 | ORDER_FLOW | No matching expiry cron |
| **G16** | 🟡 MEDIUM | PHASE 3 | ORDER_FLOW | No `select-provider` for negotiation |
| **G17** | 🟡 MEDIUM | PHASE 3 | ORDER_FLOW | No Guest checkout |
| **G18** | 🟡 MEDIUM | PHASE 3 | ORDER_FLOW | No provider accept/decline |
| **G19** | 🟡 MEDIUM | PHASE 3 | ORDER_FLOW | Staff assignment validation |
| **G20** | 🟡 MEDIUM | PHASE 3 | ORDER_FLOW | Anti-circumvention incomplete |
| **M1** | 🔵 LOW | PHASE 4 | ORDER_FLOW | `phaseFromStatus()` returns null for draft |
| **M2** | 🔵 LOW | PHASE 4 | ORDER_FLOW | `orderToCustomerJson()` missing phase |
| **M4** | 🔵 LOW | PHASE 4 | ORDER_FLOW | No two-way rating |
| **M5** | 🔵 LOW | PHASE 4 | ORDER_FLOW | No dispute resolution workflow |
| **F1** | 🟠 HIGH | PHASE 5 | GAP | Customer dashboard: no live order status polling |
| **F7** | 🟠 HIGH | PHASE 5 | GAP | Public business page missing |
| **F8** | 🟠 HIGH | PHASE 5 | GAP | Staff identity display before in-person service |
| **F11** | 🔴 CRITICAL | PHASE 5 | GAP | Payment gateway setup flow missing |
| **F12** | 🟠 HIGH | PHASE 5 | GAP | Invoice PDF generation not implemented |
| **A1** | 🟡 MEDIUM | PHASE 5 | GAP | Media audit tab not implemented |
| **A2** | 🟡 MEDIUM | PHASE 5 | GAP | Home content management missing |
| **A3** | 🟡 MEDIUM | PHASE 5 | GAP | Local insights configuration missing |
| **A4** | 🟡 MEDIUM | PHASE 5 | GAP | Business trust score manual management missing |
| **A5** | 🟠 HIGH | PHASE 5 | GAP | Dispute resolution admin interface missing |
| **A6** | 🟡 MEDIUM | PHASE 5 | GAP | Commission tracking for non-Stripe methods missing |
| **M3** | 🔵 LOW | PHASE 5 | ORDER_FLOW | Mock payment → Stripe Connect integration |
| **S2** | 🟠 HIGH | PHASE 6 | GAP | JWT token blacklist missing |
| **S5** | 🟠 HIGH | PHASE 6 | GAP | GDPR right to deletion not implemented |
| **S6** | 🟡 MEDIUM | PHASE 6 | GAP | No MFA/TOTP support |
| **F2** | 🟡 MEDIUM | PHASE 6 | GAP | Business inbox loading not prioritized |
| **F3** | 🟡 MEDIUM | PHASE 6 | GAP | Post category selection not enforced |
| **F4** | 🟡 MEDIUM | PHASE 6 | GAP | Weather/traffic/police alerts not implemented |
| **F5** | 🟡 MEDIUM | PHASE 6 | GAP | Local news & events feed missing |
| **F6** | 🟡 MEDIUM | PHASE 6 | GAP | Utility link click tracking not wired |
| **F10** | 🟡 MEDIUM | PHASE 6 | GAP | Social media manager tab not implemented |
| **T3** | 🟡 MEDIUM | PHASE 6 | GAP | No performance tests |
| **T4** | 🟡 MEDIUM | PHASE 6 | GAP | No accessibility tests (axe-core) |
| **T5** | 🟡 MEDIUM | PHASE 6 | GAP | No visual regression tests |

---

## PHASE 0 — SECURITY & INFRASTRUCTURE (Do First — Before Phase 1)

> **Goal:** Fix critical security vulnerabilities and set up testing infrastructure before any feature work.
> **Prisma migrations required:** 1 (normalizedEmail)
> **New files:** `lib/rateLimiter.ts`, `lib/emailNormalize.ts`, `vitest.config.ts`, test utilities
> **Rationale:** Per [`NEIGHBORLY_GAP_ANALYSIS.md`](../../movaghat/NEIGHBORLY_GAP_ANALYSIS.md) priority order, rate limiting and email normalization are ranked higher priority than the order state machine fix.

---

### 0.1 — S1: Rate Limiting on ALL Endpoints

| Property | Value |
|----------|-------|
| **Files** | New `lib/rateLimiter.ts`, [`server.ts`](../server.ts) |
| **Prisma migration?** | No |
| **Complexity** | Medium |
| **Dependencies** | None |

**What to do:**

1. **Install:** `npm install express-rate-limit`

2. **Create `lib/rateLimiter.ts`** — Export typed limiters (no `any`, JSDoc on each):
   - `authLimiter` → 10 requests per 1 minute per IP (for `/api/auth/*`)
   - `uploadLimiter` → 10 requests per 1 minute per user
   - `orderLimiter` → 60 requests per 1 minute per authenticated user
   - `generalLimiter` → 100 requests per 1 minute per IP

   All limiters must:
   - Return 429 with body: `{ code: "RATE_LIMIT_EXCEEDED", message: "Too many requests. Please try again later." }`
   - Use `standardHeaders: true`, `legacyHeaders: false`
   - Log the rate limit hit via structured logger (**R12**: no console.log)

3. **Apply in [`server.ts`](../server.ts):**
   - `generalLimiter` on `app.use()` BEFORE all routes
   - `authLimiter` on the `/api/auth` router specifically
   - `orderLimiter` on the `/api/orders` router
   - `uploadLimiter` on the `/api/upload` router

4. **Tests** (R3): Test that 11 rapid auth requests to `POST /api/auth/login` returns 429 on the 11th.

5. **ADR** (R4): Create `ADR-0060 — Rate Limiting on All Endpoints` in [`docs/DECISIONS.md`](../docs/DECISIONS.md)

---

### 0.2 — S4/F9: Email Normalization + Uniqueness Enforcement

| Property | Value |
|----------|-------|
| **Files** | [`prisma/schema.prisma`](../prisma/schema.prisma) (User model), new `lib/emailNormalize.ts`, [`routes/auth.ts`](../routes/auth.ts) |
| **Prisma migration?** | **Yes** — add `normalizedEmail` field |
| **Complexity** | Medium |
| **Dependencies** | None |

**What to do:**

1. **Add `normalizedEmail` to User model** in [`prisma/schema.prisma`](../prisma/schema.prisma):
   ```prisma
   normalizedEmail String @unique
   ```
   Generate migration: `npx prisma migrate dev --name add-normalized-email`

2. **Create `lib/emailNormalize.ts`:**
   - Export `normalizeEmail(email: string): string` that:
     1. Lowercases the entire email
     2. Splits into local@domain
     3. If domain is gmail.com or googlemail.com:
        a. Remove all dots from local part
        b. Remove everything after '+' in local part
     4. Returns normalized form
   - No `any` types — full TypeScript strict mode
   - JSDoc comment on the function

3. **Update [`routes/auth.ts`](../routes/auth.ts):**
   - In `POST /api/auth/register`:
     - Compute `normalizedEmail = normalizeEmail(email)`
     - Check `prisma.user.findUnique({ where: { normalizedEmail } })` for duplicate
     - If duplicate → return 409 `{ code: "EMAIL_TAKEN", message: "An account with this email already exists." }`
     - Store both `email` (raw) and `normalizedEmail` on the User record
   - In `POST /api/auth/login`:
     - Check by `normalizedEmail` first, fall back to raw email for backward compatibility

4. **Tests** (R3):
   - Register with raw email → succeeds
   - Register with same email different case → 409
   - Register with Gmail dot variant → 409
   - Register with Gmail plus addressing → 409
   - Login with normalized variant → succeeds

5. **ADR** (R4): Create `ADR-0061 — Email Normalization Enforced at Registration` in [`docs/DECISIONS.md`](../docs/DECISIONS.md)

---

### 0.3 — S3: Enable CSP Headers

| Property | Value |
|----------|-------|
| **Files** | [`server.ts`](../server.ts) |
| **Prisma migration?** | No |
| **Complexity** | Low |
| **Dependencies** | None |

**What to do:**

1. **Replace** in [`server.ts`](../server.ts):
   ```typescript
   app.use(helmet({ contentSecurityPolicy: false }));
   ```
   With full CSP configuration as specified in [`docs/SECURITY.md`](../docs/SECURITY.md) section 3.6:
   ```typescript
   app.use(helmet({
     contentSecurityPolicy: {
       directives: {
         defaultSrc: ["'self'"],
         scriptSrc: ["'self'"],
         styleSrc: ["'self'", "'unsafe-inline'"],
         imgSrc: ["'self'", 'data:', 'https:'],
         connectSrc: process.env.NODE_ENV === 'development'
           ? ["'self'", 'ws://localhost:*']
           : ["'self'", 'https://api.neighborly.app'],
         fontSrc: ["'self'"],
         objectSrc: ["'none'"],
         frameSrc: ["'none'"],
         upgradeInsecureRequests: [],
       },
     },
   }));
   ```

2. **Tests** (R3): Verify CSP headers are present in response, verify WebSocket connections work in dev mode.

---

### 0.4 — T1/T2: Testing Infrastructure Setup

| Property | Value |
|----------|-------|
| **Files** | New `vitest.config.ts`, new `tests/test-utils.ts`, new `frontend/e2e/auth.spec.ts`, new `.github/workflows/test.yml`, [`package.json`](../package.json) |
| **Prisma migration?** | No |
| **Complexity** | Low |
| **Dependencies** | None |

**What to do:**

1. **Backend test setup:**
   - Install: `npm install --save-dev vitest supertest @vitest/coverage-v8`
   - Create `vitest.config.ts` at root:
     - Coverage thresholds: branches 75%, functions 80%, lines 80%, statements 80%
     - Include: `['routes/**', 'lib/**']`
     - Exclude: `['lib/matching/**', 'node_modules', '**/*.d.ts']`
   - Add to [`package.json`](../package.json) scripts:
     - `"test": "vitest run --coverage"`
     - `"test:watch": "vitest"`

2. **Create `tests/test-utils.ts`:**
   - `loginAsCustomer(): Promise<string>` — returns JWT token
   - `loginAsProvider(): Promise<string>`
   - `loginAsAdmin(): Promise<string>`
   - `createTestUser(overrides?): Promise<User>`
   - `createTestOrder(customerId, overrides?): Promise<Order>`
   - `cleanupTestData(ids): Promise<void>`
   - Use Toronto test data as defined in [`docs/TESTING.md`](../docs/TESTING.md) section 5.2

3. **Write integration tests for critical endpoints** (4 cases each):
   - `routes/__tests__/auth.test.ts` → POST /api/auth/login, /register, /refresh
   - `routes/__tests__/orders.test.ts` → POST /orders/draft, /submit, /complete, /cancel
   - `routes/__tests__/orderContracts.test.ts` → contract lifecycle
   - `routes/__tests__/orderPayments.test.ts` → payment flow
   - `routes/__tests__/adminKyc.test.ts` → KYC review actions

4. **Create `.github/workflows/test.yml`:**
   - Runs on: pull_request to main and dev branches
   - Jobs: lint → typecheck → backend-test → frontend-test
   - Requires postgres service container for integration tests
   - Uploads coverage artifact
   - Fails PR if coverage below threshold

5. **Create `frontend/e2e/auth.spec.ts`** as template E2E test:
   - Navigate to /auth/login
   - Fill valid credentials, submit, expect redirect to dashboard
   - Fill invalid credentials, submit, expect error message
   - Check for no console errors

6. **ADR** (R4): Create `ADR-0062 — Testing Infrastructure with Vitest and Playwright` in [`docs/DECISIONS.md`](../docs/DECISIONS.md)

---

## PHASE 1 — CRITICAL BUG FIXES

> **Goal:** Fix the 5 critical bugs that break core order flow. No new features — only fixes to existing broken behavior.
> **Prisma migrations required:** 2 (B4 urgency field, B7 BookingMode enum)
> **No `lib/matching/` changes beyond `resolveEffectiveBookingMode()`**

---

### 1.1 — B1: Fix `/complete` to enforce `paid → in_progress → completed` state machine

| Property | Value |
|----------|-------|
| **Files** | [`routes/orders.ts:1060-1140`](../routes/orders.ts:1060) |
| **Prisma migration?** | No |
| **Complexity** | Medium |
| **Dependencies** | None |

**What to do:**

1. **Add `POST /:id/start-job` endpoint** (new route in [`routes/orders.ts`](../routes/orders.ts)):
   - Accepts request from matched provider/workspace staff
   - Validates order status is `paid`
   - Creates/updates `JobRecord` with `status: 'in_progress'` and `actualStartAt: new Date()`
   - Transitions order: `paid` → `in_progress` (phase: `job`)
   - Publishes NATS `orders.started`
   - Returns updated order
   - **Zod validation** (R1): validate request body
   - **try/catch** (R13): wrap async handler in try/catch with next(error)
   - **Response format** (R2): `{ data: order }`
   - **Tests** (R3): test happy path, invalid status, unauthorized access

2. **Fix `POST /:id/complete` endpoint** ([`routes/orders.ts:1060`](../routes/orders.ts:1060)):
   - Change status gate from `contracted` to `in_progress`
   - Add check: `if (order.status !== OrderStatus.in_progress)`
   - Keep existing `JobRecord` upsert logic (already sets `status: 'completed'` and `completedAt`)
   - Keep NATS publish `orders.completed`
   - Update error message: "Order must be in_progress before it can be marked complete"
   - **Tests** (R3): test complete from in_progress, complete from wrong status

3. **Update `phaseFromStatus()`** ([`lib/orderPhase.ts:7`](../lib/orderPhase.ts:7)):
   - No change needed — `in_progress` already maps to phase `job`

**State machine after fix:**
```
contracted → paid → in_progress → completed → closed
```

---

### 1.2 — B2: Add cancellation support for `matched`, `contracted`, `paid` states

| Property | Value |
|----------|-------|
| **Files** | [`routes/orders.ts:1696-1742`](../routes/orders.ts:1696) |
| **Prisma migration?** | No |
| **Complexity** | Medium |
| **Dependencies** | None |

**What to do:**

1. **Expand allowed statuses in `POST /:id/cancel`** ([`routes/orders.ts:1708-1714`](../routes/orders.ts:1708)):
   - Current: `draft`, `submitted`, `matching`
   - Add: `matched`, `contracted`, `paid`
   - Keep `in_progress`, `completed`, `disputed`, `closed`, `cancelled` as NOT cancellable
   - **Zod validation** (R1): validate cancel reason/body
   - **try/catch** (R13): wrap async handler in try/catch with next(error)
   - **Response format** (R2): `{ data: order }`

2. **Add refund logic based on cancellation phase:**
   - If `matched` or `contracted`: No payment taken yet → just cancel, no refund needed
   - If `paid`: Payment was captured → create a refund transaction record
     - Set `cancelReason` to include refund context
     - Create a `Transaction` with `category: 'order_refund'` and negative amount
     - Log audit event `ORDER_CANCELLED_WITH_REFUND`

3. **Add cancellation for matched workspace notification:**
   - If `matched` or `contracted` or `paid`: Notify the matched provider/workspace via NATS `orders.cancelled_by_customer`
   - Supersede any active `OfferMatchAttempt` records

4. **Handle `matched` state specially:**
   - If status is `matched` (not yet contracted), also clear `matchedProviderId`, `matchedWorkspaceId`, `matchedPackageId`
   - Supersede the matched attempt

5. **Tests** (R3): test cancel from each allowed status, test refund creation for paid orders, test notification publishing

---

### 1.3 — B4: Add `urgency` field to Order model + handle in submit flow

| Property | Value |
|----------|-------|
| **Files** | [`prisma/schema.prisma:441`](../prisma/schema.prisma:441), [`routes/orders.ts:247-547`](../routes/orders.ts:247) |
| **Prisma migration?** | **Yes** — new enum + field |
| **Complexity** | High |
| **Dependencies** | None |

**What to do:**

1. **Add `OrderUrgency` enum to Prisma schema** ([`prisma/schema.prisma`](../prisma/schema.prisma), near line 91):
   ```prisma
   enum OrderUrgency {
     normal
     high
     emergency
   }
   ```

2. **Add `urgency` field to `Order` model** ([`prisma/schema.prisma:457`](../prisma/schema.prisma:457)):
   ```prisma
   urgency OrderUrgency @default(normal)
   ```

3. **Generate migration:**
   ```bash
   npx prisma migrate dev --name add_order_urgency
   ```

4. **Update `runSubmitDraftOrderFlow()`** ([`routes/orders.ts:247`](../routes/orders.ts:247)):
   - Accept `urgency` from request body (optional, defaults to `normal`)
   - Store `urgency` on the order during submit
   - If `urgency === 'high'` or `'emergency'`:
     - Set `matchingExpiresAt` to 4 hours instead of 24 hours — **R11**: use UTC ISO 8601 for all datetime comparisons
     - Pass urgency context to matching engine calls
   - **Zod validation** (R1): validate urgency enum value
   - **try/catch** (R13): ensure route handler wraps async logic in try/catch with next(error)

5. **Update `orderToCustomerJson()`** ([`routes/orders.ts:148`](../routes/orders.ts:148)):
   - Include `urgency` field in serialized response
   - **Response format** (R2): ensure `{ data: order }` includes urgency

6. **Update draft creation** ([`routes/orders.ts:551`](../routes/orders.ts:551)):
   - Accept `urgency` in draft body (stored but not acted on until submit)

7. **Update `POST /:id/submit`** ([`routes/orders.ts:718`](../routes/orders.ts:718)):
   - Accept `urgency` in body, pass through to `runSubmitDraftOrderFlow`

8. **ADR** (R4): Create `ADR-00XX — Order Urgency Field` in [`docs/DECISIONS.md`](../docs/DECISIONS.md)

9. **Tests** (R3): test urgency acceptance, test matchingExpiresAt override for high/emergency, test default normal

---

### 1.4 — B7: Add missing `BookingMode` enum values

| Property | Value |
|----------|-------|
| **Files** | [`prisma/schema.prisma:93-97`](../prisma/schema.prisma:93) |
| **Prisma migration?** | **Yes** — enum values added |
| **Complexity** | Low |
| **Dependencies** | None (but B8 fix depends on this) |

**What to do:**

1. **Add enum values to `BookingMode`** ([`prisma/schema.prisma:93`](../prisma/schema.prisma:93)):
   ```prisma
   enum BookingMode {
     auto_appointment
     negotiation
     hybrid
     quote_first
     walk_in
     inherit_from_catalog
   }
   ```

2. **Generate migration:**
   ```bash
   npx prisma migrate dev --name add_booking_mode_values
   ```

3. **Update any switch/if statements** across the codebase that reference `BookingMode` to handle the new values (at minimum, add a default/fallback case).

4. **Tests** (R3): verify enum values exist in DB after migration, verify code handles all values without crashing

---

### 1.5 — B8: Update `resolveEffectiveBookingMode()` to handle all 5 modes

| Property | Value |
|----------|-------|
| **Files** | [`lib/matching/eligibility.ts:80-91`](../lib/matching/eligibility.ts:80) |
| **Prisma migration?** | No |
| **Complexity** | Low |
| **Dependencies** | B7 (new enum values must exist) |

**What to do:**

1. **Update `resolveEffectiveBookingMode()`** ([`lib/matching/eligibility.ts:80`](../lib/matching/eligibility.ts:80)):
   - Change return type to `'auto_appointment' | 'negotiation' | 'hybrid' | 'quote_first' | 'walk_in'`
   - Add resolution for new modes:
     ```typescript
     export function resolveEffectiveBookingMode(
       catalog: Pick<ServiceCatalog, 'lockedBookingMode'>,
       pkg: Pick<ProviderServicePackage, 'bookingMode'>,
     ): 'auto_appointment' | 'negotiation' | 'hybrid' | 'quote_first' | 'walk_in' {
        const lock = catalog.lockedBookingMode?.trim();
        if (lock === 'auto_appointment' || lock === 'negotiation' ||
            lock === 'hybrid' || lock === 'quote_first' || lock === 'walk_in') {
          return lock;
        }
        const mode = pkg.bookingMode?.trim();
        if (mode === 'auto_appointment' || mode === 'negotiation' ||
            mode === 'hybrid' || mode === 'quote_first' || mode === 'walk_in') {
          return mode;
        }
        return 'auto_appointment';
      }
      ```
    - Update all call sites to handle the new return values

2. **Add `BookingMode` enum validation** in [`routes/orders.ts`](../routes/orders.ts):
   - Validate that `bookingMode` in request body is one of the 5 allowed values
   - Return `400 Bad Request` with descriptive message if invalid

3. **Update Prisma schema** ([`prisma/schema.prisma`](../prisma/schema.prisma)):
   - Add `hybrid`, `quote_first`, `walk_in` to `BookingMode` enum
   - Run `npx prisma generate` after schema change

4. **Add tests** in [`tests/unit/bookingMode.test.ts`](../tests/unit/bookingMode.test.ts):
   - Test all 5 mode resolutions
   - Test catalog lock override behavior
   - Test invalid mode rejection

---

## PHASE 2 — CRITICAL GAPS

### 2.1 — G1/G15: Smart Scheduling Engine + Capacity Validation

**Severity:** Critical
**Source:** Gap Analysis (G1, G15)
**Files:**
- [`routes/schedules.ts`](../routes/schedules.ts)
- [`routes/orders.ts`](../routes/orders.ts)
- [`lib/redis.ts`](../lib/redis.ts)
- [`prisma/schema.prisma`](../prisma/schema.prisma)

**Problem:** No slot-locking mechanism exists. Multiple customers can book the same time slot for the same provider, leading to double-booking. No capacity validation prevents matching when provider is at max capacity.

**What to do:**

1. **Redis-based slot reservation** ([`lib/redis.ts`](../lib/redis.ts)):
  - Add `reserveSlot(providerId, date, slotKey, ttlSecs)` using Redis `SET NX EX`
  - Add `releaseSlot(providerId, date, slotKey)` using Redis `DEL`
  - Add `getReservedSlots(providerId, date)` using Redis `KEYS` or `SCAN`
  - Use atomic Lua script for reserve + capacity check

2. **Capacity validation** in [`routes/orders.ts`](../routes/orders.ts):
  - Before matching, call `getReservedSlots(providerId, date)`
  - Compare against `ProviderServicePackage.maxDailyBookings`
  - Return `409 Conflict` if capacity exceeded

3. **Prisma schema update** ([`prisma/schema.prisma`](../prisma/schema.prisma)):
  - Add `maxDailyBookings` field to `ProviderServicePackage` (Int, default 10)
  - Add `slotDurationMinutes` field (Int, default 60)

4. **Add tests** in [`tests/unit/scheduling.test.ts`](../tests/unit/scheduling.test.ts):
  - Test slot reservation and release
  - Test capacity exceeded rejection
  - Test concurrent booking prevention

---

### 2.2 — G2: Quote-First Flow (Mode 4)

**Severity:** Critical
**Source:** Gap Analysis (G2), Implementation Plan (Prompt 2.2)
**Files:**
- [`routes/quotes.ts`](../routes/quotes.ts) — new file
- [`routes/orders.ts`](../routes/orders.ts)
- [`prisma/schema.prisma`](../prisma/schema.prisma)

**Problem:** The Quote-First flow (BookingMode `quote_first`) is not implemented. Customers cannot request quotes from providers before committing to an order.

**What to do:**

1. **Create `Quote` model** ([`prisma/schema.prisma`](../prisma/schema.prisma)):
  ```prisma
  model Quote {
    id          String   @id @default(uuid())
    orderId     String
    order       Order    @relation(fields: [orderId], references: [id])
    providerId  String
    provider    Provider @relation(fields: [providerId], references: [id])
    amount      Int      // cents
    description String?
    status      QuoteStatus @default(pending)
    expiresAt   DateTime
    createdAt   DateTime @default(now())
    respondedAt DateTime?
  }

  enum QuoteStatus {
    pending
    accepted
    rejected
    expired
  }
  ```

2. **Create `POST /quotes` endpoint** ([`routes/quotes.ts`](../routes/quotes.ts)):
  - Provider submits a quote with amount and description
  - Validates order is in `quote_first` mode and `matching` state
  - Sets `expiresAt` to 48 hours from now
  - Sends notification via NATS

3. **Create `POST /quotes/:id/respond` endpoint**:
  - Customer accepts or rejects a quote
  - If accepted: transition order to `contracted`, set `budget` to quote amount
  - If rejected: return order to `matching` state for other providers
  - Sends notification via NATS

4. **Add tests** in [`tests/unit/quotes.test.ts`](../tests/unit/quotes.test.ts):
  - Test quote creation and expiration
  - Test accept/reject flow
  - Test order state transitions

---

### 2.3 — G9: Escrow Payment System

**Severity:** Critical
**Source:** Gap Analysis (G9), Implementation Plan (Prompt 2.4 — Stripe Connect)
**Files:**
- [`routes/orderPayments.ts`](../routes/orderPayments.ts)
- [`lib/orderPayments.ts`](../lib/orderPayments.ts)
- [`prisma/schema.prisma`](../prisma/schema.prisma)

**Problem:** No real escrow/payment system exists. Payments are not held in escrow and released upon service completion.

**What to do:**

1. **Create `Payment` model** ([`prisma/schema.prisma`](../prisma/schema.prisma)):
  ```prisma
  model Payment {
    id            String        @id @default(uuid())
    orderId       String
    order         Order         @relation(fields: [orderId], references: [id])
    amount        Int           // cents
    commission    Int           // platform fee in cents
    deduction     Int           // provider deduction in cents
    status        PaymentStatus @default(pending)
    stripePaymentIntentId String?
    stripeTransferId       String?
    escrowReleaseAt DateTime?
    createdAt     DateTime      @default(now())
    updatedAt     DateTime      @updatedAt
  }

  enum PaymentStatus {
    pending
    captured
    refunded
    failed
  }
  ```

2. **Implement escrow capture** in [`lib/orderPayments.ts`](../lib/orderPayments.ts):
  - On order transition to `contracted`: create Payment record with `pending` status
  - On order transition to `paid`: capture payment (set status to `captured`)
  - Calculate commission (platform fee percentage) and deduction (provider payout)

3. **Implement escrow release**:
  - On order transition to `completed`: set `escrowReleaseAt` to 48 hours from now
  - Create cron job (see Phase 6) to auto-release funds after 48h
  - If dispute raised: hold funds until dispute resolved

4. **Add tests** in [`tests/unit/payments.test.ts`](../tests/unit/payments.test.ts):
  - Test payment creation and capture
  - Test commission calculation
  - Test escrow release timing

---

## PHASE 3 — MEDIUM BUGS + REMAINING GAPS

### 3.1 — B3: Description Validation Mismatch

**Severity:** Medium
**Source:** Gap Analysis (B3)
**Files:** [`routes/orders.ts`](../routes/orders.ts)

**Problem:** Frontend enforces 20-character minimum for order description, but backend only validates 10 characters.

**What to do:**
1. Update validation in [`routes/orders.ts`](../routes/orders.ts) to require minimum 20 characters
2. Update error message to match frontend expectation
3. Add test in [`tests/unit/orderValidation.test.ts`](../tests/unit/orderValidation.test.ts)

---

### 3.2 — B5: Missing `budget` / Price Range Field

**Severity:** Medium
**Source:** Gap Analysis (B5)
**Files:**
- [`prisma/schema.prisma`](../prisma/schema.prisma)
- [`routes/orders.ts`](../routes/orders.ts)

**Problem:** Order model has no `budget` or price range field, preventing customers from setting a budget.

**What to do:**
1. Add `budget` field to Order model (Int?, cents)
2. Add `budgetMin` and `budgetMax` fields (Int?, cents) for range
3. Update `POST /orders` to accept budget fields
4. Include budget in matching criteria

---

### 3.3 — B6: Missing `OrderEntryPoint` Enum Values

**Severity:** Medium
**Source:** Gap Analysis (B6)
**Files:**
- [`prisma/schema.prisma`](../prisma/schema.prisma)
- [`routes/orders.ts`](../routes/orders.ts)

**Problem:** `OrderEntryPoint` enum is missing `wizard`, `reorder`, and `guest` values.

**What to do:**
1. Add `wizard`, `reorder`, `guest` to `OrderEntryPoint` enum in Prisma schema
2. Run `npx prisma generate`
3. Update validation to accept new values

---

### 3.4 — G3: Walk-In Flow (Mode 5)

**Severity:** Medium
**Source:** Gap Analysis (G3), Implementation Plan (Prompt 2.3)
**Files:**
- [`routes/orders.ts`](../routes/orders.ts)
- [`prisma/schema.prisma`](../prisma/schema.prisma)

**Problem:** Walk-In flow (BookingMode `walk_in`) is not implemented. Customers cannot walk in without prior appointment.

**What to do:**
1. Create `POST /orders/walk-in` endpoint that skips matching and goes directly to `contracted`
2. Assign any available provider (round-robin from available providers)
3. Set `scheduledAt` to current time (immediate service)
4. Add validation for business hours

---

### 3.5 — G4: Provider Counter-Offer

**Severity:** Medium
**Source:** Gap Analysis (G4)
**Files:**
- [`routes/quotes.ts`](../routes/quotes.ts)
- [`routes/orders.ts`](../routes/orders.ts)

**Problem:** Providers cannot send counter-offers when customer's budget is too low.

**What to do:**
1. Add `counterOfferTo` field to Quote model (optional, references parent quote)
2. Create `POST /quotes/:id/counter` endpoint
3. Provider submits counter-offer with new amount and description
4. Customer can accept, reject, or counter again

---

### 3.6 — G5: Reorder Flow

**Severity:** Medium
**Source:** Gap Analysis (G5), Implementation Plan (Prompt 3.3)
**Files:**
- [`routes/orders.ts`](../routes/orders.ts)
- [`prisma/schema.prisma`](../prisma/schema.prisma)

**Problem:** Customers cannot reorder from a previous order.

**What to do:**
1. Create `POST /orders/reorder/:originalOrderId` endpoint
2. Copy service, provider, and address from original order
3. Set `entryPoint` to `reorder`
4. Start new order in `draft` state

---

### 3.7 — G6: Multi-Session / Multi-Day Orders

**Severity:** Medium
**Source:** Gap Analysis (G6)
**Files:**
- [`prisma/schema.prisma`](../prisma/schema.prisma)
- [`routes/orders.ts`](../routes/orders.ts)

**Problem:** Orders cannot span multiple sessions or days.

**What to do:**
1. Add `OrderSession` model with `scheduledAt`, `durationMinutes`, `status` fields
2. Update `POST /orders` to accept array of sessions
3. Add `POST /orders/:id/sessions` to add sessions to existing order
4. Update matching to consider all sessions

---

### 3.8 — G7: Group Service Session Management

**Severity:** Medium
**Source:** Gap Analysis (G7)
**Files:**
- [`prisma/schema.prisma`](../prisma/schema.prisma)
- [`routes/orders.ts`](../routes/orders.ts)

**Problem:** Group service sessions (e.g., classes, workshops) are not managed.

**What to do:**
1. Add `maxParticipants` field to Order (Int, nullable)
2. Add `participantCount` field (Int, default 1)
3. Create `POST /orders/:id/join` endpoint for participants
4. Validate `participantCount` does not exceed `maxParticipants`

---

### 3.9 — G8: Inventory-Linked Service BOM Not Wired to Orders

**Severity:** Medium
**Source:** Gap Analysis (G8)
**Files:**
- [`routes/orders.ts`](../routes/orders.ts)
- [`prisma/schema.prisma`](../prisma/schema.prisma)

**Problem:** Service Bill of Materials (BOM) is not linked to orders for inventory deduction.

**What to do:**
1. Create `OrderBOMItem` model linking order to service materials
2. On order transition to `in_progress`, deduct BOM items from inventory
3. On order cancellation, restore BOM items to inventory

---

### 3.10 — G10: Commission / Platform Fee Deduction

**Severity:** Medium
**Source:** Gap Analysis (G10)
**Files:**
- [`lib/orderPayments.ts`](../lib/orderPayments.ts)
- [`routes/admin.ts`](../routes/admin.ts)

**Problem:** No commission or platform fee deduction logic exists.

**What to do:**
1. Add `commissionPercent` to `ProviderServicePackage` (Int, default 15)
2. Calculate commission on payment capture: `commission = amount * commissionPercent / 100`
3. Store commission in Payment record
4. Add admin endpoint to view commission totals

---

### 3.11 — G11: Auto-Release of Funds After 48h

**Severity:** Medium
**Source:** Gap Analysis (G11), Implementation Plan (Prompt 4.1)
**Files:**
- [`routes/system.ts`](../routes/system.ts)
- [`lib/orderPayments.ts`](../lib/orderPayments.ts)

**Problem:** No automatic release of escrow funds after the 48-hour dispute window.

**What to do:**
1. Create cron job in [`routes/system.ts`](../routes/system.ts) that runs every hour
2. Query payments where `escrowReleaseAt <= now()` and `status = 'captured'`
3. Release funds (set status to `released`, trigger provider payout)
4. Add logging and error handling

---

### 3.12 — G12: Recurring / Subscription Payment Model

**Severity:** Medium
**Source:** Gap Analysis (G12)
**Files:**
- [`prisma/schema.prisma`](../prisma/schema.prisma)
- [`routes/orderPayments.ts`](../routes/orderPayments.ts)

**Problem:** No recurring or subscription payment model exists.

**What to do:**
1. Add `Subscription` model with `interval` (weekly/monthly), `nextBillingAt`, `status`
2. Create `POST /orders/subscription` endpoint
3. Add cron job to process recurring payments
4. Add webhook handler for subscription cancellation

---

### 3.13 — G13: NATS Notification Handlers Incomplete

**Severity:** Medium
**Source:** Gap Analysis (G13), Implementation Plan (Prompt 3.1)
**Files:**
- [`lib/bus.ts`](../lib/bus.ts)
- [`lib/orderLifecycleNotifications.ts`](../lib/orderLifecycleNotifications.ts)

**Problem:** Only 3 of ~13+ NATS notification subjects are implemented.

**What to do:**
1. Implement all notification subjects:
  - `order.created`, `order.updated`, `order.cancelled`
  - `order.matched`, `order.contracted`, `order.paid`
  - `order.in_progress`, `order.completed`, `order.closed`
  - `quote.created`, `quote.accepted`, `quote.rejected`
  - `payment.captured`, `payment.released`, `payment.failed`
  - `dispute.created`, `dispute.resolved`
  - `provider.invited`, `provider.accepted`, `provider.declined`
2. Add email/push notification handlers for each subject
3. Add tests for each handler

---

### 3.14 — G14: Automatic Matching Window Expiry Cron

**Severity:** Medium
**Source:** Gap Analysis (G14)
**Files:**
- [`routes/system.ts`](../routes/system.ts)
- [`lib/matching/orchestrator.ts`](../lib/matching/orchestrator.ts)

**Problem:** No automatic expiry of matching window — orders can stay in `matching` state indefinitely.

**What to do:**
1. Add `matchingExpiresAt` field to Order model
2. Set `matchingExpiresAt` to 48 hours from creation when entering `matching` state
3. Create cron job to expire orders where `matchingExpiresAt <= now()` and `status = 'matching'`
4. On expiry: transition to `cancelled` with reason `matching_window_expired`

---

### 3.15 — G16: Provider Accept/Decline Invite Endpoint

**Severity:** Medium
**Source:** Gap Analysis (G16), Implementation Plan (Prompt 2.5)
**Files:**
- [`routes/providers.ts`](../routes/providers.ts)
- [`routes/orders.ts`](../routes/orders.ts)

**Problem:** No endpoint for providers to accept or decline matching invitations.

**What to do:**
1. Create `POST /providers/invitations/:id/accept` endpoint
2. Create `POST /providers/invitations/:id/decline` endpoint
3. On accept: transition order to `contracted`, notify customer
4. On decline: return order to `matching` for other providers, notify customer

---

### 3.16 — G17: Guest Checkout Flow

**Severity:** Medium
**Source:** Gap Analysis (G17)
**Files:**
- [`routes/orders.ts`](../routes/orders.ts)
- [`routes/auth.ts`](../routes/auth.ts)

**Problem:** No guest checkout flow exists — users must register before placing an order.

**What to do:**
1. Create `POST /orders/guest` endpoint that accepts guest email + phone
2. Create temporary guest user account
3. Allow order placement without full registration
4. On completion, prompt guest to create full account

---

### 3.17 — G18: Staff Assignment Validation

**Severity:** Medium
**Source:** Gap Analysis (G18)
**Files:**
- [`routes/staff.ts`](../routes/staff.ts)
- [`routes/orders.ts`](../routes/orders.ts)

**Problem:** Staff assignment has no validation — staff can be assigned to orders they're not qualified for.

**What to do:**
1. Add validation that staff member belongs to the assigned provider
2. Add validation that staff member has required certifications for the service
3. Add validation that staff member is not already assigned to overlapping orders
4. Return `400 Bad Request` with descriptive message on validation failure

---

### 3.18 — G19: Dispute Resolution Dead-End State

**Severity:** Medium
**Source:** Gap Analysis (G19), Implementation Plan (Prompt 3.2)
**Files:**
- [`routes/orders.ts`](../routes/orders.ts)
- [`prisma/schema.prisma`](../prisma/schema.prisma)
- [`routes/admin.ts`](../routes/admin.ts)

**Problem:** Dispute resolution is a dead-end state — once an order enters dispute, there's no way to resolve it.

**What to do:**
1. Create `Dispute` model with `reason`, `status`, `resolution`, `resolvedById`
2. Add `POST /orders/:id/dispute` endpoint for customers
3. Add `POST /admin/disputes/:id/resolve` endpoint for admins
4. On resolution: transition order to `refunded` (customer wins) or `completed` (provider wins)
5. Handle fund release based on resolution outcome

---

### 3.19 — G20: `phase` Missing from API Response

**Severity:** Medium
**Source:** Gap Analysis (G20)
**Files:**
- [`lib/orderPhase.ts`](../lib/orderPhase.ts)
- [`routes/orders.ts`](../routes/orders.ts)

**Problem:** The `phase` field is not included in API response serialization.

**What to do:**
1. Update [`lib/orderPhase.ts`](../lib/orderPhase.ts) to include `phase` in serialization
2. Add `phase` to all order response types
3. Update frontend to display phase information

---

## PHASE 4 — POLISH: ORDER FLOW

### 4.1 — M1: Add `phase` to Order Model + Serialization

**Severity:** Low (Polish)
**Source:** Gap Analysis (M1)
**Files:**
- [`prisma/schema.prisma`](../prisma/schema.prisma)
- [`lib/orderPhase.ts`](../lib/orderPhase.ts)
- [`routes/orders.ts`](../routes/orders.ts)

**Problem:** The `phase` field exists in the enum but is not consistently serialized in API responses.

**What to do:**
1. Ensure `phase` is included in all order response DTOs
2. Add `phase` to Prisma `Order` model if not already present
3. Update frontend to display phase badge/indicator

---

### 4.2 — M2: Add `OrderEntryPoint` to Order Model

**Severity:** Low (Polish)
**Source:** Gap Analysis (M2)
**Files:**
- [`prisma/schema.prisma`](../prisma/schema.prisma)
- [`routes/orders.ts`](../routes/orders.ts)

**Problem:** `OrderEntryPoint` is not stored on the Order model.

**What to do:**
1. Add `entryPoint` field to Order model (OrderEntryPoint, default `direct`)
2. Set `entryPoint` on order creation based on request context
3. Include `entryPoint` in API responses

---

### 4.3 — M4: Add `BookingMode` to Order Model

**Severity:** Low (Polish)
**Source:** Gap Analysis (M4)
**Files:**
- [`prisma/schema.prisma`](../prisma/schema.prisma)
- [`routes/orders.ts`](../routes/orders.ts)

**Problem:** `BookingMode` is not stored on the Order model.

**What to do:**
1. Add `bookingMode` field to Order model (BookingMode)
2. Set `bookingMode` on order creation based on service catalog + package
3. Include `bookingMode` in API responses

---

### 4.4 — M5: Add `OrderStatus` to Order Model

**Severity:** Low (Polish)
**Source:** Gap Analysis (M5)
**Files:**
- [`prisma/schema.prisma`](../prisma/schema.prisma)
- [`routes/orders.ts`](../routes/orders.ts)

**Problem:** `OrderStatus` is not consistently stored on the Order model.

**What to do:**
1. Ensure `status` field on Order model uses the `OrderStatus` enum
2. Add missing status values if any
3. Include `status` in all API responses

---

## PHASE 5 — FRONTEND & ADMIN FEATURES

### 5.1 — F1: Customer Dashboard — Live Order Status Polling

**Severity:** High
**Source:** Gap Analysis (F1), Implementation Plan (Prompt 5.1)
**Files:**
- [`frontend/src/pages/CustomerDashboard.tsx`](../frontend/src/pages/CustomerDashboard.tsx)
- [`routes/orders.ts`](../routes/orders.ts)

**Problem:** Customer dashboard does not show live order status updates.

**What to do:**
1. Add `GET /orders/:id/status` endpoint returning current status + phase + timestamps
2. Implement polling in [`CustomerDashboard.tsx`](../frontend/src/pages/CustomerDashboard.tsx) every 10 seconds
3. Show status badge with color coding
4. Show estimated time remaining for each phase
5. Add transition animations for status changes

---

### 5.2 — F7: Public Business Page

**Severity:** High
**Source:** Gap Analysis (F7), Implementation Plan (Prompt 5.2)
**Files:**
- [`routes/businessPage.ts`](../routes/businessPage.ts)
- [`frontend/src/pages/BusinessPage.tsx`](../frontend/src/pages/BusinessPage.tsx)

**Problem:** No public-facing business page exists for customers to view provider details.

**What to do:**
1. Create `GET /business/:slug` endpoint returning public business info
2. Create [`BusinessPage.tsx`](../frontend/src/pages/BusinessPage.tsx) with:
   - Business name, logo, description
   - Service catalog with prices
   - Reviews and ratings
   - Contact information
   - Business hours
   - "Book Now" CTA button

---

### 5.3 — F8: Staff Identity Display Before In-Person Service

**Severity:** High
**Source:** Gap Analysis (F8)
**Files:**
- [`routes/orders.ts`](../routes/orders.ts)
- [`frontend/src/pages/OrderDetail.tsx`](../frontend/src/pages/OrderDetail.tsx)

**Problem:** Staff identity is not displayed to customers before in-person service.

**What to do:**
1. Add `GET /orders/:id/staff` endpoint returning assigned staff info
2. Display staff name, photo, and certifications in order detail
3. Send notification when staff is assigned
4. Allow customer to view staff profile before service starts

---

### 5.4 — F11: Finance Tab — Payment Gateway Setup Flow

**Severity:** High
**Source:** Gap Analysis (F11)
**Files:**
- [`frontend/src/pages/Finance.tsx`](../frontend/src/pages/Finance.tsx)
- [`routes/orderPayments.ts`](../routes/orderPayments.ts)

**Problem:** Payment gateway setup flow is not implemented in the Finance tab.

**What to do:**
1. Create payment gateway setup wizard UI
2. Implement Stripe Connect onboarding (see M3 below)
3. Show payment method selection (card, wallet, etc.)
4. Add payment history view

---

### 5.5 — F12: Invoice PDF Generation

**Severity:** High
**Source:** Gap Analysis (F12), Implementation Plan (Prompt 5.3)
**Files:**
- [`routes/orders.ts`](../routes/orders.ts)
- [`lib/invoiceGenerator.ts`](../lib/invoiceGenerator.ts) — new file

**Problem:** Invoice PDF generation is not implemented.

**What to do:**
1. Create [`lib/invoiceGenerator.ts`](../lib/invoiceGenerator.ts) using `pdfkit`
2. Generate PDF with: order details, service description, amount, taxes, total
3. Create `GET /orders/:id/invoice` endpoint returning PDF
4. Add "Download Invoice" button in order detail page

---

### 5.6 — M3: Stripe Connect Integration (OVERRIDE AGENTS.md Rule 6)

**Severity:** High
**Source:** Implementation Plan (Prompt 2.4), Gap Analysis (M3)
**Files:**
- [`routes/orderPayments.ts`](../routes/orderPayments.ts)
- [`lib/orderPayments.ts`](../lib/orderPayments.ts)
- [`.env.example`](../.env.example)

> **⚠️ OVERRIDE NOTICE:** This task explicitly contradicts AGENTS.md Rule #6 ("NO Stripe or any payment library"). The architect has determined that Stripe Connect is required for the escrow payment system to function. This override is documented in the Implementation Plan (Prompt 2.4) and approved by the project owner.

**What to do:**
1. Install `stripe` npm package
2. Implement Stripe Connect onboarding flow:
   - `POST /payments/stripe/connect` — Create Stripe Connect account for provider
   - `GET /payments/stripe/onboarding-link` — Generate onboarding link
   - `POST /payments/stripe/complete` — Handle onboarding completion webhook
3. Implement payment processing:
   - `POST /payments/stripe/create-payment-intent` — Create payment intent for escrow
   - `POST /payments/stripe/confirm-payment` — Confirm payment
   - `POST /payments/stripe/transfer` — Transfer funds to provider (after release)
4. Add webhook handler for Stripe events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `transfer.created`
   - `account.updated`
5. Add `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` to [`.env.example`](../.env.example)

---

### 5.7 — A1: Media Audit Tab

**Severity:** Medium
**Source:** Gap Analysis (A1)
**Files:**
- [`frontend/admin/src/pages/Media.tsx`](../frontend/admin/src/pages/Media.tsx)
- [`routes/adminMedia.ts`](../routes/adminMedia.ts)

**Problem:** Media audit tab is not implemented in the admin panel.

**What to do:**
1. Create admin media audit page with:
   - All uploaded media with thumbnails
   - Filter by type (image, video, document)
   - Filter by upload date range
   - Flag inappropriate content
   - Bulk delete
2. Add `GET /admin/media` endpoint with pagination
3. Add `DELETE /admin/media/:id` endpoint
4. Add `POST /admin/media/:id/flag` endpoint

---

### 5.8 — A2: Home Content Management

**Severity:** Medium
**Source:** Gap Analysis (A2), Implementation Plan (Prompt 6.1)
**Files:**
- [`frontend/admin/src/pages/Settings.tsx`](../frontend/admin/src/pages/Settings.tsx)
- [`routes/adminHomeContent.ts`](../routes/adminHomeContent.ts)

**Problem:** Home content management is not implemented in the admin panel.

**What to do:**
1. Create admin home content management page with:
   - Banner image upload
   - Featured categories selection
   - Promotional content editor
   - Content scheduling
2. Add CRUD endpoints for home content

---

### 5.9 — A3: Local Insights Configuration

**Severity:** Medium
**Source:** Gap Analysis (A3)
**Files:**
- [`frontend/admin/src/pages/Settings.tsx`](../frontend/admin/src/pages/Settings.tsx)
- [`routes/admin.ts`](../routes/admin.ts)

**Problem:** Local insights configuration is missing from the admin panel.

**What to do:**
1. Create admin local insights configuration page with:
   - Weather API key configuration
   - News feed sources management
   - Alert categories management
   - Location-based content targeting
2. Add CRUD endpoints for insights configuration

---

### 5.10 — A4: Business Trust Score Manual Management

**Severity:** Medium
**Source:** Gap Analysis (A4), Implementation Plan (Prompt 6.2)
**Files:**
- [`frontend/admin/src/pages/Users.tsx`](../frontend/admin/src/pages/Users.tsx)
- [`routes/admin.ts`](../routes/admin.ts)

**Problem:** Business trust score cannot be manually managed by admins.

**What to do:**
1. Add trust score display in admin user detail page
2. Create `POST /admin/users/:id/trust-score` endpoint
3. Add manual adjustment with reason/audit trail
4. Show trust score history

---

### 5.11 — A5: Dispute Resolution Admin Interface

**Severity:** Medium
**Source:** Gap Analysis (A5), Implementation Plan (Prompt 3.2)
**Files:**
- [`frontend/admin/src/pages/Orders.tsx`](../frontend/admin/src/pages/Orders.tsx)
- [`routes/admin.ts`](../routes/admin.ts)

**Problem:** No admin interface for dispute resolution exists.

**What to do:**
1. Create admin dispute resolution page with:
   - List of open disputes with order details
   - Evidence viewing (messages, photos, contracts)
   - Resolution actions (refund customer, release to provider, partial refund)
   - Audit log of all actions
2. Add `GET /admin/disputes` endpoint
3. Add `POST /admin/disputes/:id/resolve` endpoint

---

### 5.12 — A6: Commission Tracking for Non-Stripe Methods

**Severity:** Medium
**Source:** Gap Analysis (A6)
**Files:**
- [`frontend/admin/src/pages/Payments.tsx`](../frontend/admin/src/pages/Payments.tsx)
- [`routes/adminPayments.ts`](../routes/adminPayments.ts)

**Problem:** Commission tracking for non-Stripe payment methods is not implemented.

**What to do:**
1. Create admin commission tracking page with:
   - Total commission collected (period)
   - Commission by provider
   - Commission by payment method
   - Export to CSV
2. Add `GET /admin/commissions` endpoint with aggregation

## PHASE 6 — COMPLIANCE & POLISH

### 6.1 — S2: JWT Token Blacklist

**Severity:** High
**Source:** Gap Analysis (S2)
**Files:**
- [`lib/jwt.ts`](../lib/jwt.ts)
- [`lib/auth.middleware.ts`](../lib/auth.middleware.ts)
- [`lib/redis.ts`](../lib/redis.ts)

**Problem:** No JWT token blacklist exists — revoked tokens remain valid until expiry.

**What to do:**
1. Add `blacklistToken(jti, expiresAt)` function using Redis `SET NX EX` with TTL matching token expiry
2. Add `isTokenBlacklisted(jti)` function using Redis `GET`
3. Update [`auth.middleware.ts`](../lib/auth.middleware.ts) to check blacklist on every request
4. Add `POST /auth/logout` endpoint that blacklists current token
5. Add `POST /auth/logout-all` endpoint that blacklists all tokens for user (increment token version)

---

### 6.2 — S5: GDPR Right to Deletion

**Severity:** High
**Source:** Gap Analysis (S5)
**Files:**
- [`routes/auth.ts`](../routes/auth.ts)
- [`prisma/schema.prisma`](../prisma/schema.prisma)

**Problem:** GDPR right to deletion (right to be forgotten) is not implemented.

**What to do:**
1. Create `DELETE /auth/account` endpoint
2. Anonymize personal data (name, email, phone) instead of hard delete
3. Keep order records for legal compliance (anonymized)
4. Send confirmation email
5. Add audit log entry

---

### 6.3 — S6: MFA / TOTP Support

**Severity:** High
**Source:** Gap Analysis (S6)
**Files:**
- [`routes/auth.ts`](../routes/auth.ts)
- [`prisma/schema.prisma`](../prisma/schema.prisma)
- [`lib/jwt.ts`](../lib/jwt.ts)

**Problem:** No multi-factor authentication or TOTP support exists.

**What to do:**
1. Install `otplib` and `qrcode` npm packages
2. Add `totpSecret` field to User model (nullable)
3. Create `POST /auth/mfa/setup` endpoint returning QR code
4. Create `POST /auth/mfa/verify` endpoint to confirm setup
5. Create `POST /auth/mfa/disable` endpoint
6. Update login flow to require TOTP code when MFA is enabled
7. Add backup codes for account recovery

---

### 6.4 — F2: Business Dashboard Inbox Loading Prioritization

**Severity:** Medium
**Source:** Gap Analysis (F2)
**Files:**
- [`frontend/src/pages/BusinessDashboard.tsx`](../frontend/src/pages/BusinessDashboard.tsx)

**Problem:** Business dashboard inbox loading is not prioritized.

**What to do:**
1. Prioritize inbox loading in business dashboard
2. Add loading skeleton for inbox section
3. Implement lazy loading for non-critical sections

---

### 6.5 — F3: Post Category Selection Enforcement

**Severity:** Medium
**Source:** Gap Analysis (F3)
**Files:**
- [`routes/posts.ts`](../routes/posts.ts)
- [`frontend/src/pages/CreatePost.tsx`](../frontend/src/pages/CreatePost.tsx)

**Problem:** Post category selection is not enforced on the frontend.

**What to do:**
1. Add required category validation on post creation
2. Update frontend to show error when category is not selected
3. Add category filter to post listing

---

### 6.6 — F4: Weather / Traffic / Police Alerts

**Severity:** Medium
**Source:** Gap Analysis (F4)
**Files:**
- [`frontend/src/pages/HomeTab.tsx`](../frontend/src/pages/HomeTab.tsx)
- [`routes/homeIntelligence.ts`](../routes/homeIntelligence.ts)

**Problem:** Weather, traffic, and police alerts are not implemented on the home tab.

**What to do:**
1. Integrate weather API for local forecasts
2. Add traffic alert component
3. Add police/safety alert component
4. Implement location-based alert targeting

---

### 6.7 — F5: Local News & Events Feed

**Severity:** Medium
**Source:** Gap Analysis (F5)
**Files:**
- [`frontend/src/pages/HomeTab.tsx`](../frontend/src/pages/HomeTab.tsx)
- [`routes/homeIntelligence.ts`](../routes/homeIntelligence.ts)

**Problem:** Local news and events feed is missing from the home tab.

**What to do:**
1. Integrate local news API
2. Add events calendar component
3. Implement feed with infinite scroll
4. Add category filtering for news/events

---

### 6.8 — F6: Utility Links Click Tracking

**Severity:** Medium
**Source:** Gap Analysis (F6)
**Files:**
- [`frontend/src/components/UtilityLinks.tsx`](../frontend/src/components/UtilityLinks.tsx)
- [`routes/adminUtilityLinks.ts`](../routes/adminUtilityLinks.ts)

**Problem:** Utility links section is not wired to click tracking.

**What to do:**
1. Add click tracking to all utility links
2. Store click events in database
3. Add admin analytics view for link clicks
4. Implement A/B testing for link placement

---

### 6.9 — F10: Social Media Manager Tab

**Severity:** Medium
**Source:** Gap Analysis (F10)
**Files:**
- [`frontend/src/pages/SocialMediaManager.tsx`](../frontend/src/pages/SocialMediaManager.tsx)
- [`routes/posts.ts`](../routes/posts.ts)

**Problem:** Social media manager tab is not implemented.

**What to do:**
1. Create social media manager page with:
   - Post scheduler
   - Multi-platform publishing (Facebook, Twitter, Instagram)
   - Analytics dashboard
   - Content calendar
2. Add CRUD endpoints for scheduled posts
3. Implement OAuth flow for social platform connections

---

### 6.10 — T3: Performance Tests

**Severity:** Medium
**Source:** Gap Analysis (T3)
**Files:**
- New `tests/performance/` directory
- [`package.json`](../package.json)

**Problem:** No performance tests exist.

**What to do:**
1. Install `k6` or `autocannon` for load testing
2. Create performance test scenarios:
   - Order submission under load (100 concurrent users)
   - Matching engine throughput
   - Payment processing latency
3. Set performance baselines and alerting thresholds
4. Add to CI pipeline as optional job

---

### 6.11 — T4: Accessibility Tests (axe-core)

**Severity:** Medium
**Source:** Gap Analysis (T4)
**Files:**
- New `frontend/e2e/accessibility.spec.ts`
- [`frontend/package.json`](../frontend/package.json)

**Problem:** No accessibility tests exist.

**What to do:**
1. Install `@axe-core/playwright` in frontend
2. Create accessibility test spec:
   - Test all main pages (login, dashboard, order detail, etc.)
   - Run axe-core analysis on each page
   - Assert zero critical violations
3. Add to CI pipeline

---

### 6.12 — T5: Visual Regression Tests

**Severity:** Medium
**Source:** Gap Analysis (T5)
**Files:**
- New `frontend/e2e/visual-regression.spec.ts`
- [`frontend/playwright.config.ts`](../frontend/playwright.config.ts)

**Problem:** No visual regression tests exist.

**What to do:**
1. Install `@playwright/test` with screenshot capabilities
2. Create baseline screenshots for all main pages
3. Create visual regression test spec:
   - Compare current screenshots against baselines
   - Set threshold for acceptable difference (e.g., 0.1%)
   - Fail test if difference exceeds threshold
4. Add to CI pipeline
5. Document baseline update process

---

## ✅ FINAL VERIFICATION CHECKLIST

Before marking any phase as complete, verify ALL of the following:

### Per-Phase Verification
- [ ] All new/modified endpoints have Zod validation (R1)
- [ ] All responses use `{ data: T }` or `{ code, message }` format (R2)
- [ ] All new/modified code has ≥70% test coverage (R3)
- [ ] ADR created for each new feature (R4)
- [ ] No file exceeds 500 lines (R5) — extract if needed
- [ ] `npm run typecheck` passes with zero errors (R7)
- [ ] `npm run lint` passes with zero warnings (R8)
- [ ] ROADMAP.md updated if feature status changed (R9)
- [ ] All monetary values stored as cents/Int (R10)
- [ ] All dates in UTC ISO 8601 format (R11)
- [ ] No console.log in production code (R12)
- [ ] All async handlers wrapped in try/catch with next(error) (R13)
- [ ] No `any` types used (R14)
- [ ] All imports use `.js` extension (R15)
- [ ] Constants use `const enum` or `as const` with JSDoc (R16)
- [ ] Git commits follow conventional format (R17)
- [ ] Playwright UI verification done if frontend changes (R18)
- [ ] Screenshots saved to screenshots/ (R19)
- [ ] Mobile viewport tested at 375px if frontend changes (R20)

### Global Verification (All 42 Issues Addressed)
- [ ] **Phase 0 (5 issues):** S1, S4/F9, S3, T1, T2
- [ ] **Phase 1 (5 issues):** B1, B2, B4, B7, B8
- [ ] **Phase 2 (4 issues):** G1, G15, G2, G9
- [ ] **Phase 3 (19 issues):** B3, B5, B6, G3, G4, G5, G6, G7, G8, G10, G11, G12, G13, G14, G16, G17, G18, G19, G20
- [ ] **Phase 4 (4 issues):** M1, M2, M4, M5
- [ ] **Phase 5 (12 issues):** F1, F7, F8, F11, F12, A1, A2, A3, A4, A5, A6, M3
- [ ] **Phase 6 (12 issues):** S2, S5, S6, F2, F3, F4, F5, F6, F10, T3, T4, T5
- [ ] **Total: 42 issues** — all mapped, all addressed

### Git Commit Sequence
After each phase, push with conventional commit messages:
```bash
git add -A
git commit -m "phase(X): description of changes in this phase"
git push
```

---

## 📊 SUMMARY

| Phase | Name | Issues | Prisma Migrations | New Files | Complexity |
|-------|------|--------|-------------------|-----------|------------|
| 0 | Security & Infrastructure | 5 (S1, S4/F9, S3, T1, T2) | 1 | `lib/rateLimiter.ts`, `lib/emailNormalize.ts`, `vitest.config.ts`, test utils | Medium |
| 1 | Critical Bug Fixes | 5 (B1, B2, B4, B7, B8) | 2 | None | Medium |
| 2 | Critical Gaps | 4 (G1/G15, G2, G9) | 2 | `routes/quotes.ts` | High |
| 3 | Medium Bugs + Remaining Gaps | 19 | 5+ | Multiple route files | High |
| 4 | Polish - Order Flow | 4 (M1, M2, M4, M5) | 1 | None | Low |
| 5 | Frontend & Admin Features | 12 (F1, F7, F8, F11, F12, A1-A6, M3) | 0 | `lib/invoiceGenerator.ts` | High |
| 6 | Compliance & Polish | 12 (S2, S5, S6, F2-F6, F10, T3-T5) | 1 | Test files | Medium |
| **Total** | **All 42 Issues** | **42** | **~12** | **~10 new files** | **—** |

### Execution Order
1. **Phase 0** → Security & Infrastructure (do first, before any feature work)
2. **Phase 1** → Critical Bug Fixes (fix broken state machine)
3. **Phase 2** → Critical Gaps (scheduling, quotes, escrow)
4. **Phase 3** → Medium Bugs + Remaining Gaps (18 items)
5. **Phase 4** → Polish - Order Flow (low-priority model fixes)
6. **Phase 5** → Frontend & Admin Features (customer-facing + admin panel)
7. **Phase 6** → Compliance & Polish (security, GDPR, testing)

### Key Dependencies
- Phase 1 depends on Phase 0 (rate limiting protects new endpoints)
- B8 depends on B7 (enum values must exist before function update)
- G2 (quotes) depends on B7/B8 (BookingMode enum)
- G9 (escrow) depends on G2 (payment capture during quote acceptance)
- M3 (Stripe) depends on G9 (escrow payment system)
- Phase 5 depends on Phase 2 (Stripe Connect for escrow)
- Phase 6 depends on Phase 0 (testing infra from T1/T2)