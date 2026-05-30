import fs from 'fs';
import path from 'path';

/** One dependency row (Docker image, npm package, …). */
export type DependencyCatalogEntry = {
  category: string;
  name: string;
  spec: string;
  notes?: string;
  sortOrder?: number;
};

/** Multiple profiles (e.g. default / staging / prod) for different environments. */
export type DependencyCatalogV1 = {
  version: 1;
  defaultProfile: string;
  profiles: Record<string, DependencyCatalogEntry[]>;
};

function readIfExists(file: string): string | null {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

/** Parse dependencies / dev_dependencies blocks in pubspec (supports `flutter:\\n  sdk: flutter`). */
function parsePubspecMapBlock(content: string, blockName: 'dependencies' | 'dev_dependencies'): Record<string, string> {
  const lines = content.split(/\r?\n/);
  const out: Record<string, string> = {};
  let i = 0;
  while (i < lines.length) {
    if (lines[i].trim() !== `${blockName}:`) {
      i++;
      continue;
    }
    i++;
    while (i < lines.length) {
      const raw = lines[i];
      const t = raw.trim();
      if (!t || t.startsWith('#')) {
        i++;
        continue;
      }
      if (blockName === 'dependencies' && t.startsWith('dev_dependencies:')) break;
      if (blockName === 'dev_dependencies' && t === 'flutter:' && !raw.startsWith(' ')) break;
      const m = raw.match(/^(\s{2})([A-Za-z0-9_]+):\s*(.*)$/);
      if (m) {
        const key = m[2];
        let val = m[3].trim();
        if (!val) {
          const next = lines[i + 1];
          const sdkLine = next?.match(/^\s{4}sdk:\s*(.+)$/);
          if (sdkLine) {
            val = `sdk: ${sdkLine[1].trim()}`;
            i += 2;
            continue;
          }
        }
        out[key] = val;
      } else if (!raw.startsWith(' ') && raw.includes(':')) {
        break;
      }
      i++;
    }
    break;
  }
  return out;
}

function dockerImagesFromCompose(yml: string): string[] {
  const found: string[] = [];
  const re = /^\s*image:\s*([^\s#]+)/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(yml))) found.push(m[1].replace(/^["']|["']$/g, ''));
  return [...new Set(found)];
}

function sortEntries(entries: DependencyCatalogEntry[]): DependencyCatalogEntry[] {
  return [...entries].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

/** Build an initial catalog from repo files (reset button or first run). */
export function buildDefaultDependencyCatalog(cwd = process.cwd()): DependencyCatalogV1 {
  let order = 0;
  const add = (category: string, name: string, spec: string, notes?: string): DependencyCatalogEntry => ({
    category,
    name,
    spec,
    notes,
    sortOrder: order++,
  });

  const defaultEntries: DependencyCatalogEntry[] = [];

  defaultEntries.push(
    add('runtime', 'Docker Engine + Compose plugin', 'v2+', 'Linux or WSL2'),
    add('runtime', 'TLS / HTTPS', 'outside default compose', 'Traefik here serves HTTP on :80 without TLS'),
  );

  const compose = readIfExists(path.join(cwd, 'docker-compose.yml'));
  if (compose) {
    for (const img of dockerImagesFromCompose(compose)) {
      defaultEntries.push(add('docker', img.split('/').pop() || img, img, 'from docker-compose.yml'));
    }
  } else {
    defaultEntries.push(add('docker', 'compose file', 'docker-compose.yml not found', 'check cwd path'));
  }

  const pkgRaw = readIfExists(path.join(cwd, 'package.json'));
  if (pkgRaw) {
    const pkg = JSON.parse(pkgRaw) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    for (const [name, spec] of Object.entries(pkg.dependencies || {})) {
      defaultEntries.push(add('npm', name, spec, 'package.json dependencies'));
    }
    for (const [name, spec] of Object.entries(pkg.devDependencies || {})) {
      defaultEntries.push(add('npmDev', name, spec, 'package.json devDependencies'));
    }
  }

  const pub = readIfExists(path.join(cwd, 'flutter_project', 'pubspec.yaml'));
  if (pub) {
    for (const [name, spec] of Object.entries(parsePubspecMapBlock(pub, 'dependencies'))) {
      defaultEntries.push(add('flutter', name, spec, 'flutter_project/pubspec.yaml'));
    }
    for (const [name, spec] of Object.entries(parsePubspecMapBlock(pub, 'dev_dependencies'))) {
      defaultEntries.push(add('flutterDev', name, spec, 'flutter_project/pubspec.yaml'));
    }
    defaultEntries.push(
      add('flutter', 'SDK constraint', '>=3.0.0 <4.0.0', 'environment.sdk in pubspec'),
      add('flutter', 'build define API_BASE_URL', '(optional)', 'Dockerfile ARG — leave empty for same-origin web'),
    );
  }

  defaultEntries.push(
    add('database', 'PostgreSQL', '16 (container)', 'from docker-compose'),
    add('database', 'Prisma schema', 'prisma/schema.prisma', 'DATABASE_URL'),
    add('env', 'DATABASE_URL / DB_*', '(see .env)', ''),
    add('env', 'JWT_SECRET / refresh', '(see .env)', ''),
    add('env', 'GOOGLE_CLIENT_ID / VITE_GOOGLE_CLIENT_ID', '(see .env)', ''),
    add('env', 'REDIS_URL / NATS_URL', '(see .env)', ''),
    add('crypto', 'bcrypt', 'password hashing', 'package.json'),
    add('crypto', 'jsonwebtoken', 'JWT', 'package.json'),
    add('crypto', '@simplewebauthn/*', 'WebAuthn', 'package.json'),
    add('crypto', 'Node crypto', 'built-in', 'no separate npm package'),
    add('crypto', 'OpenSSL (Alpine)', 'node:20-alpine', 'for Prisma / TLS client'),
  );

  const stagingEntries: DependencyCatalogEntry[] = JSON.parse(JSON.stringify(defaultEntries));

  return {
    version: 1,
    defaultProfile: 'default',
    profiles: {
      default: sortEntries(defaultEntries),
      staging: sortEntries(stagingEntries),
    },
  };
}

export function isDependencyCatalogV1(x: unknown): x is DependencyCatalogV1 {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  if (o.version !== 1) return false;
  if (typeof o.defaultProfile !== 'string' || !o.defaultProfile) return false;
  if (!o.profiles || typeof o.profiles !== 'object') return false;
  for (const k of Object.keys(o.profiles)) {
    const arr = (o.profiles as Record<string, unknown>)[k];
    if (!Array.isArray(arr)) return false;
    for (const row of arr) {
      if (!row || typeof row !== 'object') return false;
      const r = row as Record<string, unknown>;
      if (typeof r.category !== 'string' || typeof r.name !== 'string' || typeof r.spec !== 'string') return false;
    }
  }
  if (!(o.defaultProfile in (o.profiles as object))) return false;
  return true;
}

/** Text export similar to dependencies.txt for CI or docs. */
export function catalogToText(catalog: DependencyCatalogV1, profileKey?: string): string {
  const profile = profileKey ?? catalog.defaultProfile;
  const rows = catalog.profiles[profile] ?? [];
  const byCat = new Map<string, DependencyCatalogEntry[]>();
  for (const r of rows.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))) {
    const list = byCat.get(r.category) ?? [];
    list.push(r);
    byCat.set(r.category, list);
  }

  const lines: string[] = [];
  lines.push(`Neighborly — dependency catalog (profile: ${profile})`);
  lines.push(`Exported at: ${new Date().toISOString()}`);
  lines.push('');
  const catOrder = ['runtime', 'docker', 'npm', 'npmDev', 'crypto', 'database', 'flutter', 'flutterDev', 'env'];
  const keys = [...new Set([...catOrder, ...byCat.keys()])];
  for (const cat of keys) {
    const list = byCat.get(cat);
    if (!list?.length) continue;
    lines.push('='.repeat(80));
    lines.push(cat.toUpperCase());
    lines.push('='.repeat(80));
    for (const e of list) {
      lines.push(`- ${e.name}: ${e.spec}${e.notes ? `  (${e.notes})` : ''}`);
    }
    lines.push('');
  }
  lines.push('END');
  return lines.join('\n');
}
