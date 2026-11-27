---
name: provider-acquisition
description: Use this skill for provider acquisition work in Neighborly's evidence-based, micro-market GTM operating model.
---
# provider-acquisition

## Purpose

Move qualified providers toward verified activation through targeted, measurable work.

Acquire the right local supply for coverage and transaction reliability.

## When to invoke

Invoke when a task requires this procedure for a defined geography × category, decision, and evidence window. Do not invoke merely to add process; use the smallest relevant skill set.

A market has documented supply gaps and provider criteria.

## Required inputs

Decision/question; active micro-market (or explicit candidate set); relevant `marketing/context/`; current scorecard and metric definitions; active experiments; available evidence with dates; constraints; owner; and gate/approval scope. Unknown inputs must be marked `STATUS: RESEARCH REQUIRED`.

Coverage gaps; provider ICP; qualification rubric; channel evidence; economics; CASL/suppression state.

## Procedure

1. Define supply gap and ideal provider profile.
2. Research and qualify each lead.
3. Pass CASL and personalization gates before electronic outreach.
4. Track interest, onboarding, and verification separately.
5. Activate listings only after required platform verification; measure cohort quality.

1. Prioritize gaps by expected transaction impact. 2. build targeted prospect set. 3. qualify fit/capacity. 4. prepare compliant personalized contact. 5. track interest. 6. hand off onboarding and verification.

## Output format

```markdown
# provider-acquisition: <decision> — <date>
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

Required domain details: Pipeline by gap; qualification; CASL status; draft; conversion stages; activation forecast.

## Quality checks

Scope and denominators are explicit; sources are dated; primary/current evidence is preferred; facts are separated from inference; contradictory evidence and missing data are retained; no market score or metric is fabricated; downstream marketplace-health impact is addressed; applicable permissions are recorded.

Quality/density over lead volume; promises are accurate; global suppression enforced.

## Failure conditions

Stop and return `BLOCKED` when the decision scope is undefined, critical inputs are unavailable, evidence cannot support the claim, data quality invalidates analysis, required consent/verification is absent, or requested execution exceeds approval. Never fill gaps with plausible numbers.

No compliant contact basis, poor unit economics, or provider cannot meet trust requirements.

## Escalation conditions

Escalate to the owning specialist/orchestrator for material disagreement or weak evidence; to manual/founder review for legal ambiguity, spend, publication, sensitive writes, provider approval, or serious disputes; and invoke `red-team-review` before an important launch, market, offer, automation, economics, or expansion recommendation.

Escalate sends, bulk sequences, incentives, contracts, KYC, or activation.

## Related operating controls

Follow [Marketing Operating Model](../../../docs/MARKETING-OPERATING-MODEL.md). Apply the LEGAL GATE, SAFETY GATE, and MONEY/ACTION GATE whenever the proposed work crosses their scope.
