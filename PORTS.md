# Neighborly — Port Reference

> Single source of truth for all ports. Update this file whenever a port changes.

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

> In local dev, cache is **in-memory** (no Redis needed). NATS is optional (non-fatal if missing).

---

## Docker Compose — Host Port Mapping

| Service | Host Port | Container Port | Direct URL |
|---|---|---|---|
| Traefik HTTP | 80 | 80 | `http://localhost` (reverse proxy) |
| **Traefik Dashboard** | **8080** | 8080 | `http://localhost:8080` |
| Backend API (web-app) | **3000** | 8080 | `http://localhost:3000` |
| Admin Panel | **9090** | 9090 | `http://localhost:9090` |
| PostgreSQL | **5432** | 5432 | `localhost:5432` |
| PostgreSQL Media | **5433** | 5432 | `localhost:5433` |
| MinIO API | **9002** | 9000 | `http://localhost:9002` |
| MinIO Console | **9003** | 9001 | `http://localhost:9003` |
| Portainer | **9000** | 9000 | `http://localhost:9000` |
| Metabase | **3001** | 3000 | `http://localhost:3001` |
| Dozzle (logs) | **8888** | 8080 | `http://localhost:8888` |
| Vite Frontend | **5173** | 5173 | `http://localhost:5173` |
| Flutter Web | ❌ no host port | nginx:80 | Via Traefik only |

> ⚠️ **8080 = Traefik dashboard only.** Backend container listens on 8080 internally but is exposed on host port **3000**.

> ℹ️ **Redis removed.** Cache is in-memory (`lib/cache.ts`). If Redis is needed for production, re-add the service and set `REDIS_URL` in `.env`.

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
