# Project Health Audit — 2026-05-29

**Status:** ✅ Analysis Complete | **Audited by:** AI Agent  
**Purpose:** Identify unused artifacts, missing implementations, and cleanup opportunities.

---

## 🔥 ISSUE 1: Firebase Files — Why Do We Have Them?

### Files Found

| File | Lines | Purpose |
|------|-------|---------|
| `firebase-applet-config.json` | 10 | Firebase project configuration (projectId, apiKey, authDomain, firestoreDatabaseId, storageBucket) |
| `firebase-blueprint.json` | 419 | Complete Firestore database schema blueprint — 20 entities with full property definitions |
| `firestore.rules` | 251 | Firestore security rules for all 20 collections |

### Key Discovery: `firebase-blueprint.json`

This file is a **complete early-design blueprint** of the entire data model, defining 20 Firestore collections:

```
User, Company, ServiceCatalog, Contract, AuditLog, Transaction,
Schedule, B2BConnection, Post, Comment, Notification, ProviderService,
Request, KYC, Ticket, Service, ServiceRequest, ChatRoom, ChatMessage,
LegalPolicy, Page, SystemConfig
```

This blueprint maps to Firestore document paths like:
- `/users/{userId}` → User schema
- `/companies/{companyId}` → Company schema
- `/contracts/{contractId}` → Contract schema
- `/kyc/{kycId}` → KYC schema
- etc.

### Are We Using Firebase?

**NO.** The project uses **PostgreSQL + Prisma** as the primary database. Evidence:

1. **Prisma schema** (`prisma/schema.prisma`) is the actual data model
2. **All API routes** use Prisma Client (`lib/db.ts`) — not Firestore SDK
3. **No Firestore imports** exist in any route or library file
4. **CI/CD workflow** (`release-to-neighborly.yml`) explicitly **deletes** these 3 files before release:
   ```yaml
   rm -f /tmp/neighborly/firebase-applet-config.json
   rm -f /tmp/neighborly/firebase-blueprint.json
   rm -f /tmp/neighborly/firestore.rules
   ```

### Where Firebase Is Still Referenced

| Location | Reference | Severity |
|----------|-----------|----------|
| `server.ts` line ~CSP | `connect-src: https://firestore.googleapis.com` | ⚠️ CSP header allows Firestore |
| `AGENTS.md` Stack table | "Realtime: Firebase (config in firebase-applet-config.json)" | 📝 Documentation stale |
| `docs/ARCHITECTURE.md` | Firebase as system component | 📝 Documentation stale |
| `docs/SECURITY.md` | Firebase DPA requirement | 📝 Documentation stale |
| `docs/DEPLOYMENT.md` | Firebase configuration section | 📝 Documentation stale |
| `plans/doc-fix-plan.md` | Firebase in architecture diagram | 📝 Plan reference |
| `node_modules/@firebase/` | Firebase Admin SDK installed | 🔴 Unused dependency |

### Verdict

These 3 files are **legacy artifacts from the initial design phase** when Firestore was considered as the database. The project pivoted to PostgreSQL + Prisma, but the Firebase config files and SDK were never cleaned up.

**Recommendation:**
- ✅ Remove `firebase-applet-config.json`, `firebase-blueprint.json`, `firestore.rules`
- ✅ Remove `@firebase` packages from `package.json` (Firebase Admin SDK)
- ✅ Remove `connect-src: firestore.googleapis.com` from CSP in `server.ts`
- ✅ Update documentation files that still reference Firebase
- ⚠️ **Do NOT delete** if Firebase push notifications are planned for Phase 4 (see ROADMAP — realtime features are ⏳ Planned)

---

## 📦 ISSUE 2: Project Size — 1.2 GB

### Size Breakdown

| Directory/File | Size | % of Total | Notes |
|----------------|------|------------|-------|
| `node_modules/` (root) | 711 MB | 59% | Backend dependencies (Express, Prisma, Stripe, etc.) |
| `frontend/node_modules/` | 253 MB | 21% | React/Vite dependencies |
| `flutter_project/` | 209 MB | 17% | Flutter SDK + packages + build artifacts |
| `.git/` | 24 MB | 2% | Git history |
| `frontend/` (source only) | 17 MB | 1.4% | React source code |
| `dist/` | 2.5 MB | 0.2% | Build output |
| Everything else | ~20 MB | 1.7% | Routes, lib, docs, prisma, etc. |

### What's Normal

| Item | Size | Normal? |
|------|------|---------|
| `node_modules/` (964 MB total) | 964 MB | ✅ Normal for full-stack Node.js + React project |
| `flutter_project/` | 209 MB | ✅ Normal for Flutter project with SDK |
| `.git/` | 24 MB | ✅ Normal for active project |

### What Can Be Optimized

| Item | Size | Action |
|------|------|--------|
| `dist/` | 2.5 MB | 🟡 Delete — rebuild when needed |
| `screenshots/` | 256 KB | 🟡 Clean up old test screenshots |
| `logs/` | 24 KB | 🟡 Clean up log files |
| `src/` directory | 24 KB | 🟡 Verify it's legacy (Rule #3 says never touch) |
| `node_modules/@firebase/` | unknown | 🟢 Remove if Firebase is dropped |
| `flutter_project/build/` | unknown | 🟡 Clean build cache (`flutter clean`) |

### Why Is 1.2 GB Not a Problem?

- **964 MB of it is `node_modules`** — these are NOT committed to Git (in `.gitignore`)
- **209 MB is Flutter** — SDK and packages, mostly in `.gitignore`
- **Actual committed source code** is ~40 MB
- The working directory size is inflated by development dependencies that every developer installs locally via `npm install`

### Cleanup Opportunities

```bash
# Remove build artifacts
rm -rf dist/

# Clean Flutter build cache  
cd flutter_project && flutter clean

# Remove old screenshots
rm -rf screenshots/*.png

# Remove logs
rm -rf logs/*.log

# Reinstall node_modules (deduplicate)
rm -rf node_modules frontend/node_modules
npm install && cd frontend && npm install
```

---

## 📋 ISSUE 3: Unimplemented Prompts & Features

### Pending Prompts (from `docs/permanent/PROMPTS-LIST.md`)

| ID | Prompt | Status | Phase |
|----|--------|--------|-------|
| P3.1 | E2E Playwright Tests | ❌ pending | P3 — Testing & Polish |

All other prompts (P0.1 through P4.4, 13 total) are marked ✅ done.

### ROADMAP Features Not Yet Implemented

From `docs/ROADMAP.md`, these are the features with status ⏳ Planned that are NOT covered by the P0-P4 prompts:

#### Phase 1 — Auth & KYC
- KYC Level 2 for Client users (business registration docs)
- Profile photo enforcement for service staff
- Multi-workspace support

#### Phase 2 — Social Feed (ENTIRE PHASE is ⏳ Planned)
- Public video/photo posts
- Personal feed (interest + location filtering)
- Business content sharing
- Public utility links
- Follow/Unfollow
- Reactions + Comments
- Stories (24h ephemeral)
- Content moderation queue
- Video transcoding pipeline
- Media analytics
- Order CTA on business posts
- Local news, weather, traffic, police alerts
- Home Intelligence / Local Insights
- Explore profile tap → Business Page

#### Phase 3 — Service Catalog
- Hybrid booking mode (negotiable date + fixed inventory)

#### Phase 6 — Business Workspace
- CRM-lite (customer management, history, notes)
- Invoice generation (PDF)
- Quote generation and sending
- Multiple businesses per person
- Business Page (public-facing with trust layer)
- Staff identity display
- Service-to-staff assignment
- Parallel scheduling
- Email marketing / campaign management
- Pipeline revenue view
- Internal workspace roles (HR, accountant, social manager, worker)
- Platform circumvention prevention

#### Phase 8 — Admin Control Center
- Media audit (video/photo stats)
- Public utility link management
- Commission tracking (referral links)
- SonarQube report view
- Home Content Management
- Local Insights configuration

#### Phase 9 — Transport Layer (ENTIRE PHASE is ⏳ Planned)
- Vehicle type catalog
- Real-time driver location tracking
- Ride/delivery request flow
- Driver acceptance + dispatch
- Route + ETA display
- Fare calculation engine
- Driver rating + history
- Fleet management

---

## 🔴 Critical AGENTS.md Rule Violations Found

### Rule #6 vs Reality

> **AGENTS.md Rule #6:** "NO payment gateway SDK installed — Do NOT add any payment gateway SDK without an approved ADR"

**Reality:** `lib/stripe.ts` and `lib/stripeService.ts` exist, and Stripe SDK is in `node_modules`. P4.4 is marked ✅ done.

**Note:** This may be intentional — needs architect verification that ADR was approved.

### Rule #3 vs Reality

> **AGENTS.md Rule #3:** "NEVER touch `src/` directory — legacy"

**Reality:** `src/` directory still exists (24 KB) with `components/` and `test/` subdirectories. It hasn't been touched (good), but it hasn't been deleted either.

### Rule #7 — Chat Files

> **AGENTS.md Rule #2:** "NEVER touch chat-related files"

**Reality:** Some chat-moderation routes exist in `routes/adminChat.ts` and chat utilities in `lib/chatModeration.ts`, `lib/chatTranslate.ts`. These appear to be admin-moderation related, not core chat logic.

---

## 📊 Summary Table

| Issue | Severity | Action Required |
|-------|----------|-----------------|
| Firebase config files (legacy) | 🟡 Medium | Delete or archive; update docs |
| Firebase Admin SDK in deps | 🟡 Medium | Remove from package.json if unused |
| CSP allows firestore.googleapis.com | 🟡 Medium | Remove from CSP header |
| Documentation references Firebase | 🟡 Low | Update docs to reflect PostgreSQL-only |
| Project size (1.2 GB) | 🟢 Normal | Optional: cleanup dist/, screenshots/, logs/ |
| src/ directory exists | 🟢 Low | Remove if truly legacy (contradicts Rule #3 which says never touch) |
| P3.1 E2E tests pending | 🟡 Medium | Execute P3.1 prompt |
| ROADMAP phases 2,6,8,9 incomplete | 🟡 Medium | These are planned phases — roadmap is accurate |
| Stripe SDK installed (Rule #6 conflict) | 🔴 High | Verify ADR approval exists |

---

## ✅ Recommended Action Plan

### Immediate (This Session)
1. ✅ Create this audit document — **DONE**
2. Update documentation files that reference Firebase:
   - `AGENTS.md` — remove Firebase from Stack table
   - `docs/ARCHITECTURE.md` — remove Firebase component
   - `docs/SECURITY.md` — remove Firebase references
   - `docs/DEPLOYMENT.md` — remove Firebase section

### Short-term (Next Sprint)
3. Remove 3 Firebase config files from root
4. Remove `@firebase` packages from `package.json`
5. Remove `firestore.googleapis.com` from CSP in `server.ts`
6. Execute P3.1 (E2E Playwright Tests)
7. Verify Stripe integration has approved ADR

### Medium-term
8. Evaluate whether `src/` directory can be archived/deleted
9. Plan phases 2, 6, 8, 9 implementation
10. Run `flutter clean` to reduce working directory size

---

> 📝 This document should be reviewed by the Project Architect (Amir Farhadian) before any deletions are made.