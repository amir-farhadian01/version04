#!/usr/bin/env bash
# =============================================================================
# Neighborly — Agent Runner
# Reads prompt files from prompts/ and executes them one by one.
# After each prompt, runs tests and commits.
# =============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PROMPTS_DIR="${ROOT_DIR}/prompts"
LOGS_DIR="${ROOT_DIR}/logs"
TIMESTAMP=$(date '+%Y%m%d-%H%M%S')
LOG_FILE="${LOGS_DIR}/agent-runner-${TIMESTAMP}.log"
CURRENT_PROMPT=""

mkdir -p "${LOGS_DIR}"

log()  { echo "[$(date '+%H:%M:%S')] $*" | tee -a "${LOG_FILE}"; }
fail() { log "❌ FAILED: $*"; exit 1; }

# ---------------------------------------------------------------------------
# Step 1 — Run a single prompt file
# ---------------------------------------------------------------------------
run_prompt() {
  local prompt_file="$1"
  local prompt_name
  prompt_name="$(basename "${prompt_file}" .md)"
  CURRENT_PROMPT="${prompt_name}"

  log ""
  log "═══════════════════════════════════════════════════════════════"
  log "  ▶  PROMPT: ${prompt_name}"
  log "═══════════════════════════════════════════════════════════════"

  # The prompt file contains instructions for the AI agent.
  # We log it and then the agent (this script's caller) reads it.
  cat "${prompt_file}" >> "${LOG_FILE}"
  log "  ✓  Prompt loaded — ready for execution"
}

# ---------------------------------------------------------------------------
# Step 2 — Run backend tests
# ---------------------------------------------------------------------------
run_tests() {
  log ""
  log "  ── Running tests ──"

  cd "${ROOT_DIR}"

  # TypeScript type check
  log "  • typecheck..."
  npm run typecheck 2>&1 | tee -a "${LOG_FILE}" || fail "TypeScript typecheck failed after ${CURRENT_PROMPT}"

  # Backend tests
  log "  • vitest (backend)..."
  npx vitest run --config vitest.backend.config.ts 2>&1 | tee -a "${LOG_FILE}" || fail "Backend tests failed after ${CURRENT_PROMPT}"

  log "  ✓  All tests passed"
}

# ---------------------------------------------------------------------------
# Step 3 — Git commit
# ---------------------------------------------------------------------------
git_commit() {
  log ""
  log "  ── Git commit ──"

  cd "${ROOT_DIR}"

  if git diff --quiet && git diff --cached --quiet; then
    log "  • No changes to commit"
    return
  fi

  git add -A
  git commit -m "feat: ${CURRENT_PROMPT}" 2>&1 | tee -a "${LOG_FILE}" || true
  log "  ✓  Committed"
}

# ---------------------------------------------------------------------------
# Step 4 — Git push
# ---------------------------------------------------------------------------
git_push() {
  log ""
  log "  ── Git push ──"

  cd "${ROOT_DIR}"
  git push 2>&1 | tee -a "${LOG_FILE}" || log "  ⚠  Push failed (may need manual push)"
  log "  ✓  Pushed"
}

# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------
main() {
  log "================================================================"
  log "  Neighborly Agent Runner — ${TIMESTAMP}"
  log "================================================================"

  local prompt_files
  prompt_files=($(ls "${PROMPTS_DIR}"/*.md 2>/dev/null | sort))

  if [[ ${#prompt_files[@]} -eq 0 ]]; then
    fail "No prompt files found in ${PROMPTS_DIR}"
  fi

  log "Found ${#prompt_files[@]} prompt(s) to execute"
  log ""

  for prompt_file in "${prompt_files[@]}"; do
    run_prompt "${prompt_file}"
    run_tests
    git_commit
    log "  ✓  Prompt completed successfully"
  done

  git_push

  log ""
  log "================================================================"
  log "  ✅ ALL PROMPTS COMPLETED SUCCESSFULLY"
  log "================================================================"
}

main "$@"