---
name: competitor-analysis
description: Use this skill for competitor analysis work in Neighborly's evidence-based, micro-market GTM operating model.
---
# competitor-analysis

## Purpose

Assess alternatives without inventing feature, price, or traction claims.

Compare actual alternatives and their local marketplace implications.

## When to invoke

Invoke when a task requires this procedure for a defined geography × category, decision, and evidence window. Do not invoke merely to add process; use the smallest relevant skill set.

Positioning, market selection, launch planning, or competitive response.

## Required inputs

Decision/question; active micro-market (or explicit candidate set); relevant `marketing/context/`; current scorecard and metric definitions; active experiments; available evidence with dates; constraints; owner; and gate/approval scope. Unknown inputs must be marked `STATUS: RESEARCH REQUIRED`.

Market/category; customer job; named/direct/indirect alternatives; dated evidence.

## Procedure

1. Define customer job and comparison set including offline substitutes.
2. Capture dated primary-source evidence.
3. Compare positioning, supply, demand, trust, pricing model, and local coverage.
4. Separate observed facts from inference.
5. Identify testable gaps, not unproven superiority claims.

1. Define comparison dimensions. 2. Verify offering, coverage, pricing claims, supply model, trust mechanisms, and weaknesses from sources. 3. Distinguish direct, substitute, and status-quo competitors. 4. Identify testable gaps without claiming superiority.

## Output format

```markdown
# competitor-analysis: <decision> — <date>
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

Required domain details: Competitor matrix; sources/dates; implications; confidence; unknowns.

## Quality checks

Scope and denominators are explicit; sources are dated; primary/current evidence is preferred; facts are separated from inference; contradictory evidence and missing data are retained; no market score or metric is fabricated; downstream marketplace-health impact is addressed; applicable permissions are recorded.

Same dimensions used; claims linked to evidence; local availability verified; screenshots/quotes minimized and attributed.

## Failure conditions

Stop and return `BLOCKED` when the decision scope is undefined, critical inputs are unavailable, evidence cannot support the claim, data quality invalidates analysis, required consent/verification is absent, or requested execution exceeds approval. Never fill gaps with plausible numbers.

No local evidence, inaccessible source, or inferred weakness presented as fact.

## Escalation conditions

Escalate to the owning specialist/orchestrator for material disagreement or weak evidence; to manual/founder review for legal ambiguity, spend, publication, sensitive writes, provider approval, or serious disputes; and invoke `red-team-review` before an important launch, market, offer, automation, economics, or expansion recommendation.

Escalate legal/brand-sensitive claims or any proposed public comparison.

## Related operating controls

Follow [Marketing Operating Model](../../../docs/MARKETING-OPERATING-MODEL.md). Apply the LEGAL GATE, SAFETY GATE, and MONEY/ACTION GATE whenever the proposed work crosses their scope.
