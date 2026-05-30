#!/usr/bin/env bash
# =============================================================================
# Neighborly — Start All Services (ONE COMMAND)
# =============================================================================
# Usage:
#   ./scripts/start-all.sh              # interactive menu
#   ./scripts/start-all.sh --all        # ONE COMMAND: everything
#   ./scripts/start-all.sh --check      # check running services
#
# Requirements:
#   - Node.js, npm, tsx installed
#   - Flutter SDK installed (for Flutter)
#   - Docker installed (for PostgreSQL)
# =============================================================================

set -euo pipefail

# ── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# ── Paths ────────────────────────────────────────────────────────────────────
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"
FLUTTER_DIR="$ROOT_DIR/flutter_project"
LOG_DIR="$ROOT_DIR/logs"
PIDS_FILE="$ROOT_DIR/.start-all-pids"

mkdir -p "$LOG_DIR"
rm -f "$PIDS_FILE"

# ── Helpers ──────────────────────────────────────────────────────────────────
log_info()  { echo -e "${CYAN}[INFO]${NC}  $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}    $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

cleanup() {
  echo ""
  log_warn "Shutting down all services..."
  if [ -f "$PIDS_FILE" ]; then
    while IFS= read -r pid; do
      if kill -0 "$pid" 2>/dev/null; then
        kill "$pid" 2>/dev/null && log_info "Stopped PID $pid"
      fi
    done < "$PIDS_FILE"
    rm -f "$PIDS_FILE"
  fi
  log_ok "All services stopped."
  exit 0
}
trap cleanup SIGINT SIGTERM

save_pid() { echo "$1" >> "$PIDS_FILE"; }

wait_for_port() {
  local host="$1"
  local port="$2"
  local name="$3"
  local timeout="${4:-60}"
  local interval="${5:-2}"
  local elapsed=0
  log_info "Waiting for $name ($host:$port)..."
  while [ $elapsed -lt $timeout ]; do
    if timeout 2 bash -c "echo > /dev/tcp/$host/$port" 2>/dev/null; then
      log_ok "$name is ready on $host:$port"
      return 0
    fi
    sleep "$interval"
    elapsed=$((elapsed + interval))
  done
  log_warn "$name not ready after ${timeout}s"
  return 1
}

wait_for_http() {
  local url="$1"
  local name="$2"
  local timeout="${3:-60}"
  local interval="${4:-3}"
  local elapsed=0
  log_info "Waiting for $name to respond..."
  while [ $elapsed -lt $timeout ]; do
    if curl -sS -o /dev/null -w "%{http_code}" --max-time 3 "$url" 2>/dev/null | grep -qE '^[23]'; then
      log_ok "$name is ready → $url"
      return 0
    fi
    sleep "$interval"
    elapsed=$((elapsed + interval))
  done
  log_warn "$name not ready after ${timeout}s → $url"
  return 1
}

# ── PostgreSQL (Docker or Local) ─────────────────────────────────────────────
ensure_postgresql() {
  # Strategy 1: Try Docker if available
  if docker info >/dev/null 2>&1; then
    log_ok "Docker daemon is running"
    log_info "Starting PostgreSQL via Docker..."
    cd "$ROOT_DIR"
    if docker compose up -d --wait 2>&1; then
      log_ok "Docker PostgreSQL is up"
      cd "$ROOT_DIR"
      return 0
    fi
    log_warn "Docker compose had issues, falling back to local PostgreSQL..."
    cd "$ROOT_DIR"
  else
    log_info "Docker not available, checking local PostgreSQL..."
  fi

  # Strategy 2: Local PostgreSQL
  if command -v pg_isready &>/dev/null; then
    if pg_isready -q 2>/dev/null; then
      log_ok "Local PostgreSQL is already running"
      return 0
    fi
    log_info "Starting local PostgreSQL..."
    if command -v pg_ctlcluster &>/dev/null; then
      local pg_version
      pg_version=$(pg_lsclusters -h 2>/dev/null | head -1 | awk '{print $1}')
      if [ -n "$pg_version" ]; then
        sudo pg_ctlcluster "$pg_version" main start 2>/dev/null && {
          log_ok "Local PostgreSQL started (version $pg_version)"
          return 0
        }
      fi
    fi
    if command -v pg_ctl &>/dev/null; then
      pg_ctl start -D /var/lib/postgresql/*/main -l /var/log/postgresql/postgresql.log 2>/dev/null && {
        log_ok "Local PostgreSQL started via pg_ctl"
        return 0
      }
    fi
    log_error "Cannot start local PostgreSQL. Please start it manually."
    return 1
  fi

  log_error "Neither Docker nor local PostgreSQL found."
  return 1
}

# ── Services ─────────────────────────────────────────────────────────────────
start_backend() {
  log_info "Installing npm dependencies..."
  cd "$ROOT_DIR"
  npm install --silent 2>/dev/null || true

  log_info "Starting Backend API (port 8080) + Admin API (port 9090)..."
  npx tsx server.ts > "$LOG_DIR/backend.log" 2>&1 &
  local pid=$!
  save_pid "$pid"
  log_info "Backend PID: $pid (logs: $LOG_DIR/backend.log)"

  # Wait longer for backend (Prisma needs DB connection)
  wait_for_http "http://localhost:8080/api/health" "Backend API" 60 3
  cd "$ROOT_DIR"
}

start_frontend() {
  log_info "Starting React Frontend (port 5173)..."
  cd "$FRONTEND_DIR"
  npm install --silent 2>/dev/null || true
  npm run dev -- --port 5173 > "$LOG_DIR/frontend.log" 2>&1 &
  local pid=$!
  save_pid "$pid"
  log_info "Frontend PID: $pid (logs: $LOG_DIR/frontend.log)"
  wait_for_http "http://localhost:5173" "React Frontend" 45
  cd "$ROOT_DIR"
}

start_flutter() {
  log_info "Starting Flutter Web (port 7357)..."
  cd "$FLUTTER_DIR"
  flutter pub get > "$LOG_DIR/flutter-pubget.log" 2>&1
  flutter run -d web-server --web-port 7357 > "$LOG_DIR/flutter.log" 2>&1 &
  local pid=$!
  save_pid "$pid"
  log_info "Flutter PID: $pid (logs: $LOG_DIR/flutter.log)"
  wait_for_http "http://localhost:7357" "Flutter Web" 90 5
  cd "$ROOT_DIR"
}

# ── Status Check ─────────────────────────────────────────────────────────────
check_all() {
  echo ""
  echo "=============================================="
  echo -e "${CYAN}  Neighborly — Service Status${NC}"
  echo "=============================================="
  echo ""

  local services=(
    "Backend API|http://localhost:8080/api/health"
    "Admin API|http://localhost:9090/admin"
    "React Frontend|http://localhost:5173"
    "Flutter Web|http://localhost:7357"
  )

  for entry in "${services[@]}"; do
    local name="${entry%%|*}"
    local url="${entry##*|}"
    local code
    code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 5 "$url" 2>/dev/null || echo "ERR")
    if [ "$code" != "ERR" ] && { [ "${code:0:1}" = "2" ] || [ "${code:0:1}" = "3" ]; }; then
      log_ok "$name → HTTP $code ($url)"
    else
      log_error "$name → HTTP $code ($url)"
    fi
  done

  echo ""
  echo "=============================================="
  echo -e "${CYAN}  Logs: $LOG_DIR/${NC}"
  echo "=============================================="
}

# ── Main ─────────────────────────────────────────────────────────────────────
main() {
  local mode="${1:-interactive}"

  echo ""
  echo "=============================================="
  echo -e "${CYAN}  Neighborly — Start All Services${NC}"
  echo "=============================================="
  echo ""

  case "$mode" in
    --all|-a)
      # ── STEP 1: PostgreSQL ──
      log_info "Step 1/4: PostgreSQL..."
      ensure_postgresql
      wait_for_port "127.0.0.1" "5432" "PostgreSQL" 60

      # ── STEP 2: Backend API ──
      log_info "Step 2/4: Backend API..."
      start_backend

      # ── STEP 3: React Frontend ──
      log_info "Step 3/4: React Frontend..."
      start_frontend

      # ── STEP 4: Flutter Web ──
      log_info "Step 4/4: Flutter Web..."
      start_flutter

      check_all
      ;;

    --check|-c)
      check_all
      ;;

    --help|-h)
      echo "Usage:"
      echo "  ./scripts/start-all.sh --all     ONE COMMAND: start everything"
      echo "  ./scripts/start-all.sh --check   Check running services"
      echo "  ./scripts/start-all.sh           Interactive menu"
      ;;

    *)
      # Interactive mode
      echo "Select what to start:"
      echo "  1) ALL services (Docker + Backend + Frontend + Flutter)"
      echo "  2) Docker infrastructure only (PostgreSQL)"
      echo "  3) Backend API only (port 8080)"
      echo "  4) React Frontend only (port 5173)"
      echo "  5) Flutter Web only (port 7357)"
      echo "  6) Check status only"
      echo ""
      read -rp "Enter number: " choice

      case "$choice" in
        1)
          ensure_postgresql
          wait_for_port "127.0.0.1" "5432" "PostgreSQL" 60
          start_backend
          start_frontend
          start_flutter
          check_all
          ;;
        2)
          ensure_postgresql
          wait_for_port "127.0.0.1" "5432" "PostgreSQL" 60
          check_all
          ;;
        3)
          start_backend
          check_all
          ;;
        4)
          start_frontend
          check_all
          ;;
        5)
          start_flutter
          check_all
          ;;
        6)
          check_all
          ;;
        *)
          log_error "Invalid choice"
          exit 1
          ;;
      esac
      ;;
  esac

  echo ""
  echo "=============================================="
  echo -e "${GREEN}  ✅ All requested services started.${NC}"
  echo -e "${CYAN}  Press Ctrl+C to stop everything.${NC}"
  echo "=============================================="
  echo ""
  echo -e "  ${YELLOW}Backend API:${NC}      http://localhost:8080"
  echo -e "  ${YELLOW}Admin Dashboard:${NC}  http://localhost:9090/admin"
  echo -e "  ${YELLOW}React Frontend:${NC}   http://localhost:5173"
  echo -e "  ${YELLOW}Flutter Web:${NC}      http://localhost:7357"
  echo ""

  # Wait forever so Ctrl+C triggers cleanup
  if [ "$mode" != "--check" ] && [ "$mode" != "-c" ]; then
    wait
  fi
}

main "$@"
