# AGENTS.md — Neighborly Marketplace · Project Intelligence File
# Last updated: 2026-05-29
# Source of truth for ALL AI agents working on this repo.
# READ THIS ENTIRE FILE BEFORE TOUCHING ANYTHING.

> **📖 The canonical, full-length AGENTS.md lives at [`docs/AGENTS.md`](docs/AGENTS.md).**
> This root-level file is a **thin wrapper** containing only essential quick-reference info.
> For complete rules, agent modes, testing standards, Playwright verification, and code review checklists, **always read [`docs/AGENTS.md`](docs/AGENTS.md)**.

---

## 🧭 WHO IS IN CHARGE

**Project Architect & PM:** Amir Farhadian (owner)
**AI Strategy Director:** Perplexity (Space: "app") — receives all high-level decisions,
  breaks them into implementation prompts, and hands them to coding agents.
**Coding Agents:** Roo Code + DeepSeek V4 — execute prompts exactly as written.

---

## 📌 PROJECT OVERVIEW

**Name:** Neighborly
**Type:** Local services marketplace (Uber for home services)
**Repo:** github.com/amir-farhadian01/app

### Stack
| Layer | Technology |
|---|---|
| Backend API | Node.js + TypeScript, Express, `server.ts` at root |
| ORM | Prisma **5.x** (DO NOT upgrade) |
| Database | PostgreSQL |
| Web Frontend (Client) | `frontend/` — Vite + React (port 5173) |
| Web Frontend (Admin) | `frontend/admin/` — Separate Vite + React SPA (port 9090) |
| Mobile + Web App | `flutter_project/` — Flutter 3.x |
| Auth | JWT (`JWT_SECRET` in `.env`) |
| Payments | Stripe (config in `.env`, backup solution for future) |
| Infra | Docker + docker-compose + Traefik |

### Ports
> ⚠️ See **PORTS.md** for the complete port registry.
> Below are the ports used in LOCAL DEV (no Docker).

| Service | Local Dev Port | Docker Host Port | Notes |
|---|---|---|---|
| Backend API | **8080** | 3000 | `PORT` env var, default 8080 |
| Admin API + Admin SPA | **9090** | 9090 | `ADMIN_PORT` env var; serves built admin SPA from `frontend/admin/dist/` |
| Vite React Client Frontend | **5173** | 5173 | `cd frontend && npm run dev` |
| Vite Admin Dev Server | **9091** | — | `cd frontend && npm run dev:admin` (optional, proxies API to localhost:9090) |
| Flutter Web | **7357** | via Traefik | `flutter run -d web-server --web-port 7357` |
| Flutter Mobile | emulator/device | — | `flutter run -d <device-id>` |

> ❌ NEVER use port 3000 as the backend in local dev — that was legacy. Backend runs on **8080** locally.

---

## ✅ COMPLETED FEATURES

- **F5** — (done)
- **F6** — (done)
- **F7** — (done)
- **F8-admin** — (done)
- **Admin Dashboard API Fixes** — (done 2026-05-23)
  - [`AdminDashboard.tsx`](frontend/src/pages/admin/AdminDashboard.tsx): Fixed stats type to match backend `AdminOverviewStats`, changed activity endpoint from `/admin/activity` to `/admin/audit-log`
  - [`AdminUsers.tsx`](frontend/src/pages/admin/AdminUsers.tsx): Fixed response destructure from `data` to `items`, updated type to match `AdminUserRow`
  - [`AdminKyc.tsx`](frontend/src/pages/admin/AdminKyc.tsx): Rewrote to use new KYC endpoints (`/admin/kyc/personal`, `/admin/kyc/business`, `/admin/kyc/level0`) with tab-based UI
  - [`AdminOrders.tsx`](frontend/src/pages/admin/AdminOrders.tsx): Fixed response destructure from `data` to `items`, updated type to match `AdminOrderListItem`
  - [`AdminContracts.tsx`](frontend/src/pages/admin/AdminContracts.tsx): Changed endpoint from `/admin/contracts` to `/admin/contracts/queue`, fixed response structure
  - [`AdminPayments.tsx`](frontend/src/pages/admin/AdminPayments.tsx): Fixed `STATUS_COLORS` to use actual backend statuses (`PENDING`, `CAPTURED`, `REFUNDED`, `FAILED`)
- **Admin Login: Remove Phone OTP, Keep Email+Password Only** — (done 2026-05-23)
  - [`routes/auth.ts`](routes/auth.ts): Removed `POST /auth/send-otp` and `POST /auth/verify-otp` endpoints, removed in-memory `otpStore`
  - [`Login.tsx`](frontend/src/pages/auth/Login.tsx): Removed 4-step phone OTP flow (phone → otp → username → /app/home), kept only email+password form redirecting to `/admin`
  - [`server.ts`](server.ts): Fixed root route `/` — moved from `createWebApp()` to only `mainApp`, so `adminApp` (port 9090) serves the React frontend SPA instead of the API status page
  - **Playwright UI Verification** on `http://localhost:9090/auth/login`: All 5 steps passed ✅ (page load, element verification, invalid login, valid login, mobile viewport)
  - Screenshots saved to `screenshots/9090-01-initial.png`, `9090-02-invalid-login.png`, `9090-03-valid-login.png`, `9090-04-mobile.png`
- **Admin SPA Separation** — (done 2026-05-25)
  - Created separate Vite build at [`frontend/admin/`](frontend/admin/) for the admin panel
  - Admin SPA has its own router, auth store (uses `neighborly-admin-auth` localStorage key), and API client
  - [`server.ts`](server.ts): Added `mountAdminApiRoutes()` function — adminApp (port 9090) only exposes admin-prefixed API routes
  - [`server.ts`](server.ts): Dev mode serves admin SPA from `frontend/admin/dist/` on port 9090
  - [`server.ts`](server.ts): Prod mode serves admin SPA from `frontend/admin/dist/` on adminApp, client SPA from `frontend/dist/` on mainApp
  - [`frontend/src/app/router.tsx`](frontend/src/app/router.tsx): Removed admin routes (Dashboard, Users, UserDetail, KYC, Orders, Contracts, Payments, Media, Settings) — they now live in the admin SPA
  - [`frontend/package.json`](frontend/package.json): Added `build:admin`, `dev:admin`, `preview:admin` scripts
  - Both SPAs build successfully ✅

---

## 🚧 CURRENT PHASE

**Phase: Admin SPA Separation (Complete)**
- Separate Vite build for admin panel at `frontend/admin/` ✅
- Admin-only API routes on port 9090 via `mountAdminApiRoutes()` ✅
- Admin routes removed from client SPA router ✅
- Build scripts added to `frontend/package.json` ✅
- Both SPAs build successfully ✅
- AGENTS.md updated ✅

**Next Phase: New Flutter UI Design**
- Backend + Web Frontend + Flutter Web running locally ✅
- Port registry documented in PORTS.md ✅
- Next: New UI design on Flutter → connect to backend

---

## 🚫 ABSOLUTE RULES (SUMMARY)

See [`docs/AGENTS.md`](docs/AGENTS.md) for the full 25-rule list with detailed explanations.

1. **NEVER touch `lib/matching/`** — matching algorithm is sacred, hands off
2. **NEVER touch chat-related files** — chat logic is complete, do not modify
3. **NEVER touch `src/` directory**
4. **Prisma stays at 5.x** — no upgrades, no downgrades
5. **All TS/JS imports must use `.js` extension** — e.g. `import './foo.js'`
6. **NO payment gateway SDK installed** — The `Payment` model schema has Stripe-compatible 
   fields (`stripePaymentIntentId`, `stripeTransferId`) for future integration, but NO 
   Stripe SDK (`stripe` npm package) or other payment gateway library is currently 
   installed. All payments flow through internal `Transaction` records. Do NOT add 
   any payment gateway SDK without an approved ADR and architect sign-off.
7. **Use `npm` only** — no yarn, no pnpm
8. **READ before WRITE** — read every file fully before editing it
9. **No new business logic** unless explicitly instructed by the architect
10. **Each service runs in its OWN process** — never combine backend + frontend in one command
11. **After completing changes: `git add -A && git commit -m "..." && git push`** — always push, never leave local-only
12. **UI Verification**: All UI changes require Playwright verification with screenshots before completion — see [`docs/AGENTS.md`](docs/AGENTS.md) for the full UI Verification Protocol. **Tests must be done by opening the real browser URL, not by calling APIs directly.**
13. **Admin SPA is at `frontend/admin/`** — do NOT modify admin pages in `frontend/src/pages/admin/` (those are deprecated). Admin pages live in `frontend/admin/src/pages/`.
14. **Admin auth uses `neighborly-admin-auth` localStorage key** — separate from client auth (`neighborly-auth`). Do NOT share auth stores between SPAs.
15. **Admin API routes are mounted via `mountAdminApiRoutes()`** — only on `adminApp` (port 9090). The `mainApp` (port 8080) does NOT expose admin API routes.

---

## 📁 DIRECTORY MAP

```
/
├── server.ts              ← Express backend entry point (port 8080 local / 3000 docker)
├── routes/                ← API route handlers
├── lib/                   ← Shared utilities
│   └── matching/          ← 🚫 DO NOT TOUCH
├── prisma/                ← Prisma schema + migrations
├── frontend/              ← Vite + React client SPA (port 5173)
│   ├── admin/             ← Separate Vite + React admin SPA (port 9090)
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── main.tsx
│   │       ├── App.tsx
│   │       ├── router.tsx        ← Admin-only routes (login + admin pages)
│   │       ├── index.css
│   │       ├── lib/
│   │       │   ├── api.ts        ← Axios instance (reads token from neighborly-admin-auth)
│   │       │   └── cn.ts         ← cn() utility
│   │       ├── store/
│   │       │   └── authStore.ts  ← Zustand store (neighborly-admin-auth key)
│   │       ├── components/
│   │       │   ├── AdminLayout.tsx
│   │       │   └── AccountAvatarBadge.tsx
│   │       └── pages/
│   │           ├── Login.tsx
│   │           ├── Dashboard.tsx
│   │           ├── Users.tsx
│   │           ├── UserDetail.tsx
│   │           ├── Kyc.tsx
│   │           ├── Orders.tsx
│   │           ├── Contracts.tsx
│   │           ├── Payments.tsx
│   │           ├── Media.tsx
│   │           └── Settings.tsx
│   └── src/               ← Client SPA source (no admin pages)
├── flutter_project/       ← Flutter app (web: 7357, mobile: device)
├── docs/                  ← All documentation & roadmaps
├── plans/                 ← Legacy planning docs (read-only reference)
├── infra/                 ← Infrastructure configs
├── scripts/               ← Utility scripts
├── docker-compose.yml     ← Full stack docker config
├── .env.example           ← Copy to .env and fill in secrets
├── PORTS.md               ← ✅ Complete port registry (READ THIS for ports)
├── AGENTS.md              ← THIS FILE (thin wrapper — see docs/AGENTS.md for canonical)
└── CLAUDE.md              ← Claude-specific instructions
```

---

## 🔑 ENV SETUP (local dev)

Copy `.env.example` → `.env` and set:
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/neighborly"
JWT_SECRET="dev-secret-local"
NODE_ENV="development"
PORT=8080
ADMIN_PORT=9090
```

---

## 🔄 HOW TO START EVERYTHING LOCALLY

```bash
# Terminal 1 — Backend
npm install && npx tsx server.ts
# → http://localhost:8080  (API)
# → http://localhost:9090  (Admin API + Admin SPA)

# Terminal 2 — Web Frontend (Client SPA)
cd frontend && npm install && npm run dev -- --port 5173
# → http://localhost:5173

# Terminal 3 — Flutter Web
cd flutter_project && flutter pub get && flutter run -d web-server --web-port 7357
# → http://localhost:7357

# Terminal 4 — Flutter Mobile (if device available)
cd flutter_project && flutter run -d <device-id>
```

### Building Admin SPA
```bash
cd frontend && npm run build:admin
# Output: frontend/admin/dist/
# The backend serves this automatically on port 9090 in dev mode
```

### Building Client SPA
```bash
cd frontend && npm run build
# Output: frontend/dist/
```

Verify:
- http://localhost:8080/api/health → JSON response
- http://localhost:5173 → 200 OK (client SPA)
- http://localhost:9090 → 200 OK (admin SPA — redirects to /login)
- http://localhost:7357 → 200 OK (Flutter web)

---

## 📋 PROMPT WORKFLOW

All implementation prompts follow this structure:
1. `SYSTEM/ROLE` — agent identity
2. `PROJECT CONTEXT` — what we're building
3. `EXECUTION RULES` — the absolute rules above
4. `TASK` — numbered steps, execute in order
5. `FINAL VERIFICATION` — tests to confirm success

Agents must complete ALL steps, run ALL verification checks, and **push to git** before reporting done.
