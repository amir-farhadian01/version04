# G-003: Enterprise-ize Neighborly Prototype

> Created: 2026-08-07T05:02:32.769Z
> Total tasks: 20

---

## TASK 1: Fix Flutter compilation error — ImageCacheConfig.postMediaCacheWidth

T1.1: In flutter_project/lib/features/feed/widgets/post_card.dart:404, `ImageCacheConfig.postMediaCacheWidth` is undefined. Read post_card.dart to find the usage, then search for where ImageCacheConfig is defined. Fix by either adding the missing constant to ImageCacheConfig or importing the correct file. After fixing, run `flutter analyze` to verify compilation, then restart Flutter web server and verify with Playwright screenshot.

---

## TASK 2: Fix Admin Media API 403 Forbidden error

T1.2: Admin Media API returns 403 for admin user. Read routes/adminMedia.ts to understand the middleware chain. Check auth middleware and role check. The admin user (owner@neighborly.local) should have access. Fix the RBAC/permission issue.

---

## TASK 3: Fix React Router ErrorBoundary crashes (2 errors)

T1.3: React app shows 2x 'Error handled by React Router default ErrorBoundary: ErrorResponseImpl' errors. Investigate which routes cause crashes by checking the router config and data fetching patterns. Fix the root cause.

---

## TASK 4: Foundation: Audit Zod validation on all routes

T2.1: Read all route files in routes/ directory. Check that every POST/PUT/PATCH handler uses Zod schema validation. Document any routes missing validation.

---

## TASK 5: Foundation: Audit rate limiting coverage

T2.2: Check lib/rateLimiter.ts integration. Ensure all auth endpoints are rate-limited. Document gaps.

---

## TASK 6: Foundation: Eliminate console.log — enforce structured logging

T2.3: Search for any console.log statements in routes/ and lib/ (excluding test files). Replace with structured logging via lib/bus.ts.

---

## TASK 7: Foundation: Run full test suite and document coverage gaps

T2.4: Run vitest (backend + frontend). Document passing/failing tests and coverage gaps.

---

## TASK 8: Social Feed Backend: Post CRUD + Story CRUD + Feed endpoints

T3.1: Implement Post and Story CRUD API endpoints. Feed algorithm with location + interest filtering. Include content moderation integration.

---

## TASK 9: Social Feed Backend: Reactions, Comments, Follow, Moderation

T3.2: Add reactions (like), comments, follow/unfollow endpoints. Content moderation queue for admin.

---

## TASK 10: Social Feed Flutter: Feed UI, Post card, Stories row, Create post

T3.3: After T1.1 Flutter fix, implement Social Feed UI: Feed page, Post card with action bar, Stories row (horizontal scroll), Create post flow with category selection, Order CTA on business posts.

---

## TASK 11: Social Feed React: Feed page mirroring Flutter implementation

T3.4: Implement Social Feed in React frontend matching Flutter implementation.

---

## TASK 12: Social Feed Admin: Content moderation queue, Media audit

T3.5: Admin moderation queue for posts/stories. Media audit tab with flagging and bulk actions.

---

## TASK 13: Business Workspace Backend: CRM, Invoice, Quote, Business Page API

T4.1: Implement CRM endpoints (customer management, history, notes). Invoice generation (PDF). Quote system (pre-order). Business Page public API.

---

## TASK 14: Business Workspace Backend: Staff identity + Service assignment

T4.2: Staff identity display (photo + name per service). Service-to-staff assignment. Parallel scheduling calculation.

---

## TASK 15: Business Workspace Flutter: Workspace tabs completion

T4.3: Complete Flutter Business Workspace UI: CRM tab, Finance tab with transactions, Social media manager, Staff management.

---

## TASK 16: Admin: Fix Media audit, Utility links CRUD, Home Content Management

T5: After T1.2 fix (media 403), complete Media audit tab. Implement Utility links CRUD with analytics. Home Content Management (news, weather API config).

---

## TASK 17: Enterprise Polish: CI/CD pipeline audit

T6.1: Verify GitHub Actions workflow: lint, typecheck, test, sonar, build. Fix any broken gates.

---

## TASK 18: Enterprise Polish: Security scan

T6.2: Audit all new endpoints for SQL injection, XSS, CSRF, JWT tampering, IDOR. Fix findings.

---

## TASK 19: Enterprise Polish: Performance + Accessibility + Final Playwright

T6.3-6.5: API performance audit. Accessibility audit (axe-core). Full Playwright verification on all surfaces (5173, 9090, 7357).

---

## TASK 20: Enterprise Polish: Update all documentation

T6.6: Update ROADMAP.md, FEATURES.md, DECISIONS.md, AGENTS.md with new feature statuses. Log lessons learned.

---

