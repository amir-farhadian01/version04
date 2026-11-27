---
name: red-team-review
description: Use this skill for red team review work in Neighborly's evidence-based, micro-market GTM operating model.
---

# red-team-review

## Purpose

Independently challenge important GTM recommendations before commitment. This is a reusable review skill, not a permanent tenth agent and not a veto authority.

## When to invoke

Required before final recommendations on market selection/expansion, launch/go-live, material offer or spend, positioning claims with brand exposure, scaled automation/outreach, unit economics, programmatic SEO scale, or changes with meaningful legal/safety/reputation consequences.

## Required inputs

Decision brief; alternatives including no-action; evidence ledger; scoring/metric definitions; unit economics; liquidity analysis; trust/legal review; assumptions; uncertainty; approval scope; and proposed monitoring/rollback.

## Procedure

1. Restate the decision and falsifiable success/failure conditions without adopting the proposal's framing.
2. Audit source quality, recency, representativeness, missing denominators, unsupported assumptions, weak market sizing, and fact/inference boundaries.
3. Seek disconfirming evidence and identify confirmation bias, selection/survivorship bias, leakage, Goodhart effects, and alternative explanations.
4. Stress-test marketplace cold start, provider density, match rate, time to match, utilization, repeat behavior, multi-homing, and liquidity by geography/category.
5. Recalculate unit economics under adverse AOV/take rate, processing, refunds, disputes, incentives, fraud, support, infrastructure, and acquisition-cost scenarios.
6. Model fraud/abuse incentives, trust/safety failure, regulatory/legal exposure, CASL/privacy concerns, brand/reputation harm, and affected-party impact.
7. Challenge scalability and automation assumptions: error amplification, thin content, suppression failure, irreversible writes, tool outage, auditability, kill switch, and human capacity.
8. Compare the proposal with at least one credible alternative and no-action; define evidence that would reverse the decision.
9. Return `SUPPORT`, `SUPPORT WITH CONDITIONS`, `REVISE`, or `INSUFFICIENT EVIDENCE`, with severity-ranked findings. The human decision owner retains final authority.

## Output format

```markdown
# Red Team review — <decision/date>
Reviewer independence/conflicts: ...
Verdict: SUPPORT | SUPPORT WITH CONDITIONS | REVISE | INSUFFICIENT EVIDENCE
## Strongest case against
## Evidence and market-sizing defects
## Cold-start/liquidity failure modes
## Economics stress test
## Fraud, legal, trust, brand, reputation, and automation risks
## Alternatives and no-action
## Reversal evidence / pre-mortem signals
## Required conditions, monitoring, kill/rollback criteria
## Gate status and unresolved human decisions
```

## Quality checks

Reviewer actively searches for disconfirmation, uses the same market/metric boundaries, reproduces key calculations, distinguishes severity from likelihood, considers affected parties, avoids performative objections, and provides testable mitigation or evidence requests.

## Failure conditions

Return `INSUFFICIENT EVIDENCE` if primary evidence, alternatives, denominators, economics, gate reviews, or rollback conditions are missing. A deadline, founder preference, or prior sunk cost cannot convert missing evidence into support.

## Escalation conditions

Escalate credible critical safety, fraud, legal, privacy, or reputation exposure immediately; unresolved material disagreements return to the orchestrator for independent evidence; all consequential actions remain subject to the three approval gates.

## Related operating controls

Follow [Marketing Operating Model](../../../docs/MARKETING-OPERATING-MODEL.md). Apply the LEGAL GATE, SAFETY GATE, and MONEY/ACTION GATE whenever the proposed work crosses their scope.

A reviewer with a material conflict must disclose it and request an independent reviewer before issuing a verdict.
