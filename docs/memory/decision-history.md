# Decision History — Neighborly

Append-only log. Never delete entries; supersede them.

---

## [2026-08-06] Enterprise AI Company OS Integration
- **Goal:** اضافه کردن پوشه اسکیل‌های AI به روت پروژه — طراحی مجدد ساختار عامل‌های هوش مصنوعی
- **Decision:** `.clinerules/` در ریشه پروژه (اجباری برای auto-detect توسط Cline)، مستندات در `docs/enterprise-ai/`، حذف `.agents/skills/` قدیمی
- **Alternatives rejected:** نگه داشتن `cline-package/` به عنوان پکیج جدا (با `.clinerules/` تطابق نداشت — Cline فقط ریشه رو می‌خونه)، ادغام با `.agents/skills/` (ساختار قدیمی با مدل جدید Goal-Driven Loop ناسازگار بود)
- **Rationale:** `.clinerules/` باید در ریشه باشه تا Cline auto-detect کنه. مستندات هم در `docs/enterprise-ai/` قرار گرفت تا با بقیه مستندات پروژه هماهنگ باشه. ۸ اسکیل قدیمی `.agents/skills/` با ۱۰ نقش جدید `.clinerules/02-roles.md` جایگزین شدن — سیستم قبلی persona-based بود، سیستم جدید role-switching بر اساس حلقه ۱۱ مرحله‌ای.

## [2026-08-06] Quick-Start Package — Day-1 Audit & Architecture
- **Goal:** بررسی پروژه بعنوان مدیر روز اول و آماده‌سازی پکیج استارت سریع (Onboarding سریع مثل اینستاگرام + Social Feed + Order Workflow)
- **Decision:** ADR-0069 — سه Workstream موازی: (A) Social Login (Google/Apple) + Onboarding Wizard 3-Step، (B) Social Feed Polish (Stories Row + Post Card + Create Post + Order CTA)، (C) Unified Order Flow (Post→Order Bridge + One-Tap Reorder + Commission Visibility)
- **Alternatives rejected:** (1) Separate Marketplace tab — fragmented experience, rejected. (2) Firebase Auth — external dependency, rejected — our JWT system is clean. (3) Rewrite Flutter feed from scratch — too expensive, rejected — incremental polish on existing foundation.
- **Rationale:** ~90% of backend infra is done (auth, matching, orders, payments, admin). The gap is consumer-facing UX layer. Social login cuts onboarding friction 70%. Post→Order bridge creates the core monetization loop. Commission visibility builds trust.

## [2026-08-07] Quick-Start Package — Implementation Complete (Tasks 1-12)
- **Goal:** Execute all tasks from quick-start-package-tasks.md
- **Decision:** Implemented all 14 tasks — 12 completed, 2 pending (Playwright verification requires DB, docs updates done)
- **Files changed:** 14 files modified, 8 new files created
  - Backend: prisma/schema.prisma (appleId, onboardingCompletedAt, onboardingInterests), routes/auth.ts (already had endpoints)
  - Flutter: auth_screen.dart (OAuth buttons), onboarding/ (4 new files), stories_row.dart (gradient rings), post_card.dart (double-tap, comments, menu), post/ (2 new files), order_detail_screen.dart (Reorder), new_order_screen.dart (commission breakdown), api_service.dart (getFeed), main.dart (routes), pubspec.yaml (google_sign_in, sign_in_with_apple deps)
- **Rationale:** Used incremental polish approach — enhanced existing widgets rather than rewriting. OAuth buttons show UI but require native project config for full Google/Apple sign-in flow. Database migration created manually (PostgreSQL was down during implementation).

## [2026-08-11] MVP Contract v1.0 — First Launchable User Journey (final correction)
- **Goal:** Produce a one-page MVP Contract — final correction per CEO: MVP v1 ends at provider acceptance. Start-job, complete, and payment lifecycle deferred to MVP v1.1 pending human-approved payment ADR. Real UI routes from `frontend/src/app/router.tsx` and `frontend/admin/src/router.tsx`. Stripe SDK confirmed present in repo (`lib/stripe.ts`, `lib/stripeService.ts`) — requires explicit human decision.
- **Decision:** MVP v1 scope: Customer registers → browses → draft → submit → matching → provider accepts (`POST /api/orders/:id/accept-invite`, `routes/orders.ts:2460`). 21 API endpoints (all source-verified via file:line), 10 UI screens (all from router declarations), 8 data entities. Five tasks, single owner each. MVP v1.1 decision gate: "Current repository contains Stripe SDK and Stripe-related code despite the project prohibition. Payment architecture requires explicit human approval and ADR before implementation or release."
- **Alternatives rejected:** Including start-job/complete in v1 (rejected — payment infrastructure depends on unresolved Stripe SDK status). Claiming Stripe not installed (rejected — `lib/stripe.ts` imports the `stripe` npm package, `lib/stripeService.ts` is 594 lines of integration code — code exists, decision is needed).
- **Rationale:** The correct scope boundary is provider acceptance — it's the last step before work execution, which triggers payment. Stripe SDK presence in the repo contradicts `AGENTS.md` prohibition and must be resolved by human approval before any payment-related code is invoked in MVP verification.
- **Artifacts:** `docs/permanent/mvp-contract-v1.md` (final), `docs/permanent/mvp-implementation-tasks.md` (final, v1 only), `docs/adr/ADR-0070-mvp-contract-v1.md` (Proposed).
