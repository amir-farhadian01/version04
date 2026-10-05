import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readReleaseManifest, resolveApiVersion } from "./releaseInfo.js";

describe("releaseInfo (canonical release manifest)", () => {
  const tempDirs: string[] = [];

  function writeTempManifest(content: string): string {
    const dir = mkdtempSync(path.join(tmpdir(), "release-info-"));
    tempDirs.push(dir);
    const file = path.join(dir, "release-manifest.json");
    writeFileSync(file, content, "utf8");
    return file;
  }

  afterEach(() => {
    while (tempDirs.length) {
      rmSync(tempDirs.pop() as string, { recursive: true, force: true });
    }
  });

  it("resolves the api version from the repository release manifest", () => {
    const manifest = JSON.parse(readFileSync("release-manifest.json", "utf8")) as {
      applications: { api: string };
    };
    expect(manifest.applications.api.length).toBeGreaterThan(0);
    expect(resolveApiVersion()).toBe(manifest.applications.api);
  });

  it("reads applications.api from an explicit manifest path", () => {
    const file = writeTempManifest(
      JSON.stringify({ schemaVersion: 1, applications: { api: "9.9.9" } }),
    );
    expect(resolveApiVersion(file)).toBe("9.9.9");
  });

  it("throws when applications.api is missing or the manifest is unreadable", () => {
    const bad = writeTempManifest(JSON.stringify({ schemaVersion: 1, applications: {} }));
    expect(() => readReleaseManifest(bad)).toThrow(/applications\.api/);
    expect(() => resolveApiVersion(path.join(tmpdir(), "no-such-manifest.json"))).toThrow();
  });
});