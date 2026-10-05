# Release runbook (all environments)

Canonical sources (never duplicate version facts anywhere else):

- `release-manifest.json` — **required** product version, toolchain, runtime services, and the migration set that ships.
- `docs/launch/release-ledger.json` — **history** of candidates and real deployments (Git identity, artifacts, observed environment).

## Per-release checklist

1. **Check the canonical version.** Run `npm run release:manifest-check` (and `npm run release:env-check`). It asserts package/lock/manifest agreement, CI/Docker pins, and that the declared migration count + latest migration match `prisma/migrations/` on disk. Do not bump versions by hand without a product decision.
2. **Record the SHA and migrations.** Create a ledger entry (`status: "candidate"`) with `testedShaBaseline` = the commit your evidence was produced from. Leave `gitSha` null **with a `gitShaReason`** — CI fills the real SHA at build time (a commit cannot contain its own SHA). Copy `migrations` from the manifest.
3. **Record the tests of that SHA.** Point `tests.evidencePath` at a file under `docs/launch/evidence/` listing the exact commands and results for this candidate.
4. **Record the real artifact digest.** Only after an actual build/publish, set `imageDigest` from the registry (`docker inspect` / registry digest), never from memory. Until then keep `imageDigest: null` with a reason.
5. **Record the deployment only after it actually ran.** Flip `status` to `deployed` with `deployedAt` + `gitSha` + `imageDigest` together. If migrations or a rollback rehearsal ran, record the result in `migrationRehearsal` / `rollbackRehearsal`. Never write "deployed" for a planned action.

## Rules

- No secrets, connection strings, or credentials in manifest/ledger/evidence (the validator scans for them).
- `null` fields are allowed only with an explicit `*Reason` string; a deployed entry must have SHA + digest + date.
- Migration count/latest in the ledger must match the manifest; the manifest must match the repository (validator enforces both).
- Staging/production deployments and any DB action on shared environments remain behind the explicit human approval gate (`docs/launch/staging-runbook.md`).
