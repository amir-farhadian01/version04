# Documentation Update Plan — Neighborly

**Date:** 2026-05-25
**Author:** Architect Mode
**Source Document:** `/home/amir/movaghat/neighborly-doc-update-request-fa.docx`

---

## Overview

This plan details the exact changes needed for 3 documentation files and 1 directory deletion. The goal is to align product documentation with the simplified user model, 2-environment platform model, updated product vision, and 27 new requirements from the source document.

---

## File 1: `docs/ROADMAP.md`

### 1.1 Section 1 — Product Vision (lines 13-26)

**Action:** Rewrite entirely.

**Current text (lines 15-23):**
```
Neighborly is a social marketplace platform — part Instagram, part TaskRabbit, part Groupon — where:
- Regular users browse, discover, and share skills/services like a social feed
- Solo providers list personal services (barbering, gardening, baking, etc.)
- Corporate businesses manage employees, clients, invoices, and bookings
- Any business vertical is supported: beauty, auto repair, home services, transport, food, events, etc.
- Transport layer (V2): Uber-like ride/delivery dispatch (motorbike → truck)
```

**New text:**
```
Neighborly is a social marketplace location-aware platform — combining social media, local discovery, and service commerce — where:

- **Public Visitors** browse local content, discover skills and services, and explore neighbourhood activity
- **Clients** (registered users) view a location-aware feed, publish posts/stories, discover services, place orders, book appointments, and interact with businesses
- **Business Clients** (upgraded Clients) manage services, staff, inventory, CRM, finance, and scheduling within a Business Workspace — all inside the same Client App/Web surface
- **Any business vertical** is supported: beauty, auto repair, home services, transport, food, events, etc.
- **Transport layer (V2):** Uber-like ride/delivery dispatch (motorbike → truck)

The platform is **neighbourhood-aware** and **interest-filtered**: each user sees content and services tailored to their location and preferences.

All users undergo **KYC verification** by admin before activation. Business Clients additionally undergo business-level KYC (license, insurance, registration).
```

### 1.2 Section 2 — User Types (lines 29-41)

**Action:** Rewrite entirely.

**Current table (lines 31-38):**
```
| Type | Description |
|------|-------------|
| PUBLIC_VIEWER | Unauthenticated — can browse public feed and search |
| CUSTOMER | Registered user — books services, shares posts |
| SOLO_PROVIDER | Individual offering services under personal brand |
| BUSINESS_OWNER | Corporate account with employees and clients |
| EMPLOYEE | Staff member of a business; may also operate independently |
| ADMIN | Platform operator with full access |
```

**New table:**
```
| Type | Description |
|------|-------------|
| Public Visitor | Unauthenticated user — browses public feed, search, and service catalog |
| Client | Registered user / citizen — browses feed, publishes posts/stories, places orders, books services, chats, reviews |
| Business Client | Upgraded Client — same Client surface plus a Business Workspace for managing services, staff, CRM, inventory, finance, and scheduling |
| Admin / Support | Internal platform staff — operations, KYC review, audit, finance, content management, analytics |

> **Note:** "Provider", "Staff", "Employee", "Solo Provider", "Business Owner" are **internal operational roles** within a Business Workspace, NOT independent user types in product documentation. The Prisma schema may still contain legacy role enums (`provider`, `staff`, `customer`, etc.) as implementation details — these do not change the product-level user model described above.
```

**Remove the line:** `> One person can hold multiple roles across multiple businesses simultaneously.` (This is an implementation detail, not a product-level concept.)

### 1.3 Section 3 — Platform Surfaces (lines 44-60)

**Action:** Rewrite entirely.

**Current ASCII diagram (lines 46-59):**
```
┌──────────────────────────────────────────────────────┐
│  PUBLIC FEED (Social Layer — Instagram-like)         │
│  Videos · Posts · Stories · Services Discovery      │
├──────────────────────────────────────────────────────┤
│  CUSTOMER DASHBOARD                                  │
│  Browse · Book · Track Orders · Chat · Profile       │
├──────────────────────────────────────────────────────┤
│  BUSINESS / PROVIDER DASHBOARD                       │
│  Services · Clients · Invoices · Schedule · Finance  │
├──────────────────────────────────────────────────────┤
│  ADMIN PANEL                                         │
│  KYC · CRM · Orders · Contracts · Analytics · Media  │
└──────────────────────────────────────────────────────┘
```

**New diagram and text:**
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

**Key changes:**
- Replace 4 surfaces with 2 environments: **Admin Web** and **Client App/Web**
- **Business Workspace** is a subset/capability within Client App/Web, NOT a separate surface
- Explicitly note Admin is web-only; Client is both mobile and web

### 1.4 Section 4 — Phase Matrix

**Action:** Add new requirements to existing phases. No phases are removed.

#### Phase 2 — Social Feed (lines 101-117)

**Add these rows to the table:**

| Feature | Status | Notes |
|---------|--------|-------|
| Order CTA on business posts (direct booking from social) | ⏳ | Business posts can include an Order button linked to a service |
| Local news, weather, traffic, police alerts in Home | ⏳ | Admin-managed content feeds; API integration for weather/alerts |
| Home Intelligence / Local Insights (aggregate market data) | ⏳ | Anonymized aggregate data: service demand, pricing heatmaps, neighbourhood comparisons |
| Explore profile tap → Business Page (for business accounts) | ⏳ | Tapping business name/avatar navigates to full Business Page |

#### Phase 6 — Business (Provider) Dashboard (lines 174-189)

**Rename section to:** "Phase 6 — Business Workspace (Client Surface Subset)"

**Add these rows to the table:**

| Feature | Status | Notes |
|---------|--------|-------|
| Business Page (public-facing) with trust layer | ⏳ | License, insurance, work experience from KYC; critical fields read-only |
| Staff identity display (photo + name per service) | ⏳ | Required before in-person service; customer must know who will perform the work |
| Service-to-staff assignment | ⏳ | Each service assignable to one or more specific staff members |
| Parallel scheduling (multiple staff, same service, same time) | ⏳ | System calculates available slots based on staff count, service duration, and break times |
| CRM (customer management, history, notes) | ⏳ | Free built-in CRM for all Business Clients |
| Quote generation and sending | ⏳ | Pre-order quote before contract |
| Email marketing / campaign management | ⏳ | In-platform email campaigns to customers |
| Pipeline revenue view | ⏳ | Revenue from active orders vs completed vs pending |
| Internal workspace roles (HR, accountant, social manager, worker) | ⏳ | Role-based access within the workspace |
| Platform circumvention prevention (PII block before contract) | ⏳ | Phone/email/address blocked or masked until authorized workflow stage |

#### Phase 8 — Admin Control Center (lines 209-225)

**Add these rows to the table:**

| Feature | Status | Notes |
|---------|--------|-------|
| Home Content Management (news, media, external API integration) | ⏳ | Admin publishes news, manages weather/alert API connections, controls display priority |
| Local Insights configuration | ⏳ | Configure which aggregate data is shown to users; privacy boundaries |

### 1.5 Section 5 — Database Schema Strategy (lines 245-266)

**Action:** Add a note after the existing content.

**Add this paragraph:**
```
> **Note on User Roles vs Product Types:** The Prisma schema contains role enums (`customer`, `provider`, `staff`, `platform_admin`, `support`, `finance`) that are implementation details of the backend. In product documentation, these are not exposed as independent user types. The product recognizes only: Public Visitor, Client, Business Client, and Admin/Support. The `provider`, `staff`, `employee` roles are internal operational roles within a Business Workspace.
```

### 1.6 Section 9 — V2 Preview (lines 348-359)

**Action:** No changes needed. Keep as-is.

---

## File 2: `docs/FEATURES.md`

### 2.1 Global Layout Rules (lines 12-41)

**Action:** Update terminology to match new model.

**Line 14:** Change `### Header (Customer & Business Dashboards)` to `### Header (Client App/Web)`

**Line 21:** Change `- **Left side (Business mode only):**` to `- **Left side (Business Workspace mode only):**`

**Line 23:** Change `Profile avatar is always visible regardless of which dashboard is active` to `Profile avatar is always visible regardless of which surface area is active`

### 2.2 Bottom Navigation — 3 Tabs (lines 44-52)

**Action:** Update terminology.

**Line 48:** Change `Tab 3: SERVICES (regular users) / MY BUSINESS (verified business users)` to `Tab 3: SERVICES (Clients) / MY BUSINESS (Business Clients)`

**Line 50:** Change `When a user becomes a verified business, a 4th tab appears: MY BUSINESS` to `When a Client upgrades to Business Client, a 4th tab appears: MY BUSINESS`

### 2.3 Tab 1 — HOME (lines 55-141)

**Action:** Update terminology.

**Line 111:** Change `### HOME / PROFILE (accessed via avatar in header)` — no text change needed, but add note:

**After line 139 (Become a Business CTA):** Change `Button label: "Register My Business"` to `Button label: "Upgrade to Business Client"`

### 2.4 Tab 2 — EXPLORER (lines 143-199)

**Action:** Update terminology.

**Line 145:** Change `The social discovery layer. Two sub-tabs: General and Business.` to `The social discovery layer. Two sub-tabs: General and Business.`

**Line 189:** Change `### EXPLORER / BUSINESS` to `### EXPLORER / BUSINESS (Business Client content)`

### 2.5 Tab 3 — SERVICES (lines 202-301)

**Action:** Update terminology.

**Line 202:** Change `## TAB 3 — SERVICES (Regular Customer)` to `## TAB 3 — SERVICES (Client)`

**Line 208:** Change `### SERVICES / OVERVIEW (Default sub-tab)` — no text change needed.

**Line 258:** Change `### SERVICES / MESSAGES (Sub-tab — THE CORE OF THE PLATFORM)` — no text change needed.

### 2.6 Tab 4 — MY BUSINESS (lines 303-308)

**Action:** Update terminology.

**Line 303:** Change `## TAB 4 — MY BUSINESS (appears only after business KYC approval)` to `## TAB 4 — MY BUSINESS (appears only after Business Client KYC approval)`

### 2.7 BECOME A BUSINESS — KYC UPGRADE FLOW (lines 311-349)

**Action:** Update terminology.

**Line 311:** Change `## BECOME A BUSINESS — KYC UPGRADE FLOW` to `## UPGRADE TO BUSINESS CLIENT — KYC UPGRADE FLOW`

**Line 313:** Change `Triggered from profile "Register My Business" button.` to `Triggered from profile "Upgrade to Business Client" button.`

**Line 315-317:** Change:
```
Step 1 — Business Type Selection:
- Sole Proprietor (individual offering services under personal brand)
- Corporation or Partnership (company with employees)
```
To:
```
Step 1 — Business Type Selection:
- Individual (solo operator, personal brand)
- Company (corporation or partnership with employees)
```

### 2.8 BUSINESS DASHBOARD (lines 352-538)

**Action:** Rename section and update terminology throughout.

**Line 352:** Change `## BUSINESS DASHBOARD` to `## BUSINESS WORKSPACE (Client Surface Subset)`

**Line 359:** Change `### Switch to Personal Account` to `### Switch to Client Account`

**Line 360:** Change `- In hamburger menu: "Go to Personal Account"` to `- In hamburger menu: "Go to Client Account"`

**Line 361:** Change `- Returns user to personal feed without logging out of business account` to `- Returns user to Client feed without leaving the Business Workspace`

**Line 365:** Change `### BUSINESS BOTTOM NAVIGATION — 3 Tabs` to `### BUSINESS WORKSPACE BOTTOM NAVIGATION — 3 Tabs`

### 2.9 ADMIN PANEL (lines 541-578)

**Action:** Add new admin capabilities.

**After line 577 (end of Form Builder section), add:**

```
### Home Content Management

Admin panel for managing the Home screen content across all Client surfaces:

- **News Management:** Create, edit, archive news articles with title, body, photo/media, and publish date
- **External API Integration:** Configure connections to weather APIs, traffic alert services, police/safety alert feeds
- **Display Priority:** Control ordering and categorization of Home content blocks (news, weather, alerts, utility links)
- **Media Upload:** Upload images and media for news articles and announcements
- **Content Scheduling:** Schedule content to appear at specific times or dates

### Local Insights Configuration

Admin panel for controlling aggregate market data shown to users:

- **Data Visibility Toggles:** Enable/disable specific insight types (service demand, pricing heatmaps, neighbourhood comparisons)
- **Privacy Boundaries:** Configure minimum data thresholds before aggregate data is displayed (prevent deanonymization)
- **Refresh Schedule:** Set how often aggregate data is recomputed
- **Geographic Granularity:** Control whether insights are shown at city, neighbourhood, or street level
```

### 2.10 Notification Routing Table (lines 580-601)

**Action:** Update terminology.

**Line 584:** Change `| Order matched | Customer | Services tab > Messages |` to `| Order matched | Client | Services tab > Messages |`

**Line 585:** Change `| New offer received | Business | Business Messages > Active tab |` to `| New offer received | Business Client | Business Messages > Active tab |`

**Line 594:** Change `| New social comment | Business | Social Media Manager |` to `| New social comment | Business Client | Social Media Manager |`

**Line 595:** Change `| New post direct message | Business | Social Media Manager |` to `| New post direct message | Business Client | Social Media Manager |`

### 2.11 Database Model Additions (lines 604-713)

**Action:** No changes needed. These are Prisma schema models and remain accurate.

### 2.12 Confirmed Technology Stack (lines 717-738)

**Action:** No changes needed.

---

## File 3: `docs/GLOSSARY.md`

### 3.1 Customer entry (lines 261-267)

**Action:** Rewrite.

**Current:**
```
### Customer
**Definition:** A `User` with role `customer` (default) who browses the service catalog, creates orders, and reviews completed jobs. Customers use the customer dashboard and mobile app with a 4-tab bottom navigation.
**Example:** Alice signs up as a customer, browses "Plumbing" services, creates an order for a pipe repair, and is matched with a provider.
**See also:** [`User`](#user), [`UserRole`](#userrole), [`Order`](#order)
**ADR:** [`ADR-0006`](docs/DECISIONS.md) — Customer Flutter cabin: 4-tab bottom nav
**Source:** [`routes/orders.ts`](routes/orders.ts) — Customer order routes
```

**New:**
```
### Client
**Definition:** A registered user / citizen who browses the platform, publishes content, discovers services, places orders, and interacts with businesses. Clients use the Client App/Web surface (mobile app + web). This is the default user type. When a Client upgrades their account, they become a **Business Client** with access to a Business Workspace.
**Example:** Alice signs up as a Client, browses "Plumbing" services in her neighbourhood feed, creates an order for a pipe repair, and is matched with a Business Client.
**See also:** [`Business Client`](#business-client), [`User`](#user), [`Order`](#order)
**ADR:** [`ADR-0006`](docs/DECISIONS.md) — Customer Flutter cabin: 4-tab bottom nav
**Source:** [`routes/orders.ts`](routes/orders.ts) — Order routes
```

### 3.2 Provider entry (lines 673-679)

**Action:** Rewrite.

**Current:**
```
### Provider
**Definition:** A `User` with role `provider` who owns or works for a `Company`/workspace and offers services through `ProviderServicePackage` entries. Providers receive order invitations, draft contracts, and complete jobs.
**Example:** Bob registers as a provider, creates a company "Bob's Plumbing", adds service packages, and receives order invitations from customers.
**See also:** [`User`](#user), [`UserRole`](#userrole), [`Company`](#company), [`ProviderServicePackage`](#providerservicepackage)
**ADR:** [`ADR-0026`](docs/DECISIONS.md) — Workspaces and ProviderServicePackage
**Source:** [`routes/providers.ts`](routes/providers.ts) — Provider routes
```

**New:**
```
### Provider
**Definition:** An internal operational role within a Business Workspace, NOT an independent user type in product documentation. In the backend, a `User` may have a `provider` role in the Prisma schema, but at the product level, anyone offering services is a **Business Client**. The term "provider" may appear in technical contexts (matching, eligibility, routes) but should not be treated as a separate user type in product docs.
**Example:** Bob is a Business Client who owns "Bob's Plumbing" workspace. The backend may store his role as `provider` for route access control, but product documentation refers to him as a Business Client.
**See also:** [`Business Client`](#business-client), [`Company`](#company), [`ProviderServicePackage`](#providerservicepackage)
**ADR:** [`ADR-0026`](docs/DECISIONS.md) — Workspaces and ProviderServicePackage
**Source:** [`routes/providers.ts`](routes/providers.ts) — Provider routes
```

### 3.3 Add new entry: Business Client (insert alphabetically between BusinessTrustScore and BusinessVerification)

**New entry:**
```
### Business Client
**Definition:** A **Client** who has upgraded their account through business KYC and gained access to a **Business Workspace** within the Client App/Web surface. Business Clients can manage services, staff, CRM, inventory, finance, scheduling, quotes, invoices, and campaigns. This is the product-level term; the backend may use `provider`, `business_owner`, or other role enums internally.
**Example:** Alice, a Client, completes business KYC and becomes a Business Client. She now sees a "My Business" tab and can manage her plumbing services, staff, and customer relationships.
**See also:** [`Client`](#client), [`Workspace`](#workspace), [`Company`](#company)
**ADR:** Not yet covered by an ADR
**Source:** [`docs/ROADMAP.md`](docs/ROADMAP.md) — Product documentation
```

### 3.4 Add new entry: Business Workspace (insert alphabetically between BusinessVerification and Category)

**New entry:**
```
### Business Workspace
**Definition:** A capability subset within the **Client App/Web** surface, available only to **Business Clients**. The Business Workspace is NOT a separate product or surface — it is the upgraded Client's environment for managing their business operations: services, staff, CRM, inventory, finance, scheduling, quotes, invoices, and campaigns. In the backend, this maps to a `Company` record with associated `CompanyUser` memberships.
**Example:** Alice (Business Client) opens the Business Workspace to view her service packages, check her appointment calendar, and send an invoice to a customer — all within the same Client App/Web application.
**See also:** [`Business Client`](#business-client), [`Company`](#company), [`Workspace`](#workspace)
**ADR:** [`ADR-0026`](docs/DECISIONS.md) — Workspaces and ProviderServicePackage
**Source:** [`docs/ROADMAP.md`](docs/ROADMAP.md) — Product documentation
```

### 3.5 Update UserRole entry (lines 834-839)

**Action:** Add a note about product vs implementation.

**Add to the end of the entry:**
```
> **Note:** The `UserRole` enum values (`customer`, `provider`, `platform_admin`, `support`, `finance`) are backend implementation details. In product documentation, the recognized user types are: Public Visitor, Client, Business Client, and Admin/Support. The `provider` and `staff` roles are internal operational roles within a Business Workspace.
```

### 3.6 Update Workspace entry (lines 869-875)

**Action:** Add reference to Business Workspace concept.

**Add to the end of the entry:**
```
> **Product note:** In documentation, the term "Business Workspace" is used to describe this concept from the Business Client's perspective. See [`Business Workspace`](#business-workspace).
```

---

## File 4: Delete `files/` directory

### Verification

The `files/` directory contains 4 files:
- `files/AGENTS.md` — Legacy copy of `docs/AGENTS.md` (older version)
- `files/FEATURES.md` — Legacy copy of `docs/FEATURES.md` (identical content)
- `files/ROADMAP.md` — Legacy copy of `docs/ROADMAP.md` (older version, references `src/` instead of `routes/` + `lib/`)
- `files/START_HERE.md` — Legacy onboarding file (references old directory structure with `repoversion2/`, `temp_version2/`, etc.)

**Assessment:** All files in `files/` are legacy copies of content that now lives in `docs/`. The `files/` directory was created during an earlier cleanup phase as a staging area. It is safe to delete.

**Action:** `rm -rf files/`

---

## Summary of All Changes

| File | Changes |
|------|---------|
| `docs/ROADMAP.md` | Rewrite §1 Product Vision, §2 User Types, §3 Platform Surfaces; add requirements to §4 Phase 2/6/8; add note to §5 Database Schema Strategy |
| `docs/FEATURES.md` | Update terminology throughout (Customer→Client, Business→Business Client, Business Dashboard→Business Workspace); add Home Content Management and Local Insights sections to Admin Panel |
| `docs/GLOSSARY.md` | Rewrite Customer→Client entry; rewrite Provider entry; add Business Client entry; add Business Workspace entry; add notes to UserRole and Workspace entries |
| `files/` directory | Delete entirely (confirmed legacy copies) |

---

## Execution Order

1. Delete `files/` directory
2. Update `docs/ROADMAP.md` (sections 1, 2, 3, 4, 5)
3. Update `docs/FEATURES.md` (terminology + new admin sections)
4. Update `docs/GLOSSARY.md` (rewrite entries + add new entries)
5. Update version numbers and "Last Updated" dates in all 3 files
