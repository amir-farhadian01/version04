import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * Canonical release-info reader. release-manifest.json at the repository root is the single
 * source of truth for application versions (docs/launch/release-runbook.md); this module is
 * the only runtime accessor for it.
 */
export interface ReleaseManifest {
  schemaVersion: number;
  applications: Record<string, string>;
}

function defaultManifestPath(): string {
  try {
    return fileURLToPath(new URL("../release-manifest.json", import.meta.url));
  } catch {
    // Under test bundlers import.meta.url may not be a file:// URL; the tests and the API
    // both run from the repository root, so resolve from the working directory.
    return path.resolve(process.cwd(), "release-manifest.json");
  }
}

export function readReleaseManifest(manifestPath?: string): ReleaseManifest {
  const resolved = manifestPath ?? defaultManifestPath();
  const raw = readFileSync(resolved, "utf8");
  const parsed = JSON.parse(raw) as { schemaVersion?: unknown; applications?: unknown };
  if (
    !parsed ||
    typeof parsed !== "object" ||
    !parsed.applications ||
    typeof parsed.applications !== "object" ||
    typeof (parsed.applications as Record<string, unknown>).api !== "string" ||
    (parsed.applications as Record<string, string>).api.length === 0
  ) {
    throw new Error(`release-manifest.json at ${resolved} is missing a non-empty applications.api`);
  }
  return parsed as ReleaseManifest;
}

export function resolveApiVersion(manifestPath?: string): string {
  return readReleaseManifest(manifestPath).applications.api;
}