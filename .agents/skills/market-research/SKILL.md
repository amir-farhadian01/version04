---
name: market-research
description: Use this skill for market research work in Neighborly's evidence-based, micro-market GTM operating model.
---
# market-research

## Purpose

Build a dated, reproducible evidence base for a geography × category opportunity.

Evaluate a bounded market question with local, dated evidence.

## When to invoke

Invoke when a task requires this procedure for a defined geography × category, decision, and evidence window. Do not invoke merely to add process; use the smallest relevant skill set.

Comparing a geography, category, audience, channel, or demand hypothesis.

## Required inputs

Decision/question; active micro-market (or explicit candidate set); relevant `marketing/context/`; current scorecard and metric definitions; active experiments; available evidence with dates; constraints; owner; and gate/approval scope. Unknown inputs must be marked `STATUS: RESEARCH REQUIRED`.

Research question; geography/category; time window; decision threshold.

## Procedure

1. Define decision and boundaries.
2. Create source plan spanning demand, supply, economics, regulation, and trust.
3. Collect primary/current evidence with source URL and retrieval date.
4. Triangulate claims and label inference.
5. Record gaps and confidence.

1. Define falsifiable questions and terms. 2. Prefer primary/local sources and record URL/date. 3. Triangulate at least two independent signals where material. 4. Separate facts, estimates, and inference. 5. Report gaps and confidence.

## Output format

```markdown
# market-research: <decision> — <date>
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

Required domain details: Question; method; evidence table with source/date; findings; confidence; gaps; recommendation.

## Quality checks

Scope and denominators are explicit; sources are dated; primary/current evidence is preferred; facts are separated from inference; contradictory evidence and missing data are retained; no market score or metric is fabricated; downstream marketplace-health impact is addressed; applicable permissions are recorded.

Evidence is local and current; denominators are clear; contrary evidence is included; no fabricated values.

## Failure conditions

Stop and return `BLOCKED` when the decision scope is undefined, critical inputs are unavailable, evidence cannot support the claim, data quality invalidates analysis, required consent/verification is absent, or requested execution exceeds approval. Never fill gaps with plausible numbers.

No credible evidence, ambiguous scope, stale sources, or results cannot support the decision.

## Escalation conditions

Escalate to the owning specialist/orchestrator for material disagreement or weak evidence; to manual/founder review for legal ambiguity, spend, publication, sensitive writes, provider approval, or serious disputes; and invoke `red-team-review` before an important launch, market, offer, automation, economics, or expansion recommendation.

Escalate paid-data needs, sensitive collection, or a material decision based only on weak evidence.

## Related operating controls

Follow [Marketing Operating Model](../../../docs/MARKETING-OPERATING-MODEL.md). Apply the LEGAL GATE, SAFETY GATE, and MONEY/ACTION GATE whenever the proposed work crosses their scope.
