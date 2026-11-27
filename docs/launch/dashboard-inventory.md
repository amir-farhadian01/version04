# Web Dashboard Launch Inventory

This inventory is the launch checklist for the web Client, Business workspace, and separate Admin SPA. A route is not launch-verified until its critical controls, role gate, loading/empty/error behavior, console, and network behavior have passed against the staging backend.

## User dashboard

| Routes | Critical controls and states | Current evidence |
| --- | --- | --- |
| `/`, `/home`, `/home/news/:id` | Search, weather/alerts, news and utility links, article navigation; loading/empty/API failure | Production build passes; public render smoke only |
| `/explore`, `/social`, `/explorer`, `/explorer/general`, `/explorer/business`, `/post/:id` | Feed filters, business/general discovery, post actions and detail navigation | Existing social/explorer Playwright coverage; staging data not verified |
| `/services/:id`, `/biz/:id`, `/biz-profile` | Service/business detail, tabs, reviews and order entry | Business page unit coverage and 7/7 Chromium render/error-state smoke |
| `/auth`, `/auth/login` | Email/phone authentication, validation, retry and session errors | Auth-flow specs exist; user changes preserved; live auth not verified |
| `/order/new`, `/orders/:id` | Category, details, location, review/submit, order details | Order wizard/customer flow specs exist; backend-connected run pending |
| `/app/home`, `/app/orders`, `/app/orders/:id`, `/app/services` | Auth gate, orders, progress/status, services and messages tabs | Dashboard unit coverage passes; authenticated E2E pending |
| `/app/social`, `/app/activity`, `/app/profile`, `/activity`, `/profile`, `/profile/posts`, `/profile/upgrade` | Auth gate, activity, profile editing/posts and business upgrade | Route inventory complete; authenticated E2E pending |

## Business dashboard

All routes require an allowed provider/workspace role and use `/business/:workspaceId` as their base.

| Routes | Critical controls and states | Current evidence |
| --- | --- | --- |
| Index and `/dashboard` compatibility route | Workspace selection, KPI cards, orders and operational actions | Layout unit coverage passes; live workspace pending |
| `staff`, `calendar` | Staff add/edit/remove, availability and schedule management | Routes inventoried; authenticated E2E pending |
| `clients`, `clients/:customerId` | Customer search/list, detail history and actions | Routes inventoried; authenticated E2E pending |
| `finance`, `invoices` | Financial summaries, invoice list/detail and payment states | Routes inventoried; authenticated E2E pending |
| `social`, `messages` | Social publishing/moderation and order conversations | Existing Playwright specs; backend-connected run pending |
| `services`, `packages`, `inventory` | Catalog CRUD, package configuration and inventory controls | Routes inventoried; backend-connected run pending |
| `onboarding` | Multi-step workspace onboarding, validation and completion | Provider onboarding spec exists; credentialed run pending |

## Admin dashboard

The Admin SPA is separate from the Client SPA. `/login` is public; all routes below `/admin` require an Admin token.

| Routes | Critical controls and states | Current evidence |
| --- | --- | --- |
| `/login`, `/admin` | Email/password login, logout, KPI/loading/error states | Login, desktop/mobile, theme and console smoke pass |
| `/admin/users`, `/admin/users/:id` | Search/filter, user detail, role/status and enforcement actions | Route and controls inventoried; credentialed API run pending |
| `/admin/kyc` | Review queue, evidence view, approve/reject actions | KYC Playwright spec exists; credentialed run pending |
| `/admin/orders`, `/admin/contracts`, `/admin/payments` | Search/filter, detail/status, contracts and payment operations | Routes inventoried; credentialed API run pending |
| `/admin/media` | Media listing, review and removal actions | Route inventoried; credentialed API run pending |
| `/admin/home-content`, `/admin/content-moderation` | News/alerts/utility-link CRUD and content review actions | Routes inventoried; credentialed API run pending |
| `/admin/moderation` | Report queues and moderation actions | Moderation Playwright spec exists; credentialed run pending |
| `/admin/analytics` | KPI, charts, filters and empty/error states | Route inventoried; credentialed API run pending |
| `/admin/settings` | Settings load/edit/save and validation | Route inventoried; credentialed API run pending |
| `/admin/services/:catalogId/form-builder` | Dynamic field add/edit/order/save and validation | Route inventoried; credentialed API run pending |

## Protected-scope blockers

- The Client production entry chunk is 736.39 kB (195.99 kB gzip). Route-level splitting requires changes under protected `frontend/src` and was not attempted.
- Client lint has zero errors and 46 warnings, all under protected `frontend/src`; these require explicit scope authorization.
- Full PASS still requires seeded staging services and controlled User, Business, and Admin credentials. Render-only smoke results do not prove API journeys.
