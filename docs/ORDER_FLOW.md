# ORDER FLOW EXECUTION DOCUMENT
## Neighborly Platform — Universal Order Workflow
### Applicable to ALL Business Types and ALL Service Modes

**Version:** 2.0.0
**Date:** 2026-05-25
**Status:** Production Reference Document

---

## TABLE OF CONTENTS

1. Core Flow Overview
2. Service Type Classification Matrix
3. Phase-by-Phase Workflow (10 Phases)
4. Execution Modes (5 Modes)
5. Service Delivery Models (In-Store vs Mobile vs Remote)
6. Special Service Configurations
   - 6.1 Walk-In (No Appointment)
   - 6.2 Emergency / High-Urgency
   - 6.3 Multi-Session / Multi-Day
   - 6.4 Group Services
   - 6.5 Inventory-Linked Services
   - 6.6 Quote-First Flow
   - 6.7 Reorder Flow
   - 6.8 Deposit-Based Services
   - 6.9 Provider Counter-Offer
   - 6.10 Pre-Match Read Access (Invited Providers)
7. Cancellation Rules by Phase
8. Order Status Machine (Complete)
9. Capacity Reference by Business Type
10. Real-Time Notifications
11. Business Type Examples (7 Examples)
12. Failed Order Handling
13. Anti-Circumvention Protocol
14. Staff Identity and Safety Rules
15. Metrics and Monitoring
16. Quick Reference

---

## PART 1: CORE FLOW OVERVIEW

```
CLIENT INTENT
     │
     ▼
INTENT CAPTURE
(Wizard / Explore / Direct / Reorder / Guest)
     │
     ▼
SERVICE TYPE CLASSIFICATION
(determines: delivery model + execution mode + capacity model)
     │
     ▼
MATCHING ENGINE
(distance · rating · availability · capacity · booking mode)
     │
     ▼
CAPACITY VALIDATION
(live slots · time-based slots · worker availability)
     │
     ▼
DISPATCH
(auto-match 1 provider OR round-robin invite up to 5)
     │
     ▼
OFFER STAGE
(provider accepts · declines · counter-offers)
     │
     ▼
EXECUTION MODE
  ├── MODE 1: AUTO-APPOINTMENT     → instant booking, no chat
  ├── MODE 2: NEGOTIATION (Chat)   → agree price + scope + time
  ├── MODE 3: HYBRID               → auto-book + minor chat
  ├── MODE 4: QUOTE-FIRST          → provider sends quote before order
  └── MODE 5: WALK-IN              → no booking, real-time slot
     │
     ▼
CONTRACT GENERATION & APPROVAL
     │
     ▼
PAYMENT
(full · deposit · pay-on-completion · recurring)
     │
     ▼
JOB EXECUTION
(single session · multi-session · group · mobile · in-store)
     │
     ▼
COMPLETION & REVIEW
(confirm · dispute · auto-close · rate · invoice)
```

---

## PART 2: SERVICE TYPE CLASSIFICATION MATRIX

Before an order is processed, the system classifies the service across 4 dimensions.
This classification determines which flow the order follows.

### DIMENSION 1 — Delivery Model

| Model | Description | Examples |
|-------|-------------|---------|
| IN-STORE | Client comes to provider's location | Haircut, oil change, massage |
| MOBILE / ON-SITE | Provider comes to client's location | Plumber, cleaner, painter |
| REMOTE | Service delivered digitally | Tutoring, legal consult, design |
| DUAL | Either location works | Personal training, photography |

### DIMENSION 2 — Booking Model

| Model | Description | Examples |
|-------|-------------|---------|
| AUTO-APPOINTMENT | Fixed price, instant booking | Haircut, nail appointment |
| NEGOTIATION | Price or scope needs discussion | Renovation, custom design |
| HYBRID | Standard service, minor adjustments | Full detail, event photography |
| QUOTE-FIRST | Provider must assess before pricing | Large renovation, moving |
| WALK-IN | No pre-booking, real-time slot | Walk-in haircut, urgent repair |

### DIMENSION 3 — Duration Model

| Model | Description | Examples |
|-------|-------------|---------|
| FIXED SINGLE SESSION | Known duration, happens once | 30-min haircut |
| VARIABLE SINGLE SESSION | Duration unknown until assessed | Plumbing repair |
| MULTI-SESSION | Multiple visits, one order | 10 training sessions |
| MULTI-DAY | Job spans multiple days | House painting, construction |
| RECURRING | Repeats on a schedule | Weekly cleaning, monthly maintenance |

### DIMENSION 4 — Capacity Model

| Model | Description | Examples |
|-------|-------------|---------|
| UNIT-BASED | N jobs at once (chairs, bays) | Salon, garage |
| WORKER-BASED | 1 job per worker | Plumber, trainer |
| TEAM-BASED | 1 job per team | Cleaning crew, moving team |
| GROUP | 1 session, N clients | Yoga class, cooking class |
| UNLIMITED | No concurrency limit | Online tutoring, digital services |

---

## PART 3: PHASE-BY-PHASE WORKFLOW

---

### PHASE 1 — CLIENT INTENT CAPTURE

**Trigger:** Client initiates a new order from any entry point.

**Entry Points:**

| Entry Point | Description | Pre-filled Data |
|-------------|-------------|----------------|
| Wizard (Primary) | Step-by-step guided flow | None |
| Explore Mode | Browse by category or map, tap a service | Service type |
| Direct Mode | Tap a specific business from post or profile | Business + service |
| Reorder | Repeat a past order with same provider | All previous order data |
| Guest Mode | Non-authenticated user starts wizard | None (login required at submit) |
| Deep Link | From marketing banner or notification | Category or service |

**Data Collected:**

| Field | Required | Notes |
|-------|----------|-------|
| Service category | Yes | From category tree |
| Service sub-type | Yes | From service catalog |
| Description | Yes | Min. 20 characters |
| Photos | Optional | Up to 5; strongly recommended for home services |
| Service address | Yes | Where job occurs or client's location for in-store |
| Preferred date/time | Optional | If blank → system suggests |
| Budget preference | Optional | Helps matching score |
| Urgency | Optional | normal / high / flexible |
| Questionnaire answers | Conditional | Dynamic fields per service type |
| AI-assisted description | Optional | AI coach improves description quality |

**Outcome:** Order record created with `status: draft`, `phase: offer`.

**Rules:**
- Draft is auto-saved every 30 seconds
- Guest users can fill the wizard but API returns 401 on submit → wizard redirects to login with `returnTo` preserving all entered data
- Reorder pre-fills all fields from the previous order and allows editing before submit

---

### PHASE 2 — ORDER SUBMISSION

**Trigger:** Client reviews the draft and taps "Submit Order."

**Validation Before Submit:**

| Rule | Type | Message if Failed |
|------|------|-------------------|
| Description ≥ 20 characters | Hard block | "Please describe your job in more detail." |
| Location geocoded | Hard block | "We couldn't find this address. Please check and try again." |
| Service type selected | Hard block | "Please select a service type." |
| No photo uploaded | Soft warning | "Adding photos helps providers give better quotes." |
| Dynamic questionnaire complete | Hard block (if required fields set) | "Please complete all required fields." |

**What Happens:**
1. `status: draft` → `status: submitted`
2. `phase: offer`
3. Matching Engine triggered automatically (synchronous, runs inline)
4. Client receives: "Your order has been submitted. Finding you the best providers..."

**Order Record State:**
```
status:              submitted
phase:               offer
matchedProviderId:   null
autoMatchExhausted:  false
entryPoint:          wizard | explore | direct | reorder | admin
```

---

### PHASE 3 — MATCHING ENGINE

**Trigger:** Immediately after submission. Runs synchronously (2-second budget).

**Scoring Formula:**
```
Score =
  (1 / distanceKm)         × weightProximity   (default 40%)
  + providerRating          × weightRating      (default 30%)
  + (1 / finalPrice)        × weightPrice       (default 20%)
  + providerResponseRate    × weightResponse    (default 10%)
```

Client can customize weights via priority template (saved on their profile).

**Eligibility Gates — ALL must pass:**

| Gate | Requirement |
|------|-------------|
| KYC | workspace `kycStatus: verified` |
| Provider status | `isVerified: true` AND `status: active` |
| Distance | within 50km of job location |
| Booking mode | package booking mode compatible with order |
| Service match | provider offers the requested catalog service |
| Capacity | at least 1 slot available (checked in Phase 4) |

**High-Urgency Override:**
If `urgency: high`, the scoring formula applies a time-availability bonus:
```
urgency bonus = +0.3 to providers who have a slot within 4 hours
```
This effectively pushes available-now providers to the top.

**Matching Paths:**

#### PATH A — AUTO-APPOINTMENT
- Selects the single best-scored eligible provider
- Order → `matched` immediately
- Provider appears in their Inbox
- No client selection required

#### PATH B — ROUND-ROBIN NEGOTIATION
- Invites top 5 eligible providers simultaneously
- 24-hour window for each to respond
- Providers who decline → replaced by next eligible provider
- Client reviews all active offers and selects one
- Client can set priority weights at selection time (saved for future orders)

**If No Match Found:**
- `autoMatchExhausted: true`
- Admin notified
- Client notified with estimated re-match time
- System retries matching every 2 hours with slightly expanded criteria (radius +10km per retry, max 3 retries)

---

### PHASE 4 — CAPACITY VALIDATION

**Trigger:** Before dispatching to each provider, capacity is checked in real time.

**Capacity Check (Redis, atomic Lua script):**
```
IF activeJobs < maxConcurrentJobs:
    → ACCEPT: reserve slot atomically
    → proceed to dispatch

ELSE IF futureSlotAvailable within client's preferred window:
    → SCHEDULE: suggest next available slot
    → present to client for confirmation

ELSE:
    → QUEUE: add to provider's waitlist
    → notify client of estimated wait time
```

**Time-Based Slot Example:**
```
Service: Haircut | Duration: 45 min | Max concurrent: 3

2026-05-25 schedule:
  09:00-09:45 → capacity 3 → active 1 → available 2  ✓
  09:45-10:30 → capacity 3 → active 3 → available 0  FULL
  10:30-11:15 → capacity 3 → active 0 → available 3  ✓ (best score)
  11:15-12:00 → capacity 3 → active 2 → available 1  ✓
```

**Worker-Based Capacity:**
```
Service: Pipe Repair | Requires: 1 assigned worker

Workers:
  Mike  → schedule: Mon-Fri 8am-5pm | current jobs: 1 | max: 2  → AVAILABLE
  Sara  → schedule: Mon-Fri 8am-5pm | current jobs: 2 | max: 2  → FULL
  Ahmed → schedule: Mon-Wed 9am-6pm | today: day off             → UNAVAILABLE

→ Mike is assigned
```

**Race Condition Prevention:**
- All slot reservations use Redis atomic Lua scripts
- No client-side capacity decisions
- Redis = single source of truth for live capacity
- PostgreSQL = persistence only, not used for locking

---

### PHASE 5 — DISPATCH TO PROVIDERS

**Trigger:** Matching + capacity validation succeeded.

**What Providers See in Inbox:**

| Field | Content |
|-------|---------|
| Client | First name + avatar only (no contact info) |
| Service | Name + category |
| Description | Full client description |
| Photos | All uploaded photos |
| Location | Neighbourhood only (full address revealed after accept) |
| Preferred time | Client's preference or "Flexible" |
| Urgency | Shown if high |
| Expiry | Time remaining (24h default, 4h for high-urgency) |

**Provider Actions:**

| Action | What Happens |
|--------|-------------|
| Accept | Order → `matched`. Full address revealed. Chat or auto-schedule begins. |
| Decline | Attempt → `declined`. Next eligible provider invited. Lost-deal feedback requested. |
| Counter-offer | Chat thread opens. Provider proposes different price or time. Order stays `matching`. |
| No response (expiry) | Attempt → `expired`. Lazy expiry runs on next inbox access. Next provider invited. |

**Pre-Match Read Access (Invited Providers):**
Invited workspace members (staff of an invited provider) can:
- Read the order chat thread (read-only)
- View contract status (read-only, shows `CONTRACTS_LOCKED_UNTIL_MATCHED`)
- View payment status (read-only, shows `PAYMENT_CUSTOMER_AFTER_CONTRACT`)
- Cannot send chat messages or draft contracts until the order is matched to their workspace

This prevents confusion when a team is evaluating an invite together.

**Lost-Deal Feedback (shown after decline or expiry):**
- "Too far from my location"
- "Not available at requested time"
- "Service outside my current expertise"
- "Price expectation too low"
- "Fully booked"
- "Other" (free text + optional comment)

---

### PHASE 6 — EXECUTION MODE

Once a provider accepts, the system determines how the order proceeds.
The execution mode is determined by the service catalog's `lockedBookingMode` and the package's `bookingMode`.

---

#### MODE 1 — AUTO-APPOINTMENT

**When used:**
- Service catalog locks mode as `auto_appointment`
- Provider enabled auto-appointment for this package
- No negotiation needed, price is fixed

**Flow:**
```
Provider accepts
    → Smart Scheduling Engine runs
    → Top 3-5 time slots scored and presented to client
    → Client selects slot (or confirms suggested slot)
    → Worker assigned automatically
    → Contract auto-generated from template
    → Client reviews contract (1 click approve)
    → Payment requested
    → Job confirmed
```

**Slot Scoring Formula:**
```
SLOT SCORE =
  (availableSlots / maxCapacity)              × 30%  [Capacity Score]
  + (1 - workerLoad / maxLoad)                × 25%  [Worker Score]
  + (1 / (timeDelayMinutes + 1))              × 25%  [Waiting Time Score]
  + (1 - historicalDemandAtThisHour)          × 10%  [Demand Score]
  + matchesClientPreference (morning/evening) × 10%  [Preference Score]
```

Output: Ranked list of best slots, e.g.:
```
1. Today 2:00 PM  → score 0.93 → Worker: John
2. Today 2:30 PM  → score 0.88 → Worker: Maria
3. Today 4:00 PM  → score 0.85 → Worker: John
```

---

#### MODE 2 — NEGOTIATION (Chat-Based)

**When used:**
- Complex or custom scope
- Price is negotiable
- Scope needs to be defined via conversation
- Package `bookingMode: negotiation`

**Flow:**
```
Provider accepts
    → Chat thread opens automatically
    → Both parties discuss:
         · Exact scope of work
         · Final price
         · Preferred date and time
         · Materials, products, special requirements
    → When agreement reached:
         → Client taps "I have reached an agreement"
         → Client types short summary of agreed terms
         → System reads full chat history + summary
         → AI generates contract draft
         → Contract mismatch guard runs:
              · Compares chat mentions vs contract clauses
              · Flags discrepancies as non-blocking warnings
         → Client reviews contract
         → Client sends to provider OR provider drafts first
         → Provider reviews:
              · Approves → order → 'contracted'
              · Requests edit → new contract version (old = superseded)
              · Rejects → chat continues
    → Once contract approved → payment link generated
```

**PII Protection in Chat (enforced server-side, cannot be bypassed):**

| Pattern | Action |
|---------|--------|
| Phone numbers | Masked → "***" |
| Email addresses | Masked → "***" |
| External URLs | Masked → "***" |
| Social handles (@user, t.me/, wa.me/) | Masked → "***" |
| Platform names (Telegram, WhatsApp) | Flagged for admin review |
| Contact exchange phrases ("call me", "my number", "outside the app") | Flagged for admin review |

If a user sends 3+ masked messages in 24 hours → automatically blocked from sending.
Flagged messages are queued for admin moderation review.

---

#### MODE 3 — HYBRID

**When used:**
- Standard service, fixed price
- But scheduling, add-ons, or minor details need brief chat

**Flow:**
```
Provider accepts
    → Auto-scheduling runs (same as Mode 1)
    → Chat thread opens for minor coordination:
         · "Prefer the north entrance"
         · "Please bring extra drop cloths"
         · "Can we adjust the time by 30 min?"
    → Contract generated from template (not from scratch)
    → Minimal review required
    → Payment → execution
```

---

#### MODE 4 — QUOTE-FIRST

**When used:**
- Provider must assess the job before quoting a price
- Large or complex jobs where scope is unknown
- Examples: moving, large renovation, custom manufacturing

**Flow:**
```
Client submits order (description + photos)
    → Provider receives dispatch
    → Provider requests a site assessment (or remote photo review)
    → OPTIONAL: Site visit scheduled as a "free consultation"
         · This is a short sub-order (no payment, no contract)
         · Provider documents findings
    → Provider generates a formal QUOTE:
         · Itemized scope of work
         · Materials and products (with BOM snapshot)
         · Total price
         · Estimated duration
         · Validity period (e.g., "valid for 7 days")
    → Client receives quote in app
    → Client options:
         · Accept quote → order continues to contract
         · Decline quote → order cancelled (no charge)
         · Counter-propose → negotiation chat opens
    → If accepted → contract generated from quote
    → Payment → execution
```

**Quote validity:**
- Quote expires after the provider-set validity period
- If expired → client must re-request or provider re-quotes
- Quote data is preserved in order history for reference

---

#### MODE 5 — WALK-IN (No Pre-Booking)

**When used:**
- Client is physically present at the business location
- No advance booking was made
- Real-time capacity must be checked

**Flow:**
```
Client arrives at business
    → Client opens app → taps "Walk-In" on business profile
    → System checks LIVE capacity:
         IF available slots > 0:
             → Slot reserved immediately (Redis atomic)
             → Estimated wait time shown to client
             → Order created: status 'matched' (skip matching phases)
             → Contract auto-generated from template
             → Client approves on their phone
             → Payment processed (or pay-on-completion enabled)
             → Job starts
         IF no slots available:
             → Client shown wait time estimate
             → Option to join virtual queue
             → Notification sent when slot opens
```

**Virtual Queue:**
```
Queue position: 3rd
Estimated wait: ~25 minutes
→ You'll receive a notification when your slot is ready
→ You may leave and return (notification gives 5-minute window)
```

---

### PHASE 7 — CONTRACT GENERATION

**Trigger:** Agreement reached (chat summary, auto-appointment confirmation, or accepted quote).

**Contract Sources:**

| Source | When Used | AI Involved |
|--------|-----------|-------------|
| Template-based | Auto-appointment and hybrid modes | No |
| AI-generated from chat | Negotiation mode | Yes |
| AI-generated from quote | Quote-first mode | Yes |
| Manual draft by provider | Any mode (provider can always draft manually) | Optional |

**Contract Versions:**
```
Version 1 → DRAFT (provider creates or AI generates)
         → SENT (provider sends to client)
         → REJECTED by client → Version 2
Version 2 → DRAFT
         → SENT
         → APPROVED by client → order: 'contracted'

All previous versions: status = 'superseded' (immutable, preserved for audit)
```

**Minimum Contract Fields:**

| Field | Source |
|-------|--------|
| Service description | Order + chat summary |
| Agreed price | Negotiation or fixed catalog price |
| Scheduled date/time | From scheduling engine |
| Service address | From order |
| Scope of work | Chat summary or quote itemization |
| Materials included | BOM snapshot if inventory-linked |
| Payment terms | Platform defaults + deposit rules |
| Cancellation policy | Business settings |
| Staff assigned | From worker assignment |

**Mismatch Guard:**
Before contract is finalized, the system automatically checks for discrepancies:
- Price mentioned in chat vs contract amount
- Duration discussed vs contract timeline
- Scope mentioned vs contract clauses
These are shown as non-blocking warnings visible to both parties.

---

### PHASE 8 — PAYMENT

**Trigger:** Contract approved by both parties.

**Payment Models:**

#### MODEL A — FULL UPFRONT
```
Client pays full amount at contract approval
→ Funds held in escrow
→ Released to provider after job completion confirmation
→ Used for: standard services, fixed-price jobs
```

#### MODEL B — DEPOSIT + BALANCE
```
Client pays deposit % at contract approval (configurable per business)
→ Deposit held in escrow
→ Balance due on job completion (or N days before for events)
→ Used for: events, large renovations, catering
→ Typical deposit: 25–50%

Deposit refund rules:
  Cancel > 48h before job → full deposit refund
  Cancel 24-48h before → 50% deposit refund
  Cancel < 24h before → no deposit refund
  (configurable per business category by admin)
```

#### MODEL C — PAY-ON-COMPLETION
```
No upfront payment
→ Payment requested AFTER job completion
→ Client has 24h to pay after completion notification
→ If not paid → automatic dispute + admin escalation
→ Used for: walk-in services, emergency repairs (trust-based)
→ Only available to providers with trust score > threshold
```

#### MODEL D — RECURRING / SUBSCRIPTION
```
First session payment → standard flow
→ Subsequent sessions auto-charged on schedule
→ Client approves recurring charge at contract signing
→ Each session generates a new order record automatically
→ Client can pause or cancel recurring at any time
→ Used for: regular cleaning, weekly training, monthly maintenance
```

**Escrow Rules:**
- Funds held by platform from payment to completion confirmation
- Released to provider when:
  - Client explicitly confirms job completion, OR
  - 48 hours pass with no dispute after completion mark (auto-release)
- If dispute filed → funds remain held until admin resolution

**Commission:**
- Deducted automatically at payout
- Provider sees net amount in Finance dashboard
- Commission rate configured per service category by admin

---

### PHASE 9 — JOB EXECUTION

**Trigger:** Payment confirmed. Order → `paid` → `in_progress`.

**Single-Session Execution:**
```
Provider (or assigned worker) confirms arrival via app
    → Order: in_progress
    → Client notified: "Your service has started"
    → Job performed
    → Provider marks complete
    → Client notified: "Your service is complete. Please confirm."
```

**Multi-Session Execution:**
```
Session 1 → in_progress → completed (sub-session)
Session 2 → in_progress → completed (sub-session)
...
Session N → in_progress → completed (sub-session)
    → ALL sessions complete → parent order: completed
    → Single final payment release (or per-session if configured)
```

**Multi-Day Execution:**
```
Day 1:
    Provider checks in → Day 1 progress documented
    Provider uploads end-of-day photos
    → Sub-status: day_1_complete

Day 2:
    Provider checks in → continues work
    → Sub-status: day_2_complete

Final Day:
    Provider marks entire job complete
    Client reviews final result
    → order: completed
```

**Group Service Execution:**
```
1 provider session → N clients attending

Clients book individually:
    → Each client creates their own order
    → All orders reference the same session_id
    → Capacity: maxGroupSize (e.g., 15 for yoga class)

Session starts:
    → All attending clients' orders: in_progress simultaneously
    → Session ends → provider marks complete for the session
    → All linked orders: completed simultaneously
```

**Worker Assignment (In-Person Services — Mandatory):**
- Specific worker assigned before job starts
- Client sees: worker's name + photo before they arrive
- This is mandatory for all services where a person enters the client's home, vehicle, or personal space
- Worker must have KYC Level 1 verified minimum

---

### PHASE 10 — COMPLETION AND REVIEW

**Trigger:** Provider marks job as complete.

**Completion Flow:**
```
Provider marks job complete
    → Upload completion photos (optional but recommended)
    → Client receives notification: "Your service is complete."
    → Client has 48 hours to:
         a. CONFIRM → funds released to provider
         b. DISPUTE → dispute filed, funds held
         c. (No action) → auto-close after 48h, funds released
```

**Rating and Review:**
```
After confirmation:
    → Client rates 1-5 stars
    → Client writes optional review text
    → Rating contributes to provider's trust score
    → Trust score affects future matching rank
```

**Invoice:**
```
After completion:
    → Invoice auto-generated with:
         · Service details
         · Date and time
         · Assigned worker
         · Itemized amounts (if inventory-linked)
         · Platform commission line
         · Net amount to provider
    → Client receives PDF via in-app notification
    → Provider receives PDF in Finance tab
    → Both can print or download
```

**Dispute Resolution:**
```
Client files dispute
    → Admin notified immediately
    → Both parties can submit:
         · Written statement
         · Photos / videos
    → Admin reviews:
         · Full chat history
         · Contract terms
         · Before/after photos
         · Payment records
    → Admin decision:
         · Release funds to provider (provider wins)
         · Full refund to client (client wins)
         · Partial payment split (mediated)
    → Decision is final
    → Both parties notified
    → Order: closed
```

---

## PART 4: EXECUTION MODES — DECISION MATRIX

| Scenario | Mode | Contract Source | Payment Model |
|----------|------|----------------|---------------|
| Fixed-price service, instant book | AUTO-APPOINTMENT | Template | Full upfront |
| Complex job, price unknown | NEGOTIATION | AI from chat | Full upfront or deposit |
| Standard service, small chat | HYBRID | Template | Full upfront |
| Large job, needs site assessment | QUOTE-FIRST | AI from quote | Deposit + balance |
| Client physically present | WALK-IN | Template (instant) | Upfront or on-completion |
| Emergency, needs help now | AUTO-APPOINTMENT (urgency: high) | Template | Full upfront |
| Recurring service | AUTO-APPOINTMENT (recurring) | Template (reused) | Recurring charge |
| Group class | AUTO-APPOINTMENT (group) | Template | Per-client upfront |
| Multi-day project | NEGOTIATION or QUOTE-FIRST | AI-generated | Deposit + milestones |

---

## PART 5: SERVICE DELIVERY MODELS

### IN-STORE

Client travels to business location.

**Additional Logic:**
- Client confirms their own location at booking (for distance calculation only)
- Business address shown after match is confirmed
- No address privacy concern for the provider
- Walk-in mode is only available for in-store services

### MOBILE / ON-SITE

Provider travels to client's location.

**Additional Logic:**
- Full address revealed to provider ONLY after order is `matched`
- Before match: only neighbourhood shown (privacy protection)
- After contract approval: provider can see full address for navigation
- If provider no-shows: client dispute filed immediately with full refund

### REMOTE

Service delivered digitally (video call, file delivery, etc.)

**Additional Logic:**
- No physical address required
- "Location" field = platform region only (for matching purposes)
- Communication via in-app chat (external links blocked)
- Deliverables uploaded to the order record (not sent via external email)
- Completion confirmed when client downloads/acknowledges the deliverable

### DUAL (Client's Choice)

**Additional Logic:**
- Client selects preferred delivery model during intent capture
- Each model has its own pricing (mobile often costs more due to travel)
- Provider sets availability per model in their package settings

---

## PART 6: SPECIAL SERVICE CONFIGURATIONS

---

### 6.1 WALK-IN (No Appointment)

Already covered in Mode 5 above.

**Key difference from other modes:**
- Matching phases (3–5) are skipped — client selects business directly
- Order is created at `matched` status immediately
- Capacity check is the ONLY gate before execution begins
- Contract is always template-based (no negotiation possible for walk-ins)

---

### 6.2 EMERGENCY / HIGH-URGENCY

**Triggered when:** Client sets `urgency: high` OR service category is tagged as emergency-eligible.

**Differences from standard flow:**

| Aspect | Standard | Emergency |
|--------|---------|-----------|
| Provider invite window | 24 hours | 4 hours |
| Matching radius bonus | None | +0.3 score for providers available within 4h |
| Dispatch size | Up to 5 providers | Up to 10 providers |
| Client notification frequency | On match | Every 30 min until matched |
| Admin alert | Only if exhausted | Immediately on submission |
| Price | Standard | Provider may add urgency surcharge (configurable) |

**Emergency auto-escalation:**
```
If no match after 4 hours:
    → Admin manually reviews and contacts verified providers directly
    → Client status: "Our team is personally working on finding you a provider"
```

---

### 6.3 MULTI-SESSION / MULTI-DAY SERVICES

**Order structure:**
```
Parent Order (umbrella)
  ├── Session 1 (sub-order)
  ├── Session 2 (sub-order)
  ├── Session 3 (sub-order)
  └── Session N (sub-order)
```

**Contract:** Single contract covers all sessions. Signed once.

**Payment options:**
- Full amount upfront (covers all sessions)
- Per-session payment (charged before each session)
- Deposit upfront + balance after final session

**Cancellation (partial):**
```
Cancel remaining sessions:
  If sessions already delivered → pay for those sessions
  If sessions not yet started:
    → Apply cancellation policy for unstarted sessions
    → Refund for cancelled sessions (per policy)
```

**Multi-Day Progress Tracking:**
- Provider uploads end-of-day progress photos
- Client can view progress in the order detail
- Client can raise concerns mid-project via chat
- Dispute can be filed at any point (funds remain in escrow until all sessions complete)

---

### 6.4 GROUP SERVICES

**Examples:** Yoga class, cooking class, group fitness, team training

**Capacity model:**
```
Service: Yoga Class | maxGroupSize: 15 | duration: 60 min

Booking:
  Client A books → spots remaining: 14
  Client B books → spots remaining: 13
  ...
  Client O books → spots remaining: 0 → FULL
  Client P tries → waitlist offered
```

**Each client has their own order record.**
All orders for the same session share a `sessionId`.

**Provider sees:** Total confirmed clients for the session (not individual order details).

**If session is cancelled by provider:**
- All linked client orders → `cancelled`
- All clients refunded automatically
- All clients notified simultaneously

**Waitlist:**
```
If a client cancels:
    → First client on waitlist is notified
    → 1-hour window to confirm
    → If confirmed → spot filled
    → If no response → next on waitlist notified
```

---

### 6.5 INVENTORY-LINKED SERVICES

**When used:** Service requires physical products/materials (e.g., oil change needs oil + filter).

**Before Job Starts:**
```
Order submitted
    → System checks product availability in provider's inventory:
         IF stock sufficient:
             → Products reserved (soft allocation)
             → Proceed to dispatch
         IF stock insufficient:
             → Provider notified: "Insufficient stock for this order"
             → Provider can:
                  a. Restock and confirm
                  b. Decline the order
                  c. Offer without the product (modified scope)
```

**At Contract Stage:**
```
Contract includes BOM (Bill of Materials):
    Product: Oil Filter XL    → unit price $15 (snapshot)
    Product: 5W-30 Oil 5L     → unit price $28 (snapshot)
    Service: Oil Change Labor → $40
    ─────────────────────────────
    Total: $83
```

**Price Snapshot Rule:**
Product prices are snapshotted at time of contract creation.
If the business later changes product prices, existing contracts are unaffected.

**At Completion:**
```
Provider marks job complete
    → Products consumed → inventory deducted automatically
    → Inventory count updated in real time
    → Low-stock alert triggered if below threshold
```

---

### 6.6 QUOTE-FIRST FLOW

Already covered in Mode 4 above.

**Key rules:**
- Quote is not a contract — it is a price proposal
- Client can accept, decline, or counter-propose
- Quote has an expiry (set by provider, default 7 days)
- If client accepts → quote data auto-populates the contract
- Quote is preserved in order history even if declined
- Platform does NOT charge any fee for declined quotes

**Quote structure:**
```
Quote ID: Q-2026-0523-001
Provider: Ahmed Renovations
Date: 2026-05-25 | Valid until: 2026-06-01

Scope of Work:
  - Interior painting: 3 bedrooms + living room
  - Surface prep included
  - 2 coats premium latex

Materials:
  - Paint (10L premium): $120
  - Primer (5L): $45
  - Tape + supplies: $30

Labor: $600 (estimated 3 days, 2 workers)
─────────────────────────────
Total: $795

Estimated Duration: 3 days
Start Date Available: June 2 or later
```

---

### 6.7 REORDER FLOW

**Trigger:** Client taps "Book Again" on a completed order in their history.

**What is Pre-Filled:**
- Same service type
- Same provider (if still active and available)
- Same service address
- Same questionnaire answers (editable)
- Previous description shown as reference

**What Client Must Confirm:**
- New preferred date/time
- Any changes to scope or requirements
- Current pricing (may have changed)

**If previous provider is unavailable:**
- System runs matching with previous provider excluded
- Client is informed: "Your previous provider is unavailable. Here are the best alternatives."

---

### 6.8 DEPOSIT-BASED SERVICES

Already covered in Phase 8 (Payment Model B).

**Additional deposit rules:**

| Scenario | Deposit Behavior |
|----------|----------------|
| Provider cancels after deposit taken | Full deposit refunded to client |
| Client cancels > 48h before | Full deposit refunded |
| Client cancels 24–48h before | 50% deposit refunded |
| Client cancels < 24h before | Deposit forfeited (kept by provider) |
| Job not completed as contracted | Deposit returned as part of dispute resolution |

These rules are shown to both parties in the contract and at payment time.
Rates are configurable per business category by admin.

---

### 6.9 PROVIDER COUNTER-OFFER

**Trigger:** Provider receives an offer but wants to propose different terms.

**What Provider Can Counter:**
-