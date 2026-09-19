---
name: provider-research
description: Use this skill for provider research work in Neighborly's evidence-based, micro-market GTM operating model.
---
# provider-research

## Purpose

Identify provider needs, economics, qualification signals, and acquisition barriers.

Understand provider economics, capacity, workflows, acquisition friction, and verification needs.

## When to invoke

Invoke when a task requires this procedure for a defined geography × category, decision, and evidence window. Do not invoke merely to add process; use the smallest relevant skill set.

Supply selection, qualification, onboarding, or launch readiness.

## Required inputs

Decision/question; active micro-market (or explicit candidate set); relevant `marketing/context/`; current scorecard and metric definitions; active experiments; available evidence with dates; constraints; owner; and gate/approval scope. Unknown inputs must be marked `STATUS: RESEARCH REQUIRED`.

Market/category; provider criteria; public sources; interview plan; existing pipeline.

## Procedure

1. Define target category/geography and qualification criteria.
2. Use lawful public or consented sources; record provenance.
3. Assess fit, availability, service quality signals, trust burden, and economics.
4. Separate research eligibility from verification status.
5. Produce prioritized research dossiers without declaring approval.

1. Map provider types and service radius. 2. collect capacity, pricing, channels, pain points, trust signals, and switching costs. 3. verify source/date. 4. identify fit and risks. 5. avoid treating contactability as consent.

## Output format

```markdown
# provider-research: <decision> — <date>
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

Required domain details: Provider landscape; evidence; segments; qualification inputs; capacity gaps; risks.

## Quality checks

Scope and denominators are explicit; sources are dated; primary/current evidence is preferred; facts are separated from inference; contradictory evidence and missing data are retained; no market score or metric is fabricated; downstream marketplace-health impact is addressed; applicable permissions are recorded.

Local relevance verified; sensitive data minimized; public email is not treated as outreach permission.

## Failure conditions

Stop and return `BLOCKED` when the decision scope is undefined, critical inputs are unavailable, evidence cannot support the claim, data quality invalidates analysis, required consent/verification is absent, or requested execution exceeds approval. Never fill gaps with plausible numbers.

Verification impossible, source unreliable, or research would violate access/terms.

## Escalation conditions

Escalate to the owning specialist/orchestrator for material disagreement or weak evidence; to manual/founder review for legal ambiguity, spend, publication, sensitive writes, provider approval, or serious disputes; and invoke `red-team-review` before an important launch, market, offer, automation, economics, or expansion recommendation.

Escalate contact, sensitive enrichment, incentives, or ambiguous data collection.

## Related operating controls

Follow [Marketing Operating Model](../../../docs/MARKETING-OPERATING-MODEL.md). Apply the LEGAL GATE, SAFETY GATE, and MONEY/ACTION GATE whenever the proposed work crosses their scope.
