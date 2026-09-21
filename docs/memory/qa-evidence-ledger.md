# QA Evidence Ledger

| Date | Surface | Evidence | Verdict | Classification |
|---|---|---|---|---|
| 2026-08-17 | Backend lint | `npm run lint` | PASS with warnings | Quality debt |
| 2026-08-17 | TypeScript | `npm run typecheck` | PASS | — |
| 2026-08-17 | Prisma migration | 60 migrations applied with `DATABASE_URL=postgresql://amir@127.0.0.1:55432/neighborly_qa?schema=public npm exec prisma migrate deploy` | PASS | Isolated temporary PostgreSQL 16 |
| 2026-08-17 | Backend tests | `npx vitest run --config vitest.backend.config.ts`: 21 files, 374 tests | PASS | NATS/Redis refusal logs were non-fatal fallbacks |
| 2026-08-17 | Frontend unit | `cd frontend && npm test`: 73 passed | PASS | — |
| 2026-08-17 | Frontend build | `cd frontend && npm run build` | PASS with warning | Quality debt |
| 2026-08-17 | Playwright | Malformed selector quoting corrected; full browser run not completed | BLOCKED | Browser stack pending |
| 2026-08-17 | Flutter | `flutter analyze --no-pub`: 43 diagnostics; `flutter test` compile failed through `drift/web.dart` / `dart:js_interop` | FAIL | Dependency/platform compatibility |
| 2026-08-17 | Docker app build | Buildx 0.33.0 installed; Docker daemon socket absent | BLOCKED | Environment |
| 2026-08-17 | CI coverage | no Playwright job; Flutter analyze only, no widget tests | FAIL | CI configuration gap |
| 2026-08-17 | Dependency audit | `npm audit --omit=dev --offline`: 0 vulnerabilities | PASS | — |
| 2026-08-27 | Backend typecheck | `npm run typecheck` | PASS | — |
| 2026-08-27 | Backend tests | `npm test` outside port-restricted sandbox: 28 files, 411 tests | PASS | Expected non-fatal NATS refusal logs in mocked job tests |
| 2026-08-27 | Backend lint | `npm run lint`: zero errors, one protected chat warning | PASS with documented exception | `routes/chat.ts:108` is protected by launch guardrail |
| 2026-08-27 | Prisma schema | `npx prisma validate` | PASS | No migration was executed |
| 2026-08-27 | Release manifest | `npm run release:manifest-check` | PASS | — |
| 2026-08-27 | User/Business Web | typecheck, lint and production build | PASS with documented exception | Only protected `BusinessMessages.tsx:212` warning; main chunk 334.50 kB |
| 2026-08-27 | Admin Web | ESLint, TypeScript and production build | PASS | Zero lint warnings |
| 2026-08-27 | Flutter | `flutter analyze`; `flutter test` | PASS | Zero analyze issues; 4/4 tests |
| 2026-08-27 | KYC/payment focused regression | 5 files, 40 tests | PASS | Includes provider failure rollback for capture/refund |
| 2026-08-27 | Docker daemon | `docker info` | BLOCKED | Current account denied access to `/var/run/docker.sock`; staging not deployed |
| 2026-08-27 | Node toolchain | Installed and verified Node `22.14.0` through nvm | PASS | Exact release-manifest version |
| 2026-08-27 | Frontend unit after security upgrades | Vitest 4.1.0: 9 files, 73 tests | PASS | React Router 7.18.2 and Vite 8.2.2 |
| 2026-08-27 | Dependency audit | Root and frontend `npm audit --omit=dev` | PASS | 0 vulnerabilities after removing unused xlsx/pdfjs and upgrading bcrypt/router/build tooling |
| 2026-08-27 | Flutter Web release build | `flutter build web --release` | PASS | Wasm dry run also succeeded |
| 2026-08-27 | Playwright public/UI smoke | Chromium: 34 non-backend-dependent tests | PASS | Stale theme expectations updated to current canonical tokens; backend-dependent console checks remain blocked by absent staging API |
| 2026-08-27 | Staging Docker build | Frontend and API images built from pinned Node 22.14 Alpine base; in-image npm audits found 0 vulnerabilities | PASS | Frontend Docker install policy aligned with the lockfile |
| 2026-08-27 | Staging infrastructure | PostgreSQL, media PostgreSQL, Redis, NATS, MinIO, Grafana, Loki, Dozzle, Metabase, Portainer, Traefik, API and frontend started | PARTIAL | Initial `/api/health` and `/api/ready` passed all required dependencies; Docker daemon subsequently became unresponsive during API image replacement |
| 2026-08-27 | Observability release identity | Focused observability suite: 7/7 tests; root typecheck | PASS | Added `/api/version`; staging environment now derives from `APP_ENV` |
| 2026-08-27 | Local Codex plugin marketplace | Official skill/plugin validators, `npm run plugins:check`, `npm run release:manifest-check`, CLI marketplace/install listing | PASS | `neighborly-multi-agent`, `neighborly-quality`, and `neighborly-growth` installed and enabled at 0.1.0; 27 canonical skills; no app, MCP, credential, or external data flow |
| 2026-08-27 | Staging API recovery | Started the replacement API container that was left in `Created`; `/api/health` and `/api/version` returned 200 and authenticated metrics exported counters | PARTIAL | Container lifecycle issue recovered; later restart verification was blocked by an intermittently unresponsive Docker daemon |
| 2026-08-27 | Staging database schema | `prisma migrate status`, read-only PostgreSQL metadata, and `prisma migrate diff` | BLOCKED | 64/64 migrations pending, no `_prisma_migrations`, zero public tables; migration awaits immediate user approval |
| 2026-08-27 | Schema-aware readiness regression | `npx vitest run lib/observability.test.ts`: 8/8; `npm run typecheck` | PASS | Readiness now fails when PostgreSQL is reachable but Prisma history/core schema are absent; live restart proof pending |
| 2026-08-27 | KYC/payment/security remediation | 76/76 focused tests plus 3/3 final webhook regression; lint/typecheck | PASS | Payment confirmation, legacy KYC evidence, raw webhook/retry/idempotency defects fixed in code; live staging proof pending migration/restart |
| 2026-08-27 | Web dashboards | lint/typecheck, 73/73 unit tests, user/admin production builds | PARTIAL | Static gates pass; native Admin CRM and Business/User route inventories remain materially incomplete |
| 2026-08-27 | Playwright critical baseline | Chromium critical subset: 3 passed, 9 failed, 1 interrupted, 14 not run | FAIL | API/Admin/seed environment gaps plus one Playwright localStorage setup defect |
| 2026-08-27 | Flutter release regression | analyze 0 issues; 7/7 tests; configured release web build | PARTIAL | API URL, draft submit route, and draft payload fixed; dashboard stats/active/completed contract remains unresolved |
| 2026-08-27 | Dependency audit | Root production and frontend audits | PASS | Online npm audit reported 0 vulnerabilities for both trees |
| 2026-08-27 | CI workflow injection | YAML parse, output-interpolation scan, `git diff --check` | PASS | PR-controlled output moved from executable `github-script` source to environment variables; actionlint unavailable |
| 2026-09-20 | Slice A integration proof | `git diff f92bcaf HEAD` on Slice A files byte-identical (only `auth.security.test.ts` +12 later lines); patch-id differs solely by prescribed `.env.example` overlap resolution; focused security tests 14/14 | PASS | Slice A present as `c2a6738`; no re-cherry-pick needed |
| 2026-09-20 | Worktree conversion to commits | 9 atomic commits `d53a750..42692d3` (apiError, KYC flow, RequireAuth, lazy routes, admin, business, public typing, e2e tokens, governance docs) | PASS | Every commit: explicit staging, `git diff --cached --check`, secret scan clean |
| 2026-09-20 | Backend lint + typecheck | `npm run lint` (0 errors, 1 pre-existing protected chat warning), `npm run typecheck` on Node 22.14.0 | PASS | — |
| 2026-09-20 | Backend tests | `npm test`: 47 files, 482/482 tests on Node 22.14.0 | PASS | — |
| 2026-09-20 | Prisma schema + migration deploy | `prisma validate` PASS; `prisma migrate deploy` on disposable PostgreSQL 16 (port 55433, data under /tmp): all 66 migrations applied, 81 public tables | PASS | Disposable cluster only — no staging/production data touched |
| 2026-09-20 | Frontend unit + lint + build | vitest 12 files 92/92; eslint 0 errors; `tsc && vite build` PASS with code-split chunks | PASS | — |
| 2026-09-20 | Admin build | `npm run build:admin` (tsc + vite) | PASS | — |
| 2026-09-20 | Flutter analyze + tests | `flutter analyze` 0 issues; `flutter test` 14/14 incl. native disk-cache test after user-space `LD_LIBRARY_PATH` sqlite 3.53.4 (temp under /tmp) | PASS | Environment gap (absent system libsqlite3) resolved without sudo |
| 2026-09-20 | Playwright customer-dashboard (mocked) | 11/11 chromium | PASS | Spec now aligned to canonical `nh-*` tokens and `/app/orders` route |
| 2026-09-20 | Playwright full suite | Partial run: 32 PASS / 21 FAIL at cutoff; failures are backend/API-dependent specs timing out (~16s) with no staging API | FAIL (environment) | Consistent with documented staging-API absence; not a frontend regression |
| 2026-09-20 | Dependency audits + manifest | `npm audit --omit=dev` root and frontend: 0 vulnerabilities; `npm run release:manifest-check` PASS | PASS | — |
