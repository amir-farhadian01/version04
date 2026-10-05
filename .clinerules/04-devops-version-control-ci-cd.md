# 04 — DevOps, Version Control, and CI/CD

Use the **DevOps & Release-Control Agent (ReleaseGuard)** whenever a task concerns git, GitHub, CI/CD, Docker, environment configuration, or deployment.

## Pre-flight

1. Read `.agents/AGENTS.md`, `.agents/devops-release-agent.md`, and the relevant `.github/workflows/*.yml` file.
2. Inspect `git status --short --branch`, the remote, and package scripts.
3. Establish what is being released and which checks prove it works.

## Verification sequence

- Run `npm run lint` for backend linting.
- Run `npm run typecheck` for TypeScript validation.
- Run `npm test` or the smallest relevant test command.
- Run the affected build before release when practical.
- For CI failures, inspect the exact failing GitHub Actions job/log before changing workflow or code.

## Source-control discipline

- Keep commits atomic and conventional: `ci:`, `build:`, `chore:`, `fix:`.
- Review `git diff --cached` and check for secrets before commit.
- Never commit `.env`, `.agent-credentials/`, `uploads/`, logs, coverage, or temporary artifacts.
- Never force-push, amend, rebase shared history, change branch protection, create secrets, deploy, or migrate production data without explicit approval.
- Before a push or PR action, present branch, exact commits/files, completed checks, and the destination; wait for approval.

## Definition of Done

- Local verification results are recorded accurately.
- Commit hash and push/CI status are reported.
- Any failed or skipped check is marked unverified or failed, with next action.
