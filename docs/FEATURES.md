# Neighborly 2.0 — Dashboard Features Specification

**Version:** 2.2.0
**Last Updated:** 2026-05-25
**Status:** Source of truth for all UI/UX implementation

> Agents: read this file fully before building any page or component.
> Every UI decision described here is intentional and must be implemented exactly as specified.

---

## GLOBAL LAYOUT RULES

### Header (Client App/Web)
- **Right side:** Profile avatar (photo) — tapping opens a slide-down/side panel with:
  - Personal info (name, email, phone)
  - Edit profile fields
  - KYC status indicator
  - Settings (notifications, language, privacy)
  - Logout
- **Left side (Business Workspace mode only):** Company logo — tapping opens business profile panel
  - Below logo: hamburger menu icon (hamburger) for full business navigation
- Profile avatar is always visible regardless of which surface area is active

### Email Uniqueness — CRITICAL SECURITY RULE
- Every account (personal or business) MUST have a unique, verified email
- Email is the primary identity anchor — it cannot be shared across accounts
- Strict enforcement — block common email aliasing tricks:
  - Gmail dot trick (user.name@gmail.com = username@gmail.com) — normalize before storing
  - Plus addressing (user+tag@gmail.com — treat as user@gmail.com for uniqueness check)
  - Case insensitivity (User@Gmail.com = user@gmail.com)
- Store the normalized email in DB alongside the raw input
- Unique index on normalizedEmail field in User model
- Required at registration: first name, last name, phone number (OTP verified), email (link verified)

### PII Protection — CORE SYSTEM RULE
- No phone numbers, emails, or physical addresses may ever be exchanged via chat
- AI moderation scans every message before delivery
- Flagged messages are blocked and both parties notified
- This is non-negotiable — the chat system IS the communication channel for the entire platform

---

## BOTTOM NAVIGATION — 3 TABS

Tab 1: HOME
Tab 2: EXPLORER
Tab 3: SERVICES (Clients) / MY BUSINESS (Business Clients)

When a Client upgrades to Business Client, a 4th tab appears: MY BUSINESS
The SERVICES tab remains as Tab 3.

---

## TAB 1 — HOME

The HOME tab contains 3 sub-tabs displayed as a horizontal tab bar at the top.

---

### HOME / HOME (Sub-tab 1 — default landing)

Layout top to bottom:

[20% of screen — Neighbourhood Banner]
- Background: photo of the user's registered neighbourhood
- Overlaid content inside the banner:
  - Current temperature + weather icon (e.g. sunny 18C)
  - Traffic alert badges (scrollable horizontal chips): e.g. Hwy 400 delay, Yonge & Bloor accident
  - Police/safety alerts (if any active)
  - Weather forecast mini-strip (next 3 hours)
- Banner is tappable — expands to full weather/alert detail view

[Below banner — Utility Icons Row]
- Single horizontal scrollable row of icon buttons
- Each icon = a utility category: Banks, Insurance, Fuel Prices, Government, Health, Transit
- Tapping an icon — filtered list of admin-curated utility links for that category
- Commission/referral links tracked by backend (click event logged per user)

[Search Box — minimum 20% of screen height]
- Large, prominent search bar centered on screen
- Placeholder: "Search services, businesses, skills near you..."
- Auto-complete suggests: nearby services, categories, business names
- Filters below search: Distance, Rating, Price, Available Now

[Remaining 30-50% — Local News & Events Feed]
- Neighbourhood-specific content cards:
  - Sports scores/upcoming games (local NHL, NBA, MLS teams, etc.)
  - Community events
  - Local business promotions (admin-approved)
  - City announcements
- Cards are horizontally swipeable per category

---

### HOME / MY POSTS (Sub-tab 2)

User's personal content history. Three selector buttons at top:

Posts — All posts the user has published (chronological, editable)
Stories — All stories the user has published (expired stories shown greyed out)
Saved — Posts the user has bookmarked (stories cannot be saved — no save icon on stories)

- Each post card shows: thumbnail, caption snippet, like count, comment count, date
- Tap to expand full post
- Long press — edit, delete, or boost options
- Saved posts: tap bookmark icon again to unsave

---

### HOME / PROFILE (accessed via avatar in header)

Profile fields:
- Profile photo (required for all service providers — enforced at activation)
- First name, last name (required, KYC-verified)
- Phone number (OTP verified, required)
- Email (unique normalized, verified, required)
- Bio / About me
- Interests (multi-select from category tree — drives feed algorithm)
- Gender (optional — used for feed personalization only, never shown publicly)

Saved Locations (used for service matching and search relevance):
Each address has a tag stored in DB:

| Tag | Example Use |
|-----|-------------|
| home | Residential address |
| work | Office/workplace |
| favourite | Frequently visited location |
| custom | User-defined label |

- For each address: street, city, postal code, lat/lng (geocoded on save)
- Tags stored as addressTag on UserAddress model
- Address tags used as search/filter parameters when customer places a service order
- For each address the system stores associated category preferences to improve recommendation accuracy

Become a Business — CTA button in profile:
- Button label: "Upgrade to Business Client"
- Tap — KYC upgrade flow begins (see UPGRADE TO BUSINESS CLIENT section below)

---

## TAB 2 — EXPLORER

The social discovery layer. Two sub-tabs: General and Business.

---

### EXPLORER / GENERAL

Content from individual users sharing skills, hobbies, and personal services.

Stories Row (top of screen):
- Horizontal scrollable row of circular profile photo avatars (Instagram-style)
- Active stories shown with coloured ring
- Tap — fullscreen story viewer with swipe to next
- Stories expire after 24 hours

Post Feed (below stories):
Each post card shows:
- Top: profile photo + username + time posted + three-dot menu (top right)
- Content: video (auto-play muted) or photo(s)
- Bottom action bar:
  - Like (count displayed)
  - Comment (count displayed)
  - Direct message (opens platform chat — no external contact possible)
  - Order (shown only if post is linked to a bookable service — opens Order Wizard)
  - Save/Bookmark (saves post to MY POSTS > Saved tab)

Three-dot menu — top right of each post:
- For personal posts: Report, Block user
- For business posts (additional options):
  - View Business Page
  - View Inventory
  - View Packages and Services

Business post avatar (top left):
- Tap company logo or avatar — view all posts by that business

Content Creation (FAB button or top-right camera icon):
- Before publishing, user MUST select a category from the category tree
- Category selection is mandatory — no uncategorized posts are allowed
- This enables accurate feed filtering and discoverability
- For personal users: selecting a category signals their skills/interests to the platform
- Fields: category (required), caption, location (optional), link to service (optional for business)

---

### EXPLORER / BUSINESS (Business Client content)

Same layout as General but shows only content from verified business accounts.

- Stories row at top (business stories only)
- Business posts with product/service price overlays
- "Book Now" CTA button overlaid on service-linked posts
- Filter bar: category, distance, rating, price range
- Business card tap — full business profile page:
  - About, services, packages, reviews, location on map, trust score badges

---

## TAB 3 — SERVICES (Client)

The booking, order history, and chat hub. This is the core transactional layer.

---

### SERVICES / OVERVIEW (Default sub-tab)

Summary dashboard for the customer.

Stats Cards (filterable by date range, service type, provider name, staff name):

| Card | Data Shown |
|------|------------|
| Orders Placed | Total count + total amount spent |
| Orders Completed | Count + total amount paid |
| Orders Cancelled | Count + any refunds issued |
| Active Orders | Count (tap to jump to active list) |

Filters available:
- Date range: from / to date picker
- Service category
- Provider name
- Staff member name

---

### SERVICES / ORDERS (Sub-tab)

Two inner tabs:

Active Orders:
- All current orders in the pipeline
- One card per order: service name, provider, status badge, date, amount
- Status stages: Pending, Matched, Contracted, Active, Completed
- Cancelled orders shown in a collapsible section below active
- Tap card — Order Detail page with three tabs: Details, Contract, Chat
- Cancel button visible if order is still within cancellation window

Completed Jobs (history table):

| Column | Data |
|--------|------|
| Date and Time | When job was performed |
| Service | Service name and category |
| Provider | Business name |
| Staff | Name of the person who performed the work |
| Agreed Amount | Price negotiated or fixed at booking |
| Amount Paid | Confirmed payment amount |
| Actions | Print Invoice, Rate and Review |

Filters: date range, provider name, service type, staff member
Each row: tap to view full order detail, print/download invoice button

---

### SERVICES / MESSAGES (Sub-tab — THE CORE OF THE PLATFORM)

This is the heart of the application. All negotiation, agreement, and coordination happens here.
No external contact information is ever shared. This rule is absolute.

Inbox Layout:

Conversation List (left panel or full screen on mobile):
- One row per order-related conversation
- Each row: provider avatar, business name, service name, last message snippet, time, unread count badge
- Tabs at top:
  - Active (ongoing negotiations and active jobs)
  - Offers (matched providers awaiting customer response)
  - History (concluded conversations)

Chat Thread (right panel on tablet, full screen on mobile after tap):
- Full message history for selected conversation
- Provider profile photo visible at top (identity confirmation for customer — this is intentional)
- Messages scanned for PII before delivery — blocked messages show warning to sender
- Message input box at bottom of screen

Below the input box — persistent action buttons always visible:
- "I have reached an agreement" button — triggers contract generation flow
- Attach file or photo (job-related documents only)
- Request update (sends automated nudge to provider)

Contract Generation Flow (triggered by "I have reached an agreement"):
1. Customer taps the agreement button
2. System prompt appears: "Please describe the final agreement. Include the service, date, time, price, and any specific requirements."
3. Customer types their summary
4. AI reads full chat history plus customer summary and generates a contract draft
5. Contract is displayed for customer review before sending
6. Customer sends contract to provider
7. Provider receives contract and can accept or propose changes
8. When provider accepts — Stripe payment link is sent to customer
9. Customer completes payment — funds held in escrow by Stripe
10. On job completion confirmed by customer — funds released to provider minus platform commission

Notification routing:
- All order and message notifications route to this tab
- Notification badge shows workspace or business name it belongs to
- Tapping a notification opens the correct conversation thread directly

---

## TAB 4 — MY BUSINESS (appears only after Business Client KYC approval)

Tap this tab — navigates to Business Workspace.
- Personal profile avatar remains in top-right corner at all times
- Company logo appears in top-left corner with hamburger menu below it

---

## UPGRADE TO BUSINESS CLIENT — KYC UPGRADE FLOW

Triggered from profile "Upgrade to Business Client" button.

Step 1 — Business Type Selection:
- Individual (solo operator, personal brand)
- Company (corporation or partnership with employees)

Step 2 — License Requirement Check:
- System checks selected service category against license-required list (admin-configured per category)
- If license is required — upload license document (KYC Level 2)
- If not required — marked as "General Service — No License Required"
- This status is displayed publicly on the business profile page

Step 3 — Insurance Check (Corporations only):
- Does the business carry liability insurance?
- Upload certificate of insurance
- Insurance status displayed on business profile
- Contributes to trust score and search ranking

Step 4 — Document Submission:
- Government-issued ID of owner
- Business registration certificate (corporations)
- License document (if applicable)
- Insurance certificate (if applicable)

Step 5 — Admin Review:
- Goes to admin KYC queue
- Applicant receives email and in-app notification on approval or rejection
- On approval — MY BUSINESS tab becomes visible

Trust Score Calculation:
Each verified attribute contributes to overall business trust score:
- KYC identity verified: base score
- Professional license verified: additional points
- Liability insurance verified: additional points
- Average customer rating: weighted contribution
- Trust score determines ranking in search results and matching priority

---

## BUSINESS WORKSPACE (Client Surface Subset)

### Header
- Top-left: Company logo (tap — opens business profile management panel)
  - Below logo: hamburger menu for full navigation
- Top-right: Personal profile avatar (always present — access to personal account)

### Switch to Client Account
- In hamburger menu: "Go to Client Account"
- Returns user to Client feed without leaving the Business Workspace

---

### BUSINESS WORKSPACE BOTTOM NAVIGATION — 3 Tabs

---

#### BUSINESS TAB 1 — DASHBOARD (Default)

Stats Cards (filterable by date range, service type, package type):

| Card | Data |
|------|------|
| Active Services | Currently in-progress jobs count |
| Pending | Awaiting provider acceptance |
| Completed | Total finished jobs |
| Revenue Received | Total amount received from all clients |
| Platform Commission | Total commission deducted |

Performance Cards:
- Best-selling service (by number of orders)
- Lowest-performing service
- Successful orders total
- Failed or lost orders total

AI Insights Panel (bottom of dashboard page):
- Analysis of why specific orders were lost to competitors
- What other providers in the same category do differently
- Suggested improvements: pricing, availability windows, package structure
- Version 2 roadmap: deeper analytics, trend-based recommendations, demand forecasting

---

#### BUSINESS TAB 2 — MY BUSINESS

Three inner sub-tabs:

Services:
- List of service definitions linked to this workspace
- Each service shows: name, category, booking mode (Fixed / Negotiable / Auto-appointment), status
- Add, edit, archive services
- Each service links to its dynamic field schema managed by admin in service catalog

Packages:
- List of configured service packages
- Each package: name, price, booking mode, Bill of Materials items, margin display
- Toggle auto-appointment on or off per package
- Admin can lock booking mode at category level — business cannot override a locked mode

Inventory / Shop:
- Products and parts list with: name, price per unit, stock quantity, unit of measure
- Assign products to package Bills of Materials
- Set stock alert threshold (optional)
- Price at time of order is snapshotted and immutable — historical orders always show correct prices

---

#### BUSINESS TAB 3 — MESSAGES AND NOTIFICATIONS

Same PII-protection rules apply. No external contact information may be shared.

Inner tabs:

Active (Default — must load first and fast):
- Incoming order offers requiring response
- Unread count badge on tab visible at all times
- Each offer card: customer info, service requested, proposed date/time, initial message
- Actions per offer: Accept, Decline, Counter-offer, Open Chat
- Expiry countdown per offer — auto-expires if no response within configured window
- Lost-deal feedback prompt shown after expiry or decline

History:
- Lost deals: declined or expired offers
- Accepted deals: converted to active orders

Completed Orders (full table):

| Column | Data |
|--------|------|
| Client | Name and profile photo |
| Package Sold | Package name with BOM breakdown available on expand |
| Staff Assigned | Employee who performed the service |
| Amount Charged | Total billed to client |
| Commission | Platform fee deducted |
| Payment Reference | Transaction hash from payment provider |
| Date and Time | Job completion timestamp |
| Actions | Print Invoice, Email Invoice to Client |

---

### HAMBURGER MENU — Business Side Navigation

---

#### 1. FINANCE

Tab 1 — Transactions Table:

Spreadsheet-style table:
- Columns: Date, Service or Package, Client, Staff, Amount, Commission, Net Amount, Payment Reference, Status
- Running total row pinned at top showing totals for current filter
- Filter controls: date range, service type, package name, client name, staff member
- Per-row actions:
  - Print Invoice (generates PDF)
  - Email Invoice to Client (sends PDF directly from platform to client email)

Tab 2 — Payment Gateway Setup:

Before redirecting to payment provider, show preparation checklist:
- Government ID (already in KYC)
- Business registration certificate (already in KYC)
- Bank account routing number and account number
- Tax identification number (SIN for sole proprietors, Business Number for corporations)

Show brief tutorial: "This takes approximately 5 minutes. Your documents are already on file with us and will be sent automatically."

Primary: Connect to Stripe
- Opens Stripe Connect OAuth flow
- System pre-fills business data from existing KYC documents
- On Stripe approval — workspace marked payoutsEnabled in database
- Commission split configured in Stripe: platform fee auto-deducted from each transaction
- Business owner never handles commission calculation manually

Additional Payment Methods supported (agents must implement adapters for all):

Stripe Connect (primary):
- Auto commission split on every transaction
- Instant setup via OAuth
- Handles payout scheduling automatically

PayPal Business:
- For providers preferring the PayPal ecosystem
- Commission deducted via PayPal Commerce Platform split payments
- Setup via PayPal OAuth flow

Interac e-Transfer (Canada only):
- Manual verification by admin
- Commission invoiced separately to business after each payment period
- Admin marks commission as received manually in admin panel
- Not recommended for high-volume businesses

Square:
- Suitable for businesses with a physical location using Square POS
- Square Connect API integration
- Commission handled via Square payment split

Future (feature-flagged, admin-toggleable):
- Crypto wallet support
- Additional regional payment methods

For every payment method: platform commission is always calculated and collected. Manual methods require admin to track and reconcile commission separately.

---

#### 2. SOCIAL MEDIA MANAGER

Posts:
- All published posts in a list: thumbnail, category, likes, comments, date published
- Edit caption or update category on existing posts
- Archive post (soft-delete — not permanently removed)
- Schedule post: set future publish date and time

Stories:
- All stories published: active vs expired status
- Create new story: photo or video, max 24 hours duration

Respond to Comments and Messages:
- Comment notifications from posts appear here
- Direct message inquiries from Explorer (customer tapped Direct on a post)
- All replies stay on-platform — no external contact information exchanged

Social Media Access Control (business settings):
- Only the business owner can grant employees access to this section
- Role: SOCIAL_MEDIA_MANAGER — can create posts, edit posts, respond to comments and DMs
- Only owner can add or remove this role assignment
- Multiple employees can hold this role simultaneously

---

## ADMIN PANEL

Key additions to existing admin capabilities:

Media Audit Tab:
- All video and photo uploads tracked in DB with moderation status
- Uses metrics stored during media processing (views, flags, reports)
- Actions per asset: approve, remove, warn user, escalate to senior review
- Filter by: uploader type (personal or business), category, upload date, flag count
- Bulk moderation for flagged content

Utility Links Manager:
- Add, edit, archive curated public links: banks, insurance, fuel stations, government services
- Per-link click analytics: total clicks, unique users, revenue from referrals
- Commission rate configuration per link
- Category management: add new utility categories as needed

Business Trust Score Management:
- Admin view of trust scores for all businesses
- Manual adjustment of individual score factors
- Override license or insurance verification status with notes
- Flag business for re-review

Stripe Connect Overview:
- List of all connected workspaces with connection status
- Total commission received per period
- Failed payouts and disputes requiring admin attention
- Manual commission entry for non-Stripe payment methods (Interac reconciliation)

Form Builder (KYC per business type):
- Visual drag-and-drop form builder
- Different form schema per business category (beauty salon vs auto repair vs transport)
- Field types: text, textarea, number, currency, date, datetime, file upload, select, multiselect, boolean, location, phone, email
- Conditional logic: show or hide fields based on values of other fields
- Schema versioning: old submissions always linked to snapshot of schema at submission time
- Preview mode before publishing

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

---

## NOTIFICATION ROUTING TABLE

| Event | Recipient | Routes To |
|-------|-----------|-----------|
| Order matched | Client | Services tab > Messages |
| New offer received | Business Client | Business Messages > Active tab |
| Contract sent | Both parties | Messages > relevant conversation |
| Contract approved | Both parties | Messages > relevant conversation |
| Payment link ready | Customer | Order Detail page |
| Payment received | Business Client | Finance tab |
| Order completed | Both parties | Messages history |
| KYC approved | User | Profile or Business setup |
| KYC rejected | User | Profile with reason |
| PII blocked in chat | Sender | In-chat warning inline |
| New social comment | Business Client | Social Media Manager |
| New post direct message | Business Client | Social Media Manager |

Multi-workspace notification routing:
- Notification badge shows which workspace it belongs to: "New offer — ABC Plumbing"
- Tap notification — routes directly to the correct workspace Messages tab
- Never routes to wrong workspace when user manages multiple businesses

---

## DATABASE MODEL ADDITIONS

```prisma
// Normalized email for uniqueness enforcement
// Add to existing User model:
// normalizedEmail String @unique

model UserAddress {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  label       String   // home | work | favourite | custom string
  street      String
  city        String
  province    String
  postalCode  String
  country     String   @default("CA")
  latitude    Float
  longitude   Float
  categoryTags String[] // interest/category tags tied to this location for better search
  isDefault   Boolean  @default(false)
  createdAt   DateTime @default(now())
  archivedAt  DateTime?
}

model BusinessVerification {
  id                    String    @id @default(cuid())
  workspaceId           String    @unique
  requiresLicense       Boolean   @default(false)
  licenseNumber         String?
  licenseDocUrl         String?
  licenseVerifiedAt     DateTime?
  hasLiabilityInsurance Boolean   @default(false)
  insuranceDocUrl       String?
  insuranceVerifiedAt   DateTime?
  verifiedByAdminId     String?
  notes                 String?
  updatedAt             DateTime  @updatedAt
}

model BusinessTrustScore {
  id                String   @id @default(cuid())
  workspaceId       String   @unique
  kycVerified       Boolean  @default(false)
  licenseVerified   Boolean  @default(false)
  insuranceVerified Boolean  @default(false)
  avgRating         Float    @default(0)
  totalScore        Float    @default(0)
  updatedAt         DateTime @updatedAt
}

model UtilityLink {
  id             String             @id @default(cuid())
  title          String
  url            String
  category       String
  iconUrl        String?
  commissionRate Float?
  isActive       Boolean            @default(true)
  clickCount     Int                @default(0)
  createdAt      DateTime           @default(now())
  archivedAt     DateTime?
  clicks         UtilityLinkClick[]
}

model UtilityLinkClick {
  id        String      @id @default(cuid())
  linkId    String
  link      UtilityLink @relation(fields: [linkId], references: [id])
  userId    String?
  clickedAt DateTime    @default(now())
}

model Invoice {
  id          String        @id @default(cuid())
  workspaceId String
  customerId  String?
  orderId     String?
  status      InvoiceStatus @default(DRAFT)
  lineItems   Json
  subtotal    Int
  tax         Int           @default(0)
  total       Int
  dueDate     DateTime?
  sentAt      DateTime?
  paidAt      DateTime?
  pdfUrl      String?
  notes       String?
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
  archivedAt  DateTime?
}

enum InvoiceStatus {
  DRAFT
  SENT
  PAID
  OVERDUE
  CANCELLED
}

model WorkspaceSocialRole {
  id          String   @id @default(cuid())
  workspaceId String
  userId      String
  grantedById String
  createdAt   DateTime @default(now())
  archivedAt  DateTime?
}
```

---

## CONFIRMED TECHNOLOGY STACK

| Layer | Technology | Notes |
|-------|-----------|-------|
| Backend | Node.js + Express + TypeScript | Existing — do not rewrite |
| Database | PostgreSQL via Prisma ORM | Existing — extend only |
| Cache | Redis ([`lib/redis.ts`](lib/redis.ts)) with in-memory fallback ([`lib/cache.ts`](lib/cache.ts)) | Sessions, feed caching, rate limiting |
| Location Cache | Redis GEO ([`lib/locationCache.ts`](lib/locationCache.ts)) | Provider proximity, Haversine debounce, batch DB flush |
| Message bus | NATS | Event-driven notifications — existing |
| Media storage | S3-compatible | MinIO in dev, AWS S3 in prod |
| Video processing | FFmpeg worker or Mux | Transcoding + thumbnail generation |
| Payments primary | Stripe Connect | Auto commission split |
| Payments secondary | PayPal Business, Square, Interac | Adapter pattern |
| Auth | JWT + refresh token rotation | Existing |
| PII detection | Regex + AI scan | Custom lib chatModeration.ts exists |
| Frontend | React 18 + Vite + TailwindCSS + shadcn/ui | New — in /frontend/ |
| State management | Zustand + TanStack Query | New frontend |
| Mobile | Flutter | Existing — extend |
| CI/CD | GitHub Actions | New — see AGENTS.md |
| Quality gate | SonarCloud | Coverage 70% minimum, 0 blockers |
| Containerization | Docker + Docker Compose | Existing — update |
| Reverse proxy | Traefik | Already in /infra/traefik/ |

## UI Verification Protocol

All UI features documented in this specification **MUST** be verified with Playwright screenshot tests against the real frontend URL before being marked as complete.

See [TESTING.md §7](docs/TESTING.md#7-playwright-verification) for the full 12-step verification checklist and [ROADMAP.md §7.1](docs/ROADMAP.md#71-ui-verification-protocol) for the mandatory PR checklist.

**Key rules:**
- Tests must open the real browser URL (e.g. `http://localhost:5173` or `http://localhost:9090`)
- Screenshots must be saved to `screenshots/` with descriptive filenames
- Both desktop and mobile (375×812) viewports must be tested
- Error states must be verified (invalid input, empty states, network errors)
- Console errors must be checked after every interaction
