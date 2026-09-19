---
name: neighborly-quality
description: Use for Neighborly testing, E2E, Flutter QA, debugging, security review, observability, performance, CI/CD validation, future regression planning, and PASS/FAIL/BLOCKED release verdicts.
---

# Neighborly Quality

## Required sources

Before acting, read the repository `AGENTS.md`, `.agents/AGENTS.md`, applicable `.clinerules/`, and the narrow role card that owns the requested surface:

- `.agents/backend-database-security-qa.md` for API, PostgreSQL, Prisma, authorization, KYC, payments, and security.
- `.agents/web-dashboard-e2e-qa.md` for User, Business, Admin, Playwright, browser console/network, accessibility, and responsive checks.
- `.agents/flutter-qa.md` for Flutter analysis, widget/integration tests, and release builds.
- `.agents/devops-release-agent.md` for Docker, CI, release provenance, monitoring, deployment, and source control.
- `.agents/code-quality-agent.md` for lint, typecheck, maintainability, and regression quality.

## Workflow

1. Inventory the affected surfaces and select the smallest relevant checks.
2. Reproduce failures before changing code; classify product defect, test defect, environment blocker, or CI gap.
3. Respect protected paths, npm-only policy, Prisma 5.x, secret boundaries, and approval gates.
4. Run focused regression first, then the applicable full lint/typecheck/test/build/browser/device gates.
5. Inspect security, logs, health/readiness, metrics, artifact identity, and rollback evidence when release-related.
6. Record exact commands and evidence. Skipped or blocked checks never count as passing.
7. Return only `PASS`, `FAIL`, or `BLOCKED` for release verdicts.

## External-action boundary

This plugin contains no app, MCP server, credential, or external data flow. Commit, push, PR, deployment, migration, external connection, and permission changes still require explicit approval immediately before the action.
