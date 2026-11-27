---
name: retention-analysis
description: Use this skill for retention analysis work in Neighborly's evidence-based, micro-market GTM operating model.
---
# retention-analysis

## Purpose

Explain repeat behavior and churn using comparable cohorts and marketplace context.

Explain repeat behavior and churn by local cohort and marketplace experience.

## When to invoke

Invoke when a task requires this procedure for a defined geography × category, decision, and evidence window. Do not invoke merely to add process; use the smallest relevant skill set.

Weekly/monthly health review or a retention problem.

## Required inputs

Decision/question; active micro-market (or explicit candidate set); relevant `marketing/context/`; current scorecard and metric definitions; active experiments; available evidence with dates; constraints; owner; and gate/approval scope. Unknown inputs must be marked `STATUS: RESEARCH REQUIRED`.

Cohort definitions; customer/provider events; transactions; cancellations; disputes; market/category; time window.

## Procedure

1. Define retained event and cohort window.
2. Segment by side, geography/category, acquisition, and first outcome.
3. Measure repeats, survival/return, cancellations, disputes, and supply effects.
4. Investigate drivers without claiming causality from correlation.
5. Recommend testable intervention and data improvements.

1. Define activation and return event. 2. build cohort curves. 3. segment by market/category/side. 4. connect outcomes to match quality and value. 5. inspect survivorship/data bias. 6. propose tests.

## Output format

```markdown
# retention-analysis: <decision> — <date>
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

Required domain details: Cohort table/curve; drivers; caveats; at-risk states; intervention hypotheses.

## Quality checks

Scope and denominators are explicit; sources are dated; primary/current evidence is preferred; facts are separated from inference; contradictory evidence and missing data are retained; no market score or metric is fabricated; downstream marketplace-health impact is addressed; applicable permissions are recorded.

Same denominators/windows; both marketplace sides considered; correlation not called causation.

## Failure conditions

Stop and return `BLOCKED` when the decision scope is undefined, critical inputs are unavailable, evidence cannot support the claim, data quality invalidates analysis, required consent/verification is absent, or requested execution exceeds approval. Never fill gaps with plausible numbers.

Insufficient history, identity/event stitching unreliable, or cohort too small.

## Escalation conditions

Escalate to the owning specialist/orchestrator for material disagreement or weak evidence; to manual/founder review for legal ambiguity, spend, publication, sensitive writes, provider approval, or serious disputes; and invoke `red-team-review` before an important launch, market, offer, automation, economics, or expansion recommendation.

Escalate sensitive profiling, customer-impacting intervention, or data instrumentation changes.

## Related operating controls

Follow [Marketing Operating Model](../../../docs/MARKETING-OPERATING-MODEL.md). Apply the LEGAL GATE, SAFETY GATE, and MONEY/ACTION GATE whenever the proposed work crosses their scope.
