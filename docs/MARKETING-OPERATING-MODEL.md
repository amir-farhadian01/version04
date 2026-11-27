# Marketing Operating Model

## Required context protocol

Before meaningful work, every growth agent must:

1. Read project source-of-truth documentation.
2. Read relevant `marketing/context/` files.
3. Read the active `marketing/markets/<market>.md` file.
4. Read current `marketing/metrics/WEEKLY_SCORECARD.md` data/status.
5. Read active `marketing/experiments/` entries.
6. Read the specific task and its decision threshold.
7. Execute the relevant skill procedure.
8. Record evidence with source and date.
9. Write findings, uncertainty, and learnings.
10. Update shared memory when appropriate; do not overwrite history silently.

## Artifact lifecycle

| Artifact | Location | Owner | Update rule |
|---|---|---|---|
| Durable product/audience/brand facts | `marketing/context/` | Relevant specialist + orchestrator | Evidence-backed, date changes |
| Active market dossier | `marketing/markets/` | Market Intelligence | One file per geography × category candidate/active market |
| Campaign brief/result | `marketing/campaigns/` | Channel owner | Create before action; close with result |
| Experiment registry/readout | `marketing/experiments/` | Analytics & Experiments | Pre-register before launch; append result |
| Research memo | `marketing/research/` | Research owner | Source/date/confidence required |
| Weekly health | `marketing/metrics/` | Analytics & Experiments | Same definitions; missing is `N/A` |

Suggested filenames use UTC ISO dates: `YYYY-MM-DD-short-title.md`. An active market file begins with `STATUS`, `GEOGRAPHY`, `CATEGORY`, `OWNER`, `LAST_UPDATED`, and `EVIDENCE_CUTOFF`.

## Decision flow

```text
objective → task brief → specialist evidence → synthesis
→ Legal Gate → Safety Gate → Money/Action Gate
→ Red Team for material decisions → founder approval if required
→ controlled action → measurement → learning → memory update
```

## Approval matrix

Agents may autonomously research, analyze, draft, compare, score, recommend, and create internal reports. They may not autonomously spend, issue refunds, send bulk or legally ambiguous messages, approve KYC/provider transaction eligibility, resolve serious disputes, suspend high-value accounts, change payment/commission rules, or publish legally sensitive claims.

Approval is specific, time-bounded, and non-transferable. One approval does not authorize later campaigns or broader audiences. Global unsubscribe/suppression applies across every agent and tool.

## Weekly cadence

1. Refresh data-quality status and scorecard by micro-market/category.
2. Identify the single binding liquidity constraint.
3. Review active experiments and safety/economics guardrails.
4. Decide continue, revise, stop, or research—never expand by elapsed time alone.
5. Assign owner and next evidence date; write learnings.

## Incident and disagreement handling

Safety/legal/financial signals pause the affected action and route to a human owner. When agents disagree, record both positions, source quality, assumptions, and a disconfirming test. The orchestrator cannot average incompatible conclusions into false certainty.

## Required decision report

`Objective | Active micro-market | Evidence/source/date | Metrics | Assumptions | Alternatives | Gate results | Red-team findings | Recommendation | Confidence | Approval needed | Owner/next date | Memory updates`.

---

## Work unit

Every task has an objective, owner, geography × category scope, evidence window, inputs, expected artifact, due condition, and approval boundary. The orchestrator uses the smallest set of specialists necessary and requests parallel work only where independent evidence streams reduce decision risk.

## Standard cycle

1. **Intake:** founder states the business objective and constraints.
2. **Context:** agents follow `.agents/AGENTS.md` and identify missing source-of-truth data.
3. **Delegation:** orchestrator assigns non-overlapping questions and output contracts.
4. **Evidence:** specialists record sources, dates, methods, assumptions, confidence, and limitations.
5. **Synthesis:** orchestrator identifies agreements, disagreements, and gaps; weak conclusions return for more evidence.
6. **Challenge:** important decisions receive Red Team review.
7. **Gate:** legal, safety, and money/action statuses are recorded.
8. **Decision:** founder approves, rejects, or requests revision for consequential action.
9. **Execution/measurement:** approved owner acts within scope; analytics records outcomes.
10. **Memory:** reusable facts and learnings are committed to the appropriate marketing files.

## Three mandatory gates

| Gate | Trigger | Pass evidence | If unclear |
|---|---|---|---|
| LEGAL | Commercial electronic message, consent, legal/privacy claim, regulated activity | Recorded basis and reviewer/approval | Stop; `DO NOT SEND` or `DO NOT PUBLISH`; founder/manual review |
| SAFETY | Verification, transaction eligibility, fraud, material dispute/account action | Required checks complete and authorized reviewer decision | Keep ineligible/restricted; escalate |
| MONEY/ACTION | Spend, refund, bulk send, publish, external write, pricing/commission/payment change | Named human, timestamp, scope, cap, channel, expiry | Draft only; no external action |

Tool capability never implies a passed gate. Approvals are narrow, time-bound, and auditable; material changes require new approval.

## Handoff contract

Each handoff contains: decision/question, scope, artifact path, evidence ledger, metric definitions, assumptions, confidence, unresolved issues, gate status, requested next owner, and acceptance criteria. Agents exchange artifacts rather than holding open-ended conversations.

## Experiment lifecycle

Use one hypothesis and primary marketplace-health metric per experiment; define guardrails, minimum practical effect, sample/decision rule, segment, stop conditions, and approvals before launch. Log assignment and integrity checks. Record inconclusive and negative results. Never silently optimize to vanity metrics.

## Repository memory conventions

- `marketing/context/`: stable product, audience, brand, and competitive knowledge.
- `marketing/markets/`: one active market designation and evidence per geography × category.
- `marketing/research/`: dated evidence artifacts.
- `marketing/experiments/`: proposed, active, and completed experiment records.
- `marketing/campaigns/`, `content/`, `crm/`: drafts and approved execution records.
- `marketing/metrics/`: immutable dated scorecards plus the template.

No raw sensitive data, global suppression list, or identity documents belong in Git. Those remain in access-controlled systems referenced by record identifiers.

## Optional automation

n8n may later run deterministic scheduled analytics, scorecards, enrichment, CRM synchronization, notifications, approved email sequences, and research refreshes. It is optional and must enforce the same gates, idempotency, audit logs, suppression checks, and least privilege.
