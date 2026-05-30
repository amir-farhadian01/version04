# Neighborly — Port Assignments

> ## ⚠️ PORT CONFLICT RULE — READ BEFORE RUNNING
>
> **If running `npm run dev` (local backend on :8080 + admin on :9090):**
> - Comment out these lines in docker-compose.yml → web-app service:
>   ```yaml
>   ports:
>     # - "8888:8080"
>     # - "${ADMIN_PORT:-9090}:${ADMIN_PORT:-9090}"
>   ```
> - Then: `docker compose up -d --exclude=web-app`
>
> **If running FULL Docker stack (no local npm run dev):**
> - Uncomment the ports above
> - Then: `docker compose up -d`
> - Backend API available at: http://localhost:8888
> - Admin Panel available at: http://localhost:9090

## Docker Full Stack (docker compose up)
| Port  | Service                  | URL                          |
|-------|--------------------------|------------------------------|
| 80    | Traefik HTTP ingress     | http://localhost             |
| 9191  | Traefik Dashboard        | http://localhost:9191        |
| 5432  | PostgreSQL (main)        | internal                     |
| 5433  | PostgreSQL (media)       | internal                     |
| 9002  | MinIO API                | http://localhost:9002        |
| 9003  | MinIO Console            | http://localhost:9003        |
| 9000  | Portainer                | http://localhost:9000        |
| 8888  | web-app API (Docker)      | http://localhost:8888        |
| 8899  | Dozzle (container logs)   | http://localhost:8899        |
| 3001  | Metabase                 | http://localhost:3001        |
| 5173  | Vite React Frontend      | http://localhost:5173        |
| 9090  | Admin Panel              | http://localhost:9090        |

## Local Dev Mode (npm run dev — partial Docker)
| Port  | Service                  | Notes                        |
|-------|--------------------------|------------------------------|
| 8080  | ⚠️ RESERVED — Backend API | npm run dev — do NOT bind    |
| 5173  | Vite Frontend            | cd frontend && npm run dev   |
| 7357  | Flutter Web              | flutter run --web-port 7357  |
| 5432  | PostgreSQL (main)        | docker compose up postgres   |
| 5433  | PostgreSQL (media)       | docker compose up postgres-media |
| 9090  | Admin Panel              | served by backend            |

## Notes
- Port 8080 is permanently reserved for local backend development.
- NATS (4222) is optional — non-fatal if unavailable.
- Redis is actively used via [`lib/redis.ts`](lib/redis.ts) (ioredis connection manager) and [`lib/locationCache.ts`](lib/locationCache.ts) (GEO-based proximity queries). [`lib/cache.ts`](lib/cache.ts) is a drop-in in-memory fallback when Redis is unavailable.
- Traefik dashboard moved from 8080 → 9191 to avoid conflict.
