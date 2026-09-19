import { readFileSync } from 'node:fs';

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const manifest = readJson('release-manifest.json');
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
if (problems.length) {
  console.error('Release manifest validation failed:');
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}
console.log('Release manifest validation passed.');
