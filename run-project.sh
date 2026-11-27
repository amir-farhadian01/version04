#!/usr/bin/env bash
# Neighborly local environment control. It intentionally does not create .env,
# install packages, or start infrastructure.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_DIR="${NEIGHBORLY_RUNTIME_STATE_DIR:-${XDG_RUNTIME_DIR:-/tmp}/neighborly-runtime-${UID}}"
PORTS_FILE="${NEIGHBORLY_PORTS_FILE:-$ROOT_DIR/config/ports.env}"

load_ports() {
  local line key value
  [ -r "$PORTS_FILE" ] || blocked "port registry is missing or unreadable: $PORTS_FILE"
  while IFS= read -r line || [ -n "$line" ]; do
    [[ -z "$line" || "$line" == \#* ]] && continue
    [[ "$line" =~ ^([A-Z][A-Z0-9_]*)=([0-9]{1,5})$ ]] || blocked "invalid port-registry entry (only KEY=integer is allowed)"
    key="${BASH_REMATCH[1]}"
    value="${BASH_REMATCH[2]}"
    (( value >= 1 && value <= 65535 )) || blocked "invalid port-registry port value for $key"
    case "$key" in
      LOCAL_DEVELOPMENT_API_HOST_PORT|LOCAL_DEVELOPMENT_ADMIN_HOST_PORT|LOCAL_DEVELOPMENT_VITE_HOST_PORT|LOCAL_DEVELOPMENT_ADMIN_VITE_HOST_PORT|LOCAL_DEVELOPMENT_FLUTTER_DOCUMENTED_HOST_PORT|BASE_COMPOSE_POSTGRES_HOST_PORT_DEFAULT|DEVELOPMENT_POSTGRES_HOST_PORT|DEVELOPMENT_POSTGRES_MEDIA_HOST_PORT|DEVELOPMENT_REDIS_HOST_PORT)
        printf -v "$key" '%s' "$value"
        ;;
    esac
  done < "$PORTS_FILE"
  : "${LOCAL_DEVELOPMENT_API_HOST_PORT:?missing LOCAL_DEVELOPMENT_API_HOST_PORT in port registry}"
  : "${LOCAL_DEVELOPMENT_ADMIN_HOST_PORT:?missing LOCAL_DEVELOPMENT_ADMIN_HOST_PORT in port registry}"
  : "${LOCAL_DEVELOPMENT_VITE_HOST_PORT:?missing LOCAL_DEVELOPMENT_VITE_HOST_PORT in port registry}"
  : "${LOCAL_DEVELOPMENT_ADMIN_VITE_HOST_PORT:?missing LOCAL_DEVELOPMENT_ADMIN_VITE_HOST_PORT in port registry}"
  : "${LOCAL_DEVELOPMENT_FLUTTER_DOCUMENTED_HOST_PORT:?missing LOCAL_DEVELOPMENT_FLUTTER_DOCUMENTED_HOST_PORT in port registry}"
  : "${BASE_COMPOSE_POSTGRES_HOST_PORT_DEFAULT:?missing BASE_COMPOSE_POSTGRES_HOST_PORT_DEFAULT in port registry}"
  : "${DEVELOPMENT_POSTGRES_HOST_PORT:?missing DEVELOPMENT_POSTGRES_HOST_PORT in port registry}"
  : "${DEVELOPMENT_POSTGRES_MEDIA_HOST_PORT:?missing DEVELOPMENT_POSTGRES_MEDIA_HOST_PORT in port registry}"
  : "${DEVELOPMENT_REDIS_HOST_PORT:?missing DEVELOPMENT_REDIS_HOST_PORT in port registry}"
  API_PORT="$LOCAL_DEVELOPMENT_API_HOST_PORT"
  ADMIN_PORT="$LOCAL_DEVELOPMENT_ADMIN_HOST_PORT"
  WEB_PORT="$LOCAL_DEVELOPMENT_VITE_HOST_PORT"
  FLUTTER_PORT="$LOCAL_DEVELOPMENT_FLUTTER_DOCUMENTED_HOST_PORT"
  POSTGRES_PORT="$BASE_COMPOSE_POSTGRES_HOST_PORT_DEFAULT"
}

usage() {
  cat <<'EOF'
Usage: ./run-project.sh <doctor|status|start|restart|stop|logs> [options]

Commands:
  doctor, status             Read-only environment and readiness report.
  start, restart             Starts/restarts only version04_dev infrastructure and owned host processes.
  stop --service <name>      Stops only verified launcher-owned api/web/admin-web or version04_dev.
  logs --service <name>      Shows bounded logs for a managed service.

The control never creates a project .env, installs dependencies, pulls/builds
images, seeds/resets data, changes Docker context, or kills by port. Its
approved development start applies existing migrations only to version04_dev.
EOF
}

say() { printf '%s\n' "$*"; }
blocked() { say "ENVIRONMENT BLOCKED: $*" >&2; exit 3; }
state_file() { printf '%s/%s.state' "$STATE_DIR" "$1"; }
log_dir() { printf '%s/logs' "$STATE_DIR"; }
development_compose_file() { printf '%s/docker-compose.development.yml' "$ROOT_DIR"; }
development_credentials_file() { printf '%s' "${NEIGHBORLY_DEVELOPMENT_CREDENTIALS_FILE:-${XDG_STATE_HOME:-$HOME/.local/state}/neighborly/development.env}"; }
development_compose() { docker compose --env-file "$PORTS_FILE" --env-file "$(development_credentials_file)" -f "$(development_compose_file)" "$@"; }
root_id() { printf '%s' "$ROOT_DIR" | sha256sum | awk '{print $1}'; }
proc_start_ticks() { awk '{print $22}' "/proc/$1/stat" 2>/dev/null; }
proc_cmd_hash() { tr '\0' ' ' < "/proc/$1/cmdline" 2>/dev/null | sha256sum | awk '{print $1}'; }

port_listening() {
  local port="$1"
  ss -ltnH "sport = :$port" 2>/dev/null | grep -q .
}

report_port() {
  local label="$1" port="$2"
  local service=""
  case "$label" in
    API|ADMIN) service='api' ;;
    WEB) service='web' ;;
    ADMIN_VITE) service='admin-web' ;;
  esac
  if port_listening "$port"; then
    if [ -n "$service" ] && managed_service_running "$service"; then
      say "PORT $label ($port): in use by verified launcher-owned $service process"
      return 0
    fi
    say "PORT $label ($port): IN USE (ownership unknown unless verified state exists)"
    return 1
  fi
  say "PORT $label ($port): free"
  return 0
}

docker_report() {
  if ! command -v docker >/dev/null 2>&1; then
    say 'DOCKER: unavailable (docker CLI not found)'
    return
  fi
  local context
  context="$(docker context show 2>/dev/null || true)"
  if [ -n "$context" ]; then
    say "DOCKER CONTEXT: $context (observed; no project-specific expected context is configured)"
  else
    say 'DOCKER CONTEXT: unavailable'
  fi
  if docker info >/dev/null 2>&1; then
    say 'DOCKER ENGINE: reachable'
    say 'COMPOSE PROJECT: Engine reachable; project discovery is not run until a safe-start scope selects an explicit compose target'
  else
    say 'DOCKER ENGINE: unavailable (context/socket cannot be reached)'
    say 'COMPOSE PROJECT: UNKNOWN while the Engine is unavailable'
  fi
}

api_readiness_report() {
  local response body code nats
  response="$(curl -sS -w $'\n%{http_code}' --connect-timeout 2 --max-time 5 "http://127.0.0.1:${API_PORT}/api/ready" 2>/dev/null || true)"
  body="${response%$'\n'*}"
  code="${response##*$'\n'}"
  nats="$(printf '%s' "$body" | node -e '
    let input = "";
    process.stdin.on("data", (chunk) => { input += chunk; });
    process.stdin.on("end", () => {
      try {
        const ready = JSON.parse(input);
        const check = ready.checks?.nats;
        if (!check || !["up", "down"].includes(check.status) || typeof check.required !== "boolean") process.exit(1);
        process.stdout.write(`${check.status}|${check.required}`);
      } catch { process.exit(1); }
    });
  ' 2>/dev/null || true)"
  case "$code" in
    200)
      case "$nats" in
        up\|true) say 'NATS: REQUIRED and reachable' ;;
        up\|false) say 'NATS: OPTIONAL and reachable' ;;
        down\|false) say 'NATS: OPTIONAL and unavailable (event notifications are degraded)' ;;
        down\|true) say 'NATS: REQUIRED but unavailable'; return 1 ;;
        *) say 'NATS: status UNKNOWN (readiness response was incomplete)'; return 1 ;;
      esac
      say "API READINESS: READY (HTTP 200)"
      return 0
      ;;
    503) say "API READINESS: NOT READY (HTTP 503)"; return 1 ;;
    *) say 'API READINESS: unavailable (no readiness response)'; return 1 ;;
  esac
}

secure_development_credentials() {
  local file="$1" owner mode
  [ -f "$file" ] && [ ! -L "$file" ] || return 1
  owner="$(stat -c '%u' "$file" 2>/dev/null || true)"
  mode="$(stat -c '%a' "$file" 2>/dev/null || true)"
  [ "$owner" = "$(id -u)" ] && [ "$mode" = 600 ]
}

load_development_credentials() {
  local file key value
  file="$(development_credentials_file)"
  secure_development_credentials "$file" || blocked 'development credential file is not a regular 0600 file owned by this user'
  unset DEVELOPMENT_DB_USER DEVELOPMENT_DB_PASSWORD DEVELOPMENT_DB_NAME DEVELOPMENT_MEDIA_DB_USER DEVELOPMENT_MEDIA_DB_PASSWORD DEVELOPMENT_MEDIA_DB_NAME DEVELOPMENT_JWT_SECRET
  while IFS='=' read -r key value; do
    case "$key" in
      DEVELOPMENT_DB_USER|DEVELOPMENT_DB_PASSWORD|DEVELOPMENT_DB_NAME|DEVELOPMENT_MEDIA_DB_USER|DEVELOPMENT_MEDIA_DB_PASSWORD|DEVELOPMENT_MEDIA_DB_NAME|DEVELOPMENT_JWT_SECRET)
        [[ "$value" =~ ^[A-Za-z0-9_:-]+$ ]] || blocked 'development credential file contains an unsupported value format'
        printf -v "$key" '%s' "$value"
        ;;
      ''|'#'*) ;;
      *) blocked 'development credential file contains an unsupported key' ;;
    esac
  done < "$file"
  : "${DEVELOPMENT_DB_USER:?missing development DB user}"
  : "${DEVELOPMENT_DB_PASSWORD:?missing development DB password}"
  : "${DEVELOPMENT_DB_NAME:?missing development DB name}"
  : "${DEVELOPMENT_MEDIA_DB_USER:?missing development media DB user}"
  : "${DEVELOPMENT_MEDIA_DB_PASSWORD:?missing development media DB password}"
  : "${DEVELOPMENT_MEDIA_DB_NAME:?missing development media DB name}"
  : "${DEVELOPMENT_JWT_SECRET:?missing development JWT secret}"
}

development_database_url() { printf 'postgresql://%s:%s@127.0.0.1:%s/%s?schema=public' "$DEVELOPMENT_DB_USER" "$DEVELOPMENT_DB_PASSWORD" "$DEVELOPMENT_POSTGRES_HOST_PORT" "$DEVELOPMENT_DB_NAME"; }
development_media_database_url() { printf 'postgresql://%s:%s@127.0.0.1:%s/%s' "$DEVELOPMENT_MEDIA_DB_USER" "$DEVELOPMENT_MEDIA_DB_PASSWORD" "$DEVELOPMENT_POSTGRES_MEDIA_HOST_PORT" "$DEVELOPMENT_MEDIA_DB_NAME"; }

write_state() {
  local service="$1" pid="$2" log="$3" tmp
  umask 077
  mkdir -p "$STATE_DIR" "$(log_dir)"
  chmod 700 "$STATE_DIR" "$(log_dir)"
  tmp="$(mktemp "$STATE_DIR/.${service}.state.XXXXXX")"
  {
    printf 'state_root=%s\n' "$(root_id)"
    printf 'state_pid=%s\n' "$pid"
    printf 'state_start_ticks=%s\n' "$(proc_start_ticks "$pid")"
    printf 'state_cmd_hash=%s\n' "$(proc_cmd_hash "$pid")"
    printf 'state_log_file=%s\n' "$log"
  } > "$tmp"
  mv -f "$tmp" "$(state_file "$service")"
}

managed_service_running() { read_state "$1"; }

wait_for_http() {
  local url="$1" expected="$2" attempt code
  for attempt in $(seq 1 30); do
    code="$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 1 --max-time 2 "$url" 2>/dev/null || true)"
    case "$expected:$code" in api:200|web:200|admin:200|admin:301|admin:302) return 0 ;; esac
    sleep 1
  done
  return 1
}

development_images_present() {
  docker image inspect postgres:16.8-alpine redis:7.4.2-alpine >/dev/null 2>&1
}

development_infra_ready() {
  local state
  state="$(timeout 5s docker compose --env-file "$PORTS_FILE" --env-file "$(development_credentials_file)" -f "$(development_compose_file)" ps --format '{{.Service}} {{.State}} {{.Health}}' 2>/dev/null || true)"
  printf '%s\n' "$state" | grep -qx 'postgres running healthy' &&
    printf '%s\n' "$state" | grep -qx 'postgres-media running healthy' &&
    printf '%s\n' "$state" | grep -qx 'redis running healthy'
}

development_seed_report() {
  local marker sql
  load_development_credentials
  sql='SELECT CASE WHEN to_regclass('"'"'public."SystemConfig"'"'"') IS NOT NULL AND EXISTS (SELECT 1 FROM "SystemConfig" WHERE key = '"'"'global'"'"') THEN '"'"'present'"'"' ELSE '"'"'absent'"'"' END'
  marker="$(timeout 5s docker compose --env-file "$PORTS_FILE" --env-file "$(development_credentials_file)" -f "$(development_compose_file)" exec -T postgres psql -v ON_ERROR_STOP=1 -U "$DEVELOPMENT_DB_USER" -d "$DEVELOPMENT_DB_NAME" -tAc "$sql" 2>/dev/null || true)"
  case "$marker" in
    present) say 'SEED DATA: present (optional demo data)' ;;
    absent) say 'SEED DATA: absent (optional; public registration remains available)' ;;
    *) say 'SEED DATA: UNKNOWN (development marker could not be read)'; return 1 ;;
  esac
}

start_development_infra() {
  development_images_present || blocked 'development images are missing; refusing pull/build without separate approval'
  if development_infra_ready; then say 'DEVELOPMENT INFRASTRUCTURE: already healthy'; return; fi
  report_port DEVELOPMENT_POSTGRES "$DEVELOPMENT_POSTGRES_HOST_PORT" || blocked 'development PostgreSQL port is occupied by unknown ownership'
  report_port DEVELOPMENT_POSTGRES_MEDIA "$DEVELOPMENT_POSTGRES_MEDIA_HOST_PORT" || blocked 'development media PostgreSQL port is occupied by unknown ownership'
  report_port DEVELOPMENT_REDIS "$DEVELOPMENT_REDIS_HOST_PORT" || blocked 'development Redis port is occupied by unknown ownership'
  development_compose up -d --no-build --pull never postgres postgres-media redis
  local attempt
  for attempt in $(seq 1 30); do development_infra_ready && { say 'DEVELOPMENT INFRASTRUCTURE: READY'; return; }; sleep 1; done
  blocked 'development infrastructure did not become healthy within 30 seconds'
}

run_development_migrations() {
  local database_url migration_dir
  database_url="$(development_database_url)"
  [ -x "$ROOT_DIR/node_modules/.bin/prisma" ] || blocked 'local Prisma executable is missing; refusing install'
  migration_dir="$(mktemp -d "${XDG_RUNTIME_DIR:-/tmp}/neighborly-prisma.XXXXXX")"
  trap 'rm -rf -- "$migration_dir"' RETURN
  cp "$ROOT_DIR/prisma/schema.prisma" "$migration_dir/schema.prisma"
  cp -a "$ROOT_DIR/prisma/migrations" "$migration_dir/migrations"
  (
    cd "$migration_dir"
    env -i PATH="$PATH" HOME="$HOME" DATABASE_URL="$database_url" "$ROOT_DIR/node_modules/.bin/prisma" migrate deploy --schema "$migration_dir/schema.prisma"
  )
  rm -rf -- "$migration_dir"
  trap - RETURN
}

start_host_service() {
  local service="$1" cwd="$2" log="$3"; shift 3
  if managed_service_running "$service"; then return 10; fi
  if [ -e "$(state_file "$service")" ]; then
    if stale_state_is_dead "$service"; then
      rm -f -- "$(state_file "$service")"
    else
      blocked "stale or unverifiable state for '$service'; refusing duplicate process"
    fi
  fi
  umask 077
  mkdir -p "$(log_dir)"; chmod 700 "$(log_dir)"
  (
    cd "$cwd"
    setsid nohup "$@" > "$log" 2>&1 < /dev/null &
    printf '%s' "$!"
  )
}

start_development_hosts() {
  local db_url media_url api_pid web_pid admin_web_pid
  db_url="$(development_database_url)"; media_url="$(development_media_database_url)"
  report_port API "$API_PORT" || blocked 'API port is occupied by unknown ownership'
  report_port ADMIN "$ADMIN_PORT" || blocked 'Admin port is occupied by unknown ownership'
  report_port WEB "$WEB_PORT" || blocked 'Vite port is occupied by unknown ownership'
  report_port ADMIN_VITE "$LOCAL_DEVELOPMENT_ADMIN_VITE_HOST_PORT" || blocked 'Admin Vite port is occupied by unknown ownership'
  if api_pid="$(start_host_service api "$ROOT_DIR" "$(log_dir)/api.log" env -i PATH="$PATH" HOME="$HOME" NODE_ENV=development APP_ENV=development DOTENV_CONFIG_PATH=/dev/null PORT="$API_PORT" ADMIN_PORT="$ADMIN_PORT" DATABASE_URL="$db_url" MEDIA_DATABASE_URL="$media_url" REDIS_HOST=127.0.0.1 REDIS_PORT="$DEVELOPMENT_REDIS_HOST_PORT" NATS_URL=nats://127.0.0.1:1 JWT_SECRET="$DEVELOPMENT_JWT_SECRET" "$ROOT_DIR/node_modules/.bin/tsx" server.ts)"; then write_state api "$api_pid" "$(log_dir)/api.log"; else [ "$?" -eq 10 ] || return 1; fi
  wait_for_http "http://127.0.0.1:${API_PORT}/api/ready" api || blocked 'API readiness did not succeed; inspect managed API logs'
  if web_pid="$(start_host_service web "$ROOT_DIR/frontend" "$(log_dir)/web.log" env -i PATH="$PATH" HOME="$HOME" VITE_API_URL="http://127.0.0.1:${API_PORT}/api" "$ROOT_DIR/frontend/node_modules/.bin/vite" --host 127.0.0.1 --port "$WEB_PORT" --strictPort)"; then write_state web "$web_pid" "$(log_dir)/web.log"; else [ "$?" -eq 10 ] || return 1; fi
  if admin_web_pid="$(start_host_service admin-web "$ROOT_DIR/frontend/admin" "$(log_dir)/admin-web.log" env -i PATH="$PATH" HOME="$HOME" "$ROOT_DIR/frontend/node_modules/.bin/vite" --host 127.0.0.1 --port "$LOCAL_DEVELOPMENT_ADMIN_VITE_HOST_PORT" --strictPort)"; then write_state admin-web "$admin_web_pid" "$(log_dir)/admin-web.log"; else [ "$?" -eq 10 ] || return 1; fi
  wait_for_http "http://127.0.0.1:${WEB_PORT}/" web || blocked 'Vite readiness did not succeed; inspect managed web logs'
  wait_for_http "http://127.0.0.1:${LOCAL_DEVELOPMENT_ADMIN_VITE_HOST_PORT}/" web || blocked 'Admin Vite readiness did not succeed; inspect managed admin-web logs'
}

start_development() {
  load_development_credentials
  docker info >/dev/null 2>&1 || blocked 'Docker Engine is unavailable'
  start_development_infra
  run_development_migrations
  start_development_hosts
  say 'START: version04_dev infrastructure and launcher-owned host processes are ready'
}

development_report() {
  local compose_file credentials_file state rc=0
  compose_file="$(development_compose_file)"
  credentials_file="$(development_credentials_file)"
  if [ ! -r "$compose_file" ]; then
    say 'DEVELOPMENT INFRASTRUCTURE: BLOCKED (development Compose file is missing)'
    return 1
  fi
  if ! secure_development_credentials "$credentials_file"; then
    say 'DEVELOPMENT INFRASTRUCTURE: BLOCKED (credential file missing, symlinked, foreign-owned, or not mode 0600; value not read)'
    say 'DEVELOPMENT APPLICATION: BLOCKED (safe API startup mode is not approved)'
    return 1
  fi
  if ! docker info >/dev/null 2>&1; then
    say 'DEVELOPMENT INFRASTRUCTURE: BLOCKED (Docker Engine unavailable)'
    say 'DEVELOPMENT APPLICATION: BLOCKED (safe API startup mode is not approved)'
    return 1
  fi
  state="$(timeout 5s docker compose --env-file "$PORTS_FILE" --env-file "$credentials_file" -f "$compose_file" ps --format '{{.Service}} {{.State}} {{.Health}}' 2>/dev/null || true)"
  if [ -z "$state" ]; then
    report_port DEVELOPMENT_POSTGRES "$DEVELOPMENT_POSTGRES_HOST_PORT" || rc=1
    report_port DEVELOPMENT_POSTGRES_MEDIA "$DEVELOPMENT_POSTGRES_MEDIA_HOST_PORT" || rc=1
    report_port DEVELOPMENT_REDIS "$DEVELOPMENT_REDIS_HOST_PORT" || rc=1
    if [ "$rc" -eq 0 ]; then say 'DEVELOPMENT INFRASTRUCTURE: OFF (credential file verified; no version04_dev services observed)'; else say 'DEVELOPMENT INFRASTRUCTURE: BLOCKED (expected development port is occupied by unknown ownership)'; fi
  elif printf '%s\n' "$state" | grep -qx 'postgres running healthy' && printf '%s\n' "$state" | grep -qx 'postgres-media running healthy' && printf '%s\n' "$state" | grep -qx 'redis running healthy'; then
    say 'DEVELOPMENT INFRASTRUCTURE: READY (version04_dev PostgreSQL, media PostgreSQL, and Redis are healthy)'
    development_seed_report || rc=1
  else
    say 'DEVELOPMENT INFRASTRUCTURE: BLOCKED (version04_dev is present but required services are not all healthy)'
    rc=1
  fi
  if managed_service_running api && managed_service_running web && managed_service_running admin-web; then
    say 'DEVELOPMENT APPLICATION: READY (verified launcher-owned API and Vite processes)'
  else
    say 'DEVELOPMENT APPLICATION: OFF or BLOCKED (API/Vite processes are not all verified launcher-owned)'
    rc=1
  fi
  return "$rc"
}

doctor() {
  local rc=0
  say '=== Neighborly environment doctor ==='
  say "WORKSPACE: $ROOT_DIR"
  say "PORT REGISTRY: $PORTS_FILE"
  if grep -qi microsoft /proc/version 2>/dev/null; then say 'WSL: detected'; else say 'WSL: not detected'; fi
  docker_report
  report_port API "$API_PORT" || rc=1
  report_port ADMIN "$ADMIN_PORT" || rc=1
  report_port WEB "$WEB_PORT" || rc=1
  report_port FLUTTER "$FLUTTER_PORT" || rc=1
  if port_listening "$POSTGRES_PORT"; then say "POSTGRES PORT $POSTGRES_PORT: listening (observation only; Compose host port is configurable)"; else say "POSTGRES PORT $POSTGRES_PORT: not listening (observation only; Compose host port is configurable)"; fi
  development_report || rc=1
  if managed_service_running api; then
    say 'DATABASE TARGET: dedicated version04_dev PostgreSQL and media PostgreSQL (credential values withheld)'
  else
    say 'DATABASE TARGET: UNKNOWN until a verified launcher-owned API is ready; .env is not read by the host launcher.'
  fi
  api_readiness_report || rc=1
  if [ "$rc" -ne 0 ]; then
    say 'ENVIRONMENT BLOCKED: one or more required development prerequisites are unavailable or conflicted.'
    return 3
  fi
}

read_state() {
  local service="$1" file key value owner mode
  file="$(state_file "$service")"
  [ -f "$file" ] || return 1
  [ ! -L "$STATE_DIR" ] && [ ! -L "$file" ] || return 2
  [ -d "$STATE_DIR" ] || return 2
  owner="$(stat -c '%u' "$STATE_DIR" 2>/dev/null || true)"
  mode="$(stat -c '%a' "$STATE_DIR" 2>/dev/null || true)"
  [ "$owner" = "$(id -u)" ] && [ "$mode" = 700 ] || return 2
  owner="$(stat -c '%u' "$file" 2>/dev/null || true)"
  mode="$(stat -c '%a' "$file" 2>/dev/null || true)"
  [ "$owner" = "$(id -u)" ] || return 2
  [ "${mode: -2}" = 00 ] || return 2
  unset state_root state_pid state_start_ticks state_cmd_hash state_log_file
  while IFS='=' read -r key value; do
    case "$key" in
      state_root|state_pid|state_start_ticks|state_cmd_hash|state_log_file) printf -v "$key" '%s' "$value" ;;
      ''|'#'*) ;;
      *) return 2 ;;
    esac
  done < "$file"
  [ "${state_root:-}" = "$(root_id)" ] || return 2
  [[ "${state_pid:-}" =~ ^[0-9]+$ ]] || return 2
  [ "$(proc_start_ticks "$state_pid")" = "${state_start_ticks:-}" ] || return 2
  [ "$(proc_cmd_hash "$state_pid")" = "${state_cmd_hash:-}" ] || return 2
}

stale_state_is_dead() {
  local service="$1" file owner mode stale_pid
  file="$(state_file "$service")"
  [ -f "$file" ] && [ ! -L "$STATE_DIR" ] && [ ! -L "$file" ] && [ -d "$STATE_DIR" ] || return 1
  owner="$(stat -c '%u' "$STATE_DIR" 2>/dev/null || true)"
  mode="$(stat -c '%a' "$STATE_DIR" 2>/dev/null || true)"
  [ "$owner" = "$(id -u)" ] && [ "$mode" = 700 ] || return 1
  owner="$(stat -c '%u' "$file" 2>/dev/null || true)"
  mode="$(stat -c '%a' "$file" 2>/dev/null || true)"
  [ "$owner" = "$(id -u)" ] && [ "${mode: -2}" = 00 ] || return 1
  stale_pid="$(awk -F= '$1 == "state_pid" && $2 ~ /^[0-9]+$/ { print $2; exit }' "$file")"
  [[ "$stale_pid" =~ ^[0-9]+$ ]] && [ ! -d "/proc/$stale_pid" ]
}

stop_service() {
  local service="$1" file
  case "$service" in
    development)
      load_development_credentials
      stop_verified_host_if_present admin-web
      stop_verified_host_if_present web
      stop_verified_host_if_present api
      development_compose stop
      say 'STOP: stopped only verified launcher-owned development processes and version04_dev Compose services; volumes were retained'
      return
      ;;
    api|web|admin-web) ;;
    *) blocked "unsupported service '$service'; no process was stopped" ;;
  esac
  file="$(state_file "$service")"
  if read_state "$service"; then
    :
  else
    local rc=$?
    if [ "$rc" -eq 1 ]; then blocked "no launcher-owned state for '$service'; refusing to stop an unknown process"; fi
    blocked "stale or unverifiable state for '$service'; refusing to stop (PID reuse protection)"
  fi
  kill -TERM "$state_pid"
  rm -f "$file"
  say "STOP: sent TERM only to verified launcher-owned $service process"
}

stop_verified_host_if_present() {
  local service="$1" rc
  if read_state "$service"; then
    kill -TERM "$state_pid"
    rm -f -- "$(state_file "$service")"
    say "STOP: sent TERM only to verified launcher-owned $service process"
    return
  fi
  rc=$?
  [ "$rc" -eq 1 ] && return
  blocked "stale or unverifiable state for '$service'; refusing to stop (PID reuse protection)"
}

show_logs() {
  local service="$1" lines="$2" expected_dir resolved_log
  case "$service" in api|web|admin-web) ;; *) blocked "unsupported service '$service'" ;; esac
  [[ "$lines" =~ ^[0-9]+$ ]] && [ "$lines" -le 500 ] || blocked 'lines must be an integer from 0 to 500'
  if ! read_state "$service"; then
    blocked "no verified launcher-owned state for '$service'; refusing to guess a log file"
  fi
  expected_dir="$(log_dir)"
  [ -d "$expected_dir" ] && [ ! -L "$expected_dir" ] || blocked 'verified state has no launcher-controlled log directory'
  [ "$(stat -c '%u' "$expected_dir" 2>/dev/null || true)" = "$(id -u)" ] || blocked 'launcher log directory has unexpected owner'
  [ "$(stat -c '%a' "$expected_dir" 2>/dev/null || true)" = 700 ] || blocked 'launcher log directory must be mode 0700'
  resolved_log="$(realpath -e -- "${state_log_file:-}" 2>/dev/null || true)"
  case "$resolved_log" in "$expected_dir"/*) ;; *) blocked 'verified state points outside the launcher-controlled log directory' ;; esac
  [ -f "$resolved_log" ] && [ ! -L "${state_log_file:-}" ] && [ -r "$resolved_log" ] || blocked "verified state has no readable regular launcher log"
  say 'LOG NOTICE: output is bounded but not guaranteed to redact every application secret.'
  tail -n "$lines" -- "$resolved_log"
}

command="${1:-doctor}"
shift || true
load_ports
case "$command" in
  doctor|status)
    [ "$#" -eq 0 ] || blocked 'doctor/status accept no options'
    doctor
    ;;
  start|restart)
    [ "$#" -eq 0 ] || blocked 'start/restart accept no options in this phase'
    if [ "$command" = restart ]; then
      read_state admin-web && stop_service admin-web || true
      read_state web && stop_service web || true
      read_state api && stop_service api || true
    fi
    start_development
    ;;
  stop)
    [ "${1:-}" = --service ] && [ -n "${2:-}" ] && [ "$#" -eq 2 ] || { usage >&2; exit 2; }
    stop_service "$2"
    ;;
  logs)
    [ "${1:-}" = --service ] && [ -n "${2:-}" ] || { usage >&2; exit 2; }
    service="$2"; shift 2
    lines=200
    if [ "$#" -gt 0 ]; then [ "${1:-}" = --lines ] && [ -n "${2:-}" ] && [ "$#" -eq 2 ] || { usage >&2; exit 2; }; lines="$2"; fi
    show_logs "$service" "$lines"
    ;;
  help|--help|-h) usage ;;
  *) usage >&2; exit 2 ;;
esac
