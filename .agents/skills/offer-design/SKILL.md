---
name: offer-design
description: Use this skill for offer design work in Neighborly's evidence-based, micro-market GTM operating model.
---
# offer-design

## Purpose

Design a bounded offer that improves adoption without hiding cost or safety risk.

Design a testable value exchange with viable economics and clear eligibility.

## When to invoke

Invoke when a task requires this procedure for a defined geography × category, decision, and evidence window. Do not invoke merely to add process; use the smallest relevant skill set.

Provider/customer acquisition, launch, referral, or retention intervention.

## Required inputs

Decision/question; active micro-market (or explicit candidate set); relevant `marketing/context/`; current scorecard and metric definitions; active experiments; available evidence with dates; constraints; owner; and gate/approval scope. Unknown inputs must be marked `STATUS: RESEARCH REQUIRED`.

Audience/job; friction; value; cost/economics; eligibility; abuse risks; objective.

## Procedure

1. Define segment, behavior, value, cost, and constraint.
2. Model customer/provider/platform economics and abuse incentives.
3. Draft eligibility, benefit, expiry, limits, and clear terms.
4. Review brand, legal, safety, and operational impacts.
5. Recommend a measurable pilot requiring approval for spend/publication.

1. Define behavior and barrier. 2. choose benefit and ask. 3. set eligibility, expiry, caps, and exclusions. 4. model economics. 5. assess fraud and fairness. 6. define test.

## Output format

```markdown
# offer-design: <decision> — <date>
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

Required domain details: Offer brief; audience; value/ask; rules; economics; abuse controls; experiment; approval.

## Quality checks

Scope and denominators are explicit; sources are dated; primary/current evidence is preferred; facts are separated from inference; contradictory evidence and missing data are retained; no market score or metric is fabricated; downstream marketplace-health impact is addressed; applicable permissions are recorded.

Terms clear; contribution downside bounded; no deceptive urgency; operationally deliverable.

## Failure conditions

Stop and return `BLOCKED` when the decision scope is undefined, critical inputs are unavailable, evidence cannot support the claim, data quality invalidates analysis, required consent/verification is absent, or requested execution exceeds approval. Never fill gaps with plausible numbers.

Economics unknown, fulfillment unsupported, or abuse cannot be bounded.

## Escalation conditions

Escalate to the owning specialist/orchestrator for material disagreement or weak evidence; to manual/founder review for legal ambiguity, spend, publication, sensitive writes, provider approval, or serious disputes; and invoke `red-team-review` before an important launch, market, offer, automation, economics, or expansion recommendation.

Escalate discounts, credits, guarantees, spend, legal terms, or payment changes.

## Related operating controls

Follow [Marketing Operating Model](../../../docs/MARKETING-OPERATING-MODEL.md). Apply the LEGAL GATE, SAFETY GATE, and MONEY/ACTION GATE whenever the proposed work crosses their scope.
