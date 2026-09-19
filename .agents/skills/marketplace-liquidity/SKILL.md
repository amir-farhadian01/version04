---
name: marketplace-liquidity
description: Use this skill for marketplace liquidity work in Neighborly's evidence-based, micro-market GTM operating model.
---
# marketplace-liquidity

## Purpose

Diagnose whether local supply and demand reliably form successful transactions.

Diagnose whether local supply and demand reliably produce successful transactions.

## When to invoke

Invoke when a task requires this procedure for a defined geography × category, decision, and evidence window. Do not invoke merely to add process; use the smallest relevant skill set.

Before launch, during growth, or before category/geography expansion.

## Required inputs

Decision/question; active micro-market (or explicit candidate set); relevant `marketing/context/`; current scorecard and metric definitions; active experiments; available evidence with dates; constraints; owner; and gate/approval scope. Unknown inputs must be marked `STATUS: RESEARCH REQUIRED`.

Market/category cohort; searches; matches; bookings; completions; supply/capacity; time window.

## Procedure

1. Define market boundary and eligible supply/demand.
2. Build funnel from search/request to match, booking, completion, and repeat.
3. Calculate cohort and category/geography metrics with denominators.
4. Locate constraint using time-to-match, utilization, cancellations, and unmet demand.
5. Recommend smallest measurable intervention with guardrails.

1. Define market/category and funnel. 2. Calculate density, match rate, time to match, utilization, completion, cancellations, repeats. 3. Segment failure reasons. 4. Identify binding side/constraint. 5. propose threshold-based intervention.

## Output format

```markdown
# marketplace-liquidity: <decision> — <date>
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

Required domain details: Liquidity dashboard; funnel; constraint; evidence; intervention; expansion gate status.

## Quality checks

Scope and denominators are explicit; sources are dated; primary/current evidence is preferred; facts are separated from inference; contradictory evidence and missing data are retained; no market score or metric is fabricated; downstream marketplace-health impact is addressed; applicable permissions are recorded.

Cohorts are not mixed; medians/percentiles accompany averages; completed transactions are distinguished from matches.

## Failure conditions

Stop and return `BLOCKED` when the decision scope is undefined, critical inputs are unavailable, evidence cannot support the claim, data quality invalidates analysis, required consent/verification is absent, or requested execution exceeds approval. Never fill gaps with plausible numbers.

Missing event definitions, inadequate cohort size, or capacity cannot be measured.

## Escalation conditions

Escalate to the owning specialist/orchestrator for material disagreement or weak evidence; to manual/founder review for legal ambiguity, spend, publication, sensitive writes, provider approval, or serious disputes; and invoke `red-team-review` before an important launch, market, offer, automation, economics, or expansion recommendation.

Escalate expansion, incentives, or product/payment changes.

## Related operating controls

Follow [Marketing Operating Model](../../../docs/MARKETING-OPERATING-MODEL.md). Apply the LEGAL GATE, SAFETY GATE, and MONEY/ACTION GATE whenever the proposed work crosses their scope.
