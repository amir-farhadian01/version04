> READ docs/AGENTS.md COMPLETELY BEFORE WRITING ANY CODE.
> Then read docs/ROADMAP.md. Then read docs/FEATURES.md.

> ⚠️ Backend runs on port **8080** locally. Port 8077 is legacy — do not use.

# Neighborly 2.0 — Claude/Cursor Agent Guide

Read these files in this exact order before doing anything:
1. docs/ROADMAP.md
2. docs/FEATURES.md
3. docs/AGENTS.md

## Quick commands
- Start backend (port 8080): npm run dev
- Start frontend (port 5173): cd frontend && npm run dev
- Run all tests: npm test && cd frontend && npm test
- Docker up: docker compose up -d
- Prisma migrate: npx prisma migrate dev

## Architecture
- **Backend**: Node.js + Express + TypeScript + Prisma + PostgreSQL (port 8080)
- **Frontend (new)**: React 18 + Vite + TailwindCSS + Zustand (port 5173, in `frontend/`)
- **Frontend (old)**: React 18 + Vite (served by backend on port 8080, in `src/`)
- **Mobile**: Flutter (in `flutter_project/`)
- **Infrastructure**: Docker + Redis + NATS

## UI Reference
The reference UI is served on port 8080 (old `src/` frontend). It uses a dark theme:
- Background: `#0d0f1a`, Cards: `#1e2235`, Borders: `#2a2f4a`
- Primary: `#2b6eff` (blue), Business: `#ff7a2b` (orange), Success: `#0FC98A` (green)
- Text: white, `#8b90b0` (muted), `#4a4f70` (dim)
- The new `frontend/` must match this dark theme exactly.

## Phase Plan
See `docs/ROADMAP.md` for the full phased execution plan.
