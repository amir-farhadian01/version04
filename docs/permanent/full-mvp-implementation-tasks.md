# Full MVP Implementation — All Remaining Tasks

> Created: 2026-08-11T17:57:09.991Z
> Total tasks: 29

---

## TASK 1: Cleanup: Update docs/AGENTS.md rule #6 — Stripe approved

Replace rule #6 in docs/AGENTS.md:
- Remove 'NO payment gateway SDK installed' prohibition
- Add: 'Stripe SDK APPROVED — CEO approved Stripe Connect as payment gateway on 2026-08-11. lib/stripe.ts and lib/stripeService.ts are active. All payment flows use Stripe Connect for automatic commission splitting.'
- Also update CURRENT PHASE section to reflect Full MVP status

---

## TASK 2: Cleanup: Update decision-history.md — Stripe approval + MVP scope change

Add 2 new entries to docs/memory/decision-history.md:
1. [2026-08-11] Stripe SDK Approved — CEO approved Stripe Connect as official payment gateway
2. [2026-08-11] MVP Scope Expanded — CEO decided full flow (registration→payment→execution), not just accept-invite

---

## TASK 3: Cleanup: Create ADR for Stripe approval

Create docs/adr/ADR-0079-stripe-approval.md:
- ADR-0079: Stripe Connect Approved as Payment Gateway
- Status: accepted
- Context: CEO approved on 2026-08-11
- Decision: Use existing lib/stripe.ts and lib/stripeService.ts
- Supersedes AGENTS.md rule #6

---

## TASK 4: Cleanup: Update ROADMAP.md — mark Phase 7 payments as done

In docs/ROADMAP.md, Phase 7 payments line should be marked ✅ since Stripe is approved and active. Also update the status legend date to 2026-08-11.

---

## TASK 5: Cleanup: Update goal-log.md — add G-004

Add G-004 to docs/memory/goal-log.md: 'Full MVP Implementation — All remaining phases (Social Feed, Business Workspace, Admin Content, Transport)' with status 'In Progress'

---

## TASK 6: Quick-Start Task 13: Complete Playwright UI verification for Flutter

Run Playwright against Flutter web (port 7357) to verify:
1. OAuth buttons render on auth screen
2. Onboarding wizard 3-step flow works
3. Stories row renders with gradient rings
4. Post card shows with double-tap like, comments, menu
5. Order detail screen shows Reorder button
6. New order screen shows commission breakdown
Save screenshots to screenshots/flutter-quickstart-*.png

---

## TASK 7: Quick-Start Task 14: Complete documentation updates

1. Update ROADMAP.md to mark quick-start as done
2. Update FEATURES.md if any specs changed
3. Verify all ADRs reference updated Stripe status
4. Update docs/memory/lessons-learned.md with quick-start insights

---

## TASK 8: Social Feed: Implement Post creation API endpoint

In routes/ — create or extend post creation endpoint:
- POST /api/posts — create post with media, caption, categoryId
- Zod validation: categoryId required (no uncategorized posts)
- Support photo and video uploads
- Return created post with { data: post }
Owner: backend

---

## TASK 9: Social Feed: Implement Feed API endpoint

In routes/ — create feed endpoint:
- GET /api/feed — returns personalized feed based on user interests + location
- Pagination support
- Filter by: category, distance, content type (posts/stories)
- Include like count, comment count, user info
Owner: backend

---

## TASK 10: Social Feed: Implement Follow/Unfollow API

In routes/ — create social endpoints:
- POST /api/social/follow/:userId
- POST /api/social/unfollow/:userId
- GET /api/social/followers
- GET /api/social/following
Owner: backend

---

## TASK 11: Social Feed: Implement Like/Comment API

In routes/ — create engagement endpoints:
- POST /api/posts/:id/like
- DELETE /api/posts/:id/like
- POST /api/posts/:id/comments
- GET /api/posts/:id/comments
Owner: backend

---

## TASK 12: Social Feed: Implement Stories API

In routes/ — create stories endpoints:
- POST /api/stories — create 24h story with media
- GET /api/stories/feed — active stories from followed + nearby
- DELETE /api/stories/:id
- Auto-expire after 24h (cron or TTL)
Owner: backend

---

## TASK 13: Social Feed: Build React PostCard component

In frontend/src/components/social/PostCard.tsx:
- Full post card with: avatar, username, time, caption, media (photo/video)
- Action bar: Like (with count), Comment (with count), Share, Save
- Double-tap to like
- Three-dot menu: Report, Block (and View Business Page for business posts)
- Order CTA button on business posts linked to a service
Max 200 lines. Use TailwindCSS.

---

## TASK 14: Social Feed: Build React FeedPage with personalized feed

In frontend/src/pages/social/FeedPage.tsx:
- Infinite scroll feed of PostCard components
- Stories row at top (horizontal scrollable circular avatars)
- Pull-to-refresh
- Filter tabs: Following, For You, Nearby
- TanStack Query for data fetching

---

## TASK 15: Social Feed: Build React StoryViewer component

In frontend/src/components/social/StoryViewer.tsx:
- Fullscreen story viewer (Instagram-style)
- Auto-advance every 5 seconds
- Tap left/right to navigate between stories
- Progress bar at top
- Swipe down to dismiss

---

## TASK 16: Social Feed: Build React HomeTab with weather & traffic

In frontend/src/pages/home/HomeTab.tsx:
- Neighbourhood banner (photo bg, weather, traffic alerts)
- Utility icons row (Banks, Insurance, Fuel, Government, Health, Transit)
- Large search box: 'Search services, businesses, skills near you...'
- Local news & events cards (horizontally swipeable)
- 3 sub-tabs: HOME, MY POSTS, PROFILE

---

## TASK 17: Social Feed: Build React ExplorerTab (General + Business)

In frontend/src/pages/explorer/ExplorerTab.tsx:
- Two sub-tabs: General, Business
- Stories row at top for each tab
- Post feed with business filter for Business tab
- Category, distance, rating, price filters
- Business card tap → Business Page

---

## TASK 18: Business Workspace: Implement CRM API (customer management)

In routes/ — create customer management endpoints:
- GET /api/workspace/:id/customers — list with filters
- GET /api/workspace/:id/customers/:customerId — detail with order history
- POST /api/workspace/:id/customers/:customerId/notes — add note
Owner: backend

---

## TASK 19: Business Workspace: Implement Invoice API

In routes/ — create invoice endpoints extending existing invoiceGenerator.ts:
- POST /api/workspace/:id/invoices — create invoice
- GET /api/workspace/:id/invoices — list invoices
- GET /api/invoices/:id/pdf — download PDF
- POST /api/invoices/:id/send — email invoice to customer
Owner: backend

---

## TASK 20: Business Workspace: Implement Staff Assignment API

In routes/ — create staff assignment endpoints:
- POST /api/workspace/:id/services/:serviceId/staff — assign staff to service
- DELETE /api/workspace/:id/services/:serviceId/staff/:userId
- GET /api/workspace/:id/services/:serviceId/staff
- GET /api/workspace/:id/staff/:userId/schedule — staff schedule/availability
Owner: backend

---

## TASK 21: Business Workspace: Build React CRM page

In frontend/src/pages/business/CRMPage.tsx:
- Customer list with search/filter
- Customer detail view: order history, notes, total spent
- Add note functionality
- Export customer list

---

## TASK 22: Business Workspace: Build React Invoicing page

In frontend/src/pages/business/InvoicingPage.tsx:
- Invoice list with status filters (Draft, Sent, Paid, Overdue, Cancelled)
- Create invoice form (line items, tax, due date)
- Download PDF button
- Send via email button

---

## TASK 23: Business Workspace: Build React Staff Scheduling page

In frontend/src/pages/business/StaffSchedulingPage.tsx:
- Staff list with current assignments
- Assign staff to services
- Calendar/availability view per staff member
- Parallel scheduling visualization

---

## TASK 24: Admin Content: Implement Utility Links API

In routes/admin.ts — add utility link endpoints:
- POST /admin/utility-links — create link
- GET /admin/utility-links — list with click stats
- PUT /admin/utility-links/:id
- DELETE /admin/utility-links/:id
- GET /admin/utility-links/analytics — click analytics
Owner: backend

---

## TASK 25: Admin Content: Implement Home Content API

In routes/adminHomeContent.ts — extend existing:
- POST /admin/home-content/news — create news article
- PUT /admin/home-content/news/:id
- DELETE /admin/home-content/news/:id
- GET /admin/home-content — all content blocks
- PUT /admin/home-content/priority — reorder blocks
Owner: backend

---

## TASK 26: Admin Content: Build React UtilityLinksManager page

In frontend/admin/src/pages/UtilityLinks.tsx:
- Table of all utility links with click stats
- Add/Edit link form
- Commission rate per link
- Category management

---

## TASK 27: Admin Content: Build React HomeContentManager page

In frontend/admin/src/pages/HomeContent.tsx:
- News article CRUD
- Media upload for articles
- Display priority drag-and-drop ordering
- Content scheduling (future publish date)
- External API configuration (weather, traffic)

---

## TASK 28: Final: Playwright verification of all surfaces

Run full Playwright verification per docs/AGENTS.md protocol:
1. React frontend (5173) — Feed, Home, Explorer
2. Admin panel (9090) — Utility Links, Home Content
3. Flutter web (7357) — Quick-start features
Take screenshots at each step. Verify no console errors. Test mobile viewport (375px).

---

## TASK 29: Final: Git commit and push all changes

1. git add -A
2. git commit -m 'feat: full MVP implementation — Stripe approved, docs updated, social feed, business workspace, admin content'
3. git push origin main

---

