# ADR-0085: Local no-docker staging for MVP candidate validation (G-009)
- Status: accepted (owner approved the staging run 2026-10-06; candidate SHA moved 11931d9 → f7d31ba via the approved blocking fix below)
- Context:
  - Goal G-009 requires running the pinned MVP candidate `11931d9fad548fe40aef90d1e469ec830f35ab95` on an isolated staging destination with a new empty database, applying all 67 migrations, and executing the full order flow (signup → service → order → provider acceptance → Stripe test → completion → confirm & review) with synthetic data.
  - The project's documented staging convention (`docker-compose.staging.yml`, project `neighborly_staging`, ports 55432/18080/19090/15173, `docs/launch/staging-runbook.md`) requires a running Docker daemon. On this machine the Docker CLI exists but the daemon is not running and cannot be started (no sudo). A remote VM would require new external accounts, credentials and spend, and is not needed for MVP validation.
  - Constraints from the goal: no changes to production or the dev database, no baseline run, PR #10 stays Draft, merge/production-deploy/real payments forbidden, only blocking-bug fixes allowed.
- Decision:
  Stand up a **local no-docker staging** under `/home/amir/nb-staging/`:
  1. Pinned exact-SHA **git worktree** (`git worktree add --detach`, `11931d9…`) — provenance is verifiable and the repo working tree/HEAD stay untouched.
  2. **Dedicated PostgreSQL 16 cluster** (`initdb` at `~/nb-staging/pgdata`, port **55432**, socket-auth trust, host-auth scram) with two NEW EMPTY databases: `neighborly_staging`, `neighborly_media_staging`. The disposable G-008 rehearsal cluster (`/tmp/nb_pg`, DBs already dropped) is stopped first because it holds 55432.
  3. **API** `APP_ENV=staging`, `NODE_ENV` unset, `PORT=18080`, `ADMIN_PORT=19090` via `tsx server.ts` from the worktree. Rationale: `secure` refresh cookies over plain http would break auth if `NODE_ENV=production` (`routes/auth.ts`), and the prod static-serving branch assumes a compiled `__dirname` that `tsx` does not provide; `APP_ENV=staging` is the documented gate for Stripe test mode (`lib/paymentProvider.ts`).
  4. **Built SPAs**: client built with `VITE_API_URL=http://localhost:18080/api` and served via `vite preview` on **15173**; admin SPA served by the API process on **19090** — ports mirror the existing compose-staging convention.
  5. Optional services skipped (non-fatal by design): Redis/NATS → in-memory fallbacks; MinIO → local-disk `uploads/`; Traefik/Loki/Grafana/Dozzle/Metabase/Portainer → not required. `READINESS_REQUIRED_SERVICES=database,storage`.
  6. Stripe test mode requires owner-provided `sk_test_…` + `whsec_…`; without them the payment step returns `503 PAYMENT_PROVIDER_DISABLED` (designed behavior) and is reported BLOCKED-BY-CONFIG, not fixed in code.
  7. Staging files (env template, start/stop/teardown scripts, minimal owner seed, backup/restore verifier) live **outside the repo** in `~/nb-staging/`; `.env.staging` is chmod 600 and never committed. Secrets preflight hard-fails on `CHANGE_ME`/empty required values and on any `sk_live_` key.
- Alternatives considered:
  - Docker compose staging on this host — rejected: daemon unavailable, cannot start without sudo.
  - Remote VM (Hetzner/DO, ~€5–10/mo) — rejected for now: external account/credentials/spend + slower iteration; revisit if persistent shared staging is required.
  - Reusing the dev DB/cluster with a separate database name — rejected: goal forbids touching dev infra; port/user/password sharing increases blast radius.
  - Running API with `NODE_ENV=production` under tsx — rejected: breaks secure-cookie auth over http and misresolves the admin dist path.
- Consequences:
  - ✅ Zero-cost, fully local, exact-SHA provenance, trivial teardown (`stop-staging.sh --full`), dev/prod isolation by construction.
  - ⚠️ Topology deviations from the compose convention must be recorded in the release ledger (no Redis/NATS/MinIO/Traefik; readiness scope database,storage).
  - ⚠️ `/tmp`-free durability: cluster lives in `$HOME`; a machine reboot only requires `start-staging.sh` re-run (idempotent).
  - ❌ Not a production-like reverse proxy/observability stack — performance/observability conclusions from this staging are limited.
- Rollback strategy:
  `stop-staging.sh --full` (stops processes, deletes `pgdata` + worktree, prunes worktree metadata). The repo, PR #10, dev DB (`:5432`) and any remote remain untouched at every stage; no external service is contacted except Stripe test API when keys are provided.
