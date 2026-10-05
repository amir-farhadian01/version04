---
name: launch-strategy
description: Use this skill for launch strategy work in Neighborly's evidence-based, micro-market GTM operating model.
---
# launch-strategy

## Purpose

Plan a supply-first micro-market launch with explicit readiness and stop gates.

Sequence a supply-first micro-market launch through measurable readiness gates.

## When to invoke

Invoke when a task requires this procedure for a defined geography × category, decision, and evidence window. Do not invoke merely to add process; use the smallest relevant skill set.

Preparing or revising a launch.

## Required inputs

Decision/question; active micro-market (or explicit candidate set); relevant `marketing/context/`; current scorecard and metric definitions; active experiments; available evidence with dates; constraints; owner; and gate/approval scope. Unknown inputs must be marked `STATUS: RESEARCH REQUIRED`.

Selected market; supply pipeline/verification; positioning; channel capacity; metrics/thresholds.

## Procedure

1. Confirm selected market and evidence.
2. Define verified supply, demand, instrumentation, support, trust, and economics thresholds.
3. Sequence provider activation before scaled demand.
4. Create channel, owner, dependency, contingency, and stop plan.
5. Run readiness review and Red Team; submit go/no-go for human approval.

1. Define prelaunch, controlled launch, and scale gates. 2. secure verified supply coverage. 3. map demand activation to capacity. 4. define monitoring and pause triggers. 5. assign owners. 6. red-team go/no-go.

## Output format

```markdown
# launch-strategy: <decision> — <date>
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

Required domain details: Launch plan; dependencies; readiness table; channel sequence; dashboard; pause/rollback plan.

## Quality checks

Scope and denominators are explicit; sources are dated; primary/current evidence is preferred; facts are separated from inference; contradictory evidence and missing data are retained; no market score or metric is fabricated; downstream marketplace-health impact is addressed; applicable permissions are recorded.

No calendar-only expansion; supply is transaction-eligible; thresholds and owners named.

## Failure conditions

Stop and return `BLOCKED` when the decision scope is undefined, critical inputs are unavailable, evidence cannot support the claim, data quality invalidates analysis, required consent/verification is absent, or requested execution exceeds approval. Never fill gaps with plausible numbers.

Verification/capacity incomplete, instrumentation missing, or no safe rollback.

## Escalation conditions

Escalate to the owning specialist/orchestrator for material disagreement or weak evidence; to manual/founder review for legal ambiguity, spend, publication, sensitive writes, provider approval, or serious disputes; and invoke `red-team-review` before an important launch, market, offer, automation, economics, or expansion recommendation.

Escalate go-live, spend, outreach/publishing, incentives, and expansion.

## Related operating controls

Follow [Marketing Operating Model](../../../docs/MARKETING-OPERATING-MODEL.md). Apply the LEGAL GATE, SAFETY GATE, and MONEY/ACTION GATE whenever the proposed work crosses their scope.
