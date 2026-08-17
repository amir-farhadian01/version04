# Lessons Learned — Neighborly

Append after every completed goal or notable failure.

---

## [2026-08-14] Security fixes — migration chain deeper than reported
- **What happened:** Fixing the QA-round migration bug revealed the chain was broken in 3 places, and ~20 tables + several enums/columns exist only in a bare `20260525180000_social_layer.sql` snapshot that Prisma ignores.
- **Root cause:** A full-schema snapshot (`social_layer.sql`) was saved as a bare `.sql` file instead of `migrations/<name>/migration.sql`, so `migrate deploy` never applied it; later migrations were written against that snapshot state.
- **Rule for next time:** When a migration fails, run `prisma migrate diff --from-url <fresh-migrated-db> --to-schema-datamodel prisma/schema.prisma --script` to quantify TOTAL drift, not just the first error. A bare `*.sql` file directly in `prisma/migrations/` is a red flag — Prisma only reads `<name>/migration.sql` directories.

- **What happened:** Executed 38 QA tests (auth, social, admin, role, navigation). Docker unavailable (no root), so provisioned local PostgreSQL 16 clusters and ran the backend/frontend directly.
- **Root cause (findings, not failures):** 4 CRITICAL code issues found — (1) Prisma migration chain broken (`Post.categoryId` never created, so `migrate deploy` fails on fresh DB); (2) backend imports `@google/generative-ai` but `package.json` has `@google/genai`; (3) `requireRole`/`isAdmin` trust the JWT `role` claim without DB re-validation (forged `role:"owner"` token → full admin access); (4) `JWT_SECRET=dev-secret-local` (weak default).
- **Rule for next time:** On a fresh/headless machine, verify `docker`/`dockerd` and root access before assuming `docker-compose up` will work; provision a local Postgres as fallback. When testing authorization, always test with a forged/self-signed token to confirm the server re-reads roles from the DB, not just the token claim.

- **What happened:** پکیج `cline-package/` که یک Enterprise AI Company OS کامل بود، در سه لایه `.clinerules/` (قوانین Cline)، `docs/` (معماری سازمان)، و README تجزیه و در جای صحیح قرار گرفت. اسکیل‌های قدیمی `.agents/skills/` حذف شدن.

## [2026-08-16] Route rename — grep verification caught an extra caller
- **What happened:** Task renamed `/explorer/comments` → `/comments` in `main.dart`, but the verification `grep -r "explorer/comments" flutter_project/lib/` (expected "none found") revealed `features/feed/feed_screen.dart` also pushed to the old route. The prompt's "adjust imports to 3 levels (../../../)" note was also wrong — the moved file stays at the same directory depth, so `../../` imports are correct.
- **Root cause:** The prompt assumed a single navigation entry point; the route string actually had two callers (route table + feed_screen). The import-depth note didn't account for `features/` and `screens/` being the same depth under `lib/`.
- **Rule for next time:** When renaming a route, grep the whole `lib/` for the old route string and update every `pushNamed` caller, not just the route table. Verify relative-import depth against the actual directory tree instead of trusting prompt notes.


## [2026-08-16] Story viewer — prompt's API spec didn't match the real backend
- **What happened:** The task's `_loadStory()`/`_buildStoryContent()` used `GET /social/stories/:id`, unwrapped `result['data']`, and read `_story['media'][0]['url']`. The real backend has no `GET /social/stories/:id` (single story is `GET /api/stories/:id`, returned directly without a `data` wrapper), and the Story model stores `mediaUrl`/`thumbnailUrl` strings — no `media` array.
- **Root cause:** bad research — the prompt was written against `plans/social-layer-plan.md` rather than the implemented code; two story routers exist (`routes/stories.ts` at `/api/stories` vs `routes/socialFeed.ts` at `/api/social/stories/*`).
- **Rule for next time:** Before wiring a Flutter screen to an API, grep the actual route files + `server.ts` mount points for the exact endpoint and response shape (does it wrap in `data`? which Prisma fields exist?), instead of trusting prompt field names.
- **Rule for next time:** `.clinerules/` حتماً باید در ریشه پروژه باشه — Cline فقط از ریشه auto-detect می‌کنه. اگه پکیجی حاوی `.clinerules/` دریافت شد، اول `.clinerules/` رو به ریشه منتقل کن، بعد بقیه محتوا رو مرتب کن. فایل‌های `:Zone.Identifier` ویندوز همیشه باید پاک بشن.