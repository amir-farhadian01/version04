# Security Policy — Neighborly Marketplace

| Metadata | Value |
|---|---|
| **Document Owner** | Platform Engineering Team |
| **Last Review Date** | 2026-05-23 |
| **Version** | 1.0.0 |
| **Classification** | Internal — Public sections may be shared with auditors |
| **Security Contact** | [`security@neighborly.app`](mailto:security@neighborly.app) (placeholder — configure in production) |

---

## Table of Contents

1. [Security Overview](#1-security-overview)
2. [Authentication & Authorization](#2-authentication--authorization)
3. [API Security](#3-api-security)
4. [Data Protection](#4-data-protection)
5. [Infrastructure Security](#5-infrastructure-security)
6. [AI/ML Security](#6-aiml-security)
7. [Compliance Considerations](#7-compliance-considerations)
8. [Incident Response](#8-incident-response)
9. [Security Checklist for Development](#9-security-checklist-for-development)
10. [References](#10-references)

---

## 1. Security Overview

### 1.1 Purpose

This document defines the security policy, controls, and best practices for the Neighborly Marketplace platform — a local services marketplace (Uber for home services) connecting customers with service providers. It covers the full stack: Node.js/Express backend, React/Vite frontend, Flutter mobile/web app, PostgreSQL databases, and Docker-based infrastructure.

### 1.2 Scope

All components of the Neighborly platform are in scope:

- **Backend API** — [`server.ts`](server.ts) (Express, port 8080 local / 3000 Docker)
- **Admin API** — [`routes/admin.ts`](routes/admin.ts) (port 9090)
- **Web Frontend** — [`frontend/`](frontend/) (Vite + React, port 5173)
- **Mobile/Web App** — [`flutter_project/`](flutter_project/) (Flutter 3.x, port 7357 web)
- **Database** — PostgreSQL 16 (main + media metadata)
- **Object Storage** — MinIO (S3-compatible)
- **Reverse Proxy** — Traefik v3.3
- **Message Bus** — NATS (optional, non-fatal if unavailable)

### 1.3 Risk Tolerance

Neighborly handles **PII** (names, emails, phone numbers, addresses), **payment-adjacent data** (monetary values stored as cents), and **KYC documents** (ID scans, business registrations). The platform does **not** handle payment card data directly (Stripe/payment libraries are out of scope per [AGENTS.md](docs/AGENTS.md) Rule #6). The risk profile is **moderate** — a breach would expose personal information and marketplace transaction history.

### 1.4 Reporting Vulnerabilities

Report security vulnerabilities to [`security@neighborly.app`](mailto:security@neighborly.app). Expect acknowledgment within 48 hours and a fix timeline based on severity:

| Severity | Fix Timeline |
|---|---|
| Critical | 24 hours |
| High | 72 hours |
| Medium | 7 days |
| Low | 30 days |

---

## 2. Authentication & Authorization

### 2.1 JWT Token Structure

The platform uses a dual-token JWT strategy implemented in [`lib/jwt.ts`](lib/jwt.ts):

```typescript
// lib/jwt.ts — Token payload structure
interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}
```

| Token | Secret Env Var | Expiry | Purpose |
|---|---|---|---|
| **Access Token** | `JWT_SECRET` | **15 minutes** (`ACCESS_EXPIRY`) | API authorization — sent in `Authorization: Bearer <token>` header |
| **Refresh Token** | `JWT_REFRESH_SECRET` | **7 days** (`REFRESH_EXPIRY`) | Obtaining new access tokens without re-authentication |

**Token generation** ([`lib/jwt.ts:30-35`](lib/jwt.ts:30)): `generateTokenPair()` returns both tokens in a single call.

**Token verification** ([`lib/jwt.ts:22-28`](lib/jwt.ts:22)):
- `verifyAccessToken()` — used by the `authenticate` middleware on every protected route
- `verifyRefreshToken()` — used by the refresh token endpoint

**⚠️ Production requirement:** Both `JWT_SECRET` and `JWT_REFRESH_SECRET` must be set to cryptographically random values (minimum 256 bits). The dev defaults in [`lib/jwt.ts:3-4`](lib/jwt.ts:3) (`dev-access-secret-change-in-prod`, `dev-refresh-secret-change-in-prod`) are **not** suitable for production.

### 2.2 Token Expiry Policy

| Token | Lifetime | Renewal | Invalidation |
|---|---|---|---|
| Access Token | 15 minutes | Automatic via refresh token | On expiry or password change |
| Refresh Token | 7 days | Re-issued on use (rotation recommended) | On password reset ([`routes/auth.ts:302`](routes/auth.ts:302): `refreshToken: null`) |

**Recommended (not yet implemented):**
- Refresh token rotation: invalidate old refresh token on each use
- Token revocation list for immediate session termination
- Device fingerprint binding to tokens

### 2.3 RBAC Model

The platform defines **8 user roles** in the Prisma schema ([`prisma/schema.prisma:11-20`](prisma/schema.prisma:11)):

```prisma
enum UserRole {
  owner
  platform_admin
  developer
  support
  finance
  customer
  provider
  staff
}
```

| Role | Privilege Level | Description |
|---|---|---|
| `owner` | **Super Admin** | Full system access, all operations |
| `platform_admin` | **Admin** | Platform management, user administration |
| `developer` | **Admin** | System configuration, technical access |
| `support` | **Admin** | Customer support, KYC review, order management |
| `finance` | **Admin** | Payment operations, financial reporting |
| `customer` | **Standard** | Create orders, browse services, manage profile |
| `provider` | **Standard** | Accept orders, manage services, view workspace |
| `staff` | **Limited** | Workspace employee, scoped to assigned tasks |

**Admin roles** are defined in [`lib/auth.middleware.ts:38`](lib/auth.middleware.ts:38):
```typescript
export const isAdmin = requireRole('owner', 'platform_admin', 'support', 'finance');
```

### 2.4 Middleware Chain

All protected routes follow a two-layer middleware pattern ([`lib/auth.middleware.ts`](lib/auth.middleware.ts)):

```
Request → authenticate → requireRole(...) → Route Handler
```

1. **`authenticate`** ([`lib/auth.middleware.ts:8-22`](lib/auth.middleware.ts:8)): Extracts Bearer token from `Authorization` header, verifies via `verifyAccessToken()`, attaches `JwtPayload` to `req.user`. Returns `401` on missing/invalid/expired token.

2. **`requireRole(...roles)`** ([`lib/auth.middleware.ts:24-36`](lib/auth.middleware.ts:24)): Checks `req.user.role` against the allowed roles list. Returns `403` if the role is not permitted.

**Admin routes** use a shared gate ([`routes/admin.ts`](routes/admin.ts)):
```typescript
router.use(authenticate, isAdmin);
```
This applies to all routes under `/api/admin/*` (per [ADR-0002](docs/DECISIONS.md#adr-0002--admin-endpoints-under-apiaadmin-with-isadmin-middleware)).

### 2.5 Session Management

- **Stateless sessions:** JWT tokens are self-contained; no server-side session store is required
- **Refresh token storage:** Stored as `refreshToken` on the `User` model in PostgreSQL
- **Password change invalidation:** [`routes/auth.ts:302`](routes/auth.ts:302) sets `refreshToken: null` on password reset, invalidating all active refresh tokens
- **⚠️ Gap:** No explicit logout endpoint that invalidates access tokens (tokens remain valid until expiry). A token blacklist (Redis) is recommended for production.

### 2.6 Password Policies

Implemented in [`routes/auth.ts`](routes/auth.ts):

| Policy | Value | Implementation |
|---|---|---|
| **Hashing algorithm** | bcrypt | [`routes/auth.ts:199`](routes/auth.ts:199): `bcrypt.hash(password, 12)` |
| **Salt rounds** | 12 | Production-grade (OWASP recommends ≥10) |
| **Minimum length** | 8 characters | [`routes/auth.ts:291`](routes/auth.ts:291): `newPassword.length < 8` → 400 error |
| **Password comparison** | bcrypt.compare | [`routes/auth.ts:246`](routes/auth.ts:246): `bcrypt.compare(password, user.password)` |

**Recommended (not yet implemented):**
- Password complexity requirements (uppercase, lowercase, digit, special character)
- Common password blacklist check
- Account lockout after N failed attempts
- Multi-factor authentication (MFA/TOTP)
- Password history to prevent reuse

---

## 3. API Security

### 3.1 Input Validation (Zod Schemas)

Per [AGENTS.md](docs/AGENTS.md) Rule #17, **every API endpoint must have input validation** using Zod schemas:

> "No raw `req.body` access without `.parse()`" — [AGENTS.md:33](docs/AGENTS.md:33)

**Pattern:**
```typescript
// ✅ Required — every route handler
const input = createOrderSchema.parse(req.body); // Zod validation

// ❌ Forbidden — raw body access
const { name, price } = req.body; // NO
```

Zod schemas are defined per-route and provide:
- Type coercion and parsing
- Descriptive error messages on validation failure
- TypeScript type inference via `z.infer<typeof schema>`

### 3.2 Standard API Response Format

Per [AGENTS.md](docs/AGENTS.md) Rule #18, all API responses must follow:

```typescript
// Success
{ data: T }
{ data: T[], total: number, page: number, pageSize: number }  // paginated

// Error
{ code: string, message: string, details?: Record<string, unknown> }
```

**Error codes used in auth** ([`routes/auth.ts`](routes/auth.ts)):
- `EMAIL_NOT_FOUND` — login attempt with unregistered email
- `INVALID_PASSWORD` — incorrect password

### 3.3 CORS Configuration

Configured in [`server.ts:114-119`](server.ts:114):

```typescript
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN || true,  // ⚠️ 'true' allows all origins in dev
    credentials: true,
  }),
);
```

| Environment | `ALLOWED_ORIGIN` | Behavior |
|---|---|---|
| Development | Not set (defaults to `true`) | Allows all origins — acceptable for local dev |
| Production | **Must be set** to comma-separated allowed origins | Restricts to known frontend domains |

**⚠️ Production requirement:** Set `ALLOWED_ORIGIN` to the specific production origins (e.g., `https://neighborly.app,https://admin.neighborly.app`). Never use `true` or `*` in production.

### 3.4 Rate Limiting

**⚠️ Required (not yet implemented):** Rate limiting is not currently configured. The following endpoints **must** have rate limiting before production:

| Endpoint Group | Suggested Limit | Rationale |
|---|---|---|
| `/api/auth/*` | 10 requests/minute per IP | Brute force protection |
| `/api/orders/*` | 60 requests/minute per user | Abuse prevention |
| `/api/upload` | 10 requests/minute per user | File upload abuse |
| `/api/*` (general) | 100 requests/minute per IP | General DOS protection |

**Recommended middleware:** `express-rate-limit` with Redis-backed store for distributed rate tracking.

### 3.5 Request Size Limits

Configured in [`server.ts:112`](server.ts:112):

```typescript
app.use(express.json({ limit: "10mb" }));
```

The 10 MB limit applies to all JSON request bodies. File uploads are handled separately via `/api/upload` and should have their own size and type validation.

### 3.6 HTTP Security Headers

Configured in [`server.ts:120`](server.ts:120):

```typescript
app.use(helmet({ contentSecurityPolicy: false }));
```

[Helmet.js](https://helmetjs.github.io/) is used but **Content Security Policy (CSP) is disabled** (`contentSecurityPolicy: false`). This is a known gap.

**⚠️ Production requirement:** Enable and configure CSP headers:
```typescript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],  // React requires unsafe-inline for dev
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.neighborly.app"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
}));
```

---

## 4. Data Protection

### 4.1 PII Classification Levels

| Level | Definition | Examples | Storage |
|---|---|---|---|
| **L1 — Public** | Non-sensitive, intended for public display | Display name, service descriptions, ratings | Anywhere |
| **L2 — Internal** | Business data, not for public disclosure | Order details, pricing, workspace info | PostgreSQL, access-controlled |
| **L3 — Sensitive** | Personal information, regulated | Email, phone, address, KYC documents | PostgreSQL (encrypted at rest), MinIO (access-controlled) |
| **L4 — Restricted** | Highly sensitive, legally protected | Government IDs, financial records, passwords (hashed) | PostgreSQL (hashed/encrypted), never logged |

### 4.2 PII Protection in Chat

The platform implements **server-enforced PII masking** in chat messages via [`lib/chatModeration.ts`](lib/chatModeration.ts) (per [ADR-0044](docs/DECISIONS.md#adr-0044--pii-guard-is-server-enforced-on-send) and [ADR-0008](docs/DECISIONS.md#adr-0008--in-chat-pii-blocking--ai-translation-policy)).

**Detection patterns** ([`lib/chatModeration.ts:9-16`](lib/chatModeration.ts:9)):

| Pattern | Regex | Example |
|---|---|---|
| Email | `EMAIL_RE` | `user@example.com` → `***********` |
| Phone | `PHONE_RE` | `+1-416-555-0147` → `***********` |
| URL/Link | `LINK_RE` | `https://evil.com` → `**************` |
| Social handle | `HANDLE_RE` | `@username`, `t.me/...`, `wa.me/...` |
| Platform name | `PLATFORM_RE` | Telegram, WhatsApp, Signal, etc. (flagged) |
| Contact exchange | `CONTACT_EXCHANGE_RE` | "call me", "my number", "outside the app" (flagged) |

**Three-tier moderation action** ([`lib/chatModeration.ts:44-63`](lib/chatModeration.ts:44)):

| Action | Condition | Behavior |
|---|---|---|
| `allow` | No PII detected | Message passes through unchanged |
| `mask` | PII patterns detected | Sensitive text replaced with `***`; `displayText` is masked, `originalText` preserved |
| `flag` | Contact exchange intent detected | Message masked **and** flagged for admin review |

**Rate-based blocking** ([`routes/orderChat.ts:251`](routes/orderChat.ts:251)): If a sender accumulates ≥3 masked messages in a 24-hour window, subsequent masked messages are **blocked** with reason `repeated_contact_sharing`.

**⚠️ Important:** The `originalText` is always preserved server-side for audit/legal review. The masking applies only to the `displayText` sent to recipients.

### 4.3 Data Encryption at Rest

| Data Store | Encryption | Notes |
|---|---|---|
| **PostgreSQL (main)** | TDE via filesystem encryption | Volume-level encryption recommended for production |
| **PostgreSQL (media metadata)** | TDE via filesystem encryption | Separate DB instance per [`docker-compose.yml`](docker-compose.yml) |
| **MinIO (object storage)** | Server-Side Encryption (SSE-S3) | MinIO supports SSE; enable with KMS in production |
| **Backups** | GPG/AES-256 | All database backups must be encrypted before leaving the server |

**Passwords:** Hashed with bcrypt (12 rounds) — never stored in plaintext ([`routes/auth.ts:199`](routes/auth.ts:199)).

### 4.4 Data Encryption in Transit

| Connection | Protocol | Status |
|---|---|---|
| Client → Traefik | **TLS 1.3** | Required in production (Traefik handles termination) |
| Traefik → Backend | HTTP (internal network) | Acceptable within Docker network |
| Backend → PostgreSQL | TLS | Recommended; configure `sslmode=require` in `DATABASE_URL` |
| Backend → MinIO | HTTPS | Required in production |
| Backend → NATS | TLS | Recommended if NATS is used cross-host |

**Local development:** All services communicate over plain HTTP within the Docker network. This is acceptable for development only.

### 4.5 Monetary Values

Per [AGENTS.md](docs/AGENTS.md) Rule #21:

> "All monetary values stored as cents (integer) — never use floats for money."

- Prices are stored as integers (cents) in the database
- Display conversion (cents → dollars) happens in the presentation layer
- Cross-currency BOM lines are flagged but not converted ([ADR-0032](docs/DECISIONS.md#adr-0032--mixed-currency-bom-lines-warn-do-not-convert-phase-1))

### 4.6 Soft Delete Pattern

Per [AGENTS.md](docs/AGENTS.md) Rule #14:

> "Never delete DB columns — use `archivedAt` for soft delete."

All destructive operations must use the `archivedAt` (nullable `DateTime`) pattern instead of `DELETE` statements. This applies to:
- Categories ([`prisma/schema.prisma`](prisma/schema.prisma): `Category.archivedAt`)
- Service catalogs
- User accounts (recommended)
- Posts and reactions

---

## 5. Infrastructure Security

### 5.1 Docker Security Best Practices

| Practice | Status | Notes |
|---|---|---|
| **Non-root user** | ⚠️ Required | [`Dockerfile`](Dockerfile) should use `USER node` instead of running as root |
| **Read-only root filesystem** | ⚠️ Recommended | `read_only: true` in docker-compose for backend containers |
| **No privileged containers** | ✅ Implemented | No `privileged: true` in [`docker-compose.yml`](docker-compose.yml) |
| **Resource limits** | ⚠️ Recommended | Set `mem_limit` and `cpus` on all services |
| **Health checks** | ✅ Implemented | PostgreSQL and other services have health checks |
| **Image scanning** | ⚠️ Required | Run `docker scan` or Trivy on all images before deployment |
| **No latest tags** | ⚠️ Recommended | Pin specific versions (e.g., `postgres:16-alpine`) |
| **Docker socket** | ⚠️ Restricted | Traefik mounts `/var/run/docker.sock` — limit to Traefik only |

### 5.2 Traefik Reverse Proxy

Configured in [`docker-compose.yml`](docker-compose.yml) (Traefik v3.3):

| Feature | Status | Notes |
|---|---|---|
| TLS termination | ⚠️ Required | Configure Let's Encrypt via Traefik `certificatesresolvers` |
| Rate limiting | ⚠️ Required | Use Traefik middleware for global rate limiting |
| IP whitelisting | ⚠️ Recommended | Admin endpoints (`/api/admin/*`) should restrict by IP |
| Security headers | ⚠️ Recommended | Configure Traefik middleware for HSTS, X-Frame-Options |
| Dashboard auth | ⚠️ Required | Traefik dashboard (`:9191`) must have authentication in production |
| HTTP → HTTPS redirect | ⚠️ Required | All HTTP traffic must redirect to HTTPS |

### 5.3 Environment Variable Management

| Practice | Status | Notes |
|---|---|---|
| `.env` in `.gitignore` | ✅ Implemented | See [`.gitignore`](.gitignore) |
| `.env.example` as template | ✅ Implemented | See [`.env.example`](.env.example) |
| No secrets in code | ✅ Enforced | AGENTS.md Rule #8: "READ before WRITE" — no hardcoded secrets |
| Secret rotation | ⚠️ Required | Production secrets must be rotated quarterly |
| Secrets manager | ⚠️ Recommended | Use HashiCorp Vault, AWS Secrets Manager, or Docker secrets for production |

**Critical secrets that must never be committed:**
- `JWT_SECRET` — token signing key
- `JWT_REFRESH_SECRET` — refresh token signing key
- `DATABASE_URL` — contains credentials
- `GEMINI_API_KEY` — AI API key
- `MINIO_ROOT_PASSWORD` — object storage admin password

### 5.4 Network Segmentation

| Network | Services | Exposure |
|---|---|---|
| `neighborly_network` (Docker) | All internal services | Internal only |
| External (host) | Traefik (ports 80, 443) | Public |
| Admin (host) | Admin API (port 9090) | Restricted |

**Recommended segmentation:**
- Backend API and database should be on an internal network with no direct external access
- Admin API should require VPN or bastion host access in production
- MinIO should not be directly accessible from the public internet

### 5.5 MinIO Access Control

| Feature | Status | Notes |
|---|---|---|
| Authentication | ✅ Implemented | `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` |
| Bucket policies | ⚠️ Required | Restrict bucket access per-service |
| TLS | ⚠️ Required | Enable MinIO TLS in production |
| Presigned URLs | ⚠️ Recommended | Use presigned URLs for temporary media access instead of public buckets |
| Audit logging | ⚠️ Recommended | Enable MinIO audit webhook |

### 5.6 Inter-Service Authentication

#### Current State (as of v2.0.0)

Internal services communicate over **plain HTTP** within the Docker internal network (`neighborly-net`). This is considered acceptable for the current deployment scope because:

- All services run within an isolated Docker network
- The network is not exposed externally (Traefik terminates TLS at the edge)
- No sensitive data crosses service boundaries without additional application-level auth (JWT for user-facing APIs)

See [ARCHITECTURE.md §8.2](docs/ARCHITECTURE.md#82-local-development-vs-docker-mode) for the network topology.

#### Standards for New Services

Any new internal service added to the stack **MUST** implement at least one of the following authentication methods:

| Method | When to Use | Implementation |
|---|---|---|
| **Shared API Key** | Low-sensitivity internal APIs | Key stored in `.env` as `INTERNAL_API_KEY`, validated via middleware on each request |
| **JWT (service account)** | Services that need to act on behalf of users | Issue short-lived JWTs signed with `JWT_SECRET` using a dedicated service account |
| **mTLS** | Production-grade security (future) | Mutual TLS between services using a private CA; requires certificate management infrastructure |

#### API Key Authentication (Recommended for New Services)

1. Generate a secure random key: `openssl rand -hex 32`
2. Add to `.env`:
   ```env
   INTERNAL_API_KEY=<generated-key>
   ```
3. Add to `docker-compose.yml` as an environment variable for both the caller and receiver services
4. On the receiving service, add middleware to validate the `X-API-Key` header:
   ```typescript
   // Example middleware pattern
   const requireInternalApiKey = (req, res, next) => {
     const key = req.headers['x-api-key'];
     if (!key || key !== process.env.INTERNAL_API_KEY) {
       return res.status(403).json({ error: 'Forbidden' });
     }
     next();
   };
   ```

#### Future Considerations

- **Service Mesh:** Consider Traefik middleware or a dedicated service mesh (e.g. Consul Connect, Istio) for automatic mTLS
- **Rate Limiting:** See [§3.4](docs/SECURITY.md#34-rate-limiting) — rate limiting is NOT currently implemented and should be added before any inter-service auth migration
- **Audit Logging:** All inter-service authentication failures MUST be logged via the audit log system

#### Related Documentation

- [ARCHITECTURE.md §8](docs/ARCHITECTURE.md#8-deployment--infrastructure) — Docker network topology
- [ARCHITECTURE.md §8.2](docs/ARCHITECTURE.md#82-local-development-vs-docker-mode) — Local vs Docker mode
- [SECURITY.md §3.4](docs/SECURITY.md#34-rate-limiting) — Rate limiting (not yet implemented)

---

## 6. AI/ML Security

### 6.1 Client-Side Gemini AI Key Exposure

Per [ADR-0005](docs/DECISIONS.md#adr-0005--client-side-ai-for-kyc-ocrfraud-cost-on-user):

> "Keep Gemini calls client-side unless/until a reviewed server proxy exists."
> "Key exposure surface must be guarded in deployment."

**Risk:** The `VITE_GEMINI_API_KEY` environment variable is embedded in the client-side bundle and is visible to end users via browser DevTools.

**Mitigations:**

| Mitigation | Status | Notes |
|---|---|---|
| API key restriction in Google Cloud Console | ⚠️ Required | Restrict key to specific HTTP referrers and APIs |
| Key rotation | ⚠️ Required | Rotate client-side keys regularly |
| Server-side proxy | ⚠️ Recommended | Future state: proxy all AI calls through backend to hide the key |
| Usage quotas | ⚠️ Required | Set Google Cloud quota limits to prevent abuse |
| Monitoring | ⚠️ Required | Monitor Gemini API usage for anomalous patterns |

### 6.2 ADR-0005 and ADR-0016 Context

| ADR | Decision | Security Implication |
|---|---|---|
| [ADR-0005](docs/DECISIONS.md#adr-0005--client-side-ai-for-kyc-ocrfraud-cost-on-user) | Client-side AI for KYC OCR/fraud detection | API key exposed in browser; cost borne by user |
| [ADR-0016](docs/DECISIONS.md#adr-0016--ai-coach-for-order-description-client-side-gemini-store-text--flag) | Client-side AI for order description coaching | Only final user-edited text persisted; AI input/output not stored server-side |

### 6.3 Prompt Injection Considerations

Client-side AI calls are vulnerable to prompt injection attacks. Users could manipulate AI behavior by crafting malicious input.

**Mitigations:**
- AI output is **advisory only** — never trusted for authorization decisions
- KYC OCR results are reviewed by admins before approval
- Order descriptions generated by AI are user-editable before submission
- Contract drafts generated by AI require explicit provider send and customer approval ([ADR-0049](docs/DECISIONS.md#adr-0049--ai-contract-suggestion-is-advisory-final-legal-text-is-always-explicit-and-user-editable))

### 6.4 Data Retention for AI Inputs

| AI Feature | Data Sent to AI | Persisted Server-Side |
|---|---|---|
| KYC OCR | Document images | Yes (KYC submission records) |
| Order description coach | User's description draft | Only final edited `description` + `descriptionAiAssisted` flag |
| Chat translation | Message text | Yes (translation metadata on message) |
| Contract drafting | Order context + chat summary | Yes (ContractVersion with `generatedByAi=true`) |

**⚠️ GDPR consideration:** AI inputs sent to Google's Gemini API may be processed on Google's infrastructure. Ensure Data Processing Agreement (DPA) with Google Cloud is in place for production.

---

## 7. Compliance Considerations

### 7.1 GDPR (General Data Protection Regulation)

| Requirement | Status | Implementation |
|---|---|---|
| Right to access | ⚠️ Required | Provide endpoint for users to download their data |
| Right to deletion (right to be forgotten) | ⚠️ Required | Implement full user data deletion workflow (not just `archivedAt`) |
| Data portability | ⚠️ Required | Export user data in machine-readable format (JSON) |
| Consent management | ⚠️ Required | Record consent for data processing; allow withdrawal |
| Breach notification (72 hours) | ⚠️ Required | Incident response plan must include Art. 33 notification |
| Data Processing Agreement (DPA) | ⚠️ Required | Required with Google Cloud (Gemini AI) and any sub-processors |
| Data Protection Officer (DPO) | ⚠️ Recommended | Appoint DPO for EU user base |

**GDPR-specific technical measures:**
- All PII must be identifiable in the database schema for easy location and deletion
- `archivedAt` soft-delete pattern must support hard-delete for GDPR erasure requests
- Chat message `originalText` retention must have a configurable TTL
- Audit logs containing PII must have retention limits

### 7.2 CCPA (California Consumer Privacy Act)

| Requirement | Status | Notes |
|---|---|---|
| Right to know | ⚠️ Required | Disclose categories of personal information collected |
| Right to delete | ⚠️ Required | Same as GDPR deletion workflow |
| Right to opt-out | ⚠️ Required | "Do Not Sell My Personal Information" link |
| Non-discrimination | ⚠️ Required | No service denial for exercising CCPA rights |
| Notice at collection | ⚠️ Required | Privacy notice must be displayed at or before data collection |

### 7.3 PIPEDA (Canada — Toronto-Based)

The project uses Toronto test data (e.g., "123 Main St, Toronto, ON M5V 1A1" per [AGENTS.md](docs/AGENTS.md) test data requirements), indicating a Canadian operational focus.

| Requirement | Status | Notes |
|---|---|---|
| Meaningful consent | ⚠️ Required | Obtain consent for collection, use, and disclosure |
| Limiting collection | ⚠️ Required | Collect only what's necessary for service delivery |
| Safeguards | ⚠️ Required | Security measures must be proportionate to sensitivity |
| Openness | ⚠️ Required | Privacy policies must be readily available |
| Individual access | ⚠️ Required | Users can access and correct their personal information |
| Challenging compliance | ⚠️ Required | Designated contact for privacy complaints |

### 7.4 SOC2 Considerations (Production)

| Trust Service Criteria | Status | Notes |
|---|---|---|
| Security | ⚠️ Planned | Access controls, monitoring, incident response |
| Availability | ⚠️ Planned | Uptime monitoring, disaster recovery |
| Processing Integrity | ⚠️ Planned | Data validation, transaction accuracy |
| Confidentiality | ⚠️ Planned | Encryption, access controls for PII |
| Privacy | ⚠️ Planned | Personal information handling, consent |

---

## 8. Incident Response

### 8.1 Severity Levels

| Level | Definition | Examples | Response Time |
|---|---|---|---|
| **🔴 Critical** | Active data breach, system compromise, or service outage | Unauthorized database access, JWT secret leak, complete platform unavailability | Immediate — <15 minutes |
| **🟠 High** | Significant security vulnerability or partial service degradation | XSS vulnerability, authentication bypass, PII exposure via API | <1 hour |
| **🟡 Medium** | Moderate risk, limited impact | Rate limiting bypass, information disclosure (non-PII), CSRF on non-critical endpoint | <24 hours |
| **🟢 Low** | Minor issue, best-practice gap | Missing security headers, verbose error messages, outdated dependencies | <7 days |

### 8.2 Response Procedures

#### Critical/High Severity

```
1. DETECT
   └─ Alert received (automated monitoring, user report, or internal discovery)
   
2. TRIAGE (15 min)
   └─ Confirm severity and scope
   └─ Assemble incident response team
   └─ Open incident channel (Slack/Discord)
   
3. CONTAIN (1 hour)
   └─ Rotate exposed secrets (JWT_SECRET, DATABASE_URL, etc.)
   └─ Block malicious IPs/accounts
   └─ Scale down or isolate affected services
   └─ Enable maintenance mode if needed
   
4. ERADICATE (4 hours)
   └─ Identify root cause
   └─ Apply security patch
   └─ Remove attacker access
   └─ Verify no persistence mechanisms
   
5. RECOVER (8 hours)
   └─ Restore from clean backup if necessary
   └─ Verify system integrity
   └─ Gradually restore services
   └─ Monitor for recurrence
   
6. POST-MORTEM (48 hours)
   └─ Root cause analysis document
   └─ Timeline of events
   └─ Remediation items with owners
   └─ Update security policy and controls
```

#### Medium/Low Severity

```
1. Triage and log in issue tracker
2. Assign to appropriate team member
3. Fix in normal development cycle
4. Verify fix with security tests
5. Document in release notes
```

### 8.3 Communication Plan

| Audience | Channel | Timing |
|---|---|---|
| Internal team | Slack/Discord incident channel | Immediate |
| Affected users | Email notification | Within 24 hours (Critical/High) |
| Regulatory bodies (if applicable) | Formal notification | Within 72 hours (GDPR Art. 33) |
| Public (if applicable) | Status page + blog post | After containment |

### 8.4 Post-Mortem Requirements

Every security incident requires a post-mortem within 48 hours containing:

1. **Timeline** — When each event occurred (detection, triage, containment, recovery)
2. **Root cause** — Technical and procedural factors
3. **Impact assessment** — Data exposed, users affected, service downtime
4. **Detection gaps** — Why wasn't this caught earlier?
5. **Containment effectiveness** — What worked, what didn't?
6. **Remediation items** — Specific, measurable actions with owners and deadlines
7. **Lessons learned** — Process improvements, training needs, tooling gaps

---

## 9. Security Checklist for Development

Every developer and AI agent must verify this checklist before marking any task as complete:

```
□ All inputs validated with Zod schemas — no raw req.body access
□ No secrets in code or commits — checked by .gitignore + pre-commit hook
□ JWT tokens have expiry (15m access, 7d refresh)
□ CORS configured for production origins (ALLOWED_ORIGIN set)
□ Rate limiting enabled on auth endpoints (express-rate-limit)
□ PII masked in chat messages (lib/chatModeration.ts enforced)
□ File uploads validated (type, size, scan) — /api/upload
□ SQL injection prevented (Prisma parameterized queries — safe by design)
□ XSS prevented (React auto-escaping, Content-Security-Policy recommended)
□ CSRF protection (same-site cookies, JWT in Authorization header — partially covered)
□ No console.log in production — use structured logging via lib/bus.ts
□ Dependencies scanned for vulnerabilities (npm audit)
□ Docker images scanned for vulnerabilities (docker scan / Trivy)
□ All async functions have try/catch with next(error)
□ No any types — use unknown with type guards
□ All monetary values stored as cents (integer)
□ All dates in UTC ISO 8601 (timestamp with time zone)
□ Soft delete pattern (archivedAt) — never DELETE rows
□ No file exceeds 500 lines
□ No React component exceeds 200 lines
□ Standard API response format: { data: T } / { code, message, details }
□ Tests written for all new logic (coverage ≥80%)
□ Security tests pass (SQL injection, XSS, CSRF, JWT tampering, IDOR)
```

---

## 10. References

### Internal Documentation

| Document | Description |
|---|---|
| [`docs/AGENTS.md`](docs/AGENTS.md) | Agent rules, including security-related rules (#5 imports, #6 no Stripe, #13 no `any`, #14 soft delete, #16 no console.log, #17 Zod validation, #18 response format, #21 monetary values) |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Architecture Decision Records — see ADR-0005 (client-side AI), ADR-0016 (AI coach), ADR-0044 (PII guard) |
| [`docs/PORTS.md`](docs/PORTS.md) | Complete port registry for all services |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System architecture overview |

### Source Files

| File | Relevance |
|---|---|
| [`lib/jwt.ts`](lib/jwt.ts) | JWT token generation, signing, and verification |
| [`lib/auth.middleware.ts`](lib/auth.middleware.ts) | Authentication (`authenticate`) and authorization (`requireRole`, `isAdmin`) middleware |
| [`lib/chatModeration.ts`](lib/chatModeration.ts) | Server-enforced PII masking in chat messages |
| [`routes/auth.ts`](routes/auth.ts) | Registration, login, password reset — bcrypt hashing, password policies |
| [`server.ts`](server.ts) | Express app configuration — CORS, Helmet, request size limits, route mounting |
| [`routes/orderChat.ts`](routes/orderChat.ts) | Order-scoped chat with moderation pipeline and rate-based blocking |
| [`prisma/schema.prisma`](prisma/schema.prisma) | Database schema — UserRole enum, soft delete fields, monetary types |
| [`.env.example`](.env.example) | Environment variable template — all secrets marked as placeholders |
| [`docker-compose.yml`](docker-compose.yml) | Docker services configuration — Traefik, PostgreSQL, MinIO, networks |

### External Standards

| Standard | Reference |
|---|---|
| OWASP Top 10 (2021) | https://owasp.org/www-project-top-ten/ |
| OWASP ASVS (Application Security Verification Standard) | https://owasp.org/www-project-application-security-verification-standard/ |
| NIST SP 800-53 | https://csrc.nist.gov/publications/detail/sp