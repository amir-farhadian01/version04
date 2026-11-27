---
name: crm-lifecycle
description: Use this skill for crm lifecycle work in Neighborly's evidence-based, micro-market GTM operating model.
---
# crm-lifecycle

## Purpose

Design consent-aware lifecycle triggers that support activation, value, retention, and recovery.

Design consent-aware journeys across onboarding, activation, repeat, reactivation, and referral.

## When to invoke

Invoke when a task requires this procedure for a defined geography × category, decision, and evidence window. Do not invoke merely to add process; use the smallest relevant skill set.

Lifecycle performance has a defined cohort and measurable friction.

## Required inputs

Decision/question; active micro-market (or explicit candidate set); relevant `marketing/context/`; current scorecard and metric definitions; active experiments; available evidence with dates; constraints; owner; and gate/approval scope. Unknown inputs must be marked `STATUS: RESEARCH REQUIRED`.

Cohort/state; triggers/events; consent; channel history; suppression; value moments; baseline.

## Procedure

1. Map customer/provider states and value moments.
2. Define trigger, eligibility, consent, suppression, timing, exit, and frequency cap.
3. Draft channel/message and fallback behavior.
4. Instrument delivery through marketplace outcome and complaints.
5. Require approval for writes/sends; monitor and retire harmful journeys.

1. Map state transitions. 2. define eligibility, trigger, timing, cap, exit. 3. draft value-led messages. 4. apply CASL and suppression. 5. define holdout/measurement. 6. document ownership.

## Output format

```markdown
# crm-lifecycle: <decision> — <date>
Status: DRAFT | READY FOR REVIEW | BLOCKED
Scope: <geography × category>
Owner: <role>
## Inputs and definitions
## Method
## Evidence ledger (claim | source/URL | source date | retrieved | limitations)
## Findings (fact | inference | hypothesis)
## Metrics/economics and uncertainty
## Risks, counterevidence, and unknowns
## LEGAL / SAFETY / MONEY-ACTION gate status
## Recommendation and confidence
## Next owner, approvals, and memory updates
```

Required domain details: Journey spec; state diagram; messages; eligibility; suppression; KPI/guardrails; approval.

## Quality checks

Scope and denominators are explicit; sources are dated; primary/current evidence is preferred; facts are separated from inference; contradictory evidence and missing data are retained; no market score or metric is fabricated; downstream marketplace-health impact is addressed; applicable permissions are recorded.

Global suppression wins; messages stop on conversion/opt-out; referral follows delivered value.

## Failure conditions

Stop and return `BLOCKED` when the decision scope is undefined, critical inputs are unavailable, evidence cannot support the claim, data quality invalidates analysis, required consent/verification is absent, or requested execution exceeds approval. Never fill gaps with plausible numbers.

Consent or event data unreliable, no exit condition, or frequency cannot be enforced.

## Escalation conditions

Escalate to the owning specialist/orchestrator for material disagreement or weak evidence; to manual/founder review for legal ambiguity, spend, publication, sensitive writes, provider approval, or serious disputes; and invoke `red-team-review` before an important launch, market, offer, automation, economics, or expansion recommendation.

Escalate live automation, sends, incentives, sensitive segmentation, or CRM writes.

## Related operating controls

Follow [Marketing Operating Model](../../../docs/MARKETING-OPERATING-MODEL.md). Apply the LEGAL GATE, SAFETY GATE, and MONEY/ACTION GATE whenever the proposed work crosses their scope.
