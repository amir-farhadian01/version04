#!/usr/bin/env bash
# Run from repo root: ./scripts/verify-stack.sh
# After: docker compose up -d --build
set -euo pipefail
cd "$(dirname "$0")/.."

echo "=== docker compose ps ==="
docker compose ps -a

echo ""
echo "=== HTTP checks (Traefik :80) ==="
BASE="${BASE_URL:-http://127.0.0.1}"
checks=(
  "$BASE/dozzle/"
  "$BASE/metabase/"
  "$BASE/portainer/"
  "$BASE/flutter/"
  "$BASE/"
)
for url in "${checks[@]}"; do
  code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 15 "$url" || echo "ERR")
  echo "$code  $url"
done

echo ""
echo "=== Direct ports (optional) ==="
for pair in "3000:web-app" "3001:metabase" "9000:portainer" "8888:dozzle" "8080:traefik-dashboard"; do
  port="${pair%%:*}"
  name="${pair#*:}"
  code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 5 "http://127.0.0.1:$port/" 2>/dev/null || echo "skip")
  echo "port $port ($name): HTTP $code"
done

echo ""
echo "Dozzle direct (no Traefik): http://127.0.0.1:8888/dozzle/"

echo ""
echo "=== Public API (host port 3000 → web-app) ==="
BASE=http://127.0.0.1:3000 bash "$(dirname "$0")/check-public-api.sh" || true
