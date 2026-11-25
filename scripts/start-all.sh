#!/usr/bin/env bash
# Compatibility wrapper for the retired broad launcher.
# It never installs, starts Docker, or stops processes by itself.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTROL="$ROOT_DIR/run-project.sh"

case "${1:-}" in
  --check|-c) exec "$CONTROL" status ;;
  start|restart|stop|logs|doctor|status) exec "$CONTROL" "$@" ;;
  --all|-a|'')
    printf '%s\n' 'The former broad start-all workflow is retired in this phase.' >&2
    printf '%s\n' 'No Docker, database, API, frontend, Flutter process, install, or build was started.' >&2
    printf '%s\n' 'Use ./run-project.sh doctor for a read-only report.' >&2
    exit 3
    ;;
  --help|-h)
    printf '%s\n' 'Compatibility wrapper: --check maps to status; broad --all and interactive start are intentionally blocked.'
    printf '%s\n' 'Use ./run-project.sh --help for the supported control interface.'
    ;;
  *)
    printf 'Unsupported legacy argument: %s\n' "$1" >&2
    printf '%s\n' 'Use ./run-project.sh --help.' >&2
    exit 2
    ;;
esac
