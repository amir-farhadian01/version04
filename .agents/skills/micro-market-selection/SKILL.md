---
name: micro-market-selection
description: Use this skill for micro market selection work in Neighborly's evidence-based, micro-market GTM operating model.
---
# micro-market-selection

## Purpose

Compare geography × category candidates using an evidence-backed weighted matrix.

Rank geography × category candidates using evidence and explicit weights.

## When to invoke

Invoke when a task requires this procedure for a defined geography × category, decision, and evidence window. Do not invoke merely to add process; use the smallest relevant skill set.

Selecting a launch market or evaluating adjacent expansion.

## Required inputs

Decision/question; active micro-market (or explicit candidate set); relevant `marketing/context/`; current scorecard and metric definitions; active experiments; available evidence with dates; constraints; owner; and gate/approval scope. Unknown inputs must be marked `STATUS: RESEARCH REQUIRED`.

Candidate set; scoring factors/weights; evidence; liquidity/economics constraints.

## Procedure

1. Confirm candidate definitions and disqualifying gates.
2. Agree factor definitions, direction, weights, and evidence standards before scoring.
3. Gather normalized evidence and record provenance.
4. Score only supported cells; mark others research required.
5. Run sensitivity analysis and Red Team review before recommendation.

1. Set weights before scores. 2. Define anchored scoring scale. 3. Populate only evidenced scores. 4. Run sensitivity analysis. 5. apply trust, regulatory, and economics constraints. 6. Red-team finalists.

## Output format

```markdown
# micro-market-selection: <decision> — <date>
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

Required domain details: Weighted matrix; evidence per cell; missing-data flags; sensitivity; shortlist; next research.

## Quality checks

Scope and denominators are explicit; sources are dated; primary/current evidence is preferred; facts are separated from inference; contradictory evidence and missing data are retained; no market score or metric is fabricated; downstream marketplace-health impact is addressed; applicable permissions are recorded.

Weights total 100%; no invented score; confidence shown; expansion is metric-gated.

## Failure conditions

Stop and return `BLOCKED` when the decision scope is undefined, critical inputs are unavailable, evidence cannot support the claim, data quality invalidates analysis, required consent/verification is absent, or requested execution exceeds approval. Never fill gaps with plausible numbers.

Critical cells lack evidence or winner changes under minor reasonable weights.

## Escalation conditions

Escalate to the owning specialist/orchestrator for material disagreement or weak evidence; to manual/founder review for legal ambiguity, spend, publication, sensitive writes, provider approval, or serious disputes; and invoke `red-team-review` before an important launch, market, offer, automation, economics, or expansion recommendation.

Escalate shortlist/final selection to orchestrator and founder; do not launch automatically.

## Related operating controls

Follow [Marketing Operating Model](../../../docs/MARKETING-OPERATING-MODEL.md). Apply the LEGAL GATE, SAFETY GATE, and MONEY/ACTION GATE whenever the proposed work crosses their scope.
