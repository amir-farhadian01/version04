# Lessons Learned — Neighborly

Append after every completed goal or notable failure.

---

## [2026-08-27] Local plugin packaging — keep one canonical skill source
- **What happened:** Neighborly already had a complete GTM skill library, so copying every skill into plugin folders would have created two sources of truth.
- **Rule for next time:** Package repository-specific routing in the plugin, keep canonical instructions in `.agents/skills/`, and fail CI when marketplace, catalog, manifests, role cards, or release versions diverge.

## [2026-08-17] Codex multi-agent setup — plugin fallback for protected `.codex/`
- **What happened:** The workspace contained a read-only `.codex/` mount, which prevented native custom-agent configuration. A local Codex plugin supplied the reusable multi-agent workflow instead.
- **Rule for next time:** Use `.codex/agents/*.toml` when the project config directory is writable; otherwise package the coordination workflow as a local Codex plugin and do not attempt to change protected mounts.

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

## [2026-09-20] MVP readiness run — worktree to commits, Slice A verification, release gates
- **What happened:** Resumed a session where prior tool outputs had returned empty. Re-ran state inspection from scratch, proved ignore-only commit `6d379fa` and Slice A (`c2a6738`) were already on HEAD, converted the frontend worktree into 9 atomic commits, and ran every release gate green on Node 22 except API-dependent E2E.
- **Root cause (earlier empty outputs):** bad execution context — commands fired before the previous tool call finished registering; re-running sequentially fixed it. Not a repo problem.
- **Root cause (Flutter disk-cache test fail):** environment — host lacked modern `libsqlite3.so`; the only available copy (Rider-bundled) was too old for `ON CONFLICT`. Fixed user-space by extracting `libsqlite3-0_3.53.4` from the Ubuntu `.deb` into `/tmp` and exposing it via `LD_LIBRARY_PATH`.
- **Rule for next time:** After a session resume, never trust cached "in-progress" claims — re-derive repo state (status, ancestry, patch-id) before acting. `nohup ... &` inside these tool shells still dies with the parent; for long suites, poll a log file and expect partial results, or run suites subset-by-subset. For missing native test libraries, prefer distro `.deb` extraction into `/tmp` over sudo installs. Commit ordering must follow import dependencies (helpers first, importers last) so every intermediate commit typechecks.
