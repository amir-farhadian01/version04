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

## [2026-09-21] CEO correction: release report carried two unverified claims
- **What happened:** The GLM release report stated the branch was "10 commits ahead" (actually 36 — only the last execution's commits were counted) and that Slice A files were "byte-identical to `f92bcaf` except `auth.security.test.ts` +12" (actually `routes/auth.ts`, `routes/admin.ts`, and `server.ts` had also changed — though re-verification showed those deltas were legitimate later hardening, not reverts).
- **Root cause:** bad test (evidence practice) — prior-session conclusions were restated as verified facts without re-running the derivation commands in the current session.
- **Rule for next time:** Every evidence claim entering a release report or memory ledger must be re-derived with an explicit command in the same session; when a diff claim is made, run the exact `git diff --stat` and report per-file deltas, never a summarizing simplification.

## [2026-09-21] Order wizard E2E blockers fixed (G-006)
- **What happened:** Autosave/submit hit `POST /api/orders` → 404 (frontend called an endpoint that never existed) and package price was stored as `budgetCents` directly (55 cents instead of 5500). A stale draft (step 3, `budgetCents:55`) also revealed the wizard preselection only re-fetches on step 0, so a resumed journey keeps the old value until re-entering step 0.
- **Root cause:** bad implementation (frontend/backend contract drift — frontend invented an endpoint shape) compounded by bad test (the cents bug is invisible in UI because display divides by 100 symmetrically).
- **Rule for next time:** Before implementing any client call, capture the exact wire contract (route, body, response wrapper) from the backend route file and record it in the QA evidence ledger. Budget-like integer-cent fields must be converted at the domain boundary, not carried through UI state. 15-min JWTs interrupt any E2E journey >15 min — re-login between journeys.

## [2026-10-04] Provider/owner/admin journeys on restored dev env
- **What happened:** Journey run surfaced four real defects beyond the initial P2022 schema drift: (1) `BusinessDashboard.tsx` crashed (`undefined.length`) because the backend overview route returned a 5-field summary while the page (and its own test) expect a rich payload — the two were never reconciled; (2) `Finance.tsx` called `GET /workspace/:id/finance`, a route that was designed in the dead, never-mounted `workspaceDashboard.ts`; (3) that dead route's finance handler returned `pipeline` as an object while the page expects an array; (4) frontend fired ~50 `POST /api/auth/logout` in a loop after JWT expiry, saturating the 10/min auth rate limiter and 429-ing the next login (worked around by waiting out the window; loop NOT yet fixed).
- **Root cause:** bad implementation (contract drift between mounted backend routes and SPA pages; dead code that was never wired) — same family as the G-006 wizard 404. The rate-limit incident is a separate unfixed frontend defect (auth interceptor retry loop).
- **Rule for next time:** When a journey 500s/crashes, diff the page's expected interface against the route's actual `res.json` before touching code — the page's test file is the source of truth for intended contracts. Grep for never-imported route files (`import.*<file>` with zero hits) when a page 404s on a path that 'should' exist. In-memory rate limiters (10/min on auth) turn any client-side retry loop into a self-DoS; cap interceptor retries.

## [2026-10-04] Logout retry-loop fixed (follow-up to the four defects above)
- **What happened:** Defect (4) was fixed the same day: the SPA interceptor now skips the refresh→logout cycle for auth-endpoint 401s (`isAuthEndpoint` guard in `frontend/src/lib/api.ts`), `services/auth.ts` logout clears local state on server failure, and the admin app got the same guard. Loop mechanics: `authStore.logout()` fired `api.post('/auth/logout')` through the same interceptor, whose 401 branch called `logout()` again — unbounded self-recursion until the rate limiter 429'd everything.
- **Root cause:** bad implementation (auth-endpoint responses re-entered the same 401-recovery path that produced them).
- **Rule for next time:** Any interceptor that reacts to a failure class must exclude the endpoints whose failure it reacts to — and test the loop-closure case explicitly (new `src/lib/api.test.ts` does).

## [2026-10-05] Wizard clean-run on temp stack: three stacked contract drifts hid behind "deferred" testing
- **What happened:** The first real clean-run of the order wizard (deferred since G-006) failed three times in sequence: (1) photo upload 404 — frontend posted `/api/uploads/photo` (never existed) and expected `res.data.data.url`; (2) after fixing that, submit 400 "fieldId is required on each photo when the schema has multiple photo fields" — the seeded questionnaire was invalid per `isServiceQuestionnaireV1` (`version:"1.0"`, no `sections`), so `/schema` returned 500 and submit silently used `minimalFallbackQuestionnaire` (0 photo fields); (3) separately, "silent refresh" could never work — the store guarded on a `refreshToken` that login never stores (backend uses an httpOnly cookie), and `fetch` lacked `credentials:'include'`.
- **Root cause:** bad implementation (contract drift in three independent seams: upload endpoint/shape, questionnaire schema version, refresh-token transport) — each invisible until the flow was run end-to-end with real files and a real session expiry.
- **Rule for next time:** When a submission 400s with a *validation* message, diff the schema the SERVER actually used (including fallbacks like `minimalFallbackQuestionnaire`) against the one the client assumed before touching the client. Validate seeded questionnaires against `isServiceQuestionnaireV1` in CI (the preset now carries the V1 shape). Any cookie/session feature must be tested with cookies actually cleared/present — a guard on state that is always null is dead code, not a feature.

## [2026-10-05] run_commands items run in parallel — DB experiments raced
- **What happened:** Two sequential-looking `run_commands` array items (migrate deploy + seed on the same temp DB, and deploy + diff) actually started concurrently: seed hit `P2021: table does not exist` mid-deploy, and a drift `diff` captured the pre-deploy state (reporting drift that no longer existed). Both "failures" vanished when the steps were re-run chained inside a single shell command.
- **Root cause:** bad test/process assumption (tool-level parallelism mistaken for sequential execution), not bad code.
- **Rule for next time:** In this environment, steps that depend on each other MUST be chained in one command string (`a && b && c`); use separate array items only for genuinely independent work. When an output looks impossible, first suspect a race, re-run sequentially before debugging the app.

## [2026-10-05] corsOrigin.test.ts was committed broken — full suite not run before commit
- **What happened:** `lib/corsOrigin.test.ts` (commit f16eef1) crashed at module scope in every vitest run (`fileURLToPath(new URL(...))` — under the repo's global jsdom environment, vitest's web-transform rewrites `import.meta.url` to an http URL). The file had been committed without running the FULL backend suite; only targeted test files were executed. Discovered days later by the G-008 full-gate run.
- **Root cause:** bad test discipline (partial test execution accepted as green), not bad code.
- **Rule for next time:** "Tests pass" means the whole suite for that package, run in one command, output captured. Any new use of `import.meta.url`/`fileURLToPath` inside tests needs `// @vitest-environment node` (or a cwd-relative path) because `vitest.config.ts` sets `environment: 'jsdom'` globally.

## [2026-10-05] G-008: diff-generated migrations are data-blind
- **What happened:** The ADR-0084 corrective migration was generated with `prisma migrate diff` and hand-made idempotent, but it still used drop+recreate for enum conversions, dropped `PostComment.userId` without backfilling `authorId`, dropped `PostReaction` with its rows, and let PostgreSQL round `Service.price` double→int silently. The earlier "representative data" rehearsal did not cover these five areas, so the losses were invisible until a value-level (not count-level) rehearsal was demanded.
- **Root cause:** bad test — rehearsal compared counts/drift, not per-row values and relations; and diff-generated DDL must never be trusted on data-bearing tables without auditing each destructive step.
- **Rule for next time:** Any migration that touches data-bearing tables gets (a) a value+relation before/after rehearsal for every affected model, (b) guarded in-place conversions with explicit hard stops on unmappable values, and (c) verbatim archive tables (or an explicit stop) before any drop.
