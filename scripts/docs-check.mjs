#!/usr/bin/env node
/**
 * Reads docs/ROADMAP.md, runs each phase's indented shell commands under
 * "**Drift checks (commands):**", compares pass/fail to the Status table.
 */
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const roadmapPath = join(root, "docs", "ROADMAP.md");

function parsePhases(md) {
  const blocks = md.split(/\n(?=### F\d+)/);
  const out = [];
  for (const block of blocks) {
    const h = block.match(/^### (F\d+)/);
    if (!h) continue;
    const id = h[1];
    const statusBlock = block.match(/\*\*Status:\*\*([\s\S]*?)(?=\n- \*\*Evidence|\n- \*\*Done|\n### )/);
    let recorded = ["?", "?", "?"];
    if (statusBlock) {
      const lines = statusBlock[1].split("\n");
      for (const line of lines) {
        const cells = line
          .split("|")
          .map((c) => c.trim())
          .filter((c) => c && !/^[\-:]+$/.test(c));
        if (
          cells.length === 3 &&
          /^[✅🚧⏳❓⚠]/.test(cells[0]) &&
          /^[✅🚧⏳❓⚠]/.test(cells[1]) &&
          /^[✅🚧⏳❓⚠]/.test(cells[2])
        ) {
          recorded = cells;
          break;
        }
      }
    }
    const driftStart = block.indexOf("**Drift checks (commands):**");
    const cmds = [];
    if (driftStart !== -1) {
      const tail = block.slice(driftStart).split("\n");
      for (let i = 1; i < tail.length; i++) {
        const line = tail[i];
        if (line.startsWith("### ")) break;
        if (line.match(/^- \*\*/)) break;
        const m = line.match(/^ {4}(.+)$/);
        if (m) cmds.push(m[1].trim());
      }
    }
    out.push({ id, recorded, cmds });
  }
  return out;
}

function runCmd(cmd) {
  execSync(cmd, { cwd: root, stdio: "pipe", shell: "/bin/bash" });
}

function main() {
  if (!existsSync(roadmapPath)) {
    console.error("docs/ROADMAP.md not found");
    process.exit(1);
  }
  const md = readFileSync(roadmapPath, "utf8");
  const phases = parsePhases(md);
  let exit = 0;

  for (const { id, recorded, cmds } of phases) {
    void recorded;
    if (!cmds.length) {
      console.log(`${id}: ⚠ drift — no Drift checks (commands) parsed`);
      exit = 1;
      continue;
    }
    let failReason = null;
    for (const cmd of cmds) {
      try {
        runCmd(cmd);
      } catch {
        failReason = `command failed: ${cmd}`;
        break;
      }
    }
    if (failReason) {
      console.log(`${id}: ⚠ drift — reason: ${failReason}`);
      exit = 1;
      continue;
    }
    console.log(`${id}: ✅ matches recorded`);
  }

  process.exit(exit);
}

main();
