# Geography × Category Market Selection Framework

**STATUS: RESEARCH REQUIRED** — this file defines the method only. No candidate has been scored or selected.

## Decision unit and prerequisites

A candidate is one precisely bounded geography × service/category, with a stated customer/provider segment and research window. Before scoring, define candidates, sources, factor direction, disqualifying legal/safety/operability gates, weighting rationale, scorer, review date, and the evidence standard. Market selection needs founder approval and Red Team review.

## Scale

Use a common ordinal scale only after anchors are defined from comparable evidence:

- `1`: materially unfavorable relative to the candidate set.
- `3`: mixed/median evidence.
- `5`: materially favorable relative to the candidate set.
- `NR`: not rated—evidence insufficient or incomparable.

For factors where difficulty/burden/intensity is adverse, either reverse-score explicitly (`6 − raw burden score`) or define favorable anchors; never mix directions. A numeric score without cited evidence is invalid.

## Candidate factors and required evidence

| Factor | Question | Evidence examples |
|---|---|---|
| Local demand | Is transaction-ready need concentrated locally? | Internal unmet demand, representative surveys, credible local datasets |
| Supply fragmentation | Is supply reachable and fragmented enough to benefit? | Provider directories/registries, interviews, concentration evidence |
| Competition intensity | How strong are platforms and substitutes locally? | Dated primary competitor and customer-choice evidence |
| Search intent | Is qualified transactional intent observable? | Query/landing conversion data with locality/season context |
| Repeat frequency | How often can a good outcome recur? | Cohorts, interviews, category research |
| Average order value | What is completed-order value? | Comparable completed transactions; avoid advertised-price proxies alone |
| Provider acquisition difficulty | Cost/time to qualified verified activation? | Outreach/onboarding pilots and verification attrition |
| Buyer acquisition difficulty | Cost/time to completed first transaction? | Bounded channel pilots and funnel data |
| Trust burden | What identity, credential, safety, and dispute burden exists? | Policy/incident research, category expert review |
| Regulatory complexity | What rules constrain participation/claims/outreach? | Qualified current official/legal review—not agent conclusions |
| Seasonality | How volatile is liquidity over the year? | Multi-period demand/supply evidence |
| Urgency/frequency of need | Does timing support matching and repeat? | Behavioral data/customer research |
| Take-rate potential | What realized fee is sustainable? | Willingness/economics research; not an assumed list rate |
| Existing marketplace weakness | Is an important job underserved? | Customer/provider evidence and competitor gaps |
| Local density potential | Can both sides concentrate within practical radius/time? | Population/travel/provider/service-area data |
| Contribution margin potential | Can completed orders cover variable/allocated costs? | Unit-economics template with sensitivities |

## Weighted matrix

Weights total 100% and are set **before** scores are reviewed. Use `weighted points = weight × score / 5`. Do not silently redistribute an `NR` weight; show rated coverage and reject comparisons below the pre-agreed coverage threshold.

| Factor | Weight % | Candidate A score | A evidence ID | Candidate B score | B evidence ID |
|---|---:|---:|---|---:|---|
| Local demand | TBD | NR | — | NR | — |
| Supply fragmentation | TBD | NR | — | NR | — |
| Competition intensity | TBD | NR | — | NR | — |
| Search intent | TBD | NR | — | NR | — |
| Repeat frequency | TBD | NR | — | NR | — |
| Average order value | TBD | NR | — | NR | — |
| Provider acquisition difficulty | TBD | NR | — | NR | — |
| Buyer acquisition difficulty | TBD | NR | — | NR | — |
| Trust burden | TBD | NR | — | NR | — |
| Regulatory complexity | TBD | NR | — | NR | — |
| Seasonality | TBD | NR | — | NR | — |
| Urgency/frequency | TBD | NR | — | NR | — |
| Take-rate potential | TBD | NR | — | NR | — |
| Existing marketplace weakness | TBD | NR | — | NR | — |
| Local density potential | TBD | NR | — | NR | — |
| Contribution margin potential | TBD | NR | — | NR | — |
| **Total / evidence coverage** | **100** | — | — | — | — |

## Decision procedure

1. Screen disqualifying legal, safety, product-operability, and data-quality gates.
2. Freeze candidates, definitions, anchors, evidence horizon, weights, and minimum coverage.
3. Have market intelligence build the source ledger; independent scoring is preferred where ambiguity is material.
4. Reconcile scores by evidence, not authority. Keep disagreement visible.
5. Run sensitivity tests for reasonable weights, uncertain scores, cost/AOV assumptions, and excluded candidates.
6. Marketplace growth tests cold-start/liquidity and downside economics.
7. Red Team tests bias, evidence, abuse, regulation, reputation, scalability, and automation risks.
8. Orchestrator presents alternatives, no-action, confidence, reversal evidence, and gate status; founder selects a bounded validation market or requests research.

Selection authorizes further validation only. It does not authorize spending, outreach, publishing, provider approval, or launch.

## Candidate output

Store each completed comparison in `marketing/research/YYYY-MM-DD-market-selection-<slug>.md`, and create/update the approved active market record in `marketing/markets/` with threshold values, owners, evidence window, and approval reference.

## Evidence detail and hard constraints

Record source, URL/date, and confidence for every candidate-factor cell. Do not preselect any geography or category without evidence. `NR` means the same missing-evidence condition as the earlier `N/A - RESEARCH REQUIRED` notation; use `NR` consistently in this template.

A high score cannot override an unclear legal route, unmanageable trust burden, insufficient transaction-eligible supply, negative contribution outlook, or inability to measure liquidity. The output includes the matrix, source register, evidence coverage, confidence, sensitivity, constraint results, minority view, research gaps, and recommended next evidence—not an automatic launch.
