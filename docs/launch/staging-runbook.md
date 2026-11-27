# Local Ubuntu/WSL staging runbook

Staging is isolated under Compose project `neighborly_staging`. Never use production credentials.

## Approval gate

Before starting services, present the exact command, confirm `.env.staging` contains only sandbox/test credentials, and obtain explicit user approval. Twilio, Postmark, and Stripe connections are external actions and require that approval.

## Preflight

1. Copy `.env.staging.example` to ignored `.env.staging` and replace every `CHANGE_ME` value.
2. Set `GIT_SHA` to `git rev-parse HEAD`; set `APP_VERSION` to `release-manifest.json` → `applications.api`.
3. Confirm Stripe uses an `sk_test_` key. Apple Pay and Google Pay remain false.
4. Validate with `npm run release:manifest-check`, `npm run release:env-check`, and `docker compose -f docker-compose.yml -f docker-compose.staging.yml --profile app --profile infra config --quiet`.

## Approved deployment command

`docker compose --env-file .env.staging -f docker-compose.yml -f docker-compose.staging.yml --profile app --profile infra up -d --build`

Run Prisma migrations only against the staging `DATABASE_URL`, then controlled seed, readiness, smoke, alert delivery/resolve, and rollback rehearsal. Record Git SHA and Docker image digests in `docs/launch/release-ledger.json`.

## Rollback

Stop the staging project without deleting volumes, return to the last recorded Git SHA/image digest, rebuild, run migrations only when backward-compatible, and repeat readiness/smoke gates. Volume deletion is a separate destructive action and is not part of rollback.
