# Agent Provisioning — version04

## Purpose

Make the AI team expand deliberately as the project needs new expertise, without duplicating ownership or bypassing human approval.

## Trigger

At the planning stage of every task, compare the task's required capabilities with existing files in `.agents/`.

## Decision rule

- **Reuse** an existing role when its scope and verification requirements cover the task.
- **Create** a new narrow role card when the task has a distinct specialty, verification method, or authority boundary.
- **Do not create** a role merely to parallelize ordinary work or to evade a review/approval gate.

## Required role-card fields

- Name and mission
- In-scope and out-of-scope work
- Required inputs and evidence
- Verification commands or test surfaces
- Authority table
- Handoff report format
- Stop-and-escalate conditions

## Safety boundaries

- A new role starts read-only.
- Commit, push, PR, deployment, migration, deletion, secrets, credentials, permission changes, plugin installation, account connection, and external data transmission still require the applicable human approval.
- Never read or expose `.env`, `.agent-credentials/`, or other credential stores.
- Every end-to-end feature requires the relevant surface checks: API, web UI, Flutter UI, database-backed behavior, and CI where applicable.
