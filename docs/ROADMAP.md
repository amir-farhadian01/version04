# Neighborly 2.0 — Master Roadmap (Living Document)

**Version:** 3.0.0
**Last Updated:** 2026-08-11
**Historical status (2026-08-11):** MVP completion was reported. This reconciliation preserves that report, not a current release-readiness certification. Current delivery/driver work and fresh verification remain outstanding.

> ⚠️ THIS IS THE SOURCE OF TRUTH.
> Every agent, every PR, every sprint MUST read this file BEFORE writing code.

---

## 1. Product Vision

Neighborly is a **social marketplace location-aware platform** — combining social media, local discovery, and service commerce — where:

- **Public Visitors** browse local content, discover skills and services, and explore neighbourhood activity
- **Clients** (registered users) view a location-aware feed, publish posts/stories, discover services, place orders, book appointments, and interact with businesses
- **Business Clients** (upgraded Clients) manage services, staff, inventory, CRM, finance, and scheduling within a **Business Workspace** — all inside the same Client App/Web surface
- **Any business vertical** is supported: beauty, auto repair, home services, transport, food, events, etc.
- **Transport layer (V2):** Uber-like ride/delivery dispatch (motorbike → truck) — starter code complete

---

## 2. User Types

| Type | Description |
|------|-------------|
| Public Visitor | Unauthenticated user — browses public feed, search, and service catalog |
| Client | Registered user / citizen — browses feed, publishes posts/stories, places orders, books services, chats, reviews |
| Business Client | Upgraded Client — same Client surface plus a **Business Workspace** |
| Admin / Support | Internal platform staff — operations, KYC review, audit, finance, content management, analytics |

---

## 3. Platform Surfaces

```
┌──────────────────────────────────────────────────────────────┐
│  ADMIN WEB (Web Only — Internal Staff)                       │
│  KYC · Audit · Finance · Content · Analytics · Settings      │
├──────────────────────────────────────────────────────────────┤
│  CLIENT APP/WEB (Mobile + Web — All End Users)               │
│  Feed · Explore · Posts/Stories · Search · Profile           │
│  Orders · Booking · Chat · Reviews · Business Pages          │
│  Business Workspace · CRM · Invoicing · Scheduling           │
│  Transport (V2) · Ride Dispatch · Fare Engine              │
└──────────────────────────────────────────────────────────────┘
```

---

## 4. Historical Phase Matrix - reported 2026-08-11

### Phase 0 — Cleanup & Frontend Bootstrap ✅
### Phase 1 — Auth, KYC & Identity ✅
### Phase 2 — Social Feed (Public & Personal) ✅
### Phase 3 — Service Catalog & Booking Engine ✅
### Phase 4 — Order Lifecycle ✅
### Phase 5 — Matching Engine ✅
### Phase 6 — Business Workspace ✅
### Phase 7 — Chat, Contracts & Payments ✅ (Stripe approved 2026-08-11)
### Phase 8 — Admin Control Center ✅
### Phase 9 — Transport Layer (V2) ✅ (Starter code + API)

---

## 5. Technology Stack

| Layer | Technology |
|-------|-----------|
| Backend API | Node.js + TypeScript, Express |
| ORM | Prisma 5.x |
| Database | PostgreSQL |
| Web Frontend (Client) | Vite + React + TailwindCSS (port 5173) |
| Web Frontend (Admin) | Separate Vite + React SPA (port 9090) |
| Mobile + Web App | Flutter 3.x (web: 7357) |
| Auth | JWT |
| Payments | Stripe Connect (approved 2026-08-11) |
| Infra | Docker + docker-compose + Traefik |
| Cache | Redis + in-memory fallback |
| Message bus | NATS |

---

## 6. Quality Standards

- TypeScript strict mode
- Zod validation on all inputs
- Test coverage ≥80%
- Playwright UI verification on all surfaces
- SonarCloud quality gate
- Docker build success

---

## 7. Historical Verification & Sign-off - requires fresh evidence

- ✅ All backend APIs implemented and tested
- ✅ All frontend components (Client + Admin) built
- ✅ Flutter mobile app features complete
- ✅ Stripe payment gateway approved and integrated
- ✅ Transport Layer V2 starter code deployed
- ✅ All documentation updated
- ✅ Team sign-off: Software Design, Project Managers, Product Manager — approved 2026-08-11

**Historical claim only:** the prior MVP sign-off does not establish current deployment readiness or completion of subsequently authorized features.

---

# Growth Roadmap

## Current product state

The MVP is treated as complete for purposes of this growth architecture. Product changes remain outside the scope of GTM agents unless separately approved through engineering governance.

## Current priority: evidence-led micro-market liquidity

1. Establish product facts and instrumentation coverage.
2. Research geography × category candidates without assuming a winner.
3. Select one micro-market through a documented, weighted decision and Red Team review.
4. Build verified, qualified supply before scaling demand.
5. Measure matches, completed transactions, repeat behavior, trust indicators, and contribution margin.
6. Improve the active market until its founder-approved liquidity thresholds are sustained.
7. Evaluate an adjacent geography or category only after metric gates pass—not after a fixed time period.

## Status

**STATUS: RESEARCH REQUIRED** — no starting geography, category, threshold values, or expansion candidate has been selected in this repository.
