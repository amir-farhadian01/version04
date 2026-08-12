# Neighborly — Testing Strategy

**Version:** 1.0.0 | **Updated:** 2026-05-23  
**Status:** ✅ Active — applies to all current and future development

> This document defines the comprehensive testing strategy for the Neighborly marketplace platform. It covers all test types, patterns, tooling, CI/CD integration, and enforcement mechanisms. Every contributor **must** read this document before writing or modifying tests.

---

## Table of Contents

1. [Testing Philosophy](#1-testing-philosophy)
2. [Test Types & Responsibilities](#2-test-types--responsibilities)
   - [2.1 Unit Tests](#21-unit-tests)
   - [2.2 Integration Tests](#22-integration-tests)
   - [2.3 E2E Tests](#23-e2e-tests)
   - [2.4 Performance Tests](#24-performance-tests)
   - [2.5 Security Tests](#25-security-tests)
   - [2.6 Accessibility Tests](#26-accessibility-tests)
   - [2.7 Visual Regression Tests](#27-visual-regression-tests)
3. [Test Structure & Patterns](#3-test-structure--patterns)
   - [3.1 Backend Test Pattern](#31-backend-test-pattern)
   - [3.2 Frontend Test Pattern](#32-frontend-test-pattern)
4. [CI/CD Integration](#4-cicd-integration)
5. [Test Data Management](#5-test-data-management)
6. [Coverage Enforcement](#6-coverage-enforcement)
7. [Playwright Verification](#7-playwright-verification)
8. [Test Checklist for PRs](#8-test-checklist-for-prs)

---

## 1. Testing Philosophy

### 1.1 Testing Pyramid

Neighborly follows the **standard testing pyramid** with an emphasis on fast, reliable tests at every layer:

```
         ╱╲
        ╱  ╲          E2E (Playwright)
       ╱    ╲         Few — critical user flows only
      ╱──────╲
     ╱        ╲       Integration (Supertest + MSW)
    ╱          ╲      Some — API contracts, DB interactions, auth flows
   ╱────────────╲
  ╱              ╲    Unit (Jest / Vitest)
 ╱                ╲   Many — services, hooks, utilities, components
╱──────────────────╲
```

| Layer | Tool | Speed | Quantity | Purpose |
|-------|------|-------|----------|---------|
| Unit | Jest (backend) / Vitest (frontend) | ⚡ ms | High | Test individual functions, hooks, utilities, services in isolation |
| Integration | Supertest (backend) / MSW (frontend) | ⏱️ s | Medium | Test full request/response lifecycle, DB interactions, auth flows |
| E2E | Playwright | 🐢 min | Low | Test critical user flows in a real browser |

### 1.2 Coverage Targets

Coverage thresholds are **enforced in CI** and defined in [`vitest.config.ts`](../vitest.config.ts) and [`frontend/vite.config.ts`](../frontend/vite.config.ts):

| Metric | Threshold |
|--------|-----------|
| Branches | **75%** |
| Functions | **80%** |
| Lines | **80%** |
| Statements | **80%** |

> ⚠️ These are **minimum** thresholds. Critical paths (auth, payments, KYC) should target **90%+**. Any PR that drops coverage below these thresholds will be **blocked from merge**.

### 1.3 TDD Approach for New Features

All new features **must** follow a Test-Driven Development (TDD) workflow:

1. **Write the test first** — define the expected behavior before implementation
2. **Implement the feature** — write the minimum code to make the test pass
3. **Refactor** — clean up the implementation while keeping tests green
4. **Verify** — run the full test suite and Playwright verification

This applies to:
- New API endpoints (backend integration tests)
- New React components (frontend unit tests)
- New services or utilities (unit tests)
- New user flows (E2E tests)

---

## 2. Test Types & Responsibilities

### 2.1 Unit Tests

#### Backend (Jest + Supertest)

**Framework:** Jest (via Vitest) + Supertest  
**Config:** [`vitest.config.ts`](../vitest.config.ts) — root-level, covers `src/**/*.test.{ts,tsx}`  
**Runner:** `npm test` (root)

**What to test:**
- Individual utility functions in [`lib/`](../lib/)
- Service layer functions
- Validation logic (Zod schemas)
- Helper/transformer functions
- Middleware functions (auth, validation, error handling)

**What NOT to test:**
- Implementation details (private functions, internal state)
- Third-party library behavior (Prisma, Express, Zod)
- Database queries in isolation (covered by integration tests)
- Configuration or boilerplate code

**File naming:** `*.test.ts`  
**Location:** Co-located with source files in `__tests__/` directories, e.g.:
```
lib/
├── auth.middleware.ts
├── __tests__/
│   └── auth.middleware.test.ts
```

#### Frontend (Vitest + Testing Library)

**Framework:** Vitest + `@testing-library/react` + `@testing-library/jest-dom`  
**Config:** [`frontend/vite.config.ts`](../frontend/vite.config.ts) — `test` section  
**Setup:** [`frontend/src/test-setup.ts`](../frontend/src/test-setup.ts) — imports `@testing-library/jest-dom` matchers  
**Runner:** `cd frontend && npm test`

**What to test:**
- React components (render, interaction, state changes)
- Custom hooks (via `renderHook` from Testing Library)
- Service functions (API call wrappers)
- Utility functions
- Store logic (Zustand stores)

**What NOT to test:**
- Implementation details (component internals, state shape)
- Third-party library behavior (React, TanStack Query, Zustand)
- Browser APIs (covered by E2E)
- CSS/styling

**File naming:** `*.test.ts` or `*.test.tsx`  
**Location:** Co-located with source files in `__tests__/` directories, e.g.:
```
frontend/src/services/
├── business.ts
├── __tests__/
│   └── business.test.ts
```

**Example test file:** [`frontend/src/services/__tests__/business.test.ts`](../frontend/src/services/__tests__/business.test.ts) demonstrates the standard pattern:
- Mock the API client (`vi.mock('../../lib/api')`)
- Clear mocks between tests (`vi.clearAllMocks()` in `beforeEach`)
- Test each function with a dedicated `describe` block
- Verify correct endpoint + params are called
- Verify response data is returned correctly

### 2.2 Integration Tests

#### Backend (Supertest + Real DB)

**Framework:** Supertest + Vitest  
**Database:** Real PostgreSQL via transaction rollback pattern

**What to test:**
- Full request/response lifecycle through Express middleware
- Database interactions (create, read, update, delete)
- Authentication and authorization flows
- Input validation (Zod schema rejection)
- Error handling (404, 400, 401, 403, 500)
- Pagination, filtering, sorting

**Transaction rollback pattern:**
```typescript
import { prisma } from '../lib/db.js'

describe('POST /api/orders', () => {
  beforeEach(async () => {
    await prisma.$executeRawUnsafe('BEGIN')
  })

  afterEach(async () => {
    await prisma.$executeRawUnsafe('ROLLBACK')
  })

  it('creates an order', async () => {
    // Test logic — all DB changes are rolled back after each test
  })
})
```

**Required test cases for every endpoint:**
1. Unauthenticated request → **401**
2. Invalid input → **400** + descriptive error message (`code` + `message`)
3. Happy path → correct status code + response shape (`{ data: T }`)
4. Edge cases specific to the domain (e.g., duplicate, not found, conflict)

#### Frontend (Testing Library + MSW)

**Framework:** Vitest + `@testing-library/react` + MSW (Mock Service Worker)  
**Config:** MSW handlers in `frontend/src/mocks/handlers.ts`

**What to test:**
- Component behavior with real API response shapes
- Loading, empty, error, and success states
- Form submission flows
- Navigation and routing
- Auth state changes

**MSW setup pattern:**
```typescript
import { setupServer } from 'msw/node'
import { handlers } from '../mocks/handlers'

const server = setupServer(...handlers)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

### 2.3 E2E Tests

**Framework:** Playwright  
**Location:** `frontend/e2e/`  
**Runner:** `npx playwright test`

**What to test (critical user flows):**
- User registration and login
- Order creation wizard (customer flow)
- KYC submission (customer + provider)
- Offer acceptance/decline (provider flow)
- Contract signing
- Admin dashboard operations (user management, KYC review)
- Chat messaging

**Test data requirements:**
```
Names:    "Sarah Johnson" / "Mohammed Al-Rashid"
Emails:   "sarah.j@testuser.com" / "m.rashid@testuser.com"
Phones:   "+1-416-555-0147" / "+1-647-555-0293"
Addresses: "123 Main St, Toronto, ON M5V 1A1"
```

**Self-cleaning requirement:** Each E2E test **must** clean up after itself:
- Delete created records (orders, users, contracts)
- Reset database state to pre-test condition
- Use unique test identifiers to avoid collisions

### 2.4 Performance Tests

**Tool:** k6 or autocannon (backend) / Lighthouse CI (frontend)  
**Location:** `scripts/load-tests/`

**Requirements for every new API endpoint:**
- Response time must be **<200ms at p95** under normal load
- Load test with **50 concurrent users** for 30 seconds — zero failures
- Database queries must be analyzed for **N+1 patterns** (use Prisma `findMany` with `include` or `select` — never lazy-load in loops)
- Store performance test results in the PR description

**Lighthouse budgets (enforced in CI):**

| Metric | Budget |
|--------|--------|
| Performance score | ≥90 |
| Accessibility score | ≥95 |
| Best Practices score | ≥90 |
| SEO score | ≥90 |
| Time to Interactive (TTI) | <2s |
| First Contentful Paint (FCP) | <1s |
| Largest Contentful Paint (LCP) | <2.5s |
| Cumulative Layout Shift (CLS) | <0.1 |

### 2.5 Security Tests

**Required for every new API endpoint:**

| Test | Payload | Expected Result |
|------|---------|-----------------|
| SQL injection | `' OR 1=1 --` in all string inputs | 400 or 401, no data leak |
| XSS | `<script>alert('xss')</script>` in text inputs | Escaped/stripped in response |
| CSRF | State-changing endpoint without JWT | 401 |
| JWT tampering | Expired, malformed, wrong signature tokens | 401 |
| IDOR | User A accesses User B's resource by changing IDs | 403 |
| Rate limiting | Exceed rate limit on auth endpoints | 429 |

**Security test pattern:**
```typescript
describe('Security: POST /api/orders', () => {
  it('rejects SQL injection in serviceId', async () => {
    const token = await loginAsCustomer()
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ serviceId: "' OR 1=1 --", status: 'draft' })
    expect(res.status).toBe(400)
  })

  it('rejects IDOR — customer cannot access another customer order', async () => {
    const token = await loginAsCustomer('user-a')
    const res = await request(app)
      .get('/api/orders/order-owned-by-user-b')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(403)
  })
})
```

### 2.6 Accessibility Tests

**Tool:** `axe-core` (via `@axe-core/playwright` or `jest-axe`)  
**Required for every new frontend component or page.**

**Checklist:**
- [ ] Run `axe-core` automated scan on every page — zero violations
- [ ] Keyboard navigation: Tab through all interactive elements — logical focus order, visible focus indicators
- [ ] ARIA labels: All icons, buttons, and interactive elements have descriptive `aria-label` or accessible text
- [ ] Focus management: Modals trap focus, dialogs return focus on close, error summaries receive focus
- [ ] Color contrast: WCAG AA minimum (4.5:1 normal text, 3:1 large text)
- [ ] Semantic HTML: Proper heading hierarchy (`h1`→`h6`), landmarks (`<nav>`, `<main>`, `<aside>`), lists (`<ul>`, `<ol>`)
- [ ] Form inputs: All inputs have associated `<label>` elements
- [ ] Images: All images have meaningful `alt` text

**Accessibility test pattern:**
```typescript
import { axe, toHaveNoViolations } from 'jest-axe'
expect.extend(toHaveNoViolations)

it('has no accessibility violations', async () => {
  const { container } = render(<OrderCard order={mockOrder} />)
  const results = await axe(container)
  expect(results).toHaveNoViolations()
})
```

### 2.7 Visual Regression Tests

**Tool:** `jest-image-snapshot` or Playwright screenshot comparison  
**Location:** `frontend/__screenshots__/baseline/` (baseline images)

**Workflow:**
1. **Before changes:** Take a baseline screenshot of every affected page/component
2. **After changes:** Take a comparison screenshot
3. **Diff:** Compare against baseline — pixel threshold **<0.1%** difference allowed
4. **Review:** Visual regression tests require **manual approval** before merge

**Rules:**
- Baseline screenshots are committed to the repository
- Comparison screenshots are stored as CI artifacts
- Any visual diff >0.1% must be reviewed and either:
  - Accepted (intentional change) → update baseline
  - Rejected (unintentional regression) → fix and re-run

---

## 3. Test Structure & Patterns

### 3.1 Backend Test Pattern

Every backend test file **must** follow this structure:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from '../app.js'

// Helper: authenticate as a test user
async function loginAsCustomer(): Promise<string> {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'customer@test.com', password: 'password123' })
  return res.body.data.token
}

describe('POST /api/resource', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/resource').send({})
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid input', async () => {
    const token = await loginAsCustomer()
    const res = await request(app)
      .post('/api/resource')
      .set('Authorization', `Bearer ${token}`)
      .send({ invalidField: 'bad' })
    expect(res.status).toBe(400)
    expect(res.body.code).toBeDefined()
    expect(res.body.message).toBeDefined()
  })

  it('creates resource for valid input', async () => {
    const token = await loginAsCustomer()
    const res = await request(app)
      .post('/api/resource')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test Resource' })
    expect(res.status).toBe(201)
    expect(res.body.data.id).toBeDefined()
  })
})
```

**Key conventions:**
- Use `request(app)` from Supertest — never start a real HTTP server
- Extract auth helpers into a shared `test-utils.ts` file
- Always test the **4 required cases** (401, 400, happy path, edge case)
- Assert on `res.body.data` for success and `res.body.code`/`res.body.message` for errors
- Use `describe` blocks per endpoint, `it` blocks per scenario

### 3.2 Frontend Test Pattern

Every frontend test file **must** follow this structure:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ComponentName from './ComponentName'

// Mock dependencies
vi.mock('../../lib/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}))

describe('ComponentName', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading state', () => {
    render(<ComponentName />)
    expect(screen.getByRole('status')).toBeInTheDocument() // spinner
  })

  it('renders empty state', async () => {
    // Mock empty response
    render(<ComponentName />)
    await waitFor(() => {
      expect(screen.getByText('No items found')).toBeInTheDocument()
    })
  })

  it('renders error state', async () => {
    // Mock error response
    render(<ComponentName />)
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
  })

  it('renders data correctly', async () => {
    // Mock success response
    render(<ComponentName />)
    await waitFor(() => {
      expect(screen.getByText('Expected Data')).toBeInTheDocument()
    })
  })
})
```

**Key conventions:**
- Mock external dependencies (API client, stores) with `vi.mock()`
- Clear mocks in `beforeEach` to prevent test pollution
- Test **all 4 states**: loading, empty, error, success
- Use `screen.getByRole()` for accessibility-first queries
- Use `waitFor()` for async rendering
- Use `userEvent` (from `@testing-library/user-event`) for user interactions — never `fireEvent` directly
- Prefer `getByRole`, `getByLabelText`, `getByPlaceholderText` over `getByTestId`

---

## 4. CI/CD Integration

### 4.1 Pipeline Stages

Tests run on **every PR** via GitHub Actions. The pipeline executes in this order:

```
1. Lint         → eslint (fail on warnings)
2. Typecheck    → tsc --noEmit (strict mode)
3. Unit Tests   → vitest run --coverage (backend + frontend)
4. Integration  → vitest run --config vitest.integration.ts
5. Build        → vite build (backend + frontend)
6. E2E Tests    → playwright test (requires running services)
7. Visual Diff  → jest-image-snapshot comparison
8. Lighthouse   → lighthouse-ci (performance budget)
```

### 4.2 Gating Rules

| Stage | Failure Action |
|-------|---------------|
| Lint | ❌ Block merge |
| Typecheck | ❌ Block merge |
| Unit Tests | ❌ Block merge |
| Integration Tests | ❌ Block merge |
| Build | ❌ Block merge |
| E2E Tests | ❌ Block merge |
| Visual Regression | ⚠️ Require manual approval |
| Lighthouse | ❌ Block merge if budget exceeded |

### 4.3 Coverage Reports

- Coverage reports are generated with `--coverage` flag on every test run
- Reports are stored in `coverage/` directory (gitignored — not committed)
- Reports are uploaded as CI artifacts for PR review
- PR comments include coverage delta (change vs. base branch)

### 4.4 GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Test Suite
on: [pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: neighborly_test
        ports:
          - 5432:5432
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test -- --coverage
      - run: cd frontend && npm ci && npm test -- --coverage
      - uses: actions/upload-artifact@v4
        with:
          name: coverage
          path: coverage/
```

---

## 5. Test Data Management

### 5.1 Factories

Use factory functions to generate consistent, realistic test data:

```typescript
// test-utils/factories.ts
export function createTestUser(overrides: Partial<UserInput> = {}): UserInput {
  return {
    email: 'sarah.j@testuser.com',
    password: 'Password123!',
    firstName: 'Sarah',
    lastName: 'Johnson',
    phone: '+1-416-555-0147',
    role: 'customer',
    ...overrides,
  }
}

export function createTestOrder(overrides: Partial<OrderInput> = {}): OrderInput {
  return {
    customerId: 'test-customer-id',
    serviceCatalogId: 'test-service-id',
    description: 'Need help with plumbing repair',
    scheduledDate: new Date('2026-06-01T10:00:00.000Z'),
    ...overrides,
  }
}
```

### 5.2 Realistic Test Data Set

All test data should be **Toronto-based** and realistic:

| Entity | Test Data |
|--------|-----------|
| Customer | Sarah Johnson, sarah.j@testuser.com, +1-416-555-0147, 123 Main St, Toronto, ON M5V 1A1 |
| Provider | Mohammed Al-Rashid, m.rashid@testuser.com, +1-647-555-0293, 456 Queen St W, Toronto, ON M5V 2B4 |
| Admin | admin@neighborly.com, +1-416-555-0001 |
| Service | Residential Cleaning, Plumbing Repair, Electrical Wiring |
| Order | Draft → Published → Matched → Accepted → In Progress → Completed |

### 5.3 Rules

- **No production data** in test environments — ever
- Test database is **seeded** via [`prisma/seed.ts`](../prisma/seed.ts) for integration tests
- Each test run uses a **fresh database state** (transaction rollback or truncate)
- Test data must be **deterministic** — no random values that could cause flaky tests
- Use `beforeEach`/`afterEach` for setup/teardown — never rely on test ordering

---

## 6. Coverage Enforcement

### 6.1 Configuration

Coverage thresholds are defined in the test runner configuration:

**Root [`vitest.config.ts`](../vitest.config.ts):**
```typescript
test: {
  coverage: {
    provider: 'v8',
    reporter: ['text', 'json', 'html', 'lcov'],
    thresholds: {
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    include: ['src/**/*.ts'],
    exclude: [
      'src/**/*.test.ts',
      'src/**/*.d.ts',
      'src/test/**',
    ],
  },
}
```

**Frontend [`frontend/vite.config.ts`](../frontend/vite.config.ts):**
```typescript
test: {
  coverage: {
    provider: 'v8',
    reporter: ['text', 'json', 'html'],
    thresholds: {
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
}
```

### 6.2 Enforcement Rules

- `--coverage` flag is **required** for all test runs in CI
- Coverage reports are generated in `coverage/` directory (gitignored)
- PRs that drop coverage below thresholds are **blocked from merge**
- PR comments include coverage delta vs. base branch
- Coverage is measured at the **file level** — no file should be below thresholds

### 6.3 Running Coverage Locally

```bash
# Backend (root)
npm test -- --coverage

# Frontend
cd frontend && npm test -- --coverage

# Open HTML report
open coverage/index.html
```

---

## 7. Playwright Verification

### 7.1 Reference to AGENTS.md

The complete 12-step Playwright verification checklist is defined in [`docs/AGENTS.md`](AGENTS.md#-rule-zero--playwright-frontend-verification) (Rule Zero — Playwright Frontend Verification).

**This verification is MANDATORY for all frontend changes.** No agent may declare a task complete without passing all 12 steps.

### 7.2 Quick Reference

| Step | Description |
|------|-------------|
| **Step 0** | Identify which frontend surface(s) the task touches |
| **Step 1** | Confirm the surface is running |
| **Step 2** | Navigate to every affected page |
| **Step 3** | Click EVERY interactive element on affected pages |
| **Step 4** | Screenshots + visual inspection |
| **Step 5** | Console error check |
| **Step 6** | Mobile viewport check (375px) |
| **Step 7** | Loading, empty, and error states |
| **Step 8** | Accessibility verification |
| **Step 9** | RTL/LTR layout verification |
| **Step 10** | Offline / network recovery |
| **Step 11** | Browser navigation (back, forward, refresh, deep linking) |
| **Step 12** | Concurrent user sessions |

### 7.3 Screenshots

- Screenshots are stored per PR in CI artifacts
- Baseline screenshots live in `frontend/__screenshots__/baseline/`
- Each PR must include screenshots of all affected pages in the description

### 7.4 Completion Report

After all 12 steps pass, include this report in the PR:

```
✅ PLAYWRIGHT VERIFICATION COMPLETE
Surfaces tested:    [list each surface + URL]
Pages tested:       [list every route per surface]
Interactions tested:[list every button/form/interaction tested]
Test data used:     [describe data used for form submissions]
Screenshots taken:  [count]
Console errors:     None
Mobile verified:    Yes (375px) / N/A
Loading states:     Verified
Empty states:       Verified
Error states:       Verified
Accessibility:      Verified
RTL/LTR:            Verified / N/A
Offline recovery:   Verified / N/A
Browser nav:        Verified
Concurrent sessions:Verified / N/A
Task status:        COMPLETE
```

---

## 8. Test Checklist for PRs

Every PR **must** pass this checklist before merge. Any unchecked item = **block merge**.

```
□ Unit tests written for all new logic
□ Integration tests for new API endpoints
□ Loading/empty/error states tested
□ Coverage ≥80% for changed files
□ Branch coverage ≥75%
□ No flaky tests
□ Playwright verification passed (12 steps)
□ Accessibility tested (axe-core)
□ Performance budget met
□ Security tests pass
□ Visual regression tests pass
□ All tests pass in CI
□ Coverage delta reported in PR comment
□ Test data uses realistic values (Toronto-based)
□ Tests are self-cleaning (no side effects between runs)
□ No console.log in test files (use structured logging)
```

---

## Appendix A: Quick Reference

### Commands

| Command | Location | Description |
|---------|----------|-------------|
| `npm test` | Root | Run all backend unit tests with coverage |
| `npm run test:watch` | Root | Run backend tests in watch mode |
| `cd frontend && npm test` | Frontend | Run all frontend unit tests with coverage |
| `cd frontend && npm run test:watch` | Frontend | Run frontend tests in watch mode |
| `npx playwright test` | Root | Run E2E tests |
| `npx playwright test --ui` | Root | Run E2E tests with Playwright UI mode |
| `npm run lint` | Root | ESLint check |
| `npm run typecheck` | Root | TypeScript strict mode check |

### Key Files

| File | Purpose |
|------|---------|
| [`vitest.config.ts`](../vitest.config.ts) | Root test configuration (backend) |
| [`frontend/vite.config.ts`](../frontend/vite.config.ts) | Frontend test configuration |
| [`frontend/src/test-setup.ts`](../frontend/src/test-setup.ts) | Frontend test setup (jest-dom matchers) |
| [`frontend/src/services/__tests__/business.test.ts`](../frontend/src/services/__tests__/business.test.ts) | Example frontend test file |
| [`docs/AGENTS.md`](AGENTS.md) | Playwright verification checklist (Rule Zero) |
| [`prisma/seed.ts`](../prisma/seed.ts) | Test database seed data |
| [`.github/workflows/test.yml`](../.github/workflows/test.yml) | CI test workflow |
| [`scripts/test-social-feed.sh`](../scripts/test-social-feed.sh) | Social feed API smoke test (posts, likes, comments, saves, follow, feed, stories, search) |

### Glossary

| Term | Definition |
|------|------------|
| **MSW** | Mock Service Worker — intercepts network requests in tests |
| **Supertest** | HTTP assertion library for testing Express apps |
| **Vitest** | Vite-native test runner (used for both backend and frontend) |
| **Testing Library** | React component testing utilities (queries, events, async) |
| **Playwright** | Browser automation framework for E2E testing |
| **axe-core** | Accessibility testing engine |
| **IDOR** | Insecure Direct Object Reference — security vulnerability |
| **N+1** | Database query anti-pattern (1 query for parent + N queries for children) |
| **p95** | 95th percentile — 95% of requests are faster than this value |
| **CLS** | Cumulative Layout Shift — visual stability metric |
| **LCP** | Largest Contentful Paint — loading performance metric |
| **TDD** | Test-Driven Development — write tests before implementation |
