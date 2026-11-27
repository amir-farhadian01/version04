#!/usr/bin/env bash
# Static control test: does not contact Docker, a database, or an HTTP endpoint.
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
registry="$root_dir/config/ports.env"
launcher="$root_dir/run-project.sh"

required_keys=(
  LOCAL_DEVELOPMENT_API_HOST_PORT
  LOCAL_DEVELOPMENT_ADMIN_HOST_PORT
  LOCAL_DEVELOPMENT_VITE_HOST_PORT
  LOCAL_DEVELOPMENT_FLUTTER_DOCUMENTED_HOST_PORT
  BASE_COMPOSE_POSTGRES_HOST_PORT_DEFAULT
  DEVELOPMENT_POSTGRES_HOST_PORT
  DEVELOPMENT_POSTGRES_MEDIA_HOST_PORT
  DEVELOPMENT_REDIS_HOST_PORT
)

for key in "${required_keys[@]}"; do
  grep -Eq "^${key}=[0-9]{1,5}$" "$registry"
done
awk -F= '/^[A-Z][A-Z0-9_]*=/ { if ($2 < 1 || $2 > 65535) exit 1 }' "$registry"

! grep -Eq 'NEIGHBORLY_(API|ADMIN|WEB|FLUTTER)_PORT' "$launcher"
grep -Fq 'PORTS_FILE=' "$launcher"
grep -Fq 'load_ports' "$launcher"
grep -Fq 'config/ports.env' "$root_dir/docs/PORTS.md"
grep -Fq 'docs/PORTS.md' "$root_dir/PORTS.md"
grep -Fq 'BASE_COMPOSE_TRAEFIK_HTTP_HOST_PORT' "$root_dir/docker-compose.yml"
grep -Fq 'STAGING_API_HOST_PORT' "$root_dir/docker-compose.staging.yml"
grep -Fq 'DEVELOPMENT_POSTGRES_HOST_PORT' "$root_dir/docker-compose.development.yml"
grep -Fq 'development_report' "$launcher"
! grep -Eq '"[0-9]{2,5}:[0-9]{2,5}"' "$root_dir/docker-compose.yml"
! grep -Eq '"[0-9]{2,5}:[0-9]{2,5}"' "$root_dir/docker-compose.staging.yml"

tmp_registry="$(mktemp)"
trap 'rm -f "$tmp_registry"' EXIT
cp "$registry" "$tmp_registry"
printf '%s\n' 'LOCAL_DEVELOPMENT_API_HOST_PORT=not-a-port' >> "$tmp_registry"

if NEIGHBORLY_PORTS_FILE="$tmp_registry" "$launcher" help >/dev/null 2>&1; then
  printf '%s\n' 'expected malformed registry to be rejected' >&2
  exit 1
fi

sed -i '$d' "$tmp_registry"
printf '%s\n' 'UNUSED_PORT=70000' >> "$tmp_registry"
if NEIGHBORLY_PORTS_FILE="$tmp_registry" "$launcher" help >/dev/null 2>&1; then
  printf '%s\n' 'expected out-of-range registry value to be rejected' >&2
  exit 1
fi
