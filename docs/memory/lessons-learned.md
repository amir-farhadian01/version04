# Lessons Learned — Neighborly

Append after every completed goal or notable failure.

---

## [2026-08-13] QA Round 1 — Full test execution
- **What happened:** Executed 38 QA tests (auth, social, admin, role, navigation). Docker unavailable (no root), so provisioned local PostgreSQL 16 clusters and ran the backend/frontend directly.
- **Root cause (findings, not failures):** 4 CRITICAL code issues found — (1) Prisma migration chain broken (`Post.categoryId` never created, so `migrate deploy` fails on fresh DB); (2) backend imports `@google/generative-ai` but `package.json` has `@google/genai`; (3) `requireRole`/`isAdmin` trust the JWT `role` claim without DB re-validation (forged `role:"owner"` token → full admin access); (4) `JWT_SECRET=dev-secret-local` (weak default).
- **Rule for next time:** On a fresh/headless machine, verify `docker`/`dockerd` and root access before assuming `docker-compose up` will work; provision a local Postgres as fallback. When testing authorization, always test with a forged/self-signed token to confirm the server re-reads roles from the DB, not just the token claim.

- **What happened:** پکیج `cline-package/` که یک Enterprise AI Company OS کامل بود، در سه لایه `.clinerules/` (قوانین Cline)، `docs/` (معماری سازمان)، و README تجزیه و در جای صحیح قرار گرفت. اسکیل‌های قدیمی `.agents/skills/` حذف شدن.
- **Rule for next time:** `.clinerules/` حتماً باید در ریشه پروژه باشه — Cline فقط از ریشه auto-detect می‌کنه. اگه پکیجی حاوی `.clinerules/` دریافت شد، اول `.clinerules/` رو به ریشه منتقل کن، بعد بقیه محتوا رو مرتب کن. فایل‌های `:Zone.Identifier` ویندوز همیشه باید پاک بشن.