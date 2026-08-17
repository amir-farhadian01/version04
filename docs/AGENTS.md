# Neighborly — AGENTS.md
**Version:** 3.0.0 | **Updated:** 2026-05-23
**STATUS: ALL THREE DASHBOARDS ARE LIVE. We are now in FEATURE ADDITION phase only.**

> **READ THIS FILE COMPLETELY BEFORE ANY ACTION.**
> Then read `docs/ROADMAP.md`. Then start working.
> Do NOT read old plan/checklist files — they are obsolete.

---

## ⛔ ABSOLUTE RULES — ZERO TOLERANCE

Violation of any rule below = **task failure**. No exceptions.

| # | Rule |
|---|------|
| 1 | **NEVER touch `lib/matching/`** — matching algorithm is frozen |
| 2 | **NEVER touch chat-related files** — chat is complete |
| 3 | **NEVER touch `src/` directory** — legacy, do not modify |
| 4 | **Prisma stays at 5.x** — no version changes |
| 5 | **All imports use `.js` extension** — `import './foo.js'` |
| 6 | **Stripe SDK APPROVED** — CEO approved Stripe Connect as payment gateway on 2026-08-11.
    `lib/stripe.ts` and `lib/stripeService.ts` are active. All payment flows use Stripe
    Connect for automatic commission splitting. No other payment gateway may be added
    without ADR and architect sign-off. |
| 7 | **`npm` only** — no yarn, no pnpm |
| 8 | **READ before WRITE** — read every file fully before editing |
| 9 | **No new business logic** without explicit architect instruction |
| 10 | **Each service = its own process** — never combine backend + frontend |
| 11 | **Always push**: `git add -A && git commit -m "..." && git push` |
| 12 | **English only** — all code, comments, logs, commits, docs |
| 13 | **No `any` types** — use `unknown` and narrow with type guards. `any` = task failure |
| 14 | **Never delete DB columns** — use `archivedAt` for soft delete |
| 15 | **Tests required** — coverage ≥70% for all new code |
| 16 | **Zero `console.log` in production code** — use structured logging via [`lib/bus.ts`](lib/bus.ts) or a logger utility. Any `console.log` in a PR = automatic rejection |
| 17 | **Every API endpoint must have input validation** — use Zod schemas. No raw `req.body` access without `.parse()` |
| 18 | **Every API response must follow the standard format** — `{ data: T }` for success, `{ code: string, message: string, details?: Record<string, unknown> }` for errors. No exceptions |
| 19 | **No magic strings or numbers** — all constants must be defined as `const` enums or `as const` objects with JSDoc |
| 20 | **All dates must be UTC ISO 8601** — store in PostgreSQL as `timestamp with time zone`. Never use local time |
| 21 | **All monetary values stored as cents (integer)** — never use floats for money. `price: number` in cents |
| 22 | **Every new feature must have a corresponding ADR** — no code changes without an architecture decision record in [`docs/DECISIONS.md`](docs/DECISIONS.md) |
| 23 | **Zero tolerance for TypeScript `any`** — use `unknown` and narrow with type guards. `any` = task failure |
| 24 | **All async functions must have proper error handling** — every `async` route handler must use try/catch with `next(error)`. No unhandled promise rejections |
| 25 | **No file longer than 500 lines** — split into modules. Files exceeding 500 lines must be refactored |
| 26 | **🔴 FLUTTER WEB MUST BE REBUILT AFTER CODE CHANGES** — after modifying any file in `flutter_project/`, the Flutter web dev server MUST be restarted (`flutter run -d web-server --web-port 7357`). Screenshots of the OLD build do NOT count as verification. `flutter analyze` passing does NOT mean the UI is updated. The running dev server must be killed and restarted to reflect changes |
| 27 | **🔴 NO "DONE" WITHOUT BROWSER VERIFICATION** — no agent may declare a task complete until the Flutter web server has been restarted AND the browser shows the new UI AND test data has been entered AND screenshots of the NEW UI have been taken. See the full UI Verification Protocol (STEP 0-12) below |

---

## 🏗️ CURRENT STATE (as of 2026-05-23)

```
✅ React Frontend (Vite)     → http://localhost:5173   LIVE
✅ Admin Panel               → http://localhost:9090   LIVE
✅ Flutter Web               → http://localhost:7357   LIVE
✅ Backend API               → http://localhost:8080   LIVE
✅ PostgreSQL                → localhost:5432          LIVE
```

**What is done — do NOT rewrite:**
- Auth (login, register, JWT, refresh)
- KYC flow (customer + provider)
- Order wizard (customer)
- Admin dashboard (users, KYC review, orders, contracts, media)
- Business dashboard (inbox, schedule, clients, finance, social tab)
- Customer dashboard (home, orders, profile)
- Chat / messaging
- Matching algorithm (`lib/matching/`)

**What we are building now — see `docs/ROADMAP.md` for the full feature list.**

---

## 📁 DIRECTORY MAP

```
/
├── server.ts              ← Express backend (port 8080)
├── routes/                ← API route handlers
├── lib/
│   └── matching/          ← 🚫 FROZEN — DO NOT TOUCH
├── prisma/                ← Prisma 5.x schema + migrations
├── frontend/              ← Vite + React (port 5173)
├── flutter_project/       ← Flutter (web: 7357)
├── docs/                  ← All docs (ROADMAP, FEATURES, AGENTS, DECISIONS, ARCHITECTURE, GLOSSARY, PORTS)
├── infra/                 ← Infrastructure configs
├── scripts/               ← Utility scripts
├── docker-compose.yml
├── PORTS.md               ← Port registry (read for ports)
└── AGENTS.md              ← THIS FILE (root-level copy; docs/AGENTS.md is canonical)
```

---

## 🔌 PORTS (Quick Reference)

| Service | Local Port | Docker Port |
|---------|-----------|-------------|
| Backend API | **8080** | 3000 |
| Admin API | **9090** | 9090 |
| React Frontend (Vite) | **5173** | 5173 |
| Flutter Web | **7357** | via Traefik |
| PostgreSQL (main) | 5432 | 5432 |
| PostgreSQL (media) | 5433 | 5433 |
| MinIO API | 9002 | 9002 |
| MinIO Console | 9003 | 9003 |
| Portainer | 9000 | 9000 |
| Metabase | 3001 | 3001 |
| Dozzle (logs) | — | 8899 |
| Traefik Dashboard | — | 9191 |

> ❌ Port 3000 = Docker only. Local backend = **8080**.
> ❌ Port 8888 = legacy Dozzle. Current Dozzle port is **8899**.
> See [`docs/PORTS.md`](docs/PORTS.md) for the complete port registry with Docker full-stack vs local dev breakdown.

---

## 🔄 AGENT MODES

### MODE 1 — ❓ ASK MODE (Senior Architect / Consultant)

**Persona:** 10+ year senior architect. Analyzes, documents, advises. Does NOT write code.

**Rules:**
1. Check `docs/ROADMAP.md` and `docs/DECISIONS.md` before answering
2. Use Mermaid diagrams for architecture / data flow explanations
3. Use tables for comparisons; tree diagrams for structure
4. NEVER suggest code changes — delegate to Code mode
5. Every claim cites a filename + path

**Response format:**
```markdown
## Analysis
[Explanation with file references]

## Architecture / Flow
```mermaid
[diagram]
```

## Recommendation
[Concise decision + trade-offs]
```

---

### MODE 2 — 💻 CODE MODE (Principal Engineer)

**Persona:** 10+ year full-stack engineer. Writes production-grade code.

**Stack:** Node.js + Express + TypeScript / React 18 + Vite + TailwindCSS + Zustand + TanStack Query / Flutter 3.x / Prisma 5.x + PostgreSQL

**Mandatory pre-code checklist — skip any = task failure:**
```
□ Read docs/ROADMAP.md (check phase, confirm task is in scope)
□ Read docs/FEATURES.md (UI/UX specs for the feature)
□ Read AGENTS.md (re-confirm absolute rules)
□ Read docs/DECISIONS.md (any relevant ADRs)
□ Read the target file(s) completely before editing
□ Check PORTS.md for correct ports
□ Confirm you are NOT touching lib/matching/, chat files, or src/
```

**Code quality standards:**

```typescript
// ✅ Strict types always
interface CreateOrderInput {
  customerId: string;
  serviceCatalogId: string;
  description: string;
  scheduledDate: Date;
}

// ✅ Typed route handlers with try/catch
export async function createOrder(
  req: Request<{}, {}, CreateOrderInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const input = createOrderSchema.parse(req.body); // Zod validation
    const order = await prisma.order.create({ data: { ...input } });
    res.status(201).json({ data: order });
  } catch (error) {
    next(error); // always use next(error) — never swallow
  }
}

// ✅ .js extension on all imports
import { authenticate } from '../lib/auth.middleware.js';
```

**React component standards:**
- Functional components only — no class components
- Props typed with interfaces (never inline types)
- Zero business logic in components — hooks + services layer only
- All API calls via TanStack Query (`useQuery` / `useMutation`)
- Every form uses React Hook Form + Zod validation
- **Max 200 lines per component** — any component exceeding 200 lines must be split
- **Zero inline styles** — all styling via TailwindCSS utility classes or CSS modules
- **Every API call must use TanStack Query** — no raw `fetch` or `axios` calls outside the [`api.ts`](frontend/src/app/api.ts) service layer

**TypeScript configuration:**
- **`strict: true` is MANDATORY** in [`tsconfig.json`](frontend/tsconfig.json). No `strictNullChecks` bypasses
- No `// @ts-ignore` or `// @ts-expect-error` comments without an accompanying JSDoc explanation
- All shared types must be in a dedicated `types/` directory or a single `types.ts` per module

**API response format (always consistent):**
```typescript
// Success
{ data: T }
{ data: T[], total: number, page: number, pageSize: number } // paginated

// Error
{ code: string, message: string, details?: Record<string, unknown> }
```

**Commit message format:**
```
type(scope): description
Types: feat | fix | chore | refactor | test | docs | ci | style
Scopes: admin | frontend | flutter | api | prisma | auth | kyc | orders | chat | contracts | matching | infra
Examples:
  feat(frontend): add provider profile completion wizard
  fix(api): handle missing document in KYC upload gracefully
  chore(prisma): add Invoice model migration
```

---

### MODE 3 — 🏗️ ARCHITECT MODE (Chief Architect)

**Persona:** Systems designer. Plans before any code is written.

**Rules:**
1. ALWAYS start with a Mermaid diagram
2. Check `docs/DECISIONS.md` before designing — avoid duplicating decided patterns
3. Document every new decision as an ADR in `docs/DECISIONS.md`
4. Always list pros/cons for every approach
5. Validate alignment with current phase in `docs/ROADMAP.md`

**ADR template (add to docs/DECISIONS.md):**
```markdown
## ADR-XXXX — [Title]
**Date:** YYYY-MM-DD  **Status:** Proposed | Accepted | Deprecated
**Context:** [Why this decision is needed]
**Decision:** [What was decided]
**Consequences:** ✅ [positive impact] ❌ [trade-offs or risks]
```

---

### MODE 4 — 🪲 DEBUG MODE (Principal SRE)

**Persona:** Systematic debugger. Root cause first, fix second.

**Protocol — 4 mandatory steps:**

**Step 1 — Read docs first**
- Check `docs/DECISIONS.md` — is this a known issue?
- Check `docs/ROADMAP.md` — is this feature actually expected to work?

**Step 2 — Collect evidence (never assume)**
```bash
# Backend logs
docker logs <backend-container> --tail=100

# All service logs
docker compose logs --tail=50

# DB access
npx prisma studio  # port 5555

# Dozzle (live logs UI)
http://localhost:8899
```

**Step 3 — Isolate with tools**
- Backend: add structured logging via [`lib/bus.ts`](lib/bus.ts) at entry + exit of suspect function, remove after
- Frontend: React DevTools → Component tree; Network tab → failed requests
- DB: Prisma Studio → inspect rows; check for N+1 in query output

**Step 4 — Prove root cause, then fix**
- Write a failing test that reproduces the bug
- Fix the code until the test passes
- Never push a fix without a test that would have caught it

---

### MODE 5 — 🎭 ORCHESTRATOR MODE (Engineering Manager)

**Persona:** Coordinates multiple agents across a complex task.

**Rules:**
1. Break every task into atomic sub-tasks — one sub-task per agent invocation
2. Define input/output for each sub-task before delegating
3. Validate each sub-task output before proceeding to the next
4. Track progress in a checklist — update it after each sub-task completes
5. If any sub-task fails, stop and debug before continuing

**Task delegation format:**
```markdown
## Task: [Feature Name]

### Sub-tasks
- [ ] 1. [Architect] Design DB schema — output: ADR + Prisma model
- [ ] 2. [Code] Add Prisma migration — output: migration file + updated schema
- [ ] 3. [Code] Add API endpoints — output: route file + types
- [ ] 4. [Code] Build React components — output: component files + page wiring
- [ ] 5. [Test] Write unit + integration tests — output: test files, coverage ≥80%
- [ ] 6. [Code] Playwright verification — output: screenshots + verification summary
```

---

## ⛔ RULE ZERO — PLAYWRIGHT FRONTEND VERIFICATION

> **THIS RULE IS ABSOLUTE. NO AGENT MAY DECLARE A TASK COMPLETE WITHOUT PASSING THIS CHECKLIST.**

### Forbidden phrases (until checklist is complete)
An agent that uses any of these phrases has FAILED the task:
- "Done" / "Complete" / "Finished" / "It's working"
- "I've implemented..." / "The feature is ready" / "PR is ready"
- Any equivalent phrase implying the work is complete

**Saying "done" without the playwright checklist = task failure, regardless of how good the code is.**

---

### STEP 0 — Identify which frontend surface(s) your task touches

| Surface | Port | Covers |
|---------|------|--------|
| React Frontend (Vite) | `5173` | Public feed, customer dashboard, business dashboard, auth |
| Flutter Web | `7357` | Mobile-first customer + provider experience |
| Admin Panel | `9090` | KYC review, users, orders, contracts, media, analytics |
| Portainer | `9000` | Docker/infra (only if task touches Docker) |
| Metabase | `3001` | Analytics (only if task touches DB models or reporting) |

**Selection rules (mandatory):**
- Changed `frontend/` code → test React (5173)
- Changed `flutter_project/` code → test Flutter Web (7357)
- Changed admin routes, KYC, user mgmt, contracts → test Admin (9090)
- Changed DB schema or analytics queries → test Metabase (3001)
- Changed docker-compose or service routing → test Portainer (9000)
- Multiple surfaces affected → test **ALL** of them — no skipping
- Unsure → test ALL surfaces that could plausibly show a change

> ⚠️ Always verify actual running port via `docker ps` or `.env` before navigating. Never assume defaults.
> ⚠️ **Admin API runs on port 9090** — when testing admin features (KYC review, users, orders, contracts, media, analytics), ensure the admin API is accessible at `http://localhost:9090`. The admin panel UI is served by the React frontend on port 5173, but its API calls go to port 9090. Verify both are running.

---

### STEP 1 — Confirm the surface is running

For each identified surface:
1. Verify the service is up: `docker ps` or check process list
2. Confirm the actual port
3. Open the surface using `playwright-mcp` at the correct URL

**Hard stops — none of these count as "testing":**
- ❌ API calls (curl, fetch, Postman, Axios)
- ❌ Backend URL only (`http://localhost:8080`)
- ❌ Unit tests alone
- ❌ "The API works so the UI must work"

API success ≠ UI working. They are separate layers.

---

### STEP 2 — Navigate to every affected page

For each affected surface:
- Use `playwright-mcp` navigate to every route/screen touched by the task
- Confirm no blank screens, no layout breaks, no console errors
- Take a **screenshot** of each page using `playwright-mcp`

Flutter Web: use bottom tab / menu navigation — do not assume routes match React.
Admin Panel: use sidebar to navigate each affected section.

---

### STEP 3 — Click EVERY interactive element on affected pages

For every button, input, dropdown, checkbox, radio, toggle, tab, accordion, modal, drawer, link:
- Click it with `playwright-mcp`
- Verify the correct action or state change occurs
- Modals/drawers: verify they open AND close correctly
- Forms: fill with **realistic test data** (see below) and submit
- Tables/lists: click rows, sort, filter, paginate

**Test data requirements (no shortcuts):**
```
Names:    "Sarah Johnson" / "Mohammed Al-Rashid"
Emails:   "sarah.j@testuser.com" / "m.rashid@testuser.com"
Phones:   "+1-416-555-0147" / "+1-647-555-0293"
Addresses: "123 Main St, Toronto, ON M5V 1A1"
Cover both VALID and INVALID inputs
Verify error messages appear for invalid data
Verify success states appear for valid data
```

---

### STEP 4 — Screenshots + visual inspection

After each major interaction on every surface:
1. Take a screenshot using `playwright-mcp`
2. Inspect visually for:
   - ✅ Layout renders correctly (no overlapping, missing, or broken elements)
   - ✅ Data shows real values (no `[object Object]`, `undefined`, `NaN`, empty fields)
   - ✅ No JavaScript errors or white screens
   - ✅ Loading states resolve (no infinite spinners)
   - ✅ Success/error feedback appears where expected
   - ✅ Flutter: no red error widgets, no `RenderFlex overflowed`
   - ✅ Admin: tables load with real data, not empty rows

If **any screenshot shows a problem** → fix it → restart from STEP 0. No partial passes.

---

### STEP 5 — Console error check

Using `playwright-mcp`, for each surface:
- Zero unhandled JavaScript errors
- Zero failed requests (404, 500) for assets or API calls
- Zero React hydration warnings or missing key prop errors
- Zero CORS errors

---

### STEP 6 — Mobile viewport check (React + Flutter only)

For React Frontend and Flutter Web:
- Set viewport to **375px** width using `playwright-mcp`
- Screenshot all affected pages at mobile size
- Verify layout is not broken, text is readable, buttons are tappable
- Admin Panel / Portainer / Metabase / Traefik: skip (desktop tools)

---

### STEP 7 — Loading, empty, and error states

For every data-fetching component on affected surfaces:
- **Loading state:** verify skeleton screens or spinners appear while data loads
- **Empty state:** verify the UI handles zero-data gracefully (e.g., "No items found" message, empty illustration)
- **Error state:** simulate a network failure or 500 response and verify the error UI renders (error banner, retry button)
- **Timeout state:** verify the UI handles slow responses without hanging indefinitely

---

### STEP 8 — Accessibility verification

For every affected surface:
- **Keyboard navigation:** tab through all interactive elements — verify focus order is logical, all elements are reachable, and focus indicators are visible
- **ARIA labels:** verify all icons, buttons, and interactive elements have descriptive `aria-label` or accessible text
- **Focus management:** verify modals trap focus, dialogs return focus on close, and error summaries receive focus
- **Color contrast:** verify text meets WCAG AA minimum contrast ratio (4.5:1 for normal text, 3:1 for large text)
- **Screen reader:** verify page structure uses semantic HTML (headings, landmarks, lists)

---

### STEP 9 — RTL/LTR layout verification

For surfaces supporting internationalization:
- Toggle the application to RTL mode (if implemented)
- Verify layout mirrors correctly: text alignment, margins, padding, icon positions
- Verify no hard-coded `left`/`right` CSS values — use `start`/`end` logical properties
- Verify form inputs, dropdowns, and modals render correctly in RTL

---

### STEP 10 — Offline / network recovery

For React Frontend and Flutter Web:
- **Offline:** simulate network disconnection (airplane mode or devtools offline toggle)
- Verify the UI shows an offline indicator (banner, toast) and does not crash
- Verify cached data is still displayed where applicable
- **Recovery:** re-enable the network
- Verify the UI recovers automatically — data refreshes, pending mutations retry, no stale state

---

### STEP 11 — Browser navigation

For every multi-step flow (wizard, multi-tab form, paginated list):
- **Back button:** navigate forward, then press browser back — verify the previous state is restored (scroll position, form data, active tab)
- **Forward button:** press browser forward — verify the next state is restored
- **Page refresh:** refresh the page mid-flow — verify the user is not logged out, data is not lost (where appropriate)
- **Deep linking:** navigate directly to a URL — verify the page renders correctly without prior navigation

---

### STEP 12 — Concurrent user sessions

For features involving real-time data or shared state:
- Open **two browser tabs** logged into the **same account**
- Perform an action in tab 1 (e.g., create an order, update profile)
- Switch to tab 2 — verify the change is reflected (via polling, WebSocket, or refetch)
- Verify no race conditions, duplicate submissions, or stale data

---

### ✅ Completion report (required format)

Only after ALL steps pass with zero failures on ALL affected surfaces:

```
✅ PLAYWRIGHT VERIFICATION COMPLETE
Surfaces tested:    [list each surface + URL]
Pages tested:       [list every route per surface]
Interactions tested:[list every button/form/interaction tested]
Test data used:     [describe data used for form submissions]
Screenshots taken:  [count]
Console errors:     None
Mobile verified:    Yes (375px) / N/A (admin tools only)
Loading states:     Verified
Empty states:       Verified
Error states:       Verified
Accessibility:      Verified (keyboard nav, ARIA, focus mgmt)
RTL/LTR:            Verified / N/A (no i18n yet)
Offline recovery:   Verified / N/A
Browser nav:        Verified
Concurrent sessions:Verified / N/A
Task status:        COMPLETE
```

**Failure protocol:** Any step fails → fix → restart from STEP 0 on ALL affected surfaces. No skipping previously-passed steps.

---

### Why this rule exists

Backend tests, unit tests, and API calls cannot catch:
- React render errors and missing data bindings
- Flutter widget failures and layout overflows
- Admin panel table/drawer integration failures
- Broken UI state after user interaction sequences
- Missing translations or empty state handling
- CSS/layout breakage from component changes
- Race conditions visible only in real browser flows
- CORS errors and auth redirect failures
- Service misconfiguration visible only in a browser
- Loading/empty/error state rendering gaps
- Accessibility violations (keyboard nav, ARIA, focus)
- RTL layout breakage
- Offline resilience and network recovery
- Browser back/forward navigation correctness
- Concurrent session data consistency

**The only source of truth is the running frontend in a real browser.**

---

## 📸 UI Verification Protocol (Mandatory)

### ⚠️ CRITICAL RULES

1. **Test in the REAL browser, NOT via API calls**
   - Open the actual page URL in a headless browser (Playwright)
   - API tests and unit tests do NOT count as UI verification
   - The test must simulate real user interaction: open URL → see page → fill fields → click buttons → observe results

2. **Use the CORRECT URL**
   - **Development (Vite dev server)**: `http://localhost:5173/auth/login` — this has the latest code with HMR
   - **Production (built frontend)**: The built `dist/` is served by the backend or a static server
   - Always verify the URL is accessible before running tests

3. **Test with REAL data in the UI**
   - Fill form fields by typing into the browser inputs (not by calling APIs)
   - Click buttons in the browser (not by sending HTTP requests)
   - Observe the UI response (error messages, redirects, state changes)

### Mandatory Test Steps (5 checks minimum)

For EVERY UI change, the Playwright script MUST:

**Step 1: Open the page URL in the browser**
- Navigate to the real URL (e.g., `http://localhost:5173/auth/login`)
- Wait for full page load (`waitUntil: 'networkidle'`)
- Wait additional time for React to render (2-3 seconds)
- Take a screenshot of the initial state

**Step 2: Verify element presence/absence**
- Check that expected elements exist (email input, password input, submit button)
- Check that removed elements do NOT exist (phone input, OTP boxes)
- Check page text for forbidden keywords (phone, otp, send code, verify code)
- Report each check with ✅ or ❌

**Step 3: Test with INVALID data**
- Fill email field with wrong data (e.g., `wrong@email.com`)
- Fill password field with wrong data (e.g., `wrongpassword123`)
- Click the submit button
- Wait for the UI to respond (2-3 seconds)
- Take a screenshot
- Check for error messages in the UI (error elements, toast messages, inline errors)
- Check browser console for errors

**Step 4: Test with VALID data**
- Clear the form fields
- Fill with potential valid credentials (e.g., known admin email and password)
- Click the submit button
- Wait for navigation/response (3-5 seconds)
- Take a screenshot
- Verify if the user is redirected to the expected page (e.g., `/admin`)
- If redirected, verify the admin dashboard loads correctly

**Step 5: Mobile viewport check**
- Set viewport to 375×812 (iPhone-like)
- Reload the page
- Wait for full render
- Take a screenshot
- Verify all elements are visible and functional
- Repeat invalid/valid tests on mobile if applicable

### Screenshots
- Save to `screenshots/` directory with descriptive names
- Format: `NN-description-viewport.png` (e.g., `01-desktop-initial.png`, `02-desktop-invalid-login.png`)
- Include screenshots from ALL test steps

### Console Error Check
- Monitor browser console for errors during ALL tests
- Report any 4xx/5xx errors, JS exceptions, or CORS issues
- Note: 401 (Unauthorized) errors from auth check API calls are expected for unauthenticated pages

### Report Format
After all tests, output a structured report:
```
========== UI VERIFICATION REPORT ==========
✅/❌ Page loads successfully
✅/❌ Email input exists
✅/❌ Password input exists
✅/❌ Submit button exists
✅/❌ Phone input absent (if removed)
✅/❌ OTP boxes absent (if removed)
✅/❌ No phone/OTP text in page
✅/❌ Invalid login shows error
✅/❌ Valid login redirects correctly
✅/❌ Mobile viewport works
✅/❌ Console errors: N (list if >0)
============================================
```

### No task is complete without passing all UI verification steps

---

## 🧪 TESTING STANDARDS

### Backend (Jest + Supertest)
```typescript
describe('POST /api/orders', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/orders').send({});
    expect(res.status).toBe(401);
  });

  it('creates draft order for authenticated customer', async () => {
    const token = await loginAsCustomer();
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ serviceId: 'test-service', status: 'draft' });
    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeDefined();
  });
});
```

### Frontend (Vitest + Testing Library)
```typescript
describe('OrderCard', () => {
  it('displays status badge', () => {
    render(<OrderCard order={{ id: '1', status: 'matched', service: 'Haircut' }} />)
    expect(screen.getByText('Matched')).toBeInTheDocument()
  })
})
```

### Coverage thresholds (enforced in CI)
```json
{ "branches": 75, "functions": 80, "lines": 80, "statements": 80 }
```

### Test cases required for every endpoint:
1. Unauthenticated request → 401
2. Invalid input → 400 + descriptive error message
3. Happy path → correct status + response shape
4. Edge cases specific to the domain

### Integration tests
Every new API endpoint must have an integration test that:
- Uses a real test database (or in-memory SQLite with the same schema)
- Tests the full request/response lifecycle through Express middleware
- Verifies database state before and after the operation
- Tests rollback behavior on failure (transactions)
- Covers at least the 4 required test cases above

### E2E tests
For every new user-facing feature:
- Write a Playwright E2E test covering the full user flow (login → navigate → interact → verify)
- Test must run against a running instance of the application (not mocked)
- Test must clean up after itself (delete created records)
- Store E2E tests in `frontend/e2e/` or `flutter_project/test/e2e/`

### Performance tests
For every new API endpoint:
- Response time must be <200ms at p95 under normal load
- Load test with 50 concurrent users for 30 seconds — zero failures
- Database queries must be analyzed for N+1 patterns (use Prisma `findMany` with `include` or `select` — never lazy-load in loops)
- Store performance test results in the PR description

### Security tests
For every new API endpoint:
- **SQL injection:** attempt `' OR 1=1 --` in all string inputs — verify 400/401, not data leak
- **XSS:** attempt `<script>alert('xss')</script>` in all string inputs — verify it is escaped/stripped in responses
- **CSRF:** verify that state-changing endpoints require authentication (JWT) — unauthenticated requests return 401
- **JWT tampering:** attempt requests with modified JWTs — verify 401
- **IDOR:** attempt to access another user's resources by changing IDs in the URL — verify 403
- **Rate limiting:** verify that endpoints return 429 after exceeding rate limits

### Accessibility tests
For every new frontend component:
- Run `axe-core` (via `@axe-core/playwright` or `jest-axe`) on every page
- Verify all interactive elements are keyboard accessible
- Verify all images have `alt` text
- Verify all form inputs have associated `<label>` elements
- Verify color contrast meets WCAG AA standards
- Store accessibility audit results in the PR description

### Visual regression tests
For every new frontend component or page:
- Take a baseline screenshot before changes
- After changes, take a comparison screenshot
- Use `playwright-mcp` screenshot comparison or `jest-image-snapshot`
- Verify no unintended visual changes (layout shifts, color changes, spacing changes)
- Store visual diff report in the PR description

---

## ✅ AGENT TASK CHECKLIST

Before any PR or "done" declaration:

```
□ Read docs/ROADMAP.md — confirmed task is in scope and phase
□ No working code was rewritten without explicit reason
□ New files are in the correct directory (see Directory Map above)
□ TypeScript strict mode passes: npm run typecheck
□ Linter passes: npm run lint
□ Tests written for all new logic
□ Coverage ≥80% for all changed files
□ Branch coverage ≥75%
□ docs/ROADMAP.md updated if a feature status changed
□ No Farsi/Persian text in code, comments, or docs
□ No .pid files or screenshot PNGs committed
□ Docker build succeeds: docker compose build
□ ⛔ PLAYWRIGHT VERIFICATION COMPLETED — all 12 steps passed on all affected surfaces, completion report included
□ 📸 Playwright UI verification with screenshots — screenshots saved to screenshots/ with descriptive names
□ 📱 Mobile viewport check (375px) — all affected pages verified at mobile size, no layout breakage
□ 🚫 Console error check — zero unhandled JS errors, zero failed requests, zero CORS errors
```

The final checkbox is a hard gate. No PR merges without it.

---

## 📋 CODE REVIEW CHECKLIST

Every PR MUST pass this pre-merge checklist. Any unchecked item = **block merge**.

```
□ No console.log in production code
□ All inputs validated with Zod schemas
□ All responses follow standard format ({ data: T } / { code, message, details })
□ No magic strings or numbers — all constants defined as const enums or as const objects
□ All dates in UTC ISO 8601 (timestamp with time zone)
□ All monetary values in cents (integer)
□ TypeScript strict mode passes (strict: true)
□ No any types — unknown + type guards only
□ All async functions have error handling (try/catch + next(error))
□ No file exceeds 500 lines
□ No React component exceeds 200 lines
□ Test coverage ≥80%
□ Branch coverage ≥75%
□ ADR created for new features (added to docs/DECISIONS.md)
□ Playwright verification passed (all 12 steps)
□ Accessibility verified (axe-core, keyboard nav, ARIA labels, focus management)
□ Performance budget met (API <200ms p95, bundle <500KB gzipped)
□ Security scan passed (SQL injection, XSS, CSRF, JWT tampering, IDOR)
□ Integration tests written (real DB, full request/response lifecycle)
□ E2E tests written (full user flow via Playwright)
□ Visual regression tests passed (screenshot comparison)
□ All commits follow conventional commit format
```

---

## 📊 PERFORMANCE BUDGET

| Metric | Budget |
|--------|--------|
| API p95 response time | <200ms |
| Frontend initial load (gzipped) | <500KB |
| Lighthouse Performance score | ≥90 |
| Lighthouse Accessibility score | ≥95 |
| Time to Interactive (TTI) | <2s |
| First Contentful Paint (FCP) | <1s |
| Largest Contentful Paint (LCP) | <2.5s |
| Cumulative Layout Shift (CLS) | <0.1 |
| API error rate | <0.1% |
| Lighthouse Best Practices score | ≥90 |
| Lighthouse SEO score | ≥90 |

> **Violation of any budget = task failure.** Performance regressions must be fixed before merge.
> Run Lighthouse CI or `lighthouse-ci` in the PR pipeline to enforce these budgets automatically.
