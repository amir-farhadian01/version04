# Marketing MCP and Tool Architecture

## Principles

Tools extend research and execution but do not confer authority. Antigravity agents remain framework-independent, least-privileged, auditable, and able to operate with repository files alone. Never commit API keys, tokens, credentials, exports containing personal data, or secrets; configuration examples use environment-variable names only.

## Staged layers

| Layer | Examples | Default access | Controls |
|---|---|---|---|
| 1: lower risk | GitHub, browser research, PostHog read, database read-only, local repository, optional n8n | Research/read/draft | Scoped credentials, source logs, read-only roles, data minimization |
| 2: sensitive/write capable | CRM writes, email sending, social publishing, Search Console writes, ad platforms, provider-status changes | Disabled until approved | Named approver, preview/dry run, scoped audience/budget, audit log, rollback/kill switch |

Database access should use views or read replicas with no mutation permission. Analytics access should avoid unnecessary personal data. GitHub writes follow repository source-control rules.

## Three gates

### 1. LEGAL GATE

Required before commercial electronic messages, public legal/competitive claims, regulated activity, or questionable data use. CASL decisions record source, URL/date, identity, relationship, consent type/basis, status, contact history, unsubscribe, and global suppression. Unclear basis means **DO NOT SEND** and manual review.

### 2. SAFETY GATE

Required for transaction eligibility, payment receipt, verification, fraud/abuse signals, duplicate providers, suspicious reviews, disputes, or account action. Research/contact can precede verification; transactions and payouts cannot.

### 3. MONEY/ACTION GATE

Required before advertising spend, refunds, incentives, bulk outreach, publishing, account suspension, commission/payment changes, or other consequential external writes. Approval records scope, budget/audience, exact action, operator, expiry, and rollback.

## Optional n8n

n8n may later provide deterministic scheduled analytics, weekly scorecards, lead enrichment, CRM synchronization, internal notifications, approved email sequences, and research refreshes. Every workflow must be optional, idempotent where feasible, observable, retry-bounded, approval-aware, and suppression-aware. Email nodes remain disabled until Legal and Money/Action gates pass.

## Configuration placeholders

Use names such as `POSTHOG_API_KEY`, `DATABASE_READONLY_URL`, `CRM_API_TOKEN`, and `N8N_WEBHOOK_URL` only in secret managers or local ignored environment files. Do not add real or example-looking credentials to Git.

## Future adapters

CrewAI, LangGraph, AutoGen, or another orchestrator may wrap the same role/skill contracts later. Adoption requires an ADR, threat/permission review, rollback plan, and proof that repository memory and approval gates remain authoritative.

---

Antigravity is the primary agent/subagent runtime. Skills, artifacts, and permission rules are framework-independent. MCP provides bounded capabilities; it does not grant business authorization. Prefer free/open-source or existing tools where they meet the requirement.

## Layer 1: lower-risk/read-oriented

| Capability | Intended use | Minimum control |
|---|---|---|
| GitHub | Read/write reviewed repository artifacts | Branch protection and scoped token |
| Browser/web research | Public evidence collection | Source/date capture and terms compliance |
| PostHog | Aggregate funnel and experiment analysis | Read-only, privacy-safe queries |
| Database read-only | Aggregate marketplace health | Read replica/view, query limits, no sensitive exports |
| Repository/filesystem | Shared memory and templates | Path scope, review, no secrets/PII |
| Optional n8n | Approved deterministic schedules | Self-host where appropriate, audit and gate checks |

Layer 1 permits analysis and internal artifacts, not consequential external action. Database access should expose minimum necessary aggregate views.

## Layer 2: sensitive/write-capable

CRM writes, email sending, social publishing, Google Search Console changes, advertising platforms, and provider-status changes require least-privilege credentials plus explicit approval policy. Controls must include dry-run/preview, named approver, bounded scope, expiry, audit log, rate/budget cap, idempotency, rollback where feasible, and kill switch.

Email tools must check the global unsubscribe/suppression source at send time and require a passed CASL record. Provider-status tools may not grant transaction/payment eligibility without completed platform verification and authorized human review.

## Credential model

- Never commit keys, tokens, credentials, or production identifiers.
- Documentation may name placeholders such as `POSTHOG_READ_TOKEN`, `DATABASE_READONLY_URL`, `CRM_API_TOKEN`, or `EMAIL_PROVIDER_API_KEY`; actual values belong in an approved secret manager/environment.
- Separate read and write identities. Rotate credentials, log access, and revoke unused integrations.

## Staged adoption

1. Repository + browser research.
2. Read-only analytics and aggregate database views.
3. Optional scheduled internal reports.
4. CRM draft/write workflows after approval controls.
5. Individually approved sends/publishing.
6. Only then consider bounded automation with measured reliability.

CrewAI, LangGraph, and AutoGen may be evaluated later as optional adapters, but shared skills and memory must remain portable and no external framework becomes a hard dependency.
