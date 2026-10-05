---
name: marketplace-unit-economics
description: Use this skill for marketplace unit economics work in Neighborly's evidence-based, micro-market GTM operating model.
---
# marketplace-unit-economics

## Purpose

Calculate transaction-level contribution economics consistently.

Estimate contribution economics per transaction and cohort, not vanity revenue.

## When to invoke

Invoke when a task requires this procedure for a defined geography × category, decision, and evidence window. Do not invoke merely to add process; use the smallest relevant skill set.

Offer, channel, incentive, launch, or expansion decisions.

## Required inputs

Decision/question; active micro-market (or explicit candidate set); relevant `marketing/context/`; current scorecard and metric definitions; active experiments; available evidence with dates; constraints; owner; and gate/approval scope. Unknown inputs must be marked `STATUS: RESEARCH REQUIRED`.

AOV; take rate; processing; refunds; disputes; incentives; fraud; support; infrastructure; CAC; volumes.

## Procedure

1. Set cohort, geography/category, currency, period, and inclusion rules.
2. Calculate AOV × realized take rate = gross platform revenue.
3. Subtract processing, refund loss, disputes, incentives, fraud, support, infrastructure, and attributable acquisition cost.
4. Report per-order and cohort contribution margin with sensitivity ranges.
5. Reconcile sources and flag missing costs; do not substitute MRR.

1. Compute gross platform revenue = AOV × take rate. 2. Subtract all variable/allocated costs. 3. Show contribution margin per order/customer/provider and payback where valid. 4. model base/upside/downside. 5. reconcile with source data.

## Output format

```markdown
# marketplace-unit-economics: <decision> — <date>
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

Required domain details: Assumptions table; formula; scenarios; contribution margin; sensitivities; break-even; gaps.

## Quality checks

Scope and denominators are explicit; sources are dated; primary/current evidence is preferred; facts are separated from inference; contradictory evidence and missing data are retained; no market score or metric is fabricated; downstream marketplace-health impact is addressed; applicable permissions are recorded.

All money uses one currency/time basis; estimates labeled; refunds/fraud/support included; MRR not used unless subscription scoped.

## Failure conditions

Stop and return `BLOCKED` when the decision scope is undefined, critical inputs are unavailable, evidence cannot support the claim, data quality invalidates analysis, required consent/verification is absent, or requested execution exceeds approval. Never fill gaps with plausible numbers.

Material cost inputs unavailable or margin depends on unsupported assumptions.

## Escalation conditions

Escalate to the owning specialist/orchestrator for material disagreement or weak evidence; to manual/founder review for legal ambiguity, spend, publication, sensitive writes, provider approval, or serious disputes; and invoke `red-team-review` before an important launch, market, offer, automation, economics, or expansion recommendation.

Escalate pricing, take-rate, incentives, spend, or financial representations.

## Related operating controls

Follow [Marketing Operating Model](../../../docs/MARKETING-OPERATING-MODEL.md). Apply the LEGAL GATE, SAFETY GATE, and MONEY/ACTION GATE whenever the proposed work crosses their scope.
