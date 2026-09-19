# ADR-0082: Repository-local Neighborly plugin marketplace

- Status: Accepted
- Date: 2026-08-27

## Context

Neighborly needs reusable Codex capabilities for QA/debug/release work and evidence-based growth/sales planning. The canonical operating skills already live in `.agents/skills/`; duplicating them into independent plugin copies would create version drift. External CRM, email, prospecting, and security services would also introduce credentials and data flows that are unnecessary for the requested local-safe mode.

## Decision

Create a repository-local marketplace containing three local plugins: the existing `neighborly-multi-agent`, plus `neighborly-quality` and `neighborly-growth`. The new plugins provide routing skills that reference the canonical repository instructions rather than copying them. A machine-readable catalog declares each plugin's canonical skill set, and a validator fails when a declared skill is missing, duplicated, outside the approved roots, or inconsistent with the marketplace/release manifest.

No app, MCP server, credential, or external connection is included. GitHub remains an already-installed, approval-gated integration.

## Alternatives considered

1. Personal marketplace under the user's home directory: simpler automatic discovery, but not version-controlled with the project and inconsistent with the requested repository path.
2. Duplicate every canonical skill inside each plugin: portable outside the repository, but creates two sources of truth and requires error-prone synchronization.
3. External Apollo/Gmail/CRM/security plugins: useful for live operations, but rejected for the current local-safe mode because they require accounts, permissions, and external data transfer.

## Consequences

The plugin catalog is reviewable, reversible, and usable without credentials. It is intentionally Neighborly-repository-specific; exporting the plugins would require packaging the canonical referenced skills.

## Rollback

Remove the two new plugin directories, `.agents/plugins/marketplace.json`, the catalog validator and its CI invocation, then remove the plugin inventory from `release-manifest.json`. Application code and data are unaffected.
