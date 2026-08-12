# ADR-0080: Quick-Start Package — Onboarding, Social Feed & Order Workflow
- **Status:** proposed
- **Date:** 2026-08-06
- **Author:** Solution Architect (day-1 audit)

## Context

The project is a social marketplace (Instagram + TaskRabbit/Jiffy hybrid) with ~90% of core infrastructure complete. The backend (Express/TypeScript/Prisma), React frontend, Flutter app, PostgreSQL database, matching engine, order lifecycle, payment system, and admin panel are all functional. 

The remaining gap is the **consumer-facing experience layer** — the part users actually touch:

1. **Onboarding is slow** — email/password only, no social login, no guided interest selection
2. **Social feed exists but is rough** — Flutter feed screens exist but lack Instagram-level polish, story viewer is basic
3. **Order flow works but UX is disjointed** — the connection between social discovery and ordering needs to be seamless (tap a post → order the service in <30 seconds)

## Decision

We will deliver a **Quick-Start Package** with three workstreams executed in parallel:

### Workstream A: Social Login + Fast Onboarding
1. Add **Google Sign-In** and **Apple Sign-In** OAuth to backend (new `/auth/google` and `/auth/apple` endpoints)
2. Add **Flutter OAuth buttons** to AuthScreen (Google + Apple + email tab)
3. Build **Onboarding Wizard** (3 screens max): Interests → Location → Profile Photo
4. Total target: **<60 seconds from app open to home feed** (Instagram baseline)

### Workstream B: Social Feed Polish (Instagram-level)
1. **Stories Row** — circular avatars with gradient rings, smooth horizontal scroll, tap-to-view with progress bar
2. **Post Card** — video auto-play (muted), double-tap like, comment sheet, share, save
3. **Create Post Flow** — camera/gallery → category picker → caption → publish (mandatory category selection)
4. **Business Posts with Order CTA** — posts linked to services show "Book Now" button that opens Order Wizard pre-filled
5. **Feed algorithm** — location-aware + interest-filtered feed (already in schema, needs Flutter integration)

### Workstream C: Unified Order Flow (TaskRabbit-style)
1. **Post → Order bridge**: Business posts with linked services show a "Book Now" CTA → opens Order Wizard with service pre-selected
2. **Order Wizard UX polish**: Reduce to 3-4 screens max, real-time price calculation, clearer progress indicator
3. **One-tap reorder**: From order history, re-order same service with same provider in 2 taps
4. **Commission visibility**: Show platform commission line item in payment flow (transparent fee structure)

## Alternatives Considered

### Alternative A: Build a separate "Marketplace" tab
- **Pros:** Clear separation of social vs commerce
- **Cons:** Fragments the experience; Instagram/TaskRabbit hybrid works best when they're integrated, not separated
- **Rejected:** The user explicitly wants an integrated social-commerce experience, not two separate products

### Alternative B: Use Firebase Auth for social login
- **Pros:** Quick setup, managed service
- **Cons:** Another dependency, data lives outside our system, harder to enforce email uniqueness normalization
- **Rejected:** We already have a robust JWT auth system. Adding Google/Apple OAuth as additional providers within our existing system is cleaner.

### Alternative C: Rewrite Flutter feed from scratch
- **Pros:** Clean slate
- **Cons:** Massive effort, discards working code, delays delivery
- **Rejected:** The existing Flutter feed has solid foundations. Polish and incremental improvement is the right approach.

## Consequences

✅ **Positive:**
- Social login drops onboarding friction by ~70% (industry data: OAuth conversion 2-3x email)
- Post → Order bridge creates the core monetization loop
- Commission visibility builds trust with providers

❌ **Trade-offs / Risks:**
- Apple Sign-In requires Apple Developer account ($99/year) and App Store Connect configuration
- Google Sign-In requires Firebase project or Google Cloud Console OAuth configuration
- Feed algorithm tuning is iterative — initial version will be basic (location + recency), improved over time

## Rollback Strategy

- Social login can be feature-flagged: if OAuth fails, fall back to email/password (already exists)
- Feed changes are additive — existing auth_screen.dart and home_screen.dart remain as fallbacks
- Order flow changes are UI-layer only — backend order lifecycle is unchanged