#!/usr/bin/env bash
# Public API paths (no Bearer). After the server is up: BASE=http://127.0.0.1:8080 ./scripts/check-public-api.sh
set -euo pipefail
BASE="${BASE:-http://127.0.0.1:8080}"
codes=0
check() {
  local url="$1"
  local want="${2:-200}"
  local code
  code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 8 "$url" || echo "000")
  if [[ "$code" != "$want" && "$want" != "any" ]]; then
    echo "FAIL $code (expected $want) $url"
    codes=1
  else
    echo "OK   $code $url"
  fi
}

echo "BASE=$BASE"
check "$BASE/api/system/config"
check "$BASE/api/categories"
check "$BASE/api/services"
check "$BASE/api/companies"
check "$BASE/api/posts"
check "$BASE/" "any"

exit "$codes"
