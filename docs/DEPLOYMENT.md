# Neighborly — Deployment Guide

> **Version:** 1.0.0  
> **Last updated:** 2026-05-23  
> **Status:** ✅ Production-ready  
> **Maintainer:** Platform Engineering Team

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Prerequisites](#2-prerequisites)
3. [Environment Configuration](#3-environment-configuration)
4. [Local Development Setup](#4-local-development-setup)
5. [Docker Deployment](#5-docker-deployment)
6. [Traefik Configuration](#6-traefik-configuration)
7. [Database Management](#7-database-management)
8. [CI/CD Pipeline](#8-cicd-pipeline)
9. [Monitoring & Observability](#9-monitoring--observability)
10. [Scaling & Performance](#10-scaling--performance)
11. [Disaster Recovery](#11-disaster-recovery)
12. [Security in Deployment](#12-security-in-deployment)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Architecture Overview

### 1.1 High-Level Deployment Architecture

The Neighborly platform is deployed as a **multi-service Docker Compose stack** with Traefik as the ingress reverse proxy. All services communicate over an internal Docker bridge network (`neighborly_network`), with only Traefik exposing ports to the host.

```mermaid
graph TB
    subgraph "External"
        INTERNET[Internet]
        DNS[DNS: neighborly.app]
    end

    subgraph "Docker Host"
        subgraph "neighborly_network"
            TRAEFIK[Traefik v3.3<br/>Port 80, 9191]

            subgraph "Data Layer"
                PG[(PostgreSQL 16<br/>Port 5432)]
                PG_MEDIA[(PostgreSQL Media<br/>Port 5433)]
                MINIO[MinIO S3<br/>Port 9002/9003]
            end

            subgraph "Application Layer"
                BACKEND[Express Backend<br/>Port 8080 (local dev) / 3000 (Docker)]
                FRONTEND[Vite React Frontend<br/>Port 5173]
            end

            subgraph "Infrastructure"
                NATS[NATS Message Bus<br/>Port 4222]
                PORTAINER[Portainer<br/>Port 9000]
                DOZZLE[Dozzle Logs<br/>Port 8899]
                METABASE[Metabase Analytics<br/>Port 3001]
            end
        end
    end

    INTERNET -->|HTTP/HTTPS| TRAEFIK
    DNS -->|A Record| TRAEFIK
    TRAEFIK -->|/api/*| BACKEND
    TRAEFIK -->|/app/* /admin/*| FRONTEND
    TRAEFIK -->|/portainer| PORTAINER
    TRAEFIK -->|/dozzle| DOZZLE
    TRAEFIK -->|/metabase| METABASE
    TRAEFIK -->|/minio| MINIO
    BACKEND -->|Prisma ORM| PG
    BACKEND -->|pg| PG_MEDIA
    BACKEND -->|S3 API| MINIO
    BACKEND -->|NATS protocol| NATS
```

### 1.2 Service Dependencies Graph

```mermaid
graph LR
    TRAEFIK[Traefik] --> FRONTEND[Frontend]
    TRAEFIK --> BACKEND[Backend]
    FRONTEND --> BACKEND
    BACKEND --> PG[(PostgreSQL)]
    BACKEND --> PG_MEDIA[(PostgreSQL Media)]
    BACKEND --> MINIO[MinIO]
    BACKEND -.-> NATS[NATS]
    METABASE --> PG
    PORTAINER -->|Docker Socket| DOCKER[Docker Daemon]
    DOZZLE -->|Docker Socket| DOCKER
```

### 1.3 Network Topology

| Network | Type | Services | Exposure |
|---|---|---|---|
| `neighborly_network` | Docker bridge (internal) | All services | Internal only |
| Host network | External | Traefik (ports 80, 9191) | Public |
| Host network | External | Portainer (port 9000) | Admin access |
| Host network | External | Dozzle (port 8899) | Admin access |
| Host network | External | Metabase (port 3001) | Admin access |

> **Security boundary:** Only Traefik port 80 should be publicly exposed in production. All other ports should be restricted to internal/admin networks or VPN access.

---

## 2. Prerequisites

### 2.1 Software Requirements

| Component | Version | Notes |
|---|---|---|
| **Docker Engine** | ≥24.0 | Required for container orchestration |
| **Docker Compose** | ≥2.24 | Included with Docker Desktop; standalone install available |
| **Node.js** | ≥20.x (Alpine-compatible) | See [`package.json`](package.json) — engine requirement |
| **npm** | ≥10.x | Package manager (`npm` only — no yarn/pnpm) |
| **PostgreSQL** | 16 | Both main and media databases |
| **Git** | ≥2.40 | Source control |

### 2.2 Minimum System Requirements

| Environment | CPU | RAM | Disk | Notes |
|---|---|---|---|---|
| **Development** | 2 cores | 4 GB | 20 GB | Local dev with Docker |
| **Staging** | 2 cores | 8 GB | 50 GB | Single-host Docker Compose |
| **Production** | 4+ cores | 16+ GB | 100+ GB | SSD recommended; scale horizontally |

### 2.3 Required Ports

See [`docs/PORTS.md`](docs/PORTS.md) for the complete port registry. Key ports:

| Port | Service | Purpose |
|---|---|---|
| 80 | Traefik | HTTP ingress (reverse proxy) |
| 5432 | PostgreSQL (main) | Primary database |
| 5433 | PostgreSQL (media) | Media metadata database |
| 9000 | Portainer | Container management UI |
| 9002 | MinIO API | S3-compatible object storage API |
| 9003 | MinIO Console | MinIO web management console |
| 9191 | Traefik Dashboard | Traefik admin dashboard |
| 8899 | Dozzle | Container log viewer |
| 3001 | Metabase | Analytics dashboard |

> **⚠️ Port conflict rule:** Ports 8080 (backend) and 9090 (admin) are reserved for local `npm run dev`. In Docker mode, the backend uses port 3000 internally. See [`docs/PORTS.md`](docs/PORTS.md) for the full conflict resolution guide.

---

## 3. Environment Configuration

### 3.1 Complete `.env` Reference

Copy [`.env.example`](.env.example) to `.env` and configure all variables:

```bash
cp .env.example .env
```

#### Core Application

| Variable | Source File | Required | Default | Description |
|---|---|---|---|---|
| `PORT` | [`server.ts:179`](server.ts:179) | Yes | `8080` | Backend API port (local dev). Docker uses 3000. |
| `ADMIN_PORT` | [`server.ts:180`](server.ts:180) | Yes | `9090` | Admin API port. Must differ from `PORT`. |
| `NODE_ENV` | [`server.ts:108`](server.ts:108) | Yes | `development` | `development` or `production`. Controls SPA serving mode. |
| `ALLOWED_ORIGIN` | [`server.ts:116`](server.ts:116) | Production | `true` (dev) | CORS allowed origins. Set to specific URLs in production. |
| `APP_URL` | [`.env.example:17`](.env.example:17) | Production | — | Self-referential URL for OAuth callbacks and API links. |

#### Database

| Variable | Source File | Required | Default | Description |
|---|---|---|---|---|
| `DATABASE_URL` | [`docker-compose.yml:109`](docker-compose.yml:109) | Yes | — | PostgreSQL connection string for main DB. Format: `postgresql://user:password@host:5432/db?schema=public` |
| `DB_USER` | [`docker-compose.yml:29`](docker-compose.yml:29) | No | `postgres` | PostgreSQL user for main DB |
| `DB_PASSWORD` | [`docker-compose.yml:30`](docker-compose.yml:30) | No | `EagleRock901` | PostgreSQL password for main DB |
| `DB_NAME` | [`docker-compose.yml:31`](docker-compose.yml:31) | No | `neighborly_db` | PostgreSQL database name |
| `MEDIA_DATABASE_URL` | [`docker-compose.yml:110`](docker-compose.yml:110) | Yes | — | PostgreSQL connection string for media metadata DB |
| `MEDIA_DB_USER` | [`docker-compose.yml:51`](docker-compose.yml:51) | No | `postgres` | PostgreSQL user for media DB |
| `MEDIA_DB_PASSWORD` | [`docker-compose.yml:52`](docker-compose.yml:52) | No | `EagleRock901` | PostgreSQL password for media DB |
| `MEDIA_DB_NAME` | [`docker-compose.yml:53`](docker-compose.yml:53) | No | `media_db` | PostgreSQL database name for media DB |

#### Authentication & Security

| Variable | Source File | Required | Default | Description |
|---|---|---|---|---|
| `JWT_SECRET` | [`lib/jwt.ts:3`](lib/jwt.ts:3) | **Yes (production)** | `dev-access-secret-change-in-prod` | JWT access token signing secret. Minimum 256-bit random value. |
| `JWT_REFRESH_SECRET` | [`lib/jwt.ts:4`](lib/jwt.ts:4) | **Yes (production)** | `dev-refresh-secret-change-in-prod` | JWT refresh token signing secret. Minimum 256-bit random value. |
| `GOOGLE_CLIENT_ID` | [`.env.example:49`](.env.example:49) | Optional | — | Google OAuth client ID for social login |
| `VITE_GOOGLE_CLIENT_ID` | [`.env.example:50`](.env.example:50) | Optional | — | Google OAuth client ID (Vite-inlined for frontend) |

#### AI & Integrations

| Variable | Source File | Required | Default | Description |
|---|---|---|---|---|
| `GEMINI_API_KEY` | [`.env.example:9`](.env.example:9) | Optional | — | Google Gemini AI API key for server-side contract drafting and KYC analysis |
| `VITE_GEMINI_API_KEY` | [`.env.example`](.env.example) | Optional | — | Google Gemini AI API key (client-side, exposed in browser bundle) |
| `GOOGLE_MAPS_SERVER_API_KEY` | [`.env.example:14`](.env.example:14) | Optional | — | Google Maps API key for server-side geocoding and places API |
| `VITE_GOOGLE_MAPS_API_KEY` | [`.env.example:12`](.env.example:12) | Optional | — | Google Maps API key for frontend address autocomplete |

#### Object Storage

| Variable | Source File | Required | Default | Description |
|---|---|---|---|---|
| `MINIO_ROOT_USER` | [`docker-compose.yml:74`](docker-compose.yml:74) | No | `minioadmin` | MinIO root username |
| `MINIO_ROOT_PASSWORD` | [`docker-compose.yml:75`](docker-compose.yml:75) | No | `minioadmin123` | MinIO root password |

#### Message Bus

| Variable | Source File | Required | Default | Description |
|---|---|---|---|---|
| `NATS_URL` | [`docker-compose.yml:111`](docker-compose.yml:111) | No | `nats://nats:4222` | NATS connection URL. Non-fatal if unavailable. |

#### Frontend

| Variable | Source File | Required | Default | Description |
|---|---|---|---|---|
| `VITE_API_URL` | [`docker-compose.yml:214`](docker-compose.yml:214) | No | `/api` | API base URL for Vite frontend. Defaults to proxied `/api`. |
| `VITE_APP_PORT` | [`.env.example:22`](.env.example:22) | No | `8080` | Must match `PORT` — used for redirects from admin port. |
| `VITE_ADMIN_PORT` | [`.env.example:26`](.env.example:26) | No | `9090` | Must match `ADMIN_PORT` — used by browser to toggle header/footer. |
| `VITE_API_PUBLIC_ORIGIN` | [`.env.example:29`](.env.example:29) | Optional | — | Forces upload/media URLs to this origin when admin runs on another port. |

#### Matching Engine

| Variable | Source File | Required | Default | Description |
|---|---|---|---|---|
| `ROUND_ROBIN_WINDOW_HOURS` | [`.env.example:53`](.env.example:53) | No | `24` | Time window for round-robin provider matching |
| `ROUND_ROBIN_POOL_SIZE` | [`.env.example:54`](.env.example:54) | No | `5` | Number of providers in round-robin pool |

| File | Variables Read |
|---|---|
| [`server.ts`](server.ts) | `PORT`, `ADMIN_PORT`, `NODE_ENV`, `ALLOWED_ORIGIN` |
| [`lib/jwt.ts`](lib/jwt.ts) | `JWT_SECRET`, `JWT_REFRESH_SECRET` |
| [`docker-compose.yml`](docker-compose.yml) | `DATABASE_URL`, `MEDIA_DATABASE_URL`, `NATS_URL`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `MEDIA_DB_USER`, `MEDIA_DB_PASSWORD`, `MEDIA_DB_NAME`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `VITE_API_URL` |
| [`.env.example`](.env.example) | `VITE_APP_PORT`, `VITE_ADMIN_PORT`, `VITE_API_PUBLIC_ORIGIN`, `VITE_GOOGLE_MAPS_API_KEY`, `GOOGLE_MAPS_SERVER_API_KEY`, `GEMINI_API_KEY`, `VITE_GEMINI_API_KEY`, `GOOGLE_CLIENT_ID`, `VITE_GOOGLE_CLIENT_ID`, `ROUND_ROBIN_WINDOW_HOURS`, `ROUND_ROBIN_POOL_SIZE` |

---

## 4. Local Development Setup

### 4.1 Prerequisites Check

```bash
# Verify Docker
docker --version          # ≥24.0
docker compose version    # ≥2.24

# Verify Node.js
node --version            # ≥20.x
npm --version             # ≥10.x

# Verify PostgreSQL (via Docker)
docker pull postgres:16-alpine
```

### 4.2 Environment Setup

```bash
# Clone the repository
git clone https://github.com/amir-farhadian01/app.git
cd app

# Copy environment file
cp .env.example .env

# Install backend dependencies
npm install

# Install frontend dependencies
cd frontend && npm install && cd ..

# Install Flutter dependencies
cd flutter_project && flutter pub get && cd ..

# Generate Prisma client
npx prisma generate
```

### 4.3 Start Infrastructure Services (Docker)

Start only the data-layer services via Docker (PostgreSQL, MinIO, NATS):

```bash
# Start databases and supporting services
docker compose up -d postgres postgres-media minio nats

# Verify databases are healthy
docker compose ps

# Expected output:
# NAME                IMAGE                 STATUS
# neighborly_db       postgres:16-alpine    Up (healthy)
# neighborly_media_db postgres:16-alpine    Up (healthy)
# neighborly_minio    minio/minio:latest    Up
# neighborly_bus      nats:2.10-alpine      Up
```

> **⚠️ Port conflict note:** Before running `docker compose up`, comment out the `ports` section under `web-app` and `frontend` services in [`docker-compose.yml`](docker-compose.yml) (lines 131-132 and 222). These ports are used by local `npm run dev` processes.

### 4.4 Run Database Migrations

```bash
# Apply all pending migrations
npx prisma migrate deploy

# (Optional) Seed the database with test data
npm run seed
```

### 4.5 Start Application Services (4 Terminals)

Open **four separate terminal windows** — each service runs in its own process per [AGENTS.md](docs/AGENTS.md) Rule #10.

#### Terminal 1 — Backend API

```bash
# From project root
npm run dev

# Expected output:
#   App (Vite+API)  →  http://localhost:8080/
#   Admin (React dashboard)  →  http://localhost:9090/
#   PostgreSQL connected
#   Redis not available (non-fatal)
#   NATS not available (non-fatal)
```

#### Terminal 2 — Web Frontend

```bash
# From project root
cd frontend && npm run dev -- --port 5173

# Expected output:
#   VITE v6.x  ready in XXXms
#   ➜  Local:   http://localhost:5173/
```

#### Terminal 3 — Flutter Web

```bash
# From project root
cd flutter_project && flutter run -d web-server --web-port 7357

# Expected output:
#   Launching lib/main.dart on web-server in debug mode...
#   http://localhost:7357
```

#### Terminal 4 — Flutter Mobile (optional)

```bash
# List available devices
flutter devices

# Run on specific device
cd flutter_project && flutter run -d <device-id>
```

### 4.6 Verification Steps

```bash
# 1. Backend health check
curl http://localhost:8080/api/health
# Expected: {"status":"ok","timestamp":"...","version":"2.0.0"}

# 2. Frontend loads
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173
# Expected: 200

# 3. Flutter Web loads
curl -s -o /dev/null -w "%{http_code}" http://localhost:7357
# Expected: 200

# 4. Admin panel loads
curl -s -o /dev/null -w "%{http_code}" http://localhost:9090
# Expected: 200 (requires frontend/dist/ to exist)

# 5. Database connectivity
npx prisma studio
# Opens Prisma Studio at http://localhost:5555
```

### 4.7 Troubleshooting Common Local Dev Issues

| Issue | Cause | Solution |
|---|---|---|
| `EADDRINUSE` on port 8080 | Another process using the port | `fuser -k 8080/tcp` or change `PORT` in `.env` |
| `EADDRINUSE` on port 9090 | Another process using the port | `fuser -k 9090/tcp` or change `ADMIN_PORT` in `.env` |
| `PostgreSQL connection refused` | Docker PostgreSQL not running | `docker compose up -d postgres postgres-media` |
| `PrismaClientInitializationError` | Prisma client not generated | `npx prisma generate` |
| `Module not found` errors | Dependencies not installed | `npm install` in both root and `frontend/` |
| Flutter Web blank screen | CORS or API URL mismatch | Check `VITE_API_URL` in `.env`; ensure backend is running |
| `Redis not available` warning | Redis not configured | Non-fatal — cache uses in-memory store ([`lib/cache.ts`](lib/cache.ts)) |
| `NATS not available` warning | NATS not running | Non-fatal — events silently dropped |

---

## 5. Docker Deployment

### 5.1 Full Stack Deployment

Deploy all services with a single command:

```bash
# Build and start all services
docker compose up -d --build

# Verify all services are running
docker compose ps

# View logs
docker compose logs --tail=50 -f
```

> **⚠️ Before deploying full stack:** Uncomment the `ports` sections under `web-app` (lines 131-132) and `frontend` (line 222) in [`docker-compose.yml`](docker-compose.yml) to expose Docker container ports.

### 5.2 Individual Service Deployment

```bash
# Start a specific service
docker compose up -d postgres

# Build and start a specific service
docker compose up -d --build web-app

# Restart a service
docker compose restart frontend

# Scale a service (if supported)
docker compose up -d --scale web-app=2
```

### 5.3 Docker Compose Services Table

| Service | Image | Container Name | Host Ports | Dependencies | Health Check |
|---|---|---|---|---|---|
| `traefik` | `traefik:v3.3` | `neighborly_traefik` | `80`, `9191` | — | — |
| `postgres` | `postgres:16-alpine` | `neighborly_db` | `5432` | — | `pg_isready` (10s interval, 5 retries) |
| `postgres-media` | `postgres:16-alpine` | `neighborly_media_db` | `5433` | — | `pg_isready` (10s interval, 5 retries) |
| `minio` | `minio/minio:latest` | `neighborly_minio` | `9002`, `9003` | — | — |
| `nats` | `nats:2.10-alpine` | `neighborly_bus` | — | — | — |
| `web-app` | (build) | `neighborly_web_app` | `8888` (Docker), `9090` | `postgres` (healthy), `postgres-media` (healthy), `nats` | — |
| `frontend` | (build) | `neighborly_frontend` | `5173` | `web-app` | — |
| `portainer` | `portainer/portainer-ce:latest` | `neighborly_portainer` | `9000` | — | — |
| `dozzle` | `amir20/dozzle:latest` | `neighborly_dozzle` | `8899` | — | — |
| `metabase` | `metabase/metabase:latest` | `neighborly_metabase` | `3001` | `postgres` (healthy) | — |

### 5.4 Build Arguments and Volumes

#### Backend (`web-app`) Build

The [`Dockerfile`](Dockerfile) uses a **multi-stage build**:

| Stage | Base Image | Purpose | Key Commands |
|---|---|---|---|
| `base` | `node:20-alpine` | Install dependencies + generate Prisma client | `npm ci --legacy-peer-deps`, `npx prisma generate` |
| `development` | `base` | Dev mode with hot-reload | `npm run dev` |
| `builder` | `base` | Production build | `npm run build` |
| `production` | `node:20-alpine` | Production runtime (minimal image) | `npx prisma migrate deploy && npm run dev` |

**Build arguments:** None currently defined. All configuration is via environment variables.

#### Frontend Build

The [`frontend/Dockerfile`](frontend/Dockerfile) is a single-stage build:

| Stage | Base Image | Purpose | Key Commands |
|---|---|---|---|
| Single | `node:20-alpine` | Dev server | `npm run dev -- --host` |

#### Volumes

| Volume | Mount Point | Service | Purpose |
|---|---|---|---|
| `postgres_data` | `/var/lib/postgresql/data` | `postgres` | Persistent database storage |
| `postgres_media_data` | `/var/lib/postgresql/data` | `postgres-media` | Persistent media metadata storage |
| `minio_data` | `/data` | `minio` | Persistent object storage |
| `portainer_data` | `/data` | `portainer` | Persistent Portainer configuration |
| `.:/app` (bind) | `/app` | `web-app` | Hot-reload source code (dev mode) |
| `./frontend:/app` (bind) | `/app` | `frontend` | Hot-reload source code (dev mode) |

### 5.5 Health Check Configuration

PostgreSQL services have health checks configured in [`docker-compose.yml`](docker-compose.yml):

```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-postgres} -d ${DB_NAME:-neighborly_db}"]
  interval: 10s
  timeout: 5s
  retries: 5
```

The `web-app` service depends on `postgres` and `postgres-media` with `condition: service_healthy`, ensuring the backend only starts after databases are ready.

---

## 6. Traefik Configuration

### 6.1 Entry Points

Configured in [`infra/traefik/traefik.yml`](infra/traefik/traefik.yml) and [`docker-compose.yml`](docker-compose.yml):

| Entry Point | Address | Purpose |
|---|---|---|
| `web` | `:80` | HTTP ingress — all external traffic |
| Traefik Dashboard | `:9191` (host) / `:8080` (container) | Admin dashboard |

### 6.2 Service Routing Rules

All routing is defined via Docker labels in [`docker-compose.yml`](docker-compose.yml):

| Path Prefix | Target Service | Target Port | Priority | Middleware |
|---|---|---|---|---|
| `/` (catch-all) | `web-app` (backend) | `8080` | 1 | — |
| `/app`, `/auth`, `/business`, `/admin`, `/explore` | `frontend` (Vite) | `5173` | 10 | — |
| `/dozzle` | `dozzle` | `8080` | 25 | Strip prefix `/dozzle` |
| `/portainer` | `portainer` | `9000` | 10 | Strip prefix `/portainer` |
| `/metabase` | `metabase` | `3001` | 10 | Strip prefix `/metabase` |
| `/minio` | `minio` | `9003` | 10 | Strip prefix `/minio` |

**Routing logic:**
1. Traefik evaluates routes by priority (higher = evaluated first)
2. The catch-all route (`/`, priority 1) matches any request not matched by higher-priority routes
3. Path prefix stripping middleware removes the prefix before forwarding to the target service

### 6.3 Middleware Chain

Currently, only **path prefix stripping** middleware is configured:

```yaml
labels:
  - "traefik.http.middlewares.minio-strip.stripprefix.prefixes=/minio"
  - "traefik.http.routers.minio.middlewares=minio-strip"
```

**Recommended middleware for production:**

| Middleware | Purpose | Configuration |
|---|---|---|
| **Rate limiting** | Global rate limit per IP | `traefik.http.middlewares.rate-limit.ratelimit.average=100` |
| **Security headers** | HSTS, X-Frame-Options, X-Content-Type-Options | `traefik.http.middlewares.sec-headers.headers.*` |
| **CORS** | Cross-origin resource sharing | `traefik.http.middlewares.cors.headers.accesscontrolalloworiginlist=...` |
| **IP whitelist** | Restrict admin routes to specific IPs | `traefik.http.middlewares.admin-ipwhitelist.ipwhitelist.sourcerange=...` |
| **Compression** | Gzip response compression | `traefik.http.middlewares.gzip.compress=true` |

### 6.4 TLS/SSL Configuration (Let's Encrypt)

**⚠️ Required for production.** Add to [`infra/traefik/traefik.yml`](infra/traefik/traefik.yml):

```yaml
certificatesResolvers:
  letsencrypt:
    acme:
      email: admin@neighborly.app
      storage: /letsencrypt/acme.json
      httpChallenge:
        entryPoint: web

entryPoints:
  web:
    address: ":80"
    http:
      redirections:
        entryPoint:
          to: websecure
          scheme: https
  websecure:
    address: ":443"
```

And add to [`docker-compose.yml`](docker-compose.yml) Traefik service:

```yaml
volumes:
  - ./letsencrypt:/letsencrypt
labels:
  - "traefik.http.routers.web-app.tls.certresolver=letsencrypt"
```

### 6.5 Dashboard Access Control

The Traefik dashboard is exposed on port `9191` with `api.insecure: true` in [`infra/traefik/traefik.yml`](infra/traefik/traefik.yml).

**⚠️ Production requirement:** Enable dashboard authentication:

```yaml
# In traefik.yml
api:
  dashboard: true
  # Remove: insecure: true

# In docker-compose.yml labels
labels:
  - "traefik.http.routers.dashboard.rule=Host(`traefik.neighborly.app`)"
  - "traefik.http.routers.dashboard.service=api@internal"
  - "traefik.http.routers.dashboard.middlewares=auth"
  - "traefik.http.middlewares.auth.basicauth.users=admin:$$2y$$10$$..."
```

---

## 7. Database Management

### 7.1 Prisma Migrations

```bash
# Apply all pending migrations to the database
npx prisma migrate deploy

# Create a new migration after schema changes
npx prisma migrate dev --name describe_change

# Reset database (drops all data and re-applies all migrations)
npx prisma migrate reset

# Generate Prisma client after schema changes
npx prisma generate
```

> **⚠️ Production migration safety:** Always run `npx prisma migrate deploy` (not `migrate dev`) in production. The `deploy` command applies pending migrations without resetting the database.

### 7.2 Prisma Studio

```bash
# Launch Prisma Studio (data browser UI)
npx prisma studio
# → http://localhost:5555
```

### 7.3 Backup and Restore

#### PostgreSQL Backup

```bash
# Backup main database
docker exec neighborly_db pg_dump -U postgres neighborly_db > backup_neighborly_$(date +%Y%m%d_%H%M%S).sql

# Backup media database
docker exec neighborly_media_db pg_dump -U postgres media_db > backup_media_$(date +%Y%m%d_%H%M%S).sql

# Compress backup
gzip backup_*.sql
```

#### PostgreSQL Restore

```bash
# Restore main database
cat backup_neighborly_20260523_120000.sql.gz | gunzip | docker exec -i neighborly_db psql -U postgres neighborly_db

# Restore media database
cat backup_media_20260523_120000.sql.gz | gunzip | docker exec -i neighborly_media_db psql -U postgres media_db
```

#### MinIO Backup

```bash
# Use MinIO Client (mc) to backup buckets
docker run --rm --network neighborly_network \
  -v minio_data:/data \
  minio/mc \
  mirror /data /backup/minio
```

### 7.4 Connection Pooling

The backend uses Prisma's built-in connection pool. Configure via `DATABASE_URL` query parameters:

```env
# Default (no pooling)
DATABASE_URL=postgresql://user:password@host:5432/db?schema=public

# With PgBouncer (transaction mode)
DATABASE_URL=postgresql://user:password@pgbouncer:6432/db?schema=public&pgbouncer=true&connection_limit=20
```

**Production recommendation:** Use PgBouncer or a cloud-native connection pooler (e.g., RDS Proxy, Cloud SQL Connector) to manage database connections efficiently.

### 7.5 Migration Rollback Strategy

```bash
# 1. Identify the last migration
ls -la prisma/migrations/ | tail -5

# 2. Roll back the last migration
npx prisma migrate resolve --rolled-back <migration_name>

# 3. Manually revert the schema changes if needed
# (Prisma does not support automatic down migrations)

# 4. Re-apply the migration after fixing
npx prisma migrate deploy
```

> **⚠️ Prisma limitation:** Prisma does not support automatic rollback (`migrate down`). Always test migrations on a staging environment first. For production rollbacks, create a compensating migration rather than reverting.

---

## 8. CI/CD Pipeline

### 8.1 GitHub Actions Workflow

The CI/CD pipeline is defined in `.github/workflows/`. Below is the recommended pipeline structure:

```yaml
name: Neighborly CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci --legacy-peer-deps
      - run: npm run typecheck
      - run: npm run lint

  unit-tests:
    needs: lint-and-typecheck
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci --legacy-peer-deps
      - run: npx prisma generate
      - run: npm test

  integration-tests:
    needs: unit-tests
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: neighborly_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci --legacy-peer-deps
      - run: npx prisma generate
      - run: npx prisma migrate deploy
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/neighborly_test
      - run: npm test -- --coverage

  build-docker-images:
    needs: integration-tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: docker compose build

  e2e-tests:
    needs: build-docker-images
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: docker compose up -d
      - name: Run Playwright tests
        run: npx playwright test
      - name: Upload screenshots
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-screenshots
          path: playwright/screenshots/

  security-scan:
    needs: build-docker-images
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm audit --audit-level=high
      - name: Scan Docker images
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: 'neighborly-web-app:latest'
          format: 'sarif'
          output: 'trivy-results.sarif'

  deploy-staging:
    needs: [e2e-tests, security-scan]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/develop'
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to staging
        run: |
          docker compose -f docker-compose.yml -f docker-compose.staging.yml up -d --build

  deploy-production:
    needs: deploy-staging
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment: production
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to production
        run: |
          docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

### 8.2 Pipeline Stages

| Stage | Trigger | Description | Gates |
|---|---|---|---|
| **1. Lint & TypeCheck** | Every push/PR | ESLint + TypeScript strict mode | Zero errors |
| **2. Unit Tests** | After lint | Vitest unit tests | Coverage ≥80% |
| **3. Integration Tests** | After unit tests | Full API tests with real PostgreSQL | All endpoints tested |
| **4. Build Docker Images** | After integration tests | `docker compose build` | Build succeeds |
| **5. E2E Tests** | After build | Playwright browser tests | All 12 verification steps pass |
| **6. Security Scan** | After build | `npm audit` + Trivy container scan | Zero high/critical vulns |
| **7. Deploy to Staging** | After E2E + security (develop branch) | Auto-deploy to staging environment | All previous stages pass |
| **8. Deploy to Production** | After staging (main branch) | Manual approval required | Production environment gate |

### 8.3 Environment Promotion Strategy

```mermaid
graph LR
    DEV[Development] -->|PR merged to develop| STAGING[Staging]
    STAGING -->|Manual approval| PRODUCTION[Production]
    PRODUCTION -->|Hotfix branch| DEV

    style DEV fill:#4ade80,color:#000
    style STAGING fill:#fbbf24,color:#000
    style PRODUCTION fill:#f87171,color:#000
```

| Environment | Branch | Deploy Trigger | URL | Notes |
|---|---|---|---|---|
| **Development** | `develop` | Manual (local) | `http://localhost:8080` | Local `npm run dev` |
| **Staging** | `develop` | Auto-deploy on push | `https://staging.neighborly.app` | Mirrors production config |
| **Production** | `main` | Manual approval | `https://neighborly.app` | Production gate with approval |

---

## 9. Monitoring & Observability

### 9.1 Dozzle — Container Log Aggregation

**URL:** `http://localhost:8899`
**Service:** [`docker-compose.yml:161-178`](docker-compose.yml:161) — `amir20/dozzle:latest`

Dozzle provides real-time log streaming for all Docker containers:

```bash
# Access Dozzle
open http://localhost:8899

# Or via Traefik
open http://localhost/dozzle
```

**Features:**
- Real-time log streaming from all containers
- Search/filter by container name
- Regex log search
- Auto-scroll toggle
- No persistent storage (logs are ephemeral)

### 9.2 Portainer — Container Management

**URL:** `http://localhost:9000`
**Service:** [`docker-compose.yml:141-158`](docker-compose.yml:141) — `portainer/portainer-ce:latest`

Portainer provides a web UI for managing Docker containers, images, volumes, and networks:

```bash
# Access Portainer
open http://localhost:9000

# Or via Traefik
open http://localhost/portainer
```

**Features:**
- Container start/stop/restart
- Image management
- Volume and network management
- Container logs and stats
- Stack deployment (via Portainer)

### 9.3 Metabase — Analytics Dashboard

**URL:** `http://localhost:3001`
**Service:** [`docker-compose.yml:181-205`](docker-compose.yml:181) — `metabase/metabase:latest`

Metabase connects to the main PostgreSQL database for business analytics:

```bash
# Access Metabase
open http://localhost:3001

# Or via Traefik
open http://localhost/metabase
```

**Initial setup:**
1. Create admin account on first access
2. Connect to PostgreSQL database `neighborly_db`
3. Explore tables and create dashboards

**Pre-configured audit log sample:** See [`docker/metabase-audit-log-sample.sql`](docker/metabase-audit-log-sample.sql) for sample data.

### 9.4 Health Check Endpoints

```bash
# Backend health check
curl http://localhost:8080/api/health
# Response: {"status":"ok","timestamp":"2026-05-23T20:00:00.000Z","version":"2.0.0"}

# System configuration (requires auth)
curl http://localhost:8080/api/system/config
```

### 9.5 Alerting and Notification Setup

**Recommended production alerting:**

| Alert | Tool | Threshold | Action |
|---|---|---|---|
| Service down | Docker health checks | Container unhealthy >30s | Restart container, notify admin |
| High CPU/Memory | Portainer + cAdvisor | CPU >80%, RAM >80% | Scale up, notify admin |
| API error rate | Dozzle log parsing | 5xx rate >1% | Investigate, rollback if needed |
| Disk space | Node Exporter | Disk >85% | Clean up, expand volume |
| SSL certificate expiry | Traefik logs | <30 days | Renew certificate |
| Database connection pool | Prisma metrics | Connections >80% | Increase pool size |

---

## 10. Scaling & Performance

### 10.1 Horizontal Scaling Considerations

The current architecture uses a **single-host Docker Compose** deployment. For production scaling:

| Component | Scaling Strategy | Notes |
|---|---|---|
| **Backend API** | Horizontal (multiple replicas) | Stateless — scale via `--scale web-app=N`. Requires shared DB connection. |
| **Frontend** | Horizontal (CDN + replicas) | Static assets via CDN; Vite dev server not for production. Build static files with `npm run build`. |
| **PostgreSQL** | Vertical (read replicas) | Prisma supports read replicas via `@prisma/extension-read-replicas`. |
| **MinIO** | Horizontal (distributed mode) | MinIO supports distributed deployment with erasure coding. |
| **NATS** | Horizontal (cluster) | NATS supports clustering for high availability. |

### 10.2 Database Connection Pooling

```env
# Production DATABASE_URL with PgBouncer
DATABASE_URL=postgresql://user:password@pgbouncer:6432/neighborly_db?schema=public&pgbouncer=true&connection_limit=20
```

**Recommended pool sizes:**

| Service | Max Connections | Notes |
|---|---|---|
| Backend API (per replica) | 10-20 | Prisma manages the pool |
| Metabase | 5-10 | Analytics queries |
| Admin operations | 5 | Manual queries via Prisma Studio |

### 10.3 Caching Strategy

The platform uses **Redis caching** via [`lib/redis.ts`](lib/redis.ts) with an **in-memory fallback** via [`lib/cache.ts`](lib/cache.ts) when Redis is unavailable:

| Cache Type | Implementation | TTL | Usage |
|---|---|---|---|
| In-memory | `Map<string, { value, expiry }>` | Configurable | Category trees, system config |
| Browser cache | `Cache-Control` headers | 7 days | Static assets (`/uploads`) |
| CDN (recommended) | Cloudflare / Fastly | Varies | Static frontend assets |

**Production recommendation:** Use a shared Redis instance for distributed caching when scaling to multiple backend replicas.

### 10.4 CDN for Static Assets

For production, serve frontend static assets via CDN:

```bash
# Build frontend for production
cd frontend && npm run build

# Output in frontend/dist/
# Deploy dist/ to CDN (Cloudflare Pages, Vercel, Netlify, S3+CloudFront)
```

### 10.5 Load Balancing with Traefik

Traefik handles load balancing across multiple backend replicas:

```yaml
# docker-compose.yml — scale backend
services:
  web-app:
    deploy:
      replicas: 3
    labels:
      - "traefik.http.services.web-app.loadbalancer.server.port=8080"
      - "traefik.http.services.web-app.loadbalancer.sticky.cookie=true"
```

---

## 11. Disaster Recovery

### 11.1 Backup Strategy

| Data Source | Backup Method | Frequency | Retention | Storage |
|---|---|---|---|---|
| PostgreSQL (main) | `pg_dump` | Daily | 30 days | Encrypted S3/object storage |
| PostgreSQL (media) | `pg_dump` | Daily | 30 days | Encrypted S3/object storage |
| MinIO objects | `mc mirror` | Daily | 30 days | Secondary MinIO or S3 |
| Docker volumes | Volume snapshot | Weekly | 90 days | Offsite backup |
| Environment config | `.env` encrypted copy | On change | Indefinite | Secrets manager |
| Docker Compose config | Git (version controlled) | On change | Indefinite | Git history |

### 11.2 Automated Backup Script

```bash
#!/bin/bash
# backup.sh — Run daily via cron

BACKUP_DIR="/backups/neighborly"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

mkdir -p "$BACKUP_DIR"

# Backup main database
docker exec neighborly_db pg_dump -U postgres neighborly_db | gzip > "$BACKUP_DIR/db_main_$DATE.sql.gz"

# Backup media database
docker exec neighborly_media_db pg_dump -U postgres media_db | gzip > "$BACKUP_DIR/db_media_$DATE.sql.gz"

# Encrypt backups
gpg --encrypt --recipient admin@neighborly.app "$BACKUP_DIR/db_main_$DATE.sql.gz"
gpg --encrypt --recipient admin@neighborly.app "$BACKUP_DIR/db_media_$DATE.sql.gz"

# Remove backups older than retention period
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR" -name "*.gpg" -mtime +$RETENTION_DAYS -delete

# Sync to offsite storage (example: S3)
# aws s3 sync "$BACKUP_DIR" s3://neighborly-backups/production/
```

### 11.3 Restore Procedure

#### Full System Restore

```bash
# 1. Stop all services
docker compose down

# 2. Restore PostgreSQL databases
gunzip -c backup_neighborly_20260523_120000.sql.gz | docker exec -i neighborly_db psql -U postgres neighborly_db
gunzip -c backup_media_20260523_120000.sql.gz | docker exec -i neighborly_media_db psql -U postgres media_db

# 3. Restore MinIO data
docker run --rm --network neighborly_network \
  -v minio_data:/data \
  minio/mc \
  mirror /backup/minio /data

# 4. Restore environment configuration
cp /backups/env/production.env .env

# 5. Restart all services
docker compose up -d

# 6. Verify health
curl http://localhost:8080/api/health
```

### 11.4 Failover Plan

| Scenario | RPO | RTO | Action |
|---|---|---|---|
| Single container crash | 0 (no data loss) | <30s | Docker auto-restart (`restart: unless-stopped`) |
| Database corruption | <24h (daily backup) | <1h | Restore from latest backup |
| Host failure | <24h (daily backup) | <4h | Deploy to secondary host, restore from backup |
| Region failure (cloud) | <24h (cross-region backup) | <8h | Deploy to secondary region, restore from cross-region backup |
| Security breach | <1h (immediate isolation) | <4h | Isolate compromised host, restore from clean backup |

### 11.5 RPO and RTO Targets

| Metric | Target | Notes |
|---|---|---|
| **Recovery Point Objective (RPO)** | ≤24 hours | Maximum acceptable data loss |
| **Recovery Time Objective (RTO)** | ≤4 hours | Maximum acceptable downtime |
| **Critical incident RTO** | ≤1 hour | Security breach, data corruption |
| **Scheduled maintenance** | ≤15 minutes | Planned downtime for updates |

---

## 12. Security in Deployment

### 12.1 Environment Variable Management

| Practice | Implementation | Status |
|---|---|---|
| `.env` in `.gitignore` | [`.gitignore`](.gitignore) | ✅ Implemented |
| `.env.example` as template | [`.env.example`](.env.example) | ✅ Implemented |
| No secrets in code | Enforced by AGENTS.md Rule #8 | ✅ Implemented |
| Secret rotation | Quarterly rotation schedule | ⚠️ Required |
| Secrets manager | HashiCorp Vault / Docker secrets | ⚠️ Recommended |

**Critical secrets that must never be committed:**
- `JWT_SECRET` — token signing key
- `JWT_REFRESH_SECRET` — refresh token signing key
- `DATABASE_URL` — contains credentials
- `GEMINI_API_KEY` — AI API key
- `MINIO_ROOT_PASSWORD` — object storage admin password

### 12.2 Docker Security Scanning

```bash
# Scan Docker images for vulnerabilities
docker scout quickview neighborly-web-app:latest

# Using Trivy (recommended for CI)
trivy image neighborly-web-app:latest

# npm audit for dependency vulnerabilities
npm audit --audit-level=high
```

### 12.3 Network Segmentation

| Network | Services | Access | Notes |
|---|---|---|---|
| `neighborly_network` (internal) | All services | Internal Docker network | No external access |
| Host network (public) | Traefik (port 80) | Public internet | Only entry point |
| Host network (restricted) | Portainer (9000), Dozzle (8899), Metabase (3001) | Admin VPN | Not publicly accessible |

**Production recommendation:**
- Place backend and databases on an internal network with no direct external access
- Admin API (port 9090) should require VPN or bastion host access
- MinIO should not be directly accessible from the public internet
- Use Docker network policies to restrict inter-service communication

### 12.4 TLS Everywhere

| Connection | Protocol | Status |
|---|---|---|
| Client → Traefik | **TLS 1.3** (Let's Encrypt) | ⚠️ Required for production |
| Traefik → Backend | HTTP (internal network) | ✅ Acceptable within Docker |
| Backend → PostgreSQL | TLS (optional) | ⚠️ Recommended |
| Backend → MinIO | HTTPS | ⚠️ Required in production |

### 12.5 Regular Dependency Updates

```bash
# Check for outdated packages
npm outdated

# Update dependencies
npm update

# Audit for vulnerabilities
npm audit

# Fix vulnerabilities automatically
npm audit fix
```

### 12.6 Audit Logging

The platform maintains audit logs for security-relevant events:

| Event | Log Location | Retention |
|---|---|---|
| Authentication (login, logout, failed attempts) | PostgreSQL `Notification` table + Dozzle logs | 90 days |
| KYC submissions and reviews | PostgreSQL `KycReviewAuditLog` table | Indefinite |
| Contract events | PostgreSQL `ContractEvent` table | Indefinite |
| API requests | Dozzle (Docker logs) | 7 days (ephemeral) |
| Admin actions | PostgreSQL audit tables | 1 year |

---

## 13. Troubleshooting

### 13.1 Common Issues and Solutions

#### Port Conflicts

```text
Error: listen EADDRINUSE :::8080
```

**Solution:**
```bash
# Find process using the port
fuser 8080/tcp

# Kill the process
fuser -k 8080/tcp

# Or use a different port in .env
# PORT=8081
# ADMIN_PORT=9091
```

#### Database Connection Failures

```text
Error: Can't reach database server
Error: getaddrinfo ENOTFOUND postgres
```

**Solution:**
```bash
# Verify PostgreSQL is running
docker compose ps postgres

# Check PostgreSQL logs
docker compose logs postgres --tail=50

# Verify DATABASE_URL in .env
# For Docker: postgresql://user:password@postgres:5432/db?schema=public
# For local:  postgresql://user:password@localhost:5432/db?schema=public

# Restart PostgreSQL
docker compose restart postgres
```

#### JWT Authentication Errors

```text
Error: 401 Unauthorized
Error: jwt expired
Error: invalid signature
```

**Solution:**
```bash
# 1. Check JWT_SECRET is consistent across all services
#    (must be the same value used to sign and verify tokens)

# 2. Check token expiry (15 min access, 7 day refresh)
#    Tokens are short-lived by design — refresh via POST /api/auth/refresh

# 3. Clear browser localStorage and re-login
#    localStorage.removeItem('neighborly-auth')

# 4. Verify JWT_SECRET in .env is set (not using dev default)
```

#### CORS Errors

```text
Error: Cross-Origin Request Blocked
Access to fetch at 'http://localhost:8080/api/...' from origin 'http://localhost:5173'
```

**Solution:**
```bash
# 1. Check ALLOWED_ORIGIN in .env
#    For local dev: ALLOWED_ORIGIN=true (allows all origins)
#    For production: ALLOWED_ORIGIN=https://neighborly.app

# 2. Verify VITE_API_URL in frontend/.env
#    For local dev: VITE_API_URL=/api (proxied through Vite)
#    For direct API: VITE_API_URL=http://localhost:8080/api

# 3. Restart backend after changing CORS settings
```

#### Docker Build Failures

```text
Error: failed to solve: process "/bin/sh -c npm ci --legacy-peer-deps" did not complete successfully
```

**Solution:**
```bash
# 1. Clear Docker build cache
docker compose build --no-cache

# 2. Check npm version compatibility
node --version  # Must be ≥20.x

# 3. Verify package-lock.json is up to date
npm install --legacy-peer-deps

# 4. Check for platform-specific issues (Apple Silicon vs Linux)
#    Add to Dockerfile: RUN apk add --no-cache python3 make g++
```

#### Prisma Migration Issues

```text
Error: P1001: Can't reach database server
Error: P3006: Migration `20260423120000_user_google_preferences` failed to apply
```

**Solution:**
```bash
# 1. Verify database is running and accessible
docker compose ps postgres

# 2. Check migration history
npx prisma migrate status

# 3. Apply pending migrations
npx prisma migrate deploy

# 4. If a migration failed, resolve it
npx prisma migrate resolve --applied <migration_name>

# 5. Reset database (⚠️ DESTRUCTIVE — deletes all data)
npx prisma migrate reset
```

### 13.2 Log Locations and Access

| Log Source | Access Method | Location |
|---|---|---|
| Docker containers | `docker compose logs --tail=100 -f <service>` | Docker |
| Backend API | `docker compose logs web-app --tail=100` | Docker |
| PostgreSQL | `docker compose logs postgres --tail=100` | Docker |
| Frontend (browser) | Browser DevTools → Console tab | Client-side |
| Frontend (server) | `docker compose logs frontend --tail=100` | Docker |
| Dozzle (aggregated) | `http://localhost:8899` | Web UI |
| Portainer (aggregated) | `http://localhost:9000` | Web UI |

### 13.3 Debug Mode Activation

```bash
# 1. Enable verbose logging for backend
#    Set in .env:
#    LOG_LEVEL=debug
#    (or modify morgan format in server.ts)

# 2. Enable Traefik debug logging
#    In docker-compose.yml traefik service:
#    - "--log.level=DEBUG"

# 3. Enable Prisma query logging
#    In lib/db.ts:
#    const prisma = new PrismaClient({ log: ['query', 'info', 'warn', 'error'] })

# 4. Check NATS event flow
#    docker compose logs nats --tail=50

# 5. Inspect database directly
#    npx prisma studio  →  http://localhost:5555
```

### 13.4 Quick Diagnostic Commands

```bash
# System overview
docker compose ps                    # All services status
docker compose top                   # Running processes
docker stats                         # Live resource usage

# Network diagnostics
docker network inspect neighborly_network  # Network details
docker compose logs --tail=50 -f          # All logs

# Database diagnostics
docker exec neighborly_db pg_isready -U postgres  # DB connectivity
npx prisma studio                                # Data browser

# Backend diagnostics
curl http://localhost:8080/api/health             # Health check
curl http://localhost:9090/api/admin/overview     # Admin API (requires auth)

# Container resource usage
docker inspect neighborly_web_app | jq '.[0].State'  # Container state
```

---

## Appendix: Quick Reference

### Useful Commands

```bash
# Start everything (local dev)
docker compose up -d postgres postgres-media minio nats
npm run dev                    # Terminal 1
cd frontend && npm run dev     # Terminal 2

# Start everything (Docker full stack)
docker compose up -d --build

# Stop everything
docker compose down

# Stop and remove volumes (⚠️ DESTRUCTIVE)
docker compose down -v

# View logs
docker compose logs --tail=50 -f

# Rebuild a single service
docker compose up -d --build web-app

# Access database
docker exec -it neighborly_db psql -U postgres neighborly_db

# Run Prisma commands
npx prisma studio              # Data browser
npx prisma migrate deploy      # Apply migrations
npx prisma generate            # Regenerate client

# Run tests
npm test                       # Backend tests
cd frontend && npm test        # Frontend tests
```

### File Reference

| File | Purpose |
|---|---|
| [`docker-compose.yml`](docker-compose.yml) | Full Docker Compose stack definition |
| [`Dockerfile`](Dockerfile) | Multi-stage backend Docker build |
| [`frontend/Dockerfile`](frontend/Dockerfile) | Frontend Docker build |
| [`infra/traefik/traefik.yml`](infra/traefik/traefik.yml) | Traefik static configuration |
| [`.env.example`](.env.example) | Environment variable template |
| [`docs/PORTS.md`](docs/PORTS.md) | Complete port registry |
| [`docs/AGENTS.md`](docs/AGENTS.md) | Project intelligence for AI agents |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System architecture reference |
| [`docs/SECURITY.md`](docs/SECURITY.md) | Security policy and controls |
| [`server.ts`](server.ts) | Express backend entry point |
| [`lib/jwt.ts`](lib/jwt.ts) | JWT token generation and verification |
| [`lib/cache.ts`](lib/cache.ts) | In-memory cache implementation |
| [`lib/bus.ts`](lib/bus.ts) | NATS message bus integration |
| [`lib/db.ts`](lib/db.ts) | PrismaClient singleton |
| [`package.json`](package.json) | Backend dependencies and scripts |
| [`frontend/package.json`](frontend/package.json) | Frontend dependencies and scripts |

---

> **Document maintainers:** Update this file whenever the deployment architecture changes.
> **See also:** [`docs/PORTS.md`](docs/PORTS.md) — port registry | [`docs/AGENTS.md`](docs/AGENTS.md) — project intelligence | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system architecture | [`docs/SECURITY.md`](docs/SECURITY.md) — security policy