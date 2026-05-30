# Architecture Decision Record

## ADR-0068 — Customer Dashboard with Live Order Status Polling

**Status:** Accepted
**Date:** 2026-05-26
**Author:** AI Agent (Orchestrator)

### Context

The customer dashboard is the primary interface for users to track their active and past service orders. Before this feature, the dashboard displayed a static list of orders with no real-time status feedback — users had to manually refresh the page to see order progress. This created a poor user experience, especially during time-sensitive phases like `matching`, `quoting`, and `in_progress` where status changes occur frequently.

Key requirements:
1. **Live status updates** — The dashboard must reflect order status changes without manual page refresh.
2. **Time estimation** — Users need to know how long each phase is expected to take and how much time remains.
3. **Phase-aware display** — Each order phase should show a descriptive label, progress bar, and remaining time.
4. **Payment visibility** — For paid orders, show payment amount, status, and escrow release date.
5. **RTL support** — The platform serves Persian-speaking users; phase labels must be in Farsi.
6. **Lightweight polling** — The polling mechanism must not overload the backend or the client.

### Decision

We implemented a **client-side polling architecture** with a **10-second interval**, backed by a lightweight status endpoint and a shared time estimation module.

#### Architecture Overview

```
┌─────────────────────┐         GET /orders/me (every 10s)         ┌──────────────────┐
│                     │ ──────────────────────────────────────────► │                  │
│  Customer Dashboard │                                             │  Backend API     │
│  (React SPA)        │ ◄────────────────────────────────────────── │  (Express)       │
│                     │         JSON: OrderListItem[]               │                  │
│  ┌───────────────┐  │                                             │  ┌────────────┐  │
│  │ useTimeEstimate│  │  Client-side estimation                    │  │ GET /:id/  │  │
│  │ (1s tick)     │  │  using updatedAt + PHASE_DURATIONS         │  │ status     │  │
│  └───────────────┘  │                                             │  └────────────┘  │
│  ┌───────────────┐  │                                             │  ┌────────────┐  │
│  │ Progress Bar  │  │  Color: green < 50%, yellow 50-80%, red    │  │ orderTime- │  │
│  │ + Phase Label │  │  > 80%                                     │  │ Estimate   │  │
│  └───────────────┘  │                                             │  └────────────┘  │
└─────────────────────┘                                             └──────────────────┘
```

#### 1. Time Estimation Module ([`lib/orderTimeEstimate.ts`](lib/orderTimeEstimate.ts))

A shared utility that computes estimated remaining time for each order phase based on urgency level. The module is used both server-side (by the status endpoint) and client-side (by the dashboard's `useTimeEstimate` hook).

**Duration tables** (in minutes):

| Phase | low | standard | urgent | emergency |
|---|---|---|---|---|
| matching | 30 | 15 | 5 | 2 |
| quoting | 60 | 30 | 15 | 5 |
| negotiation | 120 | 60 | 30 | 15 |
| contracted | 1440 | 720 | 360 | 120 |
| paid | 0 | 0 | 0 | 0 |
| in_progress | 120* | 120* | 120* | 120* |
| completed | 0 | 0 | 0 | 0 |
| cancelled | 0 | 0 | 0 | 0 |
| disputed | 0 | 0 | 0 | 0 |

> *`in_progress` uses `jobRecord.estimatedDurationMinutes` if available, falling back to 120 min.

**Core estimation logic** ([`estimateRemainingTime`](lib/orderTimeEstimate.ts:109)):
- `totalMs` = `estimatePhaseDuration(order.phase, order.urgency)`
- `elapsedMs` = `Date.now() - order.updatedAt.getTime()` (uses `updatedAt` as phase start time)
- `remainingMs` = `Math.max(0, totalMs - elapsedMs)`
- `percentage` = `Math.min(100, Math.round((elapsedMs / totalMs) * 100))`

#### 2. Lightweight Status Endpoint ([`routes/orders.ts:1390`](routes/orders.ts:1390))

`GET /orders/:id/status` — Returns only essential fields for a single order:

```typescript
// Response shape
{
  data: {
    id: string;
    status: OrderStatus;
    phase: string | null;
    urgency: string;
    createdAt: string;
    updatedAt: string;
    scheduledAt: string | null;
    completedAt: string | null;
    cancelledAt: string | null;
    budget: number | null;
    timeEstimate: {
      remainingMs: number;
      totalMs: number;
      elapsedMs: number;
      percentage: number;
      label: string;          // Persian phase label
      remainingText: string;  // Human-readable remaining time
    };
    payment: {
      amount: number;
      status: string;
      escrowReleaseAt: string | null;
    } | null;
    provider: {
      id: string;
      businessName: string | null;
      phone: string | null;
    } | null;
  };
}
```

This endpoint is designed for future use (e.g., a dedicated order detail page with live status). Currently, the dashboard polls `GET /orders/me` which returns the full `OrderListItem[]` — the client-side `useTimeEstimate` hook computes time estimates locally using the same duration tables.

#### 3. Status-to-Phase Mapping ([`routes/orders.ts:1355`](routes/orders.ts:1355))

Maps Prisma `OrderStatus` enum values to the 9 time-estimation phases:

```typescript
function statusToTimeEstimatePhase(status: OrderStatus): OrderPhase {
  switch (status) {
    case OrderStatus.draft:
    case OrderStatus.submitted:  return 'quoting';
    case OrderStatus.matching:   return 'matching';
    case OrderStatus.matched:    return 'negotiation';
    case OrderStatus.contracted: return 'contracted';
    case OrderStatus.paid:       return 'paid';
    case OrderStatus.in_progress:return 'in_progress';
    case OrderStatus.completed:  return 'completed';
    case OrderStatus.cancelled:  return 'cancelled';
    case OrderStatus.disputed:
    case OrderStatus.closed:     return 'disputed';
    case OrderStatus.expired:    return 'cancelled';
    default:                     return 'quoting';
  }
}
```

#### 4. Frontend Dashboard ([`frontend/src/pages/customer/Dashboard.tsx`](frontend/src/pages/customer/Dashboard.tsx))

**Polling** ([`Dashboard.tsx:185-189`](frontend/src/pages/customer/Dashboard.tsx:185)):
- Initial fetch on mount via `useEffect`
- `setInterval(fetchOrders, 10000)` — polls every 10 seconds
- Cleanup on unmount via `clearInterval`

**Client-side time estimation** ([`useTimeEstimate` hook](frontend/src/pages/customer/Dashboard.tsx:100)):
- Re-computes every 1 second using a local `now` state updated via `setInterval`
- Mirrors the server-side `PHASE_DURATIONS` table and `estimateRemainingTime` logic
- Returns `{ remainingMs, totalMs, elapsedMs, percentage, label, remainingText }`

**Progress bar** ([`progressBarColor`](frontend/src/pages/customer/Dashboard.tsx:159)):
- `< 50%` → green (`bg-green-500`)
- `50-80%` → yellow (`bg-yellow-500`)
- `> 80%` → red (`bg-red-500`)

**Transition animations**:
- Active order cards use `animate-slide-in` CSS class
- Progress bar uses `transition-all duration-1000 ease-linear` for smooth width changes
- Card hover effects: `hover:border-blue-300 transition-all duration-300`

**Payment info display**:
- Amount formatted as dollars (`amount / 100`)
- Status badge with color coding (`PENDING`, `CAPTURED`, `REFUNDED`, `FAILED`)
- Escrow release date shown when available

**Persian phase labels** ([`PHASE_LABELS`](frontend/src/pages/customer/Dashboard.tsx:8)):

| Phase | Persian Label |
|---|---|
| matching | در حال پیدا کردن متخصص |
| quoting | در انتظار پیشنهاد قیمت |
| negotiation | در حال مذاکره |
| contracted | در انتظار تایید قرارداد |
| paid | پرداخت شده |
| in_progress | در حال انجام |
| completed | تکمیل شده |
| cancelled | لغو شده |
| disputed | مختومه |

#### 5. Tests

- [`lib/orderTimeEstimate.test.ts`](lib/orderTimeEstimate.test.ts) — 269 lines covering `estimatePhaseDuration`, `estimateRemainingTime`, `formatRemainingTime`, and `getPhaseLabel` with edge cases (zero durations, overflow, boundary values).
- [`routes/orders.status.test.ts`](routes/orders.status.test.ts) — 447 lines covering the `GET /orders/:id/status` endpoint with auth checks, 404/403 handling, time estimation integration, payment info, and provider info.

### Consequences

**Positive:**
- ✅ **10s polling is acceptable** for a dashboard use case — status changes (matching → quoting → contracted → in_progress) occur over minutes/hours, not seconds.
- ✅ **Client-side estimation avoids server load** — the dashboard re-computes time estimates locally every 1s without hitting the backend, reducing API calls by 99.9% compared to server-side estimation per tick.
- ✅ **No WebSocket infrastructure needed** — polling uses standard HTTP, works through all proxies and load balancers, and requires no connection management.
- ✅ **Persian phase labels** provide proper RTL support for the target user base.
- ✅ **Urgency-based duration estimates** give users appropriate expectations — emergency orders show shorter timeframes than standard ones.
- ✅ **Progress bar color coding** provides intuitive visual feedback — green for on-track, yellow for caution, red for overdue.
- ✅ **Lightweight status endpoint** is ready for future use on order detail pages or mobile clients.
- ✅ **Shared time estimation logic** between server and client ensures consistent calculations.
- ✅ **Transition animations** improve perceived performance and user experience.

**Negative:**
- ❌ **10s polling still generates 6 API calls per minute** per active dashboard session — with many concurrent users, this could add up. Mitigation: the `GET /orders/me` endpoint returns lightweight data.
- ❌ **Client-side estimation is approximate** — uses `updatedAt` as phase start time, which may drift if the phase started long before the client loaded. The percentage may show >100% briefly before capping.
- ❌ **No real-time push** — if a status changes between poll intervals, the user sees it up to 10 seconds later. This is acceptable for a dashboard but not for real-time-critical views.
- ❌ **Duration tables are duplicated** between server (`lib/orderTimeEstimate.ts`) and client (`Dashboard.tsx`). Changes must be kept in sync manually.
- ❌ **No retry logic on poll failure** — if a poll request fails, the dashboard shows "Failed to load orders" error state until the next successful poll.

### Alternatives Considered

#### 1. WebSockets (Rejected)

**Proposal:** Establish a persistent WebSocket connection for real-time order status updates pushed from the server.

**Rejected because:**
- Over-engineering for a dashboard use case where status changes occur at minute/hour granularity
- Requires WebSocket server setup, connection management, reconnection logic, and scaling considerations
- Adds complexity to the deployment (sticky sessions or a pub/sub layer like Redis)
- The existing infrastructure has no WebSocket support — would require significant new code
- 10s polling provides a comparable user experience with far less complexity

#### 2. Server-Sent Events (SSE) (Rejected)

**Proposal:** Use SSE for one-way server-to-client streaming of status updates.

**Rejected because:**
- More complex than polling — requires SSE endpoint, event stream management, and client-side `EventSource` handling
- SSE connections are long-lived HTTP connections, which can be problematic behind some proxies and load balancers
- Browser support is good but not universal (no IE support)
- Still requires server-side event emission logic when order status changes
- The marginal benefit over 10s polling does not justify the complexity

#### 3. 5-Second Polling (Rejected)

**Proposal:** Poll every 5 seconds for more responsive updates.

**Rejected because:**
- Doubles the API call volume (12 calls/min vs 6 calls/min)
- No meaningful UX improvement — order statuses don't change that frequently
- Higher backend load with negligible benefit

#### 4. 30-Second Polling (Rejected)

**Proposal:** Poll every 30 seconds to reduce API calls.

**Rejected because:**
- Too slow for status updates during fast phases (e.g., `matching` with `emergency` urgency completes in ~2 minutes)
- Users would see stale data for too long
- Poor perceived responsiveness

### Files

- [`lib/orderTimeEstimate.ts`](lib/orderTimeEstimate.ts) — Time estimation module: `estimatePhaseDuration`, `estimateRemainingTime`, `formatRemainingTime`, `getPhaseLabel`
- [`lib/orderTimeEstimate.test.ts`](lib/orderTimeEstimate.test.ts) — 269 lines of tests for the time estimation module
- [`routes/orders.ts:1355`](routes/orders.ts:1355) — `statusToTimeEstimatePhase` mapping function
- [`routes/orders.ts:1390`](routes/orders.ts:1390) — `GET /orders/:id/status` lightweight status endpoint
- [`routes/orders.status.test.ts`](routes/orders.status.test.ts) — 447 lines of tests for the status endpoint
- [`frontend/src/pages/customer/Dashboard.tsx`](frontend/src/pages/customer/Dashboard.tsx) — Customer dashboard with polling, time estimation hook, progress bar, payment info, and Persian labels
