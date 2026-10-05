import { describe, expect, it } from 'vitest';
import { validateReleaseInfo } from './lib/release-info-checks.mjs';

const base = {
  manifest: {
    schemaVersion: 1,
    applications: { api: '0.0.0', userWeb: '0.0.1', businessWeb: '0.0.1', adminWeb: '0.0.1', flutter: '1.0.0+1' },
    toolchain: { node: '22.14.0', npm: '>=10', flutter: '3.41.6', dart: '3.11.4', prisma: '5.22.0', vite: '8.2.2', reactRouter: '7.18.2', vitestFrontend: '4.1.0', bcrypt: '6.0.0' },
    database: { migrationsDirectory: 'prisma/migrations', migrationCount: 3, latestMigration: '20260103000000_c' },
    plugins: {},
    services: { postgres: '16.8-alpine' },
    environments: {},
  },
  ledger: {
    schemaVersion: 1,
    stagingBuilds: [
      {
        id: 'cand-1',
        status: 'candidate',
        createdAt: '2026-10-05',
        testedShaBaseline: 'a'.repeat(40),
        gitSha: null,
        gitShaReason: 'Assigned by CI at build time.',
        migrations: { latest: '20260103000000_c', count: 3 },
        tests: { status: 'pass', evidencePath: 'docs/launch/evidence/x.md' },
        imageDigest: null,
        imageDigestReason: 'Not built yet.',
      },
    ],
  },
  rootPackage: { version: '0.0.0', dependencies: { '@prisma/client': '5.22.0', bcrypt: '6.0.0', vite: '8.2.2' }, devDependencies: { prisma: '5.22.0' } },
  frontendPackage: { version: '0.0.1', dependencies: { 'react-router-dom': '7.18.2' }, devDependencies: { vite: '8.2.2', vitest: '4.1.0' } },
  rootLock: { version: '0.0.0' },
  frontendLock: { version: '0.0.1' },
  compose: 'image: postgres:16.8-alpine',
  rootDockerfile: 'FROM node:22.14.0-alpine',
  frontendDockerfile: 'FROM node:22.14.0-alpine',
  codeQualityWorkflow: "flutter-version: '3.41.6'\nnode-version: '22.14.0'",
  prValidationWorkflow: "node-version: '22.14.0'",
  releaseWorkflow: "node-version: '22.14.0'",
  flutterPubspec: 'version: 1.0.0+1\n  sdk: ^3.11.4',
  migrationDirs: ['20260101000000_a', '20260102000000_b', '20260103000000_c'],
  fileExists: () => true,
};

const cloneBase = () => ({ ...JSON.parse(JSON.stringify({ ...base, fileExists: undefined })), fileExists: () => true });

describe('validateReleaseInfo', () => {
  it('accepts a consistent manifest + candidate ledger entry', () => {
    expect(validateReleaseInfo(base)).toEqual([]);
  });

  it('flags a missing npm toolchain entry', () => {
    const input = cloneBase();
    delete input.manifest.toolchain.npm;
    expect(validateReleaseInfo(input).join(' ')).toContain('toolchain.npm is missing');
  });

  it('flags migration count contradicting the repository', () => {
    const input = cloneBase();
    input.manifest.database.migrationCount = 99;
    const problems = validateReleaseInfo(input).join(' ');
    expect(problems).toContain('migrationCount');
    expect(problems).toContain('does not match prisma/migrations');
  });

  it('flags a stale latestMigration', () => {
    const input = cloneBase();
    input.manifest.database.latestMigration = '20260102000000_b';
    expect(validateReleaseInfo(input).join(' ')).toContain('is not the newest migration');
  });

  it('rejects a candidate with null gitSha and no reason', () => {
    const input = cloneBase();
    delete input.ledger.stagingBuilds[0].gitShaReason;
    expect(validateReleaseInfo(input).join(' ')).toContain('gitSha is null without a gitShaReason');
  });

  it('rejects a deployed entry without sha/digest/date', () => {
    const input = cloneBase();
    input.ledger.stagingBuilds[0].status = 'deployed';
    expect(validateReleaseInfo(input).join(' ')).toContain('deployed entries require');
  });

  it('accepts a fully populated deployed entry', () => {
    const input = cloneBase();
    Object.assign(input.ledger.stagingBuilds[0], {
      status: 'deployed',
      gitSha: 'b'.repeat(40),
      imageDigest: 'sha256:' + 'c'.repeat(64),
      deployedAt: '2026-10-05T12:00:00Z',
    });
    expect(validateReleaseInfo(input)).toEqual([]);
  });

  it('rejects a malformed image digest', () => {
    const input = cloneBase();
    input.ledger.stagingBuilds[0].imageDigest = 'deadbeef';
    delete input.ledger.stagingBuilds[0].imageDigestReason;
    expect(validateReleaseInfo(input).join(' ')).toContain('imageDigest');
  });

  it('flags a ledger entry whose migrations contradict the manifest', () => {
    const input = cloneBase();
    input.ledger.stagingBuilds[0].migrations.count = 2;
    expect(validateReleaseInfo(input).join(' ')).toContain('contradict the manifest database block');
  });

  it('flags a missing evidence file', () => {
    const input = cloneBase();
    input.fileExists = () => false;
    expect(validateReleaseInfo(input).join(' ')).toContain('evidencePath does not exist');
  });

  it('scans for secrets in the ledger', () => {
    const input = cloneBase();
    input.ledger.stagingBuilds[0].notes = 'postgresql://user:hunter2@db.internal:5432/app';
    expect(validateReleaseInfo(input).join(' ')).toContain('Possible secret');
  });
});