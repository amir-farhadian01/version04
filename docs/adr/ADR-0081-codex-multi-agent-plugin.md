# ADR-0081: Codex multi-agent plugin

- Status: Accepted
- Date: 2026-08-17

## Context

Neighborly needs reusable specialist routing in Codex without altering the application or adding a customer-facing AI runtime. The workspace's pre-created `.codex/` directory is read-only, so project-local custom-agent TOML files cannot be stored there.

## Decision

Create a repository-local Codex plugin at `plugins/neighborly-multi-agent/`. Its `neighborly-multi-agent` skill defines a coordinator-led workflow and explicit Backend, Flutter, QA, and Release-Control specialist ownership. It retains the repository's approval gates and intentionally adds no MCP server, API key, external connection, or deployment.

## Alternatives considered

1. Native `.codex/agents/*.toml` definitions. Rejected in this workspace because `.codex/` is mounted read-only.
2. OpenAI Agents SDK service. Rejected because it would add credentials, dependencies, deployment, and runtime ownership to a workflow that Codex can perform locally.
3. `AGENTS.md`-only instructions. Rejected because named routing and handoff rules need a reusable Codex extension entry point.

## Consequences

The team can install or share the plugin when desired, while the source remains versioned with the repository. The current workspace is unchanged outside plugin and documentation files.

## Rollback

Remove `plugins/neighborly-multi-agent/` and this ADR. No application code, data, credentials, or external systems are affected.
