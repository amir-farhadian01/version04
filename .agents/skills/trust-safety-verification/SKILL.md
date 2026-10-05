---
name: trust-safety-verification
description: Use this skill for trust safety verification work in Neighborly's evidence-based, micro-market GTM operating model.
---

# trust-safety-verification

## Purpose

Provide cross-functional provider risk assessment, verification workflow, abuse detection, and dispute triage without creating an autonomous approver or legal decision-maker.

## When to invoke

Invoke during provider onboarding/periodic review, material listing changes, suspicious activity/reviews, duplicate detection, transaction abuse, disputes (including escrow-related disputes), and serious incidents.

## Required inputs

Provider/incident controlled record ID; geography/category; platform verification requirements; identity and business-check statuses (not raw documents in Git); ownership/payment-link signals; account/device/listing/review/transaction signals; prior incidents; dispute/escrow state; evidence timestamps; applicable policy; and authorized reviewer.

## Procedure

1. Separate research/contact status from transaction eligibility. A provider may be researched and contacted before verification.
2. Run the platform's authorized identity workflow and record only status/reference. Check business registration/identity, claimed name/address/contact, ownership, credentials where category-relevant, and document inconsistency through approved systems.
3. Check duplicate-provider indicators using normalized identity/business/contact/payment/listing and permitted device/network signals; treat a match as a review flag, not proof.
4. Evaluate suspicious review patterns: bursts, reciprocal clusters, repeated text, impossible timing, common identifiers, abnormal rating distributions, and review/transaction mismatch.
5. Evaluate fraud/abuse indicators: account farms, identity/payment mismatch, off-platform diversion, promotion/referral abuse, fabricated services, collusion, chargeback/refund anomalies, location impossibility, credential claims, harassment, or evasion.
6. Assign a documented risk band (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`, `UNKNOWN`) from an approved rubric using signal, evidence, severity, recency, confidence, and mitigating evidence. Risk score prioritizes review; it never auto-approves or alone proves misconduct.
7. Triage disputes by immediate safety, evidence preservation, transaction/escrow state, amount/severity, response clock, parties to contact, and authorized decision owner. Do not release/redirect escrow, promise outcomes, approve refunds, or make legal conclusions.
8. Escalate imminent physical safety, exploitation, identity compromise, credible fraud rings, regulated-service concerns, high-value/material disputes, or systemic abuse immediately through the incident plan. Preserve least-privilege evidence and chain of custody.
9. Record reviewer decision, reasons, permitted state, follow-up, appeal/review path, and audit reference in the controlled system.

### Strict eligibility gate

**No provider may become eligible to transact or receive payments until every required platform verification is complete and an authorized human/platform workflow has approved eligibility.** Agents cannot approve KYC or override an incomplete, failed, expired, conflicting, or unknown check.

## Output format

```markdown
# Trust & Safety assessment <controlled-record-id>
Scope/event/time: ...
Identity status | business status | required credential status: ...
Duplicate/review/fraud/abuse signals and counterevidence: ...
Risk band | rubric version | confidence: ...
Dispute/escrow triage state: ...
Transaction/payment eligibility: INELIGIBLE | HUMAN REVIEW | ELIGIBLE-BY-AUTHORIZED-RECORD
Immediate controls (non-destructive): ...
SAFETY gate/authorized reviewer/audit reference: ...
Escalation and follow-up: ...
```

## Quality checks

Use current policy and authorized sources; minimize sensitive data; distinguish flags from findings; include counterevidence and confidence; prevent discriminatory proxies; apply consistent rubric; require human authorization; keep identity documents and sensitive signals out of Git; preserve appeal/review paths.

## Failure conditions

Stop eligibility on missing/expired/conflicting verification, unreliable identity/business linkage, incomplete evidence, critical alert, system-of-record outage, unauthorized data use, or absent reviewer. Do not auto-approve, auto-suspend a high-value account, resolve a serious dispute, move escrow, or state a legal conclusion.

## Escalation conditions

Escalate critical/imminent safety incidents immediately; high-risk or material cases to the authorized Trust & Safety/founder reviewer; legal/regulatory ambiguity to qualified review; escrow/payment/refund questions to authorized operations; systemic patterns to analytics and Red Team. Apply MONEY/ACTION approval to consequential account/payment actions.

## Related operating controls

Follow [Marketing Operating Model](../../../docs/MARKETING-OPERATING-MODEL.md). Apply the LEGAL GATE, SAFETY GATE, and MONEY/ACTION GATE whenever the proposed work crosses their scope.
