/**
 * Pure validation core for release version/deploy information.
 * Exported so tests can exercise it (scripts/validate-release-manifest.test.mjs);
 * the CLI (validate-release-manifest.mjs) gathers real repository inputs.
 */
export function validateReleaseInfo(input) {
  const {
    manifest,
    ledger,
    rootPackage,
    frontendPackage,
    rootLock,
    frontendLock,
    compose,
    rootDockerfile,
    frontendDockerfile,
    codeQualityWorkflow,
    prValidationWorkflow,
    releaseWorkflow,
    flutterPubspec,
    migrationDirs = [],
    fileExists = () => true,
  } = input;
  const problems = [];

  if (manifest.applications.api !== rootPackage.version || rootPackage.version !== rootLock.version) problems.push('API package/lock/manifest versions differ');
  if (manifest.applications.userWeb !== frontendPackage.version || frontendPackage.version !== frontendLock.version) problems.push('Frontend package/lock/manifest versions differ');
  if (manifest.applications.businessWeb !== frontendPackage.version || manifest.applications.adminWeb !== frontendPackage.version) problems.push('Business/admin manifest versions differ from the frontend package');
  if (!flutterPubspec.includes(`version: ${manifest.applications.flutter}`)) problems.push('Flutter app version differs from manifest');
  if (!String(rootPackage.dependencies?.['@prisma/client'] || '').includes(manifest.toolchain.prisma)) problems.push('Prisma client differs from manifest');
  if (!String(rootPackage.devDependencies?.prisma || '').includes(manifest.toolchain.prisma)) problems.push('Prisma CLI differs from manifest');
  if (!String(rootPackage.dependencies?.bcrypt || '').includes(manifest.toolchain.bcrypt)) problems.push('bcrypt differs from manifest');
  if (!String(rootPackage.dependencies?.vite || '').includes(manifest.toolchain.vite) || !String(frontendPackage.devDependencies?.vite || '').includes(manifest.toolchain.vite)) problems.push('Vite differs from manifest');
  if (!String(frontendPackage.dependencies?.['react-router-dom'] || '').includes(manifest.toolchain.reactRouter)) problems.push('React Router differs from manifest');
  if (!String(frontendPackage.devDependencies?.vitest || '').includes(manifest.toolchain.vitestFrontend)) problems.push('Frontend Vitest differs from manifest');
  if (!flutterPubspec.includes(`sdk: ^${manifest.toolchain.dart}`)) problems.push('Flutter Dart SDK constraint differs from manifest');
  if (!codeQualityWorkflow.includes(`flutter-version: '${manifest.toolchain.flutter}'`)) problems.push('Flutter CI version differs from manifest');
  const nodeImage = `node:${manifest.toolchain.node}-alpine`;
  if (!rootDockerfile.includes(nodeImage) || !frontendDockerfile.includes(nodeImage)) problems.push('Docker Node image differs from manifest');
  for (const workflow of [codeQualityWorkflow, prValidationWorkflow, releaseWorkflow]) {
    if (!workflow.includes(`node-version: '${manifest.toolchain.node}'`)) problems.push('Workflow Node version differs from manifest');
  }
  if (/image:\s*\S+:latest\b/.test(compose)) problems.push('Docker Compose contains an unpinned latest image');
  for (const [service, version] of Object.entries(manifest.services)) {
    if (!compose.includes(`:${version}`)) problems.push(`${service} image version is not represented in Compose`);
  }

  // npm toolchain
  const npm = manifest.toolchain?.npm;
  if (!npm || typeof npm !== 'string') problems.push('Manifest toolchain.npm is missing (e.g. ">=10")');
  else if (!/^(>=)?\d+(\.\d+){0,2}$/.test(npm)) problems.push(`Manifest toolchain.npm is not a valid version/range: ${npm}`);

  // database / migration block vs repository
  const db = manifest.database;
  if (!db || typeof db !== 'object') problems.push('Manifest database block is missing');
  else {
    if (!Number.isInteger(db.migrationCount) || db.migrationCount <= 0) problems.push('Manifest database.migrationCount must be a positive integer');
    if (typeof db.latestMigration !== 'string' || !db.latestMigration) problems.push('Manifest database.latestMigration is missing');
    if (Array.isArray(migrationDirs) && migrationDirs.length > 0) {
      if (db.migrationCount !== migrationDirs.length) problems.push(`Manifest database.migrationCount (${db.migrationCount}) does not match prisma/migrations (${migrationDirs.length})`);
      const sorted = [...migrationDirs].sort();
      if (db.latestMigration !== sorted[sorted.length - 1]) problems.push(`Manifest database.latestMigration (${db.latestMigration}) is not the newest migration (${sorted[sorted.length - 1]})`);
    }
  }

  // ledger history
  const ledgerText = JSON.stringify(ledger ?? {});
  if (!ledger || ledger.schemaVersion !== 1) problems.push('Ledger schemaVersion must be 1');
  const builds = Array.isArray(ledger?.stagingBuilds) ? ledger.stagingBuilds : null;
  if (!builds) problems.push('Ledger must contain a stagingBuilds array');
  else {
    const shaRe = /^[0-9a-f]{40}$/;
    for (const [i, b] of builds.entries()) {
      const at = `stagingBuilds[${i}]`;
      if (!b.id) problems.push(`${at}.id is required`);
      if (!['candidate', 'deployed', 'rolled-back', 'failed'].includes(b.status)) problems.push(`${at}.status must be candidate|deployed|rolled-back|failed`);
      if (!/^\d{4}-\d{2}-\d{2}/.test(String(b.createdAt ?? ''))) problems.push(`${at}.createdAt must be an ISO date`);
      if (b.gitSha != null && !shaRe.test(b.gitSha)) problems.push(`${at}.gitSha must be a 40-hex SHA or null with gitShaReason`);
      if (b.gitSha == null && !b.gitShaReason) problems.push(`${at}.gitSha is null without a gitShaReason`);
      if (b.imageDigest != null && !/^sha256:[0-9a-f]{64}$/.test(b.imageDigest)) problems.push(`${at}.imageDigest must look like sha256:<64 hex> or be null with imageDigestReason`);
      if (b.imageDigest == null && !b.imageDigestReason) problems.push(`${at}.imageDigest is null without an imageDigestReason`);
      if (b.status === 'deployed' && (!b.gitSha || !b.imageDigest || !b.deployedAt)) {
        problems.push(`${at}: deployed entries require gitSha, imageDigest and deployedAt`);
      }
      if (b.tests) {
        if (!['pass', 'fail', 'blocked'].includes(b.tests.status)) problems.push(`${at}.tests.status must be pass|fail|blocked`);
        if (!b.tests.evidencePath) problems.push(`${at}.tests.evidencePath is required`);
        else if (!fileExists(b.tests.evidencePath)) problems.push(`${at}.tests.evidencePath does not exist: ${b.tests.evidencePath}`);
      } else {
        problems.push(`${at}.tests is required`);
      }
      if (b.migrations && manifest.database) {
        if (b.migrations.count !== manifest.database.migrationCount || b.migrations.latest !== manifest.database.latestMigration) {
          problems.push(`${at}.migrations contradict the manifest database block`);
        }
      }
    }
  }

  // secrets scan — manifest and ledger must stay credential-free
  const secretPatterns = [
    [/postgres(?:ql)?:\/\/[^\s/:@]+:[^\s/@]+@/i, 'database URL with inline password'],
    [/sk_live_[0-9a-zA-Z]{10,}/, 'Stripe live secret key'],
    [/AKIA[0-9A-Z]{16}/, 'AWS access key id'],
    [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private key material'],
  ];
  for (const text of [JSON.stringify(manifest), ledgerText]) {
    for (const [re, label] of secretPatterns) {
      if (re.test(text)) problems.push(`Possible secret (${label}) found in manifest/ledger — remove it`);
    }
  }

  return problems;
}
