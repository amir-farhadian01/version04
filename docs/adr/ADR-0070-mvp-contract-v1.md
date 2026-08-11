# ADR-0070: MVP Contract v1.0 — First Launchable User Journey

- **Status:** proposed
- **Date:** 2026-08-11 (final correction)
- **Context:** Neighborly needs a scoped MVP definition to validate the first launchable user journey end-to-end. The platform has extensive source-level capabilities but nothing verified at runtime. A previous draft used invented endpoints and claimed Stripe capture as a release blocker against project rules. This revision defines MVP v1 as ending at provider acceptance of a matched order. All start-job, complete, and payment lifecycle is deferred to MVP v1.1 pending a human-approved payment ADR. The repository contains Stripe SDK code (`lib/stripe.ts` imports the `stripe` npm package; `lib/stripeService.ts` — 594 lines — provides full Stripe integration) despite the `AGENTS.md` prohibition.
- **Decision:** Adopt the MVP Contract defined in `docs/permanent/mvp-contract-v1.md`. MVP v1 scope: Customer registers → browses services → creates draft → submits for matching → provider accepts invitation. Every endpoint is derived from actual `router.get/post/put` declarations with exact file:line references. Every UI route is derived from `frontend/src/app/router.tsx` and `frontend/admin/src/router.tsx`. Five tasks, each with exactly one owner team. MVP v1.1 (start-job, complete, payment) is gated on a human-approved payment ADR.
- **Alternatives considered:**
  1. **Include start-job + complete in MVP v1:** Rejected — requires payment infrastructure that depends on Stripe SDK code whose architectural status is unresolved.
  2. **Claim Stripe is not installed / remove Stripe code:** Rejected — Stripe SDK exists in `lib/stripe.ts` and `lib/stripeService.ts`. The correct action is an explicit human decision, not code deletion.
  3. **API-only verification:** Rejected — violates Rule Zero (Playwright UI verification required).
  4. **Full-feature MVP with chat/social/Flutter:** Rejected — too much surface area for first verification.

- **Consequences:**
  - ✅ Every endpoint and UI route maps to a specific file and line number
  - ✅ Every task has exactly one owner team
  - ✅ MVP v1 ends at a clearly defined state (provider accepted, contract created)
  - ✅ MVP v1.1 decision gate is explicit: requires human-approved payment ADR before start-job/complete/payment/stripe
  - ✅ No payment or Stripe claims in MVP v1 release criteria
  - ✅ 14 items explicitly excluded with target phases
  - ❌ Start-job, complete, and payment lifecycle are deferred
  - ❌ Stripe SDK architectural decision is deferred

- **Rollback strategy:** This is a scoping decision. If the MVP v1 boundary proves too narrow, expand to v1.1 after the payment ADR is approved. ADR status remains Proposed until review.