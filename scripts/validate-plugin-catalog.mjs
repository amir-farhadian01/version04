import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const catalog = readJson('plugins/plugin-catalog.json');
const marketplace = readJson('.agents/plugins/marketplace.json');
const release = readJson('release-manifest.json');
const problems = [];
const declaredSkills = new Set();

if (marketplace.name !== catalog.marketplace) problems.push('Marketplace name differs from plugin catalog');

const marketplaceByName = new Map(marketplace.plugins.map((entry) => [entry.name, entry]));
for (const [name, definition] of Object.entries(catalog.plugins)) {
  const manifestPath = resolve('plugins', name, '.codex-plugin/plugin.json');
  let manifest;
  try {
    manifest = readJson(manifestPath);
  } catch {
    problems.push(`${name}: missing or invalid plugin manifest`);
    continue;
  }
  if (manifest.name !== name) problems.push(`${name}: folder and manifest names differ`);
  if (manifest.version !== definition.version) problems.push(`${name}: catalog and manifest versions differ`);
  if ('apps' in manifest || 'mcpServers' in manifest) problems.push(`${name}: external apps/MCP are forbidden in local-safe mode`);
  const entry = marketplaceByName.get(name);
  if (!entry) problems.push(`${name}: missing marketplace entry`);
  else {
    if (entry.source?.source !== 'local' || entry.source?.path !== `./plugins/${name}`) problems.push(`${name}: marketplace source must be local`);
    if (entry.policy?.installation !== 'AVAILABLE' || entry.policy?.authentication !== 'ON_INSTALL') problems.push(`${name}: marketplace policy differs from approved defaults`);
  }
  for (const skill of definition.canonicalSkills) {
    if (declaredSkills.has(skill)) problems.push(`${skill}: assigned to more than one plugin`);
    declaredSkills.add(skill);
    try {
      if (!statSync(resolve('.agents/skills', skill, 'SKILL.md')).isFile()) problems.push(`${skill}: canonical SKILL.md is missing`);
    } catch {
      problems.push(`${skill}: canonical SKILL.md is missing`);
    }
  }
  for (const role of definition.canonicalRoleCards) {
    try {
      if (!statSync(resolve('.agents', `${role}.md`)).isFile()) problems.push(`${role}: canonical role card is missing`);
    } catch {
      problems.push(`${role}: canonical role card is missing`);
    }
  }
}

for (const name of marketplaceByName.keys()) if (!catalog.plugins[name]) problems.push(`${name}: marketplace entry is absent from catalog`);
const canonicalSkillDirs = readdirSync('.agents/skills', { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
const catalogSkills = [...declaredSkills].sort();
if (JSON.stringify(canonicalSkillDirs) !== JSON.stringify(catalogSkills)) problems.push('Canonical growth skill inventory differs from plugin catalog');
const catalogVersions = Object.fromEntries(Object.entries(catalog.plugins).map(([name, value]) => [name, value.version]));
if (JSON.stringify(release.plugins) !== JSON.stringify(catalogVersions)) problems.push('Release manifest plugin versions differ from catalog');

if (problems.length) {
  console.error('Plugin catalog validation failed:');
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}
console.log(`Plugin catalog validation passed (${Object.keys(catalog.plugins).length} plugins, ${catalogSkills.length} canonical skills).`);
