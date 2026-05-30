# Neighborly 2.0 — Master Roadmap (Living Document)

**Version:** 2.1.0  
**Last Updated:** 2026-05-27  
**Status Legend:** ✅ Done · 🚧 In Progress · ⏳ Planned · ❌ Blocked  

> ⚠️ THIS IS THE SOURCE OF TRUTH.
> Every agent, every PR, every sprint MUST read this file BEFORE writing code.
> Run `npm run docs:check` first to detect drift.

---

## 1. Product Vision

Neighborly is a **social marketplace location-aware platform** — combining social media, local discovery, and service commerce — where:

- **Public Visitors** browse local content, discover skills and services, and explore neighbourhood activity
- **Clients** (registered users) view a location-aware feed, publish posts/stories, discover services, place orders, book appointments, and interact with businesses
- **Business Clients** (upgraded Clients) manage services, staff, inventory, CRM, finance, and scheduling within a **Business Workspace** — all inside the same Client App/Web surface
- **Any business vertical** is supported: beauty, auto repair, home services, transport, food, events, etc.
- **Transport layer (V2):** Uber-like ride/delivery dispatch (motorbike → truck)

The platform is **neighbourhood-aware** and **interest-filtered**: each user sees content and services tailored to their location and preferences.

All users undergo **KYC verification** by admin before activation. Business Clients additionally undergo business-level KYC (license, insurance, registration).

---

## 2. User Types

| Type | Description |
|------|-------------|
| Public Visitor | Unauthenticated user — browses public feed, search, and service catalog |
| Client | Registered user / citizen — browses feed, publishes posts/stories, places orders, books services, chats, reviews |
| Business Client | Upgraded Client — same Client surface plus a **Business Workspace** for managing services, staff, CRM, inventory, finance, and scheduling |
| Admin / Support | Internal platform staff — operations, KYC review, audit, finance, content management, analytics |

> **Note:** "Provider", "Staff", "Employee", "Solo Provider", "Business Owner" are **internal operational roles** within a Business Workspace, NOT independent user types in product documentation. The Prisma schema may still contain legacy role enums (`provider`, `staff`, `customer`, etc.) as implementation details — these do not change the product-level user model described above.

---

## 3. Platform Surfaces

```
┌──────────────────────────────────────────────────────────────┐
│  ADMIN WEB (Web Only — Internal Staff)                       │
│  KYC · Audit · Finance · Content · Analytics · Settings      │
├──────────────────────────────────────────────────────────────┤
│  CLIENT APP/WEB (Mobile + Web — All End Users)               │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  Regular Client Features                             │    │
│  │  Feed · Explore · Posts/Stories · Search · Profile   │    │
│  │  Orders · Booking · Chat · Reviews · Business Pages  │    │
│  ├──────────────────────────────────────────────────────┤    │
│  │  Business Workspace (subset — upgraded Clients only) │    │
│  │  Services · Staff · CRM · Finance · Inventory        │    │
│  │  Scheduling · Quotes · Invoices · Campaigns          │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

**Key points:**
- **Admin Web** is web-only, accessible only by internal staff (admin, support, finance roles)
- **Client App/Web** is the main end-user environment, available on both mobile app and web browser
- **Business Workspace** is a capability subset within Client App/Web, NOT a separate product or surface — it is the upgraded Client's environment for managing business operations

---

## 4. Phase Matrix

### Phase 0 — Cleanup & Frontend Bootstrap

**Goal:** Remove stale files, introduce new React frontend shell alongside existing backend.

| Track | Status | Notes |
|-------|--------|-------|
| Delete `repoversion2/`, `temp_version2/`, `scratch/` | ✅ | Done — Phase 0 cleanup |
| Delete root-level screenshot PNGs | ✅ | Done — Phase 0 cleanup |
| Delete `sync-from-version2.sh`, `.backend.pid`, `.flutter.pid` | ✅ | Done — Phase 0 cleanup |
| Archive old `docs/` and replace with this set | ✅ | Done |
| Scaffold new React frontend in `/frontend/` | ✅ | Done — Vite + React + TailwindCSS + shadcn/ui |
| CI/CD pipeline baseline (GitHub Actions) | ✅ | Lint + Test + Build gate |
| SonarCloud integration | ✅ | Quality gate: coverage ≥70%, 0 blockers |
| Docker Compose unified (backend + frontend + db) | ✅ | Done — single `docker-compose up` |

---

### Phase 1 — Auth, KYC & Identity

**Goal:** Every user is verified before accessing platform features.

| Track | Client | Business Client | Admin | Status |
|-------|--------|-----------------|-------|--------|
| JWT Auth (register/login/refresh/logout) | ✅ | ✅ | ✅ | ✅ Done |
| KYC Level 0 (email + phone verify) | ✅ | ✅ | ✅ | ✅ Done |
| KYC Level 1 (government ID upload) | ✅ | ✅ | ✅ | ✅ Done |
| KYC Level 2 (business registration docs) | ⏳ | ✅ | ✅ | 🚧 In Progress |
| Admin KYC review queue | — | — | ✅ | ✅ Done |
| Profile photo enforcement for service staff | ⏳ | ⏳ | — | ⏳ Planned |
| Multi-workspace support (person in multiple businesses) | ⏳ | ⏳ | — | ⏳ Planned |

> **Security requirement:** Any person who visits a client's location (or receives a client) to perform a service MUST have a verified profile photo visible to the client for identity confirmation.

---

### Phase 2 — Social Feed (Public & Personal)

**Goal:** Instagram-like feed with algorithmic content delivery based on location + interests.

| Feature | Status | Notes |
|---------|--------|-------|
| Public video/photo posts | ⏳ | Both personal and business accounts |
| Personal feed (interest + location filtering) | ⏳ | Gender/interest personalization |
| Business content sharing (promotional videos) | ⏳ | Links to bookable services |
| Public utility links (banks, insurance, fuel prices) | ⏳ | Admin-curated, commission-tracked referrals |
| Follow / Unfollow | ⏳ | |
| Reactions + Comments | ⏳ | |
| Stories (24h ephemeral) | ⏳ | |
| Content moderation queue (admin) | ⏳ | Integrated with video audit DB already in place |
| Video transcoding pipeline | ⏳ | Mux or equivalent, metadata in DB |
| Media analytics (views, engagement) | ⏳ | Admin dashboard charts |
| **Order CTA on business posts** (direct booking from social) | ⏳ | Business Client posts can include an Order button linked to a service |
| **Local news, weather, traffic, police alerts in Home** | ⏳ | Admin-managed content feeds; API integration for weather/alerts |
| **Home Intelligence / Local Insights** (aggregate market data) | ⏳ | Anonymized aggregate data: service demand, pricing heatmaps, neighbourhood comparisons |
| **Explore profile tap → Business Page** (for business accounts) | ⏳ | Tapping business name/avatar navigates to full Business Page |

---

### Phase 3 — Service Catalog & Booking Engine

**Goal:** Any business type can configure services with flexible booking modes.

| Feature | Status | Notes |
|---------|--------|-------|
| Hierarchical category tree (≤5 levels) | ✅ | Admin manages |
| Service definition with dynamic field schema | ✅ | Powers booking wizard |
| Booking mode: **Fixed price** (direct appointment) | ✅ | Like Groupon |
| Booking mode: **Negotiable** (price + date + details) | ✅ | Like TaskRabbit/Jiffy |
| Booking mode: **Inventory-based** (custom package) | ✅ | Client selects parts/products |
| Booking mode: **Hybrid** (negotiable date + fixed inventory) | ⏳ | |
| Auto-appointment (no negotiation) | ✅ | Business configures per service |
| Provider sets booking mode per service | ✅ | `lockedBookingMode` in schema |
| Package builder with BOM (Bill of Materials) | ✅ | |
| Inventory management (products/parts) | ✅ | |

---

### Phase 4 — Order Lifecycle

**Goal:** Full order journey from creation to review.

| Stage | Status |
|-------|--------|
| Order wizard (3 entry points) | ✅ |
| Draft / autosave | ✅ |
| Dynamic fields per service | ✅ |
| Photo attachments | ✅ |
| Submit + matching trigger | ✅ |
| Provider notification | ✅ |
| Negotiation chat | ✅ |
| Contract generation (AI-assisted) | ✅ |
| Contract versioning + approval | ✅ |
| Payment gate (contract must be approved) | ✅ |
| Order completion + review | ✅ |
| Dispute filing | ✅ |
| Admin order management | ✅ |

---

### Phase 5 — Matching Engine

| Feature | Status |
|---------|--------|
| Auto-book matching | ✅ |
| Round-robin (5 providers) | ✅ |
| Provider eligibility checks | ✅ |
| Lazy expiry + re-match | ✅ |
| Admin override | ✅ |
| Lost-deal capture | ✅ |

---

### Phase 6 — Business Workspace (Client Surface Subset)

**Goal:** Full business management suite inside the Client App/Web surface, available only to Business Clients.

| Feature | Status | Notes |
|---------|--------|-------|
| Workspace (company) creation | ✅ | |
| Multi-employee management | ✅ | Staff tab |
| Client (customer) management | ⏳ | CRM-lite for businesses |
| Invoice generation + sending | ⏳ | PDF invoices |
| Schedule/Calendar view | ✅ | Provider pipeline orders |
| Finance tab (earnings snapshot) | ✅ | Read-only, no gateway yet |
| Service packages management | ✅ | |
| Inventory management | ✅ | |
| Business KYC (corporate + sole trader) | ✅ | |
| Multiple businesses per person | ⏳ | UI for workspace switching |
| **Business Page (public-facing) with trust layer** | ⏳ | License, insurance, work experience from KYC; critical fields read-only |
| **Staff identity display** (photo + name per service) | ⏳ | Required before in-person service; customer must know who will perform the work |
| **Service-to-staff assignment** | ⏳ | Each service assignable to one or more specific staff members |
| **Parallel scheduling** (multiple staff, same service, same time) | ⏳ | System calculates available slots based on staff count, service duration, and break times |
| **CRM** (customer management, history, notes) | ⏳ | Free built-in CRM for all Business Clients |
| **Quote generation and sending** | ⏳ | Pre-order quote before contract |
| **Email marketing / campaign management** | ⏳ | In-platform email campaigns to customers |
| **Pipeline revenue view** | ⏳ | Revenue from active orders vs completed vs pending |
| **Internal workspace roles** (HR, accountant, social manager, worker) | ⏳ | Role-based access within the workspace |
| **Platform circumvention prevention** (PII block before contract) | ⏳ | Phone/email/address blocked or masked until authorized workflow stage |

---

### Phase 7 — Chat, Contracts & Payments

| Feature | Status |
|---------|--------|
| Order-scoped chat | ✅ |
| PII guard + moderation | ✅ |
| AI translation layer | ✅ |
| Contract drafting (AI from chat) | ✅ |
| Contract templates | ✅ |
| Payment session (post-contract) | ✅ |
| Payment gateway integration (Stripe/etc.) | ✅ |
| Payout to providers | ✅ |
| Admin payment ledger | ✅ |

---

### Phase 8 — Admin Control Center

| Feature | Status |
|---------|--------|
| User CRM (segments, filters, detail) | ✅ |
| KYC review queue | ✅ |
| Form builder (per business type) | ✅ |
| Order management | ✅ |
| Contract review queue | ✅ |
| Chat moderation | ✅ |
| Payments ledger | ✅ |
| Media audit (video/photo stats) | ⏳ |
| Analytics dashboard | ✅ |
| Public utility link management | ⏳ |
| Commission tracking (referral links) | ⏳ |
| SonarQube report view | ⏳ |
| **Home Content Management** (news, media, external API integration) | ⏳ | Admin publishes news, manages weather/alert API connections, controls display priority |
| **Local Insights configuration** | ⏳ | Configure which aggregate data is shown to users; privacy boundaries |

---

### Phase 9 — Transport Layer (V2)

**Goal:** Uber-like dispatch for motorbikes, cars, vans, trucks.

| Feature | Status |
|---------|--------|
| Vehicle type catalog (moto → truck) | ⏳ |
| Real-time driver location tracking | ⏳ |
| Ride/delivery request flow | ⏳ |
| Driver acceptance + dispatch | ⏳ |
| Route + ETA display | ⏳ |
| Fare calculation engine | ⏳ |
| Driver rating + history | ⏳ |
| Fleet management for businesses | ⏳ |

---

## 5. Database Schema Strategy

The Prisma schema already has solid foundations. Key models to extend:

```
User → UserRole[] (multi-role)
Business → employees[] + clients[] + invoices[]
Post → media[] + location + interests[]
Service → BookingMode + inventory + dynamicFields
Order → lifecycle → Contract → Payment
JobRecord → transport extension (V2)
AuditLog → all admin actions
AnalyticsEvent → media, referral, feed
```

**Extensibility rules:**
- Never delete columns — use `archivedAt` soft-delete
- All monetary values stored as integers (cents)
- All timestamps UTC
- Media metadata stored in DB, files in object storage (S3/compatible)
- Analytics events are append-only (no updates)

> **Note on User Roles vs Product Types:** The Prisma schema contains role enums (`customer`, `provider`, `staff`, `platform_admin`, `support`, `finance`) that are implementation details of the backend. In product documentation, these are not exposed as independent user types. The product recognizes only: Public Visitor, Client, Business Client, and Admin/Support. The `provider`, `staff`, `employee` roles are internal operational roles within a Business Workspace.

---

## 6. CI/CD Standards

```
GitHub Actions Workflow:
  on: [push, pull_request]
  
  jobs:
    lint:      eslint + prettier check
    typecheck: tsc --noEmit
    test:      jest (backend) + vitest (frontend) — coverage ≥70%
    sonar:     SonarCloud analysis — 0 blockers/criticals
    build:     docker build (must succeed)
    deploy:    only on main branch + all gates passed
```

**Branch strategy:**
- `main` — production-ready, protected
- `dev` — integration branch
- `feature/*` — feature branches (PR into dev)
- `hotfix/*` — emergency fixes (PR into main)

---

## 7. Quality Standards

Every PR must pass:
1. ESLint (0 errors, 0 warnings)
2. TypeScript strict mode (0 errors)
3. Unit tests (new code ≥70% coverage)
4. SonarCloud quality gate
5. Docker build success
6. One peer review approval

### 7.1 UI Verification Protocol

All UI changes **MUST** be verified with Playwright screenshot tests against the **real frontend URL** — NOT by calling APIs directly.

**Mandatory checklist (from [TESTING.md §7](docs/TESTING.md#7-playwright-verification)):**

1. Open the real browser URL (e.g. `http://localhost:9090/auth/login`)
2. Wait for the page to fully load
3. Take a full-page screenshot → save to `screenshots/`
4. Verify all expected elements are visible in the screenshot
5. Interact with the UI (click buttons, fill forms)
6. Take a post-interaction screenshot
7. Assert expected outcomes (redirect, toast, state change)
8. Test error states (invalid login, missing fields)
9. Test mobile viewport (375×812)
10. Take mobile screenshot
11. Verify no console errors
12. Save all screenshots with descriptive filenames

**Completion report template** (paste into PR description):

```
## UI Verification
- [ ] Page loads at `http://localhost:<PORT>/<PATH>`
- [ ] Screenshot: `screenshots/<feature>-01-initial.png`
- [ ] Screenshot: `screenshots/<feature>-02-interaction.png`
- [ ] Screenshot: `screenshots/<feature>-03-error-state.png`
- [ ] Screenshot: `screenshots/<feature>-04-mobile.png`
- [ ] No console errors
```

> ⚠️ **Rule:** Any PR that modifies UI components MUST include Playwright screenshots. PRs without screenshots will be rejected.

---

## 8. Architecture Overview

```
/
├── server.ts         ← Backend entry point (Express + TypeScript)
├── routes/           ← API route handlers
├── lib/              ← Business logic, cache, utilities
├── frontend/         ← React frontend (Vite + Tailwind)
│   ├── src/
│   │   ├── pages/    ← Route-level pages
│   │   ├── components/
│   │   │   ├── admin/
│   │   │   ├── business/
│   │   │   ├── customer/
│   │   │   └── social/
│   │   ├── services/ ← API client layer
│   │   └── store/    ← Zustand state
├── flutter_project/  ← Mobile app (Flutter)
├── prisma/           ← Database schema
├── docker/           ← Service configs
└── docs/             ← This documentation set
```

### Port Assignments
> ⚠️ Port 8080 is permanently reserved for `npm run dev` (local backend).
> Never bind any Docker service to host port 8080.

| Port  | Service               | Mode        |
|-------|-----------------------|-------------|
| 8080  | Backend API (local)   | Local only  |
| 80    | Traefik ingress       | Docker only |
| 9191  | Traefik dashboard     | Docker only |
| 5173  | Vite frontend         | Both        |
| 7357  | Flutter Web           | Local only  |
| 9090  | Admin Panel           | Both        |
| 5432  | PostgreSQL main       | Both        |
| 5433  | PostgreSQL media      | Both        |
| 8899  | Dozzle                | Docker only |
| 9002  | MinIO API             | Docker only |
| 9000  | Portainer             | Docker only |
| 3001  | Metabase              | Docker only |
| 6379  | Redis                 | Docker only |

> **Infrastructure Note:** The system uses **Redis** for caching ([`lib/redis.ts`](lib/redis.ts)) and GEO-based location proximity ([`lib/locationCache.ts`](lib/locationCache.ts)). Redis runs as a Docker container in production and can be started locally via `docker-compose up redis`. When Redis is unavailable, the system gracefully falls back to in-memory caching ([`lib/cache.ts`](lib/cache.ts)).

---

## 9. V2 Preview — Transport Services

Coming after core platform stability:

- Ride-hailing (motorcycle, car, van, truck)
- Package delivery
- Scheduled logistics for businesses
- Driver KYC (vehicle + license verification)
- Real-time GPS tracking
- Fare rules engine per vehicle class

This will be built as a first-class service type within the existing catalog/booking framework, not a separate codebase.
