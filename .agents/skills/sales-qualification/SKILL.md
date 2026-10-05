---
name: sales-qualification
description: Use this skill for sales qualification work in Neighborly's evidence-based, micro-market GTM operating model.
---
# sales-qualification

## Purpose

Apply consistent evidence-based fit and readiness criteria to potential providers.

Consistently assess provider fit, capacity, readiness, and risk before sales effort.

## When to invoke

Invoke when a task requires this procedure for a defined geography × category, decision, and evidence window. Do not invoke merely to add process; use the smallest relevant skill set.

Before outreach, onboarding priority, or pipeline review.

## Required inputs

Decision/question; active micro-market (or explicit candidate set); relevant `marketing/context/`; current scorecard and metric definitions; active experiments; available evidence with dates; constraints; owner; and gate/approval scope. Unknown inputs must be marked `STATUS: RESEARCH REQUIRED`.

Provider evidence; service area/category; capacity; pricing; reputation; platform requirements; risk flags.

## Procedure

1. Define must-have, exclusion, and unknown criteria.
2. Review business fit, service area, capacity, economics, trust burden, and source evidence.
3. Record pass/fail/unknown per criterion.
4. Route unknown legal/safety items to review.
5. Return qualified, nurture, disqualified, or research-needed—not verified.

1. Apply published rubric. 2. verify identity/business signals without approving them. 3. score fit, capacity, urgency, and risk. 4. state evidence/confidence. 5. assign next action.

## Output format

```markdown
# sales-qualification: <decision> — <date>
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

Required domain details: Qualification record; score breakdown; evidence; risks; missing data; next step.

## Quality checks

Scope and denominators are explicit; sources are dated; primary/current evidence is preferred; facts are separated from inference; contradictory evidence and missing data are retained; no market score or metric is fabricated; downstream marketplace-health impact is addressed; applicable permissions are recorded.

No score without evidence; research status differs from verification/approval; duplicates checked.

## Failure conditions

Stop and return `BLOCKED` when the decision scope is undefined, critical inputs are unavailable, evidence cannot support the claim, data quality invalidates analysis, required consent/verification is absent, or requested execution exceeds approval. Never fill gaps with plausible numbers.

Identity ambiguous, major risk flags, or material data missing.

## Escalation conditions

Escalate to the owning specialist/orchestrator for material disagreement or weak evidence; to manual/founder review for legal ambiguity, spend, publication, sensitive writes, provider approval, or serious disputes; and invoke `red-team-review` before an important launch, market, offer, automation, economics, or expansion recommendation.

Escalate adverse decisions, verification, high-risk accounts, or legal conclusions.

## Related operating controls

Follow [Marketing Operating Model](../../../docs/MARKETING-OPERATING-MODEL.md). Apply the LEGAL GATE, SAFETY GATE, and MONEY/ACTION GATE whenever the proposed work crosses their scope.
