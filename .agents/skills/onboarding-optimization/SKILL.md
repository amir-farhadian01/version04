---
name: onboarding-optimization
description: Use this skill for onboarding optimization work in Neighborly's evidence-based, micro-market GTM operating model.
---
# onboarding-optimization

## Purpose

Reduce friction to the first safe, valuable marketplace outcome.

Reduce time to verified value for customers and providers without weakening trust gates.

## When to invoke

Invoke when a task requires this procedure for a defined geography × category, decision, and evidence window. Do not invoke merely to add process; use the smallest relevant skill set.

Drop-off, delayed activation, or unclear onboarding steps.

## Required inputs

Decision/question; active micro-market (or explicit candidate set); relevant `marketing/context/`; current scorecard and metric definitions; active experiments; available evidence with dates; constraints; owner; and gate/approval scope. Unknown inputs must be marked `STATUS: RESEARCH REQUIRED`.

Funnel events; user research; requirements; verification states; support issues; baseline.

## Procedure

1. Define persona-specific activation and required verification steps.
2. Measure step funnel, latency, errors, and qualitative friction.
3. Protect required safety/legal steps from optimization removal.
4. Prioritize smallest test and guardrails.
5. Assess verified activation and downstream transaction quality.

1. Define activation/value event. 2. locate step-level friction. 3. separate required from optional. 4. propose guidance/progressive steps. 5. preserve verification gate. 6. test with guardrails.

## Output format

```markdown
# onboarding-optimization: <decision> — <date>
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

Required domain details: Funnel; friction evidence; hypothesis; revised flow brief; experiment; safety checks.

## Quality checks

Scope and denominators are explicit; sources are dated; primary/current evidence is preferred; facts are separated from inference; contradictory evidence and missing data are retained; no market score or metric is fabricated; downstream marketplace-health impact is addressed; applicable permissions are recorded.

No dark patterns; accessibility considered; transaction/payment eligibility remains verification-gated.

## Failure conditions

Stop and return `BLOCKED` when the decision scope is undefined, critical inputs are unavailable, evidence cannot support the claim, data quality invalidates analysis, required consent/verification is absent, or requested execution exceeds approval. Never fill gaps with plausible numbers.

Instrumentation missing, compliance requirement uncertain, or change would bypass verification.

## Escalation conditions

Escalate to the owning specialist/orchestrator for material disagreement or weak evidence; to manual/founder review for legal ambiguity, spend, publication, sensitive writes, provider approval, or serious disputes; and invoke `red-team-review` before an important launch, market, offer, automation, economics, or expansion recommendation.

Escalate production/UI changes, KYC policy, data collection, incentives, or automation.

## Related operating controls

Follow [Marketing Operating Model](../../../docs/MARKETING-OPERATING-MODEL.md). Apply the LEGAL GATE, SAFETY GATE, and MONEY/ACTION GATE whenever the proposed work crosses their scope.
