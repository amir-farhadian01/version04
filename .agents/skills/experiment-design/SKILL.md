---
name: experiment-design
description: Use this skill for experiment design work in Neighborly's evidence-based, micro-market GTM operating model.
---
# experiment-design

## Purpose

Produce decision-grade experiments tied to marketplace outcomes.

Design decision-grade tests with precommitted metrics and safety guardrails.

## When to invoke

Invoke when a task requires this procedure for a defined geography × category, decision, and evidence window. Do not invoke merely to add process; use the smallest relevant skill set.

A GTM hypothesis can be tested with bounded user/business impact.

## Required inputs

Decision/question; active micro-market (or explicit candidate set); relevant `marketing/context/`; current scorecard and metric definitions; active experiments; available evidence with dates; constraints; owner; and gate/approval scope. Unknown inputs must be marked `STATUS: RESEARCH REQUIRED`.

Hypothesis; unit; population; baseline; primary metric; guardrails; minimum effect; operational constraints.

## Procedure

1. State hypothesis, unit, population, primary metric, guardrails, and practical effect.
2. Choose design, assignment, sample/decision rule, duration conditions, and integrity checks.
3. Predefine exclusions, stopping, segments, and analysis.
4. Pass relevant gates before exposure.
5. Report effect, uncertainty, validity threats, decision, and reusable learning.

1. State causal hypothesis. 2. select design and assignment. 3. precommit primary/secondary/guardrail metrics. 4. estimate duration/sample needs. 5. define stop rules and analysis. 6. record registry entry before launch.

## Output format

```markdown
# experiment-design: <decision> — <date>
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

Required domain details: Experiment brief; hypothesis; design; metrics; sample/duration; risks; approvals; readout template.

## Quality checks

Scope and denominators are explicit; sources are dated; primary/current evidence is preferred; facts are separated from inference; contradictory evidence and missing data are retained; no market score or metric is fabricated; downstream marketplace-health impact is addressed; applicable permissions are recorded.

No metric switching; contamination considered; practical significance reported; segment fishing avoided.

## Failure conditions

Stop and return `BLOCKED` when the decision scope is undefined, critical inputs are unavailable, evidence cannot support the claim, data quality invalidates analysis, required consent/verification is absent, or requested execution exceeds approval. Never fill gaps with plausible numbers.

Cannot isolate treatment, insufficient sample, unethical/risky treatment, or missing instrumentation.

## Escalation conditions

Escalate to the owning specialist/orchestrator for material disagreement or weak evidence; to manual/founder review for legal ambiguity, spend, publication, sensitive writes, provider approval, or serious disputes; and invoke `red-team-review` before an important launch, market, offer, automation, economics, or expansion recommendation.

Escalate launch, spend, incentives, production changes, personal-data use, or safety risk.

## Related operating controls

Follow [Marketing Operating Model](../../../docs/MARKETING-OPERATING-MODEL.md). Apply the LEGAL GATE, SAFETY GATE, and MONEY/ACTION GATE whenever the proposed work crosses their scope.
