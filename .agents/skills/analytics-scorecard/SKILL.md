---
name: analytics-scorecard
description: Use this skill for analytics scorecard work in Neighborly's evidence-based, micro-market GTM operating model.
---
# analytics-scorecard

## Purpose

Maintain a consistent weekly view of marketplace liquidity, trust, and economics.

Maintain a decision-oriented weekly marketplace health view by geography/category.

## When to invoke

Invoke when a task requires this procedure for a defined geography × category, decision, and evidence window. Do not invoke merely to add process; use the smallest relevant skill set.

Weekly review, launch monitoring, or expansion gate assessment.

## Required inputs

Decision/question; active micro-market (or explicit candidate set); relevant `marketing/context/`; current scorecard and metric definitions; active experiments; available evidence with dates; constraints; owner; and gate/approval scope. Unknown inputs must be marked `STATUS: RESEARCH REQUIRED`.

Metric definitions; dated sources; cohort dimensions; costs; prior scorecard; targets/thresholds.

## Procedure

1. Confirm metric contracts and data freshness.
2. Compute defined numerators, denominators, cohorts, geography/category, and comparison window.
3. Run completeness, duplication, outlier, and reconciliation checks.
4. Explain movements as evidence or hypotheses, never invented causality.
5. Record thresholds, gate status, owners, and actions.

1. Validate freshness/completeness. 2. calculate north-star and guardrail metrics. 3. compare trend/threshold. 4. annotate causes/unknowns. 5. assign actions. 6. archive learnings.

## Output format

```markdown
# analytics-scorecard: <decision> — <date>
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

Required domain details: Completed scorecard; data-quality notes; trend; gate status; actions/owners/dates.

## Quality checks

Scope and denominators are explicit; sources are dated; primary/current evidence is preferred; facts are separated from inference; contradictory evidence and missing data are retained; no market score or metric is fabricated; downstream marketplace-health impact is addressed; applicable permissions are recorded.

Missing is `N/A`, not zero; definitions stable; GMV/revenue/margin distinct; cohorts explicit.

## Failure conditions

Stop and return `BLOCKED` when the decision scope is undefined, critical inputs are unavailable, evidence cannot support the claim, data quality invalidates analysis, required consent/verification is absent, or requested execution exceeds approval. Never fill gaps with plausible numbers.

Source unavailable, definitions changed silently, or material reconciliation failure.

## Escalation conditions

Escalate to the owning specialist/orchestrator for material disagreement or weak evidence; to manual/founder review for legal ambiguity, spend, publication, sensitive writes, provider approval, or serious disputes; and invoke `red-team-review` before an important launch, market, offer, automation, economics, or expansion recommendation.

Escalate expansion/go-live recommendations or financial claims based on weak data.

## Related operating controls

Follow [Marketing Operating Model](../../../docs/MARKETING-OPERATING-MODEL.md). Apply the LEGAL GATE, SAFETY GATE, and MONEY/ACTION GATE whenever the proposed work crosses their scope.
