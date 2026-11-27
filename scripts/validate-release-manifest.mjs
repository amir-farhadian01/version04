import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { validateReleaseInfo } from './lib/release-info-checks.mjs';

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

function main() {
  const manifest = readJson('release-manifest.json');
  let ledger = null;
  try {
    ledger = readJson('docs/launch/release-ledger.json');
  } catch {
    console.error('docs/launch/release-ledger.json could not be parsed.');
    process.exit(1);
  }
  const rootPackage = readJson('package.json');
  const frontendPackage = readJson('frontend/package.json');
  const rootLock = readJson('package-lock.json');
  const frontendLock = readJson('frontend/package-lock.json');
  const compose = readFileSync('docker-compose.yml', 'utf8');
  const rootDockerfile = readFileSync('Dockerfile', 'utf8');
  const frontendDockerfile = readFileSync('frontend/Dockerfile', 'utf8');
  const codeQualityWorkflow = readFileSync('.github/workflows/code-quality.yml', 'utf8');
  const prValidationWorkflow = readFileSync('.github/workflows/pr-validation.yml', 'utf8');
  const releaseWorkflow = readFileSync('.github/workflows/release-to-neighborly.yml', 'utf8');
  const flutterPubspec = readFileSync('flutter_project/pubspec.yaml', 'utf8');
  const migrationDirs = readdirSync('prisma/migrations', { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(`prisma/migrations/${d.name}/migration.sql`))
    .map((d) => d.name);

  const problems = validateReleaseInfo({
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
    migrationDirs,
    fileExists: (p) => existsSync(p) && statSync(p).isFile(),
  });

  if (problems.length) {
    console.error('Release manifest validation failed:');
    for (const problem of problems) console.error(`- ${problem}`);
    process.exit(1);
  }
  console.log('Release manifest validation passed.');
}

const invokedDirectly = process.argv[1] && process.argv[1].endsWith('validate-release-manifest.mjs');
if (invokedDirectly) main();

