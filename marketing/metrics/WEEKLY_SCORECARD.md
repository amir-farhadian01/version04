# Weekly Marketplace Scorecard

## Metric contract status

**UNRESOLVED - do not populate or compare these candidate tables until the analytics owner defines one metric contract.** Both prior proposals are preserved below. They differ in match eligibility, completion recognition, supply utilization (capacity versus active-provider participation), and dispute denominators. These are different measures, not interchangeable definitions. No live metric values or thresholds are established here.

## Candidate definition set A - not active

STATUS: DATA CONNECTION REQUIRED

**Week ending (UTC):** YYYY-MM-DD

**Geography:** RESEARCH REQUIRED

**Category:** RESEARCH REQUIRED

**Owner:** TBD

**Evidence cutoff:** YYYY-MM-DD

Never combine micro-markets/categories without also showing their individual cohorts. Missing data is `N/A`, not zero.

| Metric | Definition | Current | Prior | Target/gate | Source/query | Quality note |
|---|---|---:|---:|---:|---|---|
| Successful local matches | Searches/requests producing an accepted eligible match | N/A | N/A | TBD | TBD | |
| Completed local transactions | Paid/recognized completed local orders under canonical definition | N/A | N/A | TBD | TBD | |
| GMV | Completed transaction value, before platform deductions | N/A | N/A | TBD | TBD | |
| Match rate | Eligible requests matched / eligible requests | N/A | N/A | TBD | TBD | |
| Search-to-booking conversion | Eligible searches resulting in booking / eligible searches | N/A | N/A | TBD | TBD | |
| Time to match | Median and p90 from eligible request to accepted match | N/A | N/A | TBD | TBD | |
| Supply utilization | Fulfilled provider capacity / usable verified capacity | N/A | N/A | TBD | TBD | |
| Active providers | Verified, transaction-eligible providers with usable capacity/activity | N/A | N/A | TBD | TBD | |
| Repeat customer rate | Customers returning within defined window / eligible customer cohort | N/A | N/A | TBD | TBD | |
| Repeat provider rate | Providers fulfilling again within defined window / eligible provider cohort | N/A | N/A | TBD | TBD | |
| Cancellation rate | Cancelled eligible bookings / eligible bookings | N/A | N/A | TBD | TBD | |
| Dispute rate | Transactions with a dispute / completed transactions | N/A | N/A | TBD | TBD | |
| Referral rate | Eligible post-value users generating a qualified referral / eligible users | N/A | N/A | TBD | TBD | |
| Contribution margin | Gross platform revenue less processing, refunds, disputes, incentives, fraud, support, infrastructure allocation, and attributable acquisition cost | N/A | N/A | TBD | TBD | |
| Liquidity by geography/category | Cohort view of matches, completions, match rate, time, utilization, and repeats | N/A | N/A | TBD | TBD | |

## Unit economics bridge

| Input | Value | Source/assumption | Confidence |
|---|---:|---|---|
| Average order value | N/A | TBD | — |
| Platform take rate | N/A | TBD | — |
| Gross platform revenue per order | N/A | `AOV × take rate` | — |
| Payment processing | N/A | TBD | — |
| Refund losses | N/A | TBD | — |
| Disputes | N/A | TBD | — |
| Incentives | N/A | TBD | — |
| Fraud loss | N/A | TBD | — |
| Support cost | N/A | TBD | — |
| Infrastructure allocation | N/A | TBD | — |
| Acquisition cost | N/A | TBD | — |
| **Contribution margin per order** | **N/A** | Revenue less listed costs | — |

## Weekly decision

- Binding liquidity constraint: RESEARCH REQUIRED
- Trust/safety indicators: N/A
- Active experiment results: N/A
- Gate status: HOLD — DATA REQUIRED
- Decision (`continue`, `revise`, `stop`, `evaluate expansion`): RESEARCH REQUIRED
- Evidence, owner, and next review date: TBD

---

## Candidate definition set B - not active

**STATUS: RESEARCH REQUIRED**

Week (UTC): `<start>` to `<end>`
Prepared/checked: `<owner>` / `<reviewer>`
Active micro-market: `<geography × category or NOT SELECTED>`
Data freshness/timezone/currency: `<...>`
Metric contract version: `<...>`
Comparison: `<prior week / trailing period / cohort>`

Never enter invented values. Use `N/A — reason`, distinguish zero from missing, and link reproducible aggregate queries/dashboards without embedding sensitive data.

## Marketplace north star

| Metric | Definition | Current | Previous | Target/gate | Status | Source/quality notes |
|---|---|---:|---:|---:|---|---|
| Successful local matches | Eligible requests/searches paired with a qualified local provider under the metric contract | — | — | TBD | RESEARCH REQUIRED | — |
| Completed local transactions | Eligible locally completed orders | — | — | TBD | RESEARCH REQUIRED | — |
| GMV | Value of eligible completed transactions; currency stated | — | — | TBD | RESEARCH REQUIRED | — |
| Match rate | Successful local matches / eligible match attempts | — | — | TBD | RESEARCH REQUIRED | — |
| Search-to-booking conversion | Eligible bookings / eligible searches (or contracted funnel start) | — | — | TBD | RESEARCH REQUIRED | — |
| Time to match | Median plus P75/P90 from eligible intent to match | — | — | TBD | RESEARCH REQUIRED | — |
| Supply utilization | Providers with eligible completed work / eligible active providers | — | — | TBD | RESEARCH REQUIRED | — |
| Active providers | Verified, transaction-eligible providers with legitimate active inventory/activity | — | — | TBD | RESEARCH REQUIRED | — |
| Repeat customer rate | Customers repeating eligible completed transaction in defined window / eligible customer cohort | — | — | TBD | RESEARCH REQUIRED | — |
| Repeat provider rate | Providers completing again in defined window / eligible provider cohort | — | — | TBD | RESEARCH REQUIRED | — |
| Cancellation rate | Eligible cancelled bookings/orders / eligible booked orders | — | — | TBD max | RESEARCH REQUIRED | — |
| Dispute rate | Eligible disputed completed/placed orders / eligible orders | — | — | TBD max | RESEARCH REQUIRED | — |
| Referral rate | Eligible value recipients producing qualified referral event / eligible value recipients | — | — | TBD | RESEARCH REQUIRED | — |
| Contribution margin | Gross platform revenue less all defined processing/refund/dispute/incentive/fraud/support/infrastructure/acquisition costs | — | — | TBD | RESEARCH REQUIRED | — |

## Liquidity by geography × category

| Geography | Category | Eligible demand | Verified active providers | Matches | Match rate | Completed | Time to match P50/P90 | Utilization | Repeat | Cancel/dispute | Contribution | Evidence quality |
|---|---|---:|---:|---:|---:|---:|---|---:|---:|---|---:|---|
| NOT SELECTED | NOT SELECTED | — | — | — | — | — | — | — | — | — | — | RESEARCH REQUIRED |

## Funnel and trust/economics guardrails

Record search/request → match → booking → completion → repeat counts and conversion with denominators. Add verification completion/expiry, refund/chargeback/fraud signals, support load, review-integrity alerts, incident severity, AOV, realized take rate, each cost component, and contribution per order. Sensitive details remain in controlled systems.

## Expansion gate

| Gate | Pre-approved threshold/window | Result | Evidence | Owner |
|---|---|---|---|---|
| Sufficient verified provider density | TBD | NOT EVALUATED | — | — |
| Acceptable match rate | TBD | NOT EVALUATED | — | — |
| Real completed transactions | TBD | NOT EVALUATED | — | — |
| Repeat usage | TBD | NOT EVALUATED | — | — |
| Acceptable time to match | TBD | NOT EVALUATED | — | — |
| Acceptable trust/safety indicators | TBD | NOT EVALUATED | — | — |
| Acceptable contribution economics | TBD | NOT EVALUATED | — | — |

Expansion status: `HOLD — thresholds and active market require research`. Passing time alone cannot change this result.

## Experiments, interpretation, and decisions

- Active experiment IDs, assignment/integrity, primary result, guardrails: `None recorded`.
- Material movements (fact): `STATUS: RESEARCH REQUIRED`.
- Explanations (label hypothesis vs supported cause): `STATUS: RESEARCH REQUIRED`.
- Data-quality incidents/corrections: `None recorded`.
- Decisions, owners, due conditions, gate approvals: `None recorded`.
- Shared-memory updates: `None recorded`.
