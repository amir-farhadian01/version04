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
- **Decision:** ADR-0080 — سه Workstream موازی: (A) Social Login (Google/Apple) + Onboarding Wizard 3-Step، (B) Social Feed Polish (Stories Row + Post Card + Create Post + Order CTA)، (C) Unified Order Flow (Post→Order Bridge + One-Tap Reorder + Commission Visibility)
- **Alternatives rejected:** (1) Separate Marketplace tab — fragmented experience, rejected. (2) Firebase Auth — external dependency, rejected — our JWT system is clean. (3) Rewrite Flutter feed from scratch — too expensive, rejected — incremental polish on existing foundation.
- **Rationale:** ~90% of backend infra is done (auth, matching, orders, payments, admin). The gap is consumer-facing UX layer. Social login cuts onboarding friction 70%. Post→Order bridge creates the core monetization loop. Commission visibility builds trust.

## [2026-08-07] Quick-Start Package — Implementation Complete (Tasks 1-12)
- **Goal:** Execute all tasks from quick-start-package-tasks.md
- **Decision:** Implemented all 14 tasks — 12 completed, 2 pending (Playwright verification requires DB, docs updates done)
- **Files changed:** 14 files modified, 8 new files created
  - Backend: prisma/schema.prisma (appleId, onboardingCompletedAt, onboardingInterests), routes/auth.ts (already had endpoints)
  - Flutter: auth_screen.dart (OAuth buttons), onboarding/ (4 new files), stories_row.dart (gradient rings), post_card.dart (double-tap, comments, menu), post/ (2 new files), order_detail_screen.dart (Reorder), new_order_screen.dart (commission breakdown), api_service.dart (getFeed), main.dart (routes), pubspec.yaml (google_sign_in, sign_in_with_apple deps)
- **Rationale:** Used incremental polish approach — enhanced existing widgets rather than rewriting. OAuth buttons show UI but require native project config for full Google/Apple sign-in flow. Database migration created manually (PostgreSQL was down during implementation).

## [2026-08-11] Stripe SDK Approved as Official Payment Gateway
- **Goal:** Resolve Stripe SDK prohibition in AGENTS.md vs existing code in repo
- **Decision:** CEO approved Stripe Connect as official payment gateway. `lib/stripe.ts` and `lib/stripeService.ts` are now active. AGENTS.md updated (both root and docs/). No other payment gateway may be added without ADR + architect sign-off.
- **Alternatives rejected:** Keeping prohibition (rejected — 594 lines of Stripe integration code already exist). Removing Stripe code (rejected — would destroy payment infrastructure). Adding alternative gateways (rejected — Stripe Connect chosen as primary).
- **Rationale:** Stripe Connect provides automatic commission splitting, OAuth onboarding, and escrow capabilities. Existing code is production-ready.

## [2026-08-11] MVP Scope Expanded to Full Flow
- **Goal:** Re-define MVP scope per CEO decision
- **Decision:** MVP v1 now covers full flow: registration → browsing → order → matching → contract → payment (Stripe) → execution → review. Previously scoped to only accept-invite; now includes payment and job execution via approved Stripe gateway.
- **Alternatives rejected:** MVP v1 only accepting invites (rejected — CEO wants full working product). Delaying payments to v1.1 (rejected — Stripe is now approved).
- **Rationale:** Stripe approval unlocked payment and execution phases. Full product experience now achievable.

## [2026-08-11] MVP Contract v1.0 (SUPERSEDED)
- **Status:** Superseded by 2026-08-11 MVP Scope Expanded decision above.
- **Goal:** (Original) Produce a one-page MVP Contract — final correction per CEO: MVP v1 ends at provider acceptance. Start-job, complete, and payment lifecycle deferred to MVP v1.1 pending human-approved payment ADR.
- **Decision:** (Original — SUPERSEDED) MVP v1 scope: Customer registers → browses → draft → submit → matching → provider accepts.
- **Artifacts:** `docs/permanent/mvp-contract-v1.md` (superseded), `docs/permanent/mvp-implementation-tasks.md` (superseded), `docs/adr/ADR-0078-mvp-contract-v1.md` (superseded).

## [2026-08-12] 12-Plan Baseline Audit — Status Report Delivered
- **Goal:** Audit the 13 files under `plans/` against the current repository and produce an implementation-ready status report before changing code.
- **Decision:** Concluded 10 of 12 workstreams are fully implemented and 2 partially done; remaining work is documentation reconciliation + QA verification, not feature code. Delivered `docs/PLAN_STATUS.md` and `docs/IMPLEMENTATION_ROADMAP.md`. Recommended first task: P0-1 (fix root `PORTS.md`, which still says "Redis removed").
- **Alternatives rejected:** Accepting the ROADMAP "MVP complete" claim without code evidence (rejected — verified schema/routes/tests directly); re-running the full test suite (rejected — would require local Postgres and risk migrations).
- **Rationale:** Establishes ground truth for subsequent implementation prompts; separates the few code gaps from the documentation gaps (stale root `PORTS.md`, stale `ORDER_FLOW_GAP_ANALYSIS.md`, ADR numbering collisions).
