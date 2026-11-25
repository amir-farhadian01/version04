# Neighborly port registry

This is the official, recorded registry for project ports. The numeric
machine-readable companion is [`config/ports.env`](../config/ports.env), which
`run-project.sh` reads for Doctor/Status. It contains no credentials.

Status meanings:

- `host runtime`: a process binds the host port when its named launcher runs.
- `Compose published`: Docker publishes the host port when that Compose service/profile runs.
- `container internal`: a service port is reachable only on the Compose network.
- `documentation/test-only`: a historical, test, comment, or documentation reference; it does not reserve or prove a listener.
- `reserved/non-usable`: an explicit owner restriction; launcher automation must not use it.

## Local development and IDE

| Environment | Service | Port | Status | Executable source | Note / restriction |
|---|---|---:|---|---|---|
| local development | Node API | 8080 | host runtime | `server.ts` `PORT` | `run-project.sh` Doctor reads `LOCAL_DEVELOPMENT_API_HOST_PORT`. |
| local development | Node admin server / built admin SPA | 9090 | host runtime | `server.ts` `ADMIN_PORT` | This is not the admin Vite port. |
| local development | customer Vite | 5173 | host runtime | `frontend/vite.config.ts` | Proxies API and uploads to 8080. |
| local development | admin Vite | 9091 | host runtime | `frontend/admin/vite.config.ts` | Proxies `/api` to 9090. |
| local development | Flutter web conventional route | 7357 | documentation/test-only | E2E and helper scripts | Used by existing browser scripts; not the active IDE task. |
| IDE task | Flutter web | 9088 | host runtime | `.vscode/tasks.json`, `.vscode/launch.json` | Binds `0.0.0.0`; distinct from the 7357 convention. |
| IDE task | Flutter API target | 8077 | reserved/non-usable | `.vscode/tasks.json` | Current task value; `CLAUDE.md` marks 8077 legacy. No matching project API launcher is defined. |

## Base Compose (`docker-compose.yml`)

| Environment | Service | Port | Status | Executable source | Note / restriction |
|---|---|---:|---|---|---|
| base Compose | Traefik HTTP / dashboard | 80 / 9191 | Compose published | `docker-compose.yml` | `infra` profile. |
| base Compose | PostgreSQL | `${POSTGRES_HOST_PORT:-5432}` → 5432 | Compose published | `docker-compose.yml` | Host value is configurable; 5432 is only the default. |
| base Compose | PostgreSQL media | 5433 → 5432 | Compose published | `docker-compose.yml` | `infra,app` profile. |
| base Compose | Redis | 6379 → 6379 | Compose published | `docker-compose.yml` | `infra,app` profile. |
| base Compose | MinIO API / console | 9002 → 9000 / 9003 → 9001 | Compose published | `docker-compose.yml` | `infra` profile. |
| base Compose | Portainer / Dozzle / Metabase | 9000 → 9000 / 8899 → 8080 / 3001 → 3000 | Compose published | `docker-compose.yml` | `infra` profile. |
| base Compose | NATS / API / admin / frontend / Grafana | 4222 / 8080 / 9090 / 5173 / 3000 | container internal | `docker-compose.yml` | Not host-published by current base configuration. |
| base Compose | web-app API host mapping | 8888 → 8080 | documentation/test-only | commented `docker-compose.yml` entry | Not active; Doctor must not treat it as a development endpoint. |
| base Compose | web-app admin and frontend host mappings | 9090 / 5173 | documentation/test-only | commented `docker-compose.yml` entries | Deliberately disabled for split local development. |

## Staging Compose (`docker-compose.yml` + `docker-compose.staging.yml`)

| Environment | Service | Port | Status | Executable source | Note / restriction |
|---|---|---:|---|---|---|
| staging | PostgreSQL / media / Redis / NATS | 55432 / 55433 / 56379 / 54222 | Compose published | `docker-compose.staging.yml` | Project `neighborly_staging`. |
| staging | MinIO API / console | 59002 / 59003 | Compose published | `docker-compose.staging.yml` | |
| staging | API / admin / frontend | 18080 / 19090 / 15173 | Compose published | `docker-compose.staging.yml` | Not a development-test target. |
| staging | Traefik HTTP / dashboard | 18000 / 19191 | Compose published | `docker-compose.staging.yml` | |
| staging | Grafana / Dozzle / Metabase / Portainer | 13000 / 18899 / 13001 / 19000 | Compose published | `docker-compose.staging.yml` | |

## Isolated verification and owner reservations

| Environment | Service | Port | Status | Executable source | Note / restriction |
|---|---|---:|---|---|---|
| isolated verification | RUN-001 disposable PostgreSQL | 55440 | documentation/test-only | RUN-001 review record | Historical fixture port only. Prove fixture ownership before any use. |
| isolated verification | historical PostgreSQL fixtures | 55442 / 55443 / 55445–55448 | documentation/test-only | cycle review records | Past disposable clusters; neither running nor reserved is implied. |
| owner reservation | PostgreSQL | 55444 / 55449 | reserved/non-usable | current owner instruction | Do not connect, start, stop, or reuse through launcher automation. |

## Separate development infrastructure (`version04_dev`)

| Environment | Service | Port | Status | Executable source | Note / restriction |
|---|---|---:|---|---|---|
| development infrastructure | PostgreSQL | 55450 → 5432 | Compose published | `docker-compose.development.yml` + `config/ports.env` | Loopback-only. Port was observed free before registration; no container or volume has been created. |
| development infrastructure | media PostgreSQL | 55451 → 5432 | Compose published | `docker-compose.development.yml` + `config/ports.env` | Loopback-only. |
| development infrastructure | Redis | 56380 → 6379 | Compose published | `docker-compose.development.yml` + `config/ports.env` | Loopback-only. |

Credentials are deliberately absent from the repository and registry. After a
separate approval, create the parent directory with mode `0700` and a regular
credential file at `${XDG_STATE_HOME:-$HOME/.local/state}/neighborly/development.env`
with mode `0600`, owned by the invoking user. Generate values locally, never
place them in chat or Git, and pass that file alongside `config/ports.env` to
Compose. Doctor checks the file type, owner, and mode before its read-only
Compose status query; it never displays credential values.

The development Compose file defines infrastructure only. API/frontend startup
remains fail-closed until the separate safe-startup approval.

## Non-port routing note

Traefik routes internal services through port 80 when the base `infra` profile
is running. Those routes do not publish the internal service ports and do not
make an application, database, or staging data authorized for use.
