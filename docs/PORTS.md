# Neighborly — Port Reference

> Single source of truth for all ports. Update this file whenever a port changes.
>
> **Last verified against `docker-compose.yml` and `docs/PORTS.md` on 2026-08-12.**

---

## Local Dev (npm run dev — no Docker)

| Service | Host URL | Notes |
|---|---|---|
| Backend API | `http://localhost:8080` | Express/Fastify listens on PORT=8080 |
| Admin Panel | `http://localhost:9090` | Vite+React, ADMIN_PORT=9090 |
| Vite Frontend | `http://localhost:5173` | `cd frontend && npm run dev` |
| Flutter Web | `http://localhost:7357` | `flutter run -d web-server --web-port 7357` |
| PostgreSQL | `localhost:5432` | Must have Docker running for postgres service |
| PostgreSQL Media | `localhost:5433` | Must have Docker running for postgres-media service |
| Redis | `localhost:6379` | Optional in local dev — in-memory fallback used if Redis is down |

> In local dev, Redis is optional: `lib/redis.ts` falls back to the in-memory cache (`lib/cache.ts`) if Redis is unavailable. NATS is optional (non-fatal if missing).

---

## Docker Compose — Host Port Mapping

| Service | Host Port | Container Port | Direct URL |
|---|---|---|---|
| Traefik HTTP | 80 | 80 | `http://localhost` (reverse proxy) |
| **Traefik Dashboard** | **9191** | 8080 | `http://localhost:9191` |
| Backend API (web-app) | 8888 | 8080 | `http://localhost:8888` (Docker mode) |
| Admin Panel | 9090 | 9090 | `http://localhost:9090` |
| PostgreSQL | 5432 | 5432 | `localhost:5432` |
| PostgreSQL Media | 5433 | 5432 | `localhost:5433` |
| Redis | 6379 | 6379 | `localhost:6379` |
| MinIO API | 9002 | 9000 | `http://localhost:9002` |
| MinIO Console | 9003 | 9001 | `http://localhost:9003` |
| Portainer | 9000 | 9000 | `http://localhost:9000` |
| Metabase | 3001 | 3000 | `http://localhost:3001` |
| Dozzle (logs) | 8899 | 8080 | `http://localhost:8899` |
| Vite Frontend | 5173 | 5173 | `http://localhost:5173` |
| Flutter Web | ❌ no host port | nginx:80 | Via Traefik only |

> ⚠️ **8080 = Backend API (local dev) only.** The Traefik dashboard is on host port **9191**. The backend container listens on 8080 internally but is exposed on host port **8888** in Docker mode.

> ℹ️ **Redis is actively used** via [`lib/redis.ts`](lib/redis.ts) (ioredis connection manager) and [`lib/locationCache.ts`](lib/locationCache.ts) (Redis GEO + async PostgreSQL flusher). [`lib/cache.ts`](lib/cache.ts) is a drop-in in-memory fallback when Redis is unavailable.

---

## Traefik Routing (via port 80)

| Path prefix | Routes to | Priority |
|---|---|---|
| `/flutter` | flutter-web:80 | 20 |
| `/app`, `/auth`, `/business`, `/admin`, `/explore` | frontend:5173 | 10 |
| `/dozzle` | dozzle:8080 | 25 |
| `/portainer` | portainer:9000 | 10 |
| `/metabase` | metabase:3000 | 10 |
| `/minio` | minio:9001 | 10 |
| `/` (catch-all) | web-app:8080 | 1 |
