#!/usr/bin/env bash
# Run Neighborly stack
# Usage: ./run-project.sh [start|stop|restart|status]

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_PORT="${PORT:-3000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"

start_backend() {
  echo "Starting backend on port $BACKEND_PORT..."
  cd "$SCRIPT_DIR"
  npm run dev &
  echo "Backend starting at http://localhost:$BACKEND_PORT"
}

start_frontend() {
  echo "Starting frontend on port $FRONTEND_PORT..."
  cd "$SCRIPT_DIR/frontend"
  npm run dev &
  echo "Frontend starting at http://localhost:$FRONTEND_PORT"
}

stop_services() {
  echo "Stopping services..."
  fuser -k "${BACKEND_PORT}/tcp" 2>/dev/null || true
  fuser -k "${FRONTEND_PORT}/tcp" 2>/dev/null || true
  echo "Done."
}

show_status() {
  echo "=== Neighborly Stack Status ==="
  lsof -Pi :"$BACKEND_PORT" -sTCP:LISTEN -t >/dev/null 2>&1 \
    && echo "Backend:  running on http://localhost:$BACKEND_PORT" \
    || echo "Backend:  not running"
  lsof -Pi :"$FRONTEND_PORT" -sTCP:LISTEN -t >/dev/null 2>&1 \
    && echo "Frontend: running on http://localhost:$FRONTEND_PORT" \
    || echo "Frontend: not running"
}

case "${1:-start}" in
  start)
    [ ! -f "$SCRIPT_DIR/.env" ] && cp "$SCRIPT_DIR/.env.example" "$SCRIPT_DIR/.env"
    start_backend
    sleep 2
    start_frontend
    sleep 1
    show_status
    ;;
  stop)    stop_services ;;
  restart) stop_services; sleep 1; start_backend; sleep 2; start_frontend ;;
  status)  show_status ;;
  *) echo "Usage: $0 [start|stop|restart|status]"; exit 1 ;;
esac
