# Evidence — G-008 data-preserving upgrade rehearsal (2026-10-05)

Branch: `chore/issue-4-visual-sync` · Scope: data preservation of the corrective migration `20261004120000_align_schema_with_models` on data-bearing databases, canonical health version, bare `/order/new` entry. No shared/staging/production/dev DB was touched — all rehearsals ran on disposable temp databases of the local temp PostgreSQL 16 cluster (`/tmp/nb_pg`, port 55432).

## 0. Applied-ness audit of the migration (before revision)

- `docs/launch/release-ledger.json`: no deployments — `deployedAt: null`, `imageDigest: null` with reasons.
- `.github/workflows/ci.yml` + `release-to-neighborly.yml`: `prisma migrate deploy` runs only against ephemeral CI service databases; the "Push to neighborly" job syncs source only.
- Persistent dev DB (`neighborly_db`): `_prisma_migrations` does not exist (db-push synced; baselining path, never migrated).
- ⇒ The migration had only ever been applied to disposable temp DBs ⇒ revising the same migration folder in place was allowed (checksum concern applies to no persistent environment).

## 1. Fresh install (67 migrations)

- `prisma migrate deploy` → "All migrations have been successfully applied."
- `prisma migrate diff --from-url <fresh> --to-schema-datamodel prisma/schema.prisma --script` → "-- This is an empty migration." (zero drift; no tombstones on fresh DBs).

## 2. Upgrade rehearsal from the 66-migration legacy state with realistic data

State after migrations 1..66, then seeded legacy-shaped rows:

| Area | Before (legacy shape) | After (post-migration) |
|---|---|---|
| Post.moderationStatus (TEXT) | p1 `approved`, p2 `pending`, p3 `rejected`, p4 `flagged` | identical per id, now enum `PostModerationStatus` (in-place conversion) |
| PostComment (userId → authorId) | cm1→u2, cm2→u3, cm3→u1 (`userId NOT NULL`) | identical per id as `authorId`, `NOT NULL`, `userId` column dropped; FK to User valid |
| PostMedia.type (TEXT) | m1 `image`, m2 `video`, m3 `image` | identical per id, now enum `PostMediaType` (in-place conversion) |
| PostReaction (model removed) | 4 rows (like/love/celebrate/insightful) | archived verbatim into `_legacy_PostReaction` (ids, postIds, userIds, types identical); live table dropped |
| Service.price (DOUBLE PRECISION dollars) | s1 `49.5`, s2 `120`, s3 `89.99` | s1 `50`, s2 `120`, s3 `90` (whole-dollar contract); exact fractional values archived in `_legacy_Service_prices` (s1 `49.5`, s3 `89.99`; lossless s2 not archived) |

Assertions executed as a `DO` block (`ALL-ASSERTIONS-PASSED`): per-id value checks, `authorId` completeness (no NULL), `userId` column absence, reaction archive count = 4 with r4 fully intact, price conversions and exact archive values, tombstone/live-table presence.

- Drift after upgrade vs `schema.prisma`: exactly `DROP TABLE "_legacy_PostReaction"; DROP TABLE "_legacy_Service_prices";` — the two documented, intentional tombstones (only present because legacy data existed).
- Idempotency: migration SQL body executed twice more via psql on the upgraded DB → no errors; re-assertions pass; prices unchanged (50/120/90), archive still 4 rows (guarded conversions + anti-join inserts).
- Prisma client readback (app-level): posts enum statuses, comment `authorId`s, media enum types, integer service prices — all as expected.

## 3. Hard stop on unmappable value + recovery

- Seeded legacy DB with `Post.moderationStatus = 'bizarre'` → `prisma migrate deploy` FAILS with `Post.moderationStatus: values outside {pending, approved, rejected, flagged} — refusing to convert`.
- Post-failure state: all rows intact (`bizarre` preserved), column still TEXT, no tombstone created, migration recorded as not applied. Nothing was dropped.
- Recovery: map the value deliberately (`UPDATE … 'approved'`) → `prisma migrate resolve --rolled-back 20261004120000_align_schema_with_models` → `prisma migrate deploy` → PASS + `ALL-ASSERTIONS-PASSED`.

## 4. Code changes in this delivery

- `prisma/migrations/20261004120000_align_schema_with_models/migration.sql` — data-preserving revision (in place; see ADR-0084 revision section).
- `lib/releaseInfo.ts` (+ test) — canonical `release-manifest.json` reader; `server.ts` health/observability `version` now falls back to `applications.api` from the manifest instead of the hardcoded `'2.0.0'` (APP_VERSION remains an explicit deployment override).
- `frontend/src/pages/order/OrderWizard.tsx` — bare `/order/new` (no params, no draft selection) redirects to `/explore` (service discovery with direct order CTAs) instead of dead-ending; saved drafts with a selection still resume; `(price/100)` display fixed to the whole-dollar contract (`$price`).
- `frontend/src/pages/services/ServicesPage.tsx` — "Create New Order" CTA navigates to `/explore` (usable selection surface) instead of bare `/order/new`.
- `frontend/src/pages/order/__tests__/OrderWizard.test.tsx` — redirect + resume tests.
