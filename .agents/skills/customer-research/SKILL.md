---
name: customer-research
description: Use this skill for customer research work in Neighborly's evidence-based, micro-market GTM operating model.
---
# customer-research

## Purpose

Learn customer jobs, barriers, trust needs, and repeat drivers without overstating samples.

Understand local customer jobs, barriers, trust needs, and repeat behavior.

## When to invoke

Invoke when a task requires this procedure for a defined geography × category, decision, and evidence window. Do not invoke merely to add process; use the smallest relevant skill set.

ICP, positioning, launch, onboarding, retention, or offer work.

## Required inputs

Decision/question; active micro-market (or explicit candidate set); relevant `marketing/context/`; current scorecard and metric definitions; active experiments; available evidence with dates; constraints; owner; and gate/approval scope. Unknown inputs must be marked `STATUS: RESEARCH REQUIRED`.

Research objective; participant criteria; market/category; consent/privacy plan; prior evidence.

## Procedure

1. Define learning questions and recruitment screen.
2. Obtain approved consent and avoid unnecessary PII.
3. Use non-leading interviews/surveys or behavioral data.
4. Code observations and preserve counterexamples.
5. Report themes with counts, sample limitations, and testable implications.

1. Define unbiased guide. 2. Recruit relevant participants. 3. Capture observations and exact source context. 4. code patterns and contradictions. 5. Separate prevalence from anecdotes. 6. store de-identified learning.

## Output format

```markdown
# customer-research: <decision> — <date>
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

Required domain details: Research plan; notes/source; themes; counterexamples; confidence; implications; open questions.

## Quality checks

Scope and denominators are explicit; sources are dated; primary/current evidence is preferred; facts are separated from inference; contradictory evidence and missing data are retained; no market score or metric is fabricated; downstream marketplace-health impact is addressed; applicable permissions are recorded.

No leading questions; privacy minimized; sample limitations stated; behavior distinguished from intent.

## Failure conditions

Stop and return `BLOCKED` when the decision scope is undefined, critical inputs are unavailable, evidence cannot support the claim, data quality invalidates analysis, required consent/verification is absent, or requested execution exceeds approval. Never fill gaps with plausible numbers.

No qualified participants, consent unclear, or sample too biased for intended inference.

## Escalation conditions

Escalate to the owning specialist/orchestrator for material disagreement or weak evidence; to manual/founder review for legal ambiguity, spend, publication, sensitive writes, provider approval, or serious disputes; and invoke `red-team-review` before an important launch, market, offer, automation, economics, or expansion recommendation.

Escalate incentives, recording, sensitive data, or external recruiting.

## Related operating controls

Follow [Marketing Operating Model](../../../docs/MARKETING-OPERATING-MODEL.md). Apply the LEGAL GATE, SAFETY GATE, and MONEY/ACTION GATE whenever the proposed work crosses their scope.
