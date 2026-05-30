# Monetization Features (P2) — Implementation Plan

## Overview

This plan covers the **P2 monetization features** for Neighborly: Order CTA on posts, auto-appointment scheduling, Business Workspace CRM, quote generation, pipeline revenue view, and internal workspace roles.

---

## 1. Order CTA on Posts

### Current State
- [`Post`](prisma/schema.prisma:721) model has `serviceId` (nullable String) and `businessId` (nullable String) fields
- [`routes/posts.ts`](routes/posts.ts) creates posts with `serviceId` linking to [`ServiceCatalog`](prisma/schema.prisma:277)
- No mechanism to convert a post view into an order — posts are purely social content

### What Needs to Change

#### 1a. Prisma: Add `postId` to Order model
Add a nullable `postId` field on [`Order`](prisma/schema.prisma:428) to track which post triggered the order.

```prisma
// In model Order (after line 472)
postId     String?
post       Post?    @relation(fields: [postId], references: [id], onDelete: SetNull)
```

This creates a direct link: a customer sees a post → clicks "Order Now" → a draft order is created with `postId` set.

#### 1b. Backend: New endpoint `POST /api/posts/:id/order`
Add to [`routes/posts.ts`](routes/posts.ts):

- **Route:** `POST /api/posts/:id/order` (authenticated)
- **Logic:**
  1. Fetch post by `id`, verify it has a `serviceId` and `businessId`
  2. Verify the post's `businessId` corresponds to an active [`Company`](prisma/schema.prisma:231) with active [`ProviderServicePackage`](prisma/schema.prisma:307)s for that `serviceId`
  3. Create a draft [`Order`](prisma/schema.prisma:428) with:
     - `customerId` = requesting user
     - `serviceCatalogId` = post's `serviceId`
     - `entryPoint` = `direct`
     - `postId` = post's `id`
     - Pre-fill `description` from post's `caption` (if present)
  4. Return the draft order (reuse [`orderToCustomerJson`](routes/orders.ts:148))
- **Response shape:** Same as `POST /api/orders/draft`

#### 1c. Backend: Include `serviceId` and `businessId` in post GET responses
Modify [`GET /api/posts`](routes/posts.ts:8) and [`GET /api/posts/:id`](routes/posts.ts:40) to include `serviceId`, `businessId`, and a new computed field `orderable: boolean` indicating whether the post can be ordered from (has active packages).

#### 1d. Frontend (React): "Order Now" button on PostCard
In the React client SPA ([`frontend/src/`](frontend/src/)):

- Add an "Order Now" button to [`PostCard`](frontend/src/) component (or equivalent)
- Button visible only when `post.serviceId` is set and `post.orderable === true`
- On click: call `POST /api/posts/:id/order` → navigate to order draft page (`/orders/draft/:id`)
- If user is not logged in, redirect to login first

#### 1e. Frontend (React): Post detail page enhancement
On the post detail page, add a service info card showing:
- Service name (from `ServiceCatalog`)
- Link to business profile page
- "Order Now" CTA button

#### 1f. Flutter: "Order Now" button on Post widget
In [`flutter_project/`](flutter_project/):

- Add "Order Now" button to the post widget in [`home_screen.dart`](flutter_project/lib/screens/home_screen.dart) or [`social_screen.dart`](flutter_project/lib/screens/social_screen.dart)
- Same logic: visible when `post.serviceId` and `post.orderable` are true
- On tap: call API → navigate to order flow

---

## 2. Auto-Appointment Scheduling

### Current State
- [`Schedule`](prisma/schema.prisma:691) model exists with `companyId`, `staffId`, `startTime`, `endTime`, `status`, `isActive`
- [`routes/schedules.ts`](routes/schedules.ts) provides CRUD for schedules
- [`Order`](prisma/schema.prisma:428) has `scheduledAt`, `scheduleFlexibility` fields
- [`ProviderServicePackage`](prisma/schema.prisma:307) has `bookingMode` (enum: `auto_appointment`, `negotiation`, `inherit_from_catalog`), `durationMinutes`, `breakTimeMinutes`
- [`PackageStaffAssignment`](prisma/schema.prisma:340) links packages to staff members
- No auto-slot calculation or appointment booking logic exists yet

### What Needs to Change

#### 2a. Backend: New library `lib/slotCalculator.ts`
Create a new library that calculates available time slots for a given workspace/package:

```typescript
// lib/slotCalculator.ts
export interface TimeSlot {
  startTime: Date;
  endTime: Date;
  staffId: string;
  staffName: string;
}

export async function calculateAvailableSlots(
  workspaceId: string,
  packageId: string,
  date: Date, // the day to check
): Promise<TimeSlot[]>
```

**Logic:**
1. Fetch the [`ProviderServicePackage`](prisma/schema.prisma:307) with `durationMinutes` and `breakTimeMinutes`
2. Fetch [`PackageStaffAssignment`](prisma/schema.prisma:340) entries for this package to get eligible staff
3. Fetch [`Schedule`](prisma/schema.prisma:691) entries for each staff member on the given date (their working hours)
4. Fetch existing [`Order`](prisma/schema.prisma:428) records for this workspace that have `scheduledAt` on the given date and status `in` (`contracted`, `paid`, `in_progress`) — these block slots
5. Calculate free intervals by subtracting booked slots from working hours
6. Return array of available `TimeSlot` objects

#### 2b. Backend: New endpoint `GET /api/schedules/:workspaceId/slots`
Add to [`routes/schedules.ts`](routes/schedules.ts):

- **Route:** `GET /api/schedules/:workspaceId/slots?packageId=X&date=YYYY-MM-DD`
- **Logic:** Call [`calculateAvailableSlots`](plans/monetization-plan.md) and return results
- **Access:** Public (for customers browsing), but full detail for workspace members

#### 2c. Backend: New endpoint `POST /api/orders/:orderId/schedule`
Add to [`routes/orders.ts`](routes/orders.ts):

- **Route:** `POST /api/orders/:orderId/schedule` (authenticated, customer or workspace member)
- **Body:** `{ staffId: string, scheduledAt: string }`
- **Logic:**
  1. Verify order exists and is in `matched`, `contracted`, or `paid` status
  2. Verify the selected staff member is assigned to the matched package
  3. Verify the slot is available (call slot calculator to confirm)
  4. Update order's `scheduledAt` and `assignedStaffId`
  5. Create a [`JobRecord`](prisma/schema.prisma:479) if not exists, set `scheduledStartAt`
  6. Return updated order

#### 2d. Backend: Auto-schedule on match (optional enhancement)
When an order is auto-matched (in [`runSubmitDraftOrderFlow`](routes/orders.ts:247)), if the matched package has `bookingMode === auto_appointment`:
- Automatically calculate the first available slot
- Suggest it to the customer via the order response
- Customer can confirm or pick a different slot

#### 2e. Frontend (React): Slot picker UI
In the order flow / order detail page:

- When order is matched and package has `bookingMode === auto_appointment`, show a date picker + time slot grid
- Fetch available slots from `GET /api/schedules/:workspaceId/slots`
- Display slots as a scrollable time grid, grouped by staff member
- On slot selection, call `POST /api/orders/:orderId/schedule`
- Show confirmation with staff name and time

#### 2f. Flutter: Slot picker UI
Mirror the React slot picker in Flutter:
- Date picker + time slot grid
- API calls to same endpoints
- Confirmation screen

---

## 3. Business Workspace / CRM

### Current State
- [`BusinessDashboard.tsx`](frontend/src/pages/business/BusinessDashboard.tsx) exists with **hardcoded mock data** — stats, appointments, orders, staff, menu
- [`dashboard_screen.dart`](flutter_project/lib/screens/dashboard_screen.dart) mirrors the React version with hardcoded data
- [`routes/staff.ts`](routes/staff.ts) provides staff listing and management
- [`routes/schedules.ts`](routes/schedules.ts) provides schedule CRUD
- [`lib/buildProviderWorkspaceFinance.ts`](lib/buildProviderWorkspaceFinance.ts) provides finance calculations
- Menu items in the dashboard sidebar include: "My Clients", "Offers, Orders & Jobs", "Invoices", "Users & Roles", "Calendar & Appointments"

### What Needs to Change

#### 3a. Backend: New endpoint `GET /api/workspace/:workspaceId/crm/customers`
Add a new route file [`routes/workspaceCrm.ts`](routes/workspaceCrm.ts):

- **Route:** `GET /api/workspace/:workspaceId/crm/customers` (authenticated, workspace member)
- **Logic:**
  1. Find all distinct customers who have orders with this workspace
  2. For each customer, aggregate:
     - Total orders count
     - Total revenue (sum of contract amounts)
     - Last order date
     - Order status breakdown (completed, pending, cancelled)
     - Customer info (name, avatar, email, phone)
  3. Support pagination and search (by customer name)
- **Response:** `{ customers: CustomerRow[], total: number, page: number }`

#### 3b. Backend: New endpoint `GET /api/workspace/:workspaceId/crm/customers/:customerId`
- **Route:** `GET /api/workspace/:workspaceId/crm/customers/:customerId` (authenticated, workspace member)
- **Logic:**
  1. Fetch all orders for this customer + workspace combination
  2. Include order details: service, package, amount, status, dates, contract info
  3. Include customer profile info
  4. Include any internal notes (see 3c)
- **Response:** `{ customer: CustomerProfile, orders: OrderSummary[], notes: Note[] }`

#### 3c. Backend: New model `WorkspaceCustomerNote`
Add to [`prisma/schema.prisma`](prisma/schema.prisma):

```prisma
model WorkspaceCustomerNote {
  id          String   @id @default(cuid())
  workspaceId String
  workspace   Company  @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  customerId  String
  customer    User     @relation(fields: [customerId], references: [id], onDelete: Cascade)
  authorId    String
  author      User     @relation(fields: [authorId], references: [id])
  content     String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  archivedAt  DateTime?

  @@index([workspaceId, customerId])
  @@index([workspaceId])
}
```

#### 3d. Backend: CRM notes CRUD
Add to [`routes/workspaceCrm.ts`](routes/workspaceCrm.ts):

- `POST /api/workspace/:workspaceId/crm/customers/:customerId/notes` — create note
- `GET /api/workspace/:workspaceId/crm/customers/:customerId/notes` — list notes
- `PUT /api/workspace/:workspaceId/crm/notes/:noteId` — update note
- `DELETE /api/workspace/:workspaceId/crm/notes/:noteId` — soft-delete note

#### 3e. Backend: Dashboard stats endpoint (replace hardcoded data)
Add to [`routes/workspaceCrm.ts`](routes/workspaceCrm.ts) or a new [`routes/workspaceDashboard.ts`](routes/workspaceDashboard.ts):

- **Route:** `GET /api/workspace/:workspaceId/dashboard` (authenticated, workspace member)
- **Logic:**
  1. Count today's appointments (orders with `scheduledAt` = today, status in `contracted`/`paid`/`in_progress`)
  2. Count pending requests (orders with status `submitted`/`matching`/`matched`)
  3. Calculate revenue this week (sum of contract amounts for orders with `paidAt` this week)
  4. Calculate average rating from `OrderReview`
  5. Fetch upcoming appointments (next 5)
  6. Fetch recent offers/orders (last 5)
  7. Fetch staff with online/offline status
- **Response:** `{ stats: DashboardStats, appointments: Appointment[], orders: OrderSummary[], staff: StaffSummary[] }`

#### 3f. Frontend (React): Wire BusinessDashboard to live API
Replace all hardcoded data in [`BusinessDashboard.tsx`](frontend/src/pages/business/BusinessDashboard.tsx) with API calls:

- On mount, fetch `GET /api/workspace/:workspaceId/dashboard`
- Replace `STATS`, `APPOINTMENTS`, `ORDERS`, `STAFF` constants with state from API
- Add loading skeletons and error states
- Keep the menu sidebar structure but wire menu items to routes

#### 3g. Frontend (React): New CRM pages
Create new pages under [`frontend/src/pages/business/`](frontend/src/pages/business/):

- **`Clients.tsx`** — Customer list with search, sort by name/revenue/orders/last order
  - Columns: Name, Email, Total Orders, Total Revenue, Last Order, Actions
  - Click row → navigate to client detail
- **`ClientDetail.tsx`** — Single customer view
  - Customer info card
  - Order history table (service, amount, status, date)
  - Notes section (create, edit, delete notes)
  - Revenue summary

#### 3h. Flutter: Wire dashboard to live API
Replace hardcoded data in [`dashboard_screen.dart`](flutter_project/lib/screens/dashboard_screen.dart) with API calls to the same endpoints.

#### 3i. Flutter: New CRM screens
Create new screens under [`flutter_project/lib/screens/`](flutter_project/lib/screens/):

- **`clients_screen.dart`** — Customer list
- **`client_detail_screen.dart`** — Single customer view with orders and notes

---

## 4. Quote Generation and Sending

### Current State
- [`OrderContract`](prisma/schema.prisma:565) and [`ContractVersion`](prisma/schema.prisma:579) models exist
- [`lib/contractDraft.ts`](lib/contractDraft.ts) generates contract drafts via Gemini AI
- [`routes/orderContracts.ts`](routes/orderContracts.ts) provides contract management endpoints
- No "quote" concept exists — contracts are the binding agreement
- Quotes are needed as a **pre-contract** step: a provider sends a quote before the customer commits to a contract

### What Needs to Change

#### 4a. Prisma: Add `Quote` model
Add a new model for pre-contract quotes:

```prisma
enum QuoteStatus {
  draft
  sent
  accepted
  rejected
  expired
  superseded
}

model Quote {
  id              String       @id @default(cuid())
  orderId         String
  order           Order        @relation(fields: [orderId], references: [id], onDelete: Cascade)
  workspaceId     String
  workspace       Company      @relation(fields: [workspaceId], references: [id])
  createdById     String
  createdBy       User         @relation(fields: [createdById], references: [id])
  versionNumber   Int          @default(1)
  status          QuoteStatus  @default(draft)
  title           String
  description     String?
  lineItems       Json         // [{ description, quantity, unitPrice, total }]
  subtotal        Float
  tax             Float        @default(0)
  total           Float
  currency        String       @default("CAD")
  validUntil      DateTime?
  notes           String?
  customerMessage String?
  sentAt          DateTime?
  respondedAt     DateTime?
  rejectionReason String?
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  @@index([orderId])
  @@index([workspaceId, status])
}
```

#### 4b. Backend: New route file `routes/quotes.ts`
Create a new route file with:

- **`GET /api/orders/:orderId/quotes`** — List quotes for an order (customer + workspace members)
- **`POST /api/orders/:orderId/quotes`** — Create a new quote (workspace member only)
  - Body: `{ title, description, lineItems, subtotal, tax, total, currency, validUntil, notes, customerMessage }`
  - Creates quote with status `draft`
- **`GET /api/quotes/:quoteId`** — Get single quote detail
- **`PUT /api/quotes/:quoteId`** — Update draft quote
- **`POST /api/quotes/:quoteId/send`** — Send quote to customer (status → `sent`, set `sentAt`)
  - Publishes event `quotes.sent` via bus
- **`POST /api/quotes/:quoteId/accept`** — Customer accepts quote (status → `accepted`)
  - Auto-creates a [`ContractVersion`](prisma/schema.prisma:579) from the quote data
  - Sets contract status to `sent`
- **`POST /api/quotes/:quoteId/reject`** — Customer rejects quote (status → `rejected`)
  - Body: `{ reason?: string }`

#### 4c. Backend: Quote → Contract conversion logic
In [`routes/quotes.ts`](routes/quotes.ts) or a new [`lib/quoteToContract.ts`](lib/quoteToContract.ts):

```typescript
export async function convertQuoteToContract(quoteId: string): Promise<ContractVersion>
```

**Logic:**
1. Fetch quote with order
2. Create [`OrderContract`](prisma/schema.prisma:565) if not exists
3. Create [`ContractVersion`](prisma/schema.prisma:579) with:
   - `title` = quote title
   - `amount` = quote total
   - `currency` = quote currency
   - `termsMarkdown` = generated from quote line items + description
   - `status` = `sent`
4. Set as current version
5. Create [`ContractEvent`](prisma/schema.prisma:611) with `actionType = provider_sent`

#### 4d. Frontend (React): Quote UI
- **Quote list** in order detail page — show all quotes for an order
- **Create quote form** — workspace member fills in line items, totals auto-calculate
- **Quote detail view** — shows full quote breakdown, send/accept/reject buttons based on role
- **Customer view** — customer sees sent quotes, can accept or reject with reason

#### 4e. Flutter: Quote UI
Mirror the React quote UI in Flutter:
- Quote list, create, detail, accept/reject screens

---

## 5. Pipeline Revenue View

### Current State
- [`lib/buildProviderWorkspaceFinance.ts`](lib/buildProviderWorkspaceFinance.ts) already calculates:
  - `estimatedEarnings` (completed + closed jobs)
  - `pendingAmount` (matched → in_progress pipeline)
  - `completedJobCount`, `disputedJobCount`
  - Ledger and invoice rows
- This is not yet displayed in any UI

### What Needs to Change

#### 5a. Backend: Enhance finance endpoint
The existing [`buildProviderWorkspaceFinance`](lib/buildProviderWorkspaceFinance.ts) function is solid. Add a new endpoint:

- **Route:** `GET /api/workspace/:workspaceId/finance` (authenticated, workspace member)
- **Response:** Return the full [`ProviderWorkspaceFinancePayload`](lib/buildProviderWorkspaceFinance.ts:67)

Add pipeline breakdown to the summary:

```typescript
pipeline: {
  draft: { count: number; amount: number };
  submitted: { count: number; amount: number };
  matching: { count: number; amount: number };
  matched: { count: number; amount: number };
  contracted: { count: number; amount: number };
  paid: { count: number; amount: number };
  in_progress: { count: number; amount: number };
  completed: { count: number; amount: number };
  disputed: { count: number; amount: number };
  closed: { count: number; amount: number };
}
```

#### 5b. Frontend (React): Pipeline revenue chart
Add a pipeline revenue section to the Business Dashboard or a new "Finance" page:

- **Pipeline bar** — horizontal stacked bar showing revenue by stage:
  - Draft (gray), Submitted (blue), Matching (yellow), Matched (green), Contracted (teal), Paid (purple), In Progress (orange), Completed (emerald), Disputed (red)
- **Summary cards** — Total Pipeline Value, Completed Revenue, Pending Revenue
- **Revenue trend** — weekly/monthly revenue chart (using data from ledger)
- **Invoice list** — table of invoices with status, amount, customer, date

#### 5c. Flutter: Pipeline revenue view
Mirror the pipeline revenue UI in Flutter:
- Pipeline bar chart
- Summary cards
- Invoice list

---

## 6. Internal Workspace Roles

### Current State
- [`StaffRole`](prisma/schema.prisma:22) enum exists: `handyman`, `finance`, `adv`, `career`, `task_manager`, `internal_manager`, `hr`
- [`CompanyUser`](prisma/schema.prisma:266) has `role` (string: owner/admin/member/staff) and `staffRole` (StaffRole?)
- [`routes/staff.ts`](routes/staff.ts) provides staff CRUD with role assignment
- No role-based access control (RBAC) within workspaces exists beyond basic membership checks

### What Needs to Change

#### 6a. Backend: Workspace role definitions
Define workspace-level roles and their permissions in a new [`lib/workspaceRoles.ts`](lib/workspaceRoles.ts):

```typescript
export type WorkspaceRole = 'owner' | 'admin' | 'hr' | 'accountant' | 'social_manager' | 'worker';

export interface RolePermissions {
  canManageStaff: boolean;
  canViewFinance: boolean;
  canManageOrders: boolean;
  canManageServices: boolean;
  canManagePosts: boolean;
  canManageSchedule: boolean;
  canViewCRM: boolean;
  canManageSettings: boolean;
}

export const ROLE_PERMISSIONS: Record<WorkspaceRole, RolePermissions> = {
  owner:           { canManageStaff: true, canViewFinance: true, canManageOrders: true, canManageServices: true, canManagePosts: true, canManageSchedule: true, canViewCRM: true, canManageSettings: true },
  admin:           { canManageStaff: true, canViewFinance: true, canManageOrders: true, canManageServices: true, canManagePosts: true, canManageSchedule: true, canViewCRM: true, canManageSettings: true },
  hr:              { canManageStaff: true, canViewFinance: false, canManageOrders: false, canManageServices: false, canManagePosts: false, canManageSchedule: true, canViewCRM: true, canManageSettings: false },
  accountant:      { canManageStaff: false, canViewFinance: true, canManageOrders: true, canManageServices: false, canManagePosts: false, canManageSchedule: false, canViewCRM: false, canManageSettings: false },
  social_manager:  { canManageStaff: false, canViewFinance: false, canManageOrders: false, canManageServices: false, canManagePosts: true, canManageSchedule: false, canViewCRM: false, canManageSettings: false },
  worker:          { canManageStaff: false, canViewFinance: false, canManageOrders: true, canManageServices: false, canManagePosts: false, canManageSchedule: true, canViewCRM: false, canManageSettings: false },
};
```

#### 6b. Backend: Role-based access middleware
Create [`lib/workspaceRoleMiddleware.ts`](lib/workspaceRoleMiddleware.ts):

```typescript
export function requireWorkspacePermission(permission: keyof RolePermissions) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    // 1. Extract workspaceId from params
    // 2. Look up user's CompanyUser record
    // 3. Map their role to permissions
    // 4. If permission denied, return 403
    // 5. Otherwise, next()
  };
}
```

#### 6c. Backend: Update staff invite to use new roles
Modify [`POST /api/staff/:workspaceId/invite`](routes/staff.ts:120) to accept the new role types:
- `role` field accepts: `'owner' | 'admin' | 'hr' | 'accountant' | 'social_manager' | 'worker'`
- Map `staffRole` accordingly

#### 6d. Backend: Apply role middleware to workspace endpoints
Apply the permission middleware to existing routes:

| Route | Required Permission |
|---|---|
| [`GET /api/staff/:workspaceId`](routes/staff.ts:40) | `canManageStaff` |
| [`POST /api/staff/:workspaceId/invite`](routes/staff.ts:120) | `canManageStaff` |
| [`PUT /api/staff/:workspaceId/:userId`](routes/staff.ts:173) | `canManageStaff` |
| [`GET /api/schedules/:workspaceId`](routes/schedules.ts:39) | `canManageSchedule` |
| [`POST /api/schedules/:workspaceId`](routes/schedules.ts:85) | `canManageSchedule` |
| [`GET /api/workspace/:workspaceId/finance`](plans/monetization-plan.md) | `canViewFinance` |
| [`GET /api/workspace/:workspaceId/crm/*`](plans/monetization-plan.md) | `canViewCRM` |
| Post creation/management | `canManagePosts` |

#### 6e. Frontend (React): Role-based UI
- In the dashboard sidebar, show/hide menu items based on user's workspace role
- On CRM, Finance, Staff pages, show/hide action buttons based on permissions
- Add a "Roles & Permissions" page under "Users & Roles" showing the permission matrix

#### 6f. Flutter: Role-based UI
Mirror the role-based UI logic in Flutter:
- Conditional menu items
- Conditional action buttons

---

## File-by-File Change List

### Prisma Schema
| File | Change |
|---|---|
| [`prisma/schema.prisma`](prisma/schema.prisma) | Add `postId` field to `Order` model |
| [`prisma/schema.prisma`](prisma/schema.prisma) | Add `Quote` model + `QuoteStatus` enum |
| [`prisma/schema.prisma`](prisma/schema.prisma) | Add `WorkspaceCustomerNote` model |

### Backend — New Files
| File | Purpose |
|---|---|
| [`routes/quotes.ts`](routes/quotes.ts) | Quote CRUD + send/accept/reject endpoints |
| [`routes/workspaceCrm.ts`](routes/workspaceCrm.ts) | CRM customer list, detail, notes endpoints |
| [`routes/workspaceDashboard.ts`](routes/workspaceDashboard.ts) | Dashboard stats endpoint |
| [`lib/slotCalculator.ts`](lib/slotCalculator.ts) | Available time slot calculation |
| [`lib/quoteToContract.ts`](lib/quoteToContract.ts) | Quote → ContractVersion conversion |
| [`lib/workspaceRoles.ts`](lib/workspaceRoles.ts) | Role definitions and permission matrix |
| [`lib/workspaceRoleMiddleware.ts`](lib/workspaceRoleMiddleware.ts) | Role-based access middleware |

### Backend — Modified Files
| File | Change |
|---|---|
| [`routes/posts.ts`](routes/posts.ts) | Add `POST /api/posts/:id/order` endpoint; include `serviceId`, `businessId`, `orderable` in GET responses |
| [`routes/orders.ts`](routes/orders.ts) | Add `POST /api/orders/:orderId/schedule` endpoint; handle `postId` in draft creation |
| [`routes/schedules.ts`](routes/schedules.ts) | Add `GET /api/schedules/:workspaceId/slots` endpoint |
| [`routes/staff.ts`](routes/staff.ts) | Update role handling for new workspace roles |
| [`lib/buildProviderWorkspaceFinance.ts`](lib/buildProviderWorkspaceFinance.ts) | Add pipeline breakdown to finance payload |
| [`server.ts`](server.ts) | Mount new route files (`quotes`, `workspaceCrm`, `workspaceDashboard`) |

### Frontend (React) — New Files
| File | Purpose |
|---|---|
| [`frontend/src/pages/business/Clients.tsx`](frontend/src/pages/business/Clients.tsx) | CRM customer list page |
| [`frontend/src/pages/business/ClientDetail.tsx`](frontend/src/pages/business/ClientDetail.tsx) | CRM customer detail page |
| [`frontend/src/pages/business/Finance.tsx`](frontend/src/pages/business/Finance.tsx) | Pipeline revenue + finance page |
| [`frontend/src/pages/business/Quotes.tsx`](frontend/src/pages/business/Quotes.tsx) | Quote list for an order |
| [`frontend/src/pages/business/QuoteDetail.tsx`](frontend/src/pages/business/QuoteDetail.tsx) | Quote create/edit/detail page |
| [`frontend/src/pages/business/Roles.tsx`](frontend/src/pages/business/Roles.tsx) | Role management page |

### Frontend (React) — Modified Files
| File | Change |
|---|---|
| [`frontend/src/pages/business/BusinessDashboard.tsx`](frontend/src/pages/business/BusinessDashboard.tsx) | Replace hardcoded data with API calls; wire menu items to routes |
| [`frontend/src/components/PostCard.tsx`](frontend/src/components/PostCard.tsx) | Add "Order Now" button when `serviceId` and `orderable` are set |
| [`frontend/src/app/router.tsx`](frontend/src/app/router.tsx) | Add routes for new business pages |

### Flutter — New Files
| File | Purpose |
|---|---|
| [`flutter_project/lib/screens/clients_screen.dart`](flutter_project/lib/screens/clients_screen.dart) | CRM customer list |
| [`flutter_project/lib/screens/client_detail_screen.dart`](flutter_project/lib/screens/client_detail_screen.dart) | CRM customer detail |
| [`flutter_project/lib/screens/finance_screen.dart`](flutter_project/lib/screens/finance_screen.dart) | Pipeline revenue view |
| [`flutter_project/lib/screens/quotes_screen.dart`](flutter_project/lib/screens/quotes_screen.dart) | Quote list + detail |
| [`flutter_project/lib/screens/roles_screen.dart`](flutter_project/lib/screens/roles_screen.dart) | Role management |

### Flutter — Modified Files
| File | Change |
|---|---|
| [`flutter_project/lib/screens/dashboard_screen.dart`](flutter_project/lib/screens/dashboard_screen.dart) | Replace hardcoded data with API calls |
| [`flutter_project/lib/screens/home_screen.dart`](flutter_project/lib/screens/home_screen.dart) | Add "Order Now" button on posts |
| [`flutter_project/lib/screens/social_screen.dart`](flutter_project/lib/screens/social_screen.dart) | Add "Order Now" button on posts |

---

## Implementation Order

The work should be done in this sequence to minimize dependencies:

```
Phase 1: Foundation (Backend)
├── 1. Prisma migrations (postId on Order, Quote model, WorkspaceCustomerNote)
├── 2. lib/workspaceRoles.ts + lib/workspaceRoleMiddleware.ts
├── 3. Update routes/staff.ts for new roles
├── 4. lib/slotCalculator.ts
├── 5. Add slots endpoint to routes/schedules.ts
├── 6. Add schedule endpoint to routes/orders.ts

Phase 2: Order CTA
├── 7. Add POST /api/posts/:id/order to routes/posts.ts
├── 8. Update post GET responses with orderable flag
├── 9. Frontend: "Order Now" button on PostCard
├── 10. Flutter: "Order Now" button on post widgets

Phase 3: Quotes
├── 11. routes/quotes.ts (CRUD + send/accept/reject)
├── 12. lib/quoteToContract.ts
├── 13. Frontend: Quote pages
├── 14. Flutter: Quote screens

Phase 4: CRM
├── 15. routes/workspaceCrm.ts (customers, notes)
├── 16. routes/workspaceDashboard.ts (dashboard stats)
├── 17. Frontend: Clients.tsx, ClientDetail.tsx
├── 18. Flutter: clients_screen.dart, client_detail_screen.dart

Phase 5: Pipeline Revenue
├── 19. Enhance lib/buildProviderWorkspaceFinance.ts with pipeline breakdown
├── 20. Add GET /api/workspace/:workspaceId/finance endpoint
├── 21. Frontend: Finance.tsx
├── 22. Flutter: finance_screen.dart

Phase 6: Wire Up Dashboards
├── 23. Frontend: Replace hardcoded BusinessDashboard data with API
├── 24. Flutter: Replace hardcoded dashboard data with API
├── 25. Apply role middleware to all workspace endpoints
├── 26. Role-based UI hiding in React + Flutter
```
