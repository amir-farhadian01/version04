---
name: outreach-personalization
description: Use this skill for outreach personalization work in Neighborly's evidence-based, micro-market GTM operating model.
---
# outreach-personalization

## Purpose

Draft relevant one-to-one provider outreach without deceptive or mass-spam tactics.

Prepare relevant one-to-one outreach grounded in genuine provider evidence.

## When to invoke

Invoke when a task requires this procedure for a defined geography × category, decision, and evidence window. Do not invoke merely to add process; use the smallest relevant skill set.

A provider is qualified and CASL review is required before any commercial message.

## Required inputs

Decision/question; active micro-market (or explicit candidate set); relevant `marketing/context/`; current scorecard and metric definitions; active experiments; available evidence with dates; constraints; owner; and gate/approval scope. Unknown inputs must be marked `STATUS: RESEARCH REQUIRED`.

Provider record; source/date/URL; observed relevance; value hypothesis; consent/CASL/suppression status.

## Procedure

1. Confirm qualified target and evidence for genuine relevance.
2. Record contact provenance and invoke CASL compliance.
3. Draft concise identity, reason, value, truthful CTA, and required sender/unsubscribe elements.
4. Check claims, tone, frequency, and global suppression.
5. Return draft and gate record; never send autonomously.

1. Verify recipient/context. 2. cite a genuine relevance signal. 3. write concise value and low-pressure ask. 4. avoid sensitive inference. 5. include required identity/unsubscribe elements. 6. run CASL gate.

## Output format

```markdown
# outreach-personalization: <decision> — <date>
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

Required domain details: Unsent draft; personalization evidence; compliance fields; channel; follow-up limits; approval status.

## Quality checks

Scope and denominators are explicit; sources are dated; primary/current evidence is preferred; facts are separated from inference; contradictory evidence and missing data are retained; no market score or metric is fabricated; downstream marketplace-health impact is addressed; applicable permissions are recorded.

Specific and truthful; not templated spam; global suppression checked; no send occurs in skill.

## Failure conditions

Stop and return `BLOCKED` when the decision scope is undefined, critical inputs are unavailable, evidence cannot support the claim, data quality invalidates analysis, required consent/verification is absent, or requested execution exceeds approval. Never fill gaps with plausible numbers.

Legal basis unclear, personalization relies on sensitive data, or contact is suppressed.

## Escalation conditions

Escalate to the owning specialist/orchestrator for material disagreement or weak evidence; to manual/founder review for legal ambiguity, spend, publication, sensitive writes, provider approval, or serious disputes; and invoke `red-team-review` before an important launch, market, offer, automation, economics, or expansion recommendation.

Escalate every ambiguous commercial send, automation, bulk use, or high-frequency follow-up.

## Related operating controls

Follow [Marketing Operating Model](../../../docs/MARKETING-OPERATING-MODEL.md). Apply the LEGAL GATE, SAFETY GATE, and MONEY/ACTION GATE whenever the proposed work crosses their scope.
