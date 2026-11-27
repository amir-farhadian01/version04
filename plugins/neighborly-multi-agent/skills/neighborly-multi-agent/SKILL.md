---
name: neighborly-multi-agent
description: Coordinate production-focused Neighborly QA across backend/database, React E2E, Flutter, security, and CI/release specialists. Use when work needs a release verdict or spans independent test surfaces.
---

# Neighborly Multi-Agent

Coordinate work for the Neighborly repository without bypassing its guardrails.

## QA roles

- **QA Coordinator:** owns the test plan, evidence ledger, scope boundaries, handoffs, and final release verdict.
- **Backend/Database QA:** owns Express/API contracts, authorization, validation, Prisma 5.x migrations, PostgreSQL isolation, and backend tests.
- **React E2E QA:** owns React and admin SPA unit/browser flows, accessibility basics, browser-console and network failures, and Playwright evidence.
- **Flutter QA:** owns Flutter analysis, widget/integration checks, navigation, responsive mobile/web smoke evidence, and SDK/device blockers.
- **Security QA:** owns authentication/authorization review, input/upload/payment-webhook boundaries, dependency and secret review, and CI permission review.
- **CI/Release QA:** owns clean-worktree evidence, workflow/test-gate coverage, artifact provenance, Docker build checks, and release readiness.

## Complete role roster

Every role is read-only by default, owns one bounded task, uses the shared handoff below, and stops for missing evidence, irreversible action, high/critical security risk, or unapproved product/schema/payment/API behavior change.

| Group | Roles | Verification focus |
| --- | --- | --- |
| Leadership | CEO/Product Owner; Program Manager; Engineering Manager | goals, acceptance criteria, ownership, approval gates |
| Research | Product Researcher; Market/User Researcher; Technical Researcher | current evidence, alternatives, assumptions |
| Architecture | Solution Architect; Data/Database Architect; Security Architect | ADR, migration safety, threat model, rollback |
| Delivery | Backend/API Developer; React Web Developer; Admin SPA Developer; Flutter Developer; DevOps/Platform Engineer; CI/Release Engineer | assigned paths, focused checks, no independent QA verdict |
| QA | QA Coordinator; Backend/Database QA; React E2E/Accessibility QA; Flutter/Mobile QA; Security QA; Performance/Reliability QA; Documentation/Knowledge Manager | command evidence, browser/device evidence, release ledger |

Before work, read `AGENTS.md`, `.agents/AGENTS.md`, applicable `.clinerules/`, `docs/memory/`, the relevant ADR, and this skill. The QA Coordinator maintains `docs/memory/qa-evidence-ledger.md`; Documentation/Knowledge Manager keeps decisions and lessons secret-free and append-only.

## Dispatch protocol

1. Read repository instructions before dispatching.
2. Create a written brief: user goal, acceptance criteria, owned paths, excluded paths, required evidence, and stop conditions.
3. Dispatch only independent work. One specialist owns each test surface; never give overlapping edit ownership.
4. Give every specialist the brief and these hard restrictions: do not touch `lib/matching/`, chat-related files, or `src/`; use npm only; keep Prisma on 5.x; never inspect/expose secrets.
5. QA is read-only by default. It may create only explicitly authorized disposable test databases and generated reports, traces, screenshots, coverage, and logs. Keep generated artifacts outside the repository when feasible.
6. Require each specialist to return PASS, FAIL, or BLOCKED; exact commands/results; evidence locations; root-cause classification (`product defect`, `test defect`, `environment blocker`, or `CI configuration gap`); risks; and blockers. A skipped check is `unverified`, never `passed`.
7. Run Security QA and CI/Release QA after surface verification. The coordinator reconciles conflicts and gives the user one integrated result.

## Approval gates

Never commit, push, create or update pull requests, deploy, delete, run real-data migrations, change CI permissions/secrets, install/connect plugins, or transmit external data without the user's explicit approval immediately before the action.

## Recommended routing

| Task shape | Specialists |
| --- | --- |
| Backend/API/database validation | Backend/Database QA → Security QA → CI/Release QA |
| React/admin validation | React E2E QA → Security QA → CI/Release QA |
| Flutter/mobile validation | Flutter QA → CI/Release QA |
| Full MVP release assessment | All surface specialists in parallel → Security QA + CI/Release QA → Coordinator |
| CI, Docker, git, or release | CI/Release QA; add surface QA only when product code is affected |

## Handoff template

```text
Goal:
Owned paths:
Excluded paths:
Evidence required:
Commands run and result:
Changed files:
Risks / blockers:
Approval needed:
```
