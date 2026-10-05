---
name: casl-compliance
description: Use this skill for casl compliance work in Neighborly's evidence-based, micro-market GTM operating model.
---

# casl-compliance

## Purpose

Provide a conservative Canadian anti-spam compliance decision gate for commercial electronic messages (CEMs). This operational checklist is not legal advice and does not replace qualified counsel.

## When to invoke

Invoke before drafting an executable electronic outreach sequence, importing a contact for outreach, approving a CEM, or changing consent/suppression status. A public business email is **not** by itself permission to send.

## Required inputs

For every recipient, the controlled system of record must contain: contact source; source URL; source date; business identity; relationship basis, if any; consent type; consent basis and evidence; CASL status; last-contacted date; unsubscribe status; and global suppression status. Also provide sender identity, message purpose/channel, planned date, prior contacts, and applicable approval.

## Procedure

1. Confirm the message is in scope and identify the sender/business on whose behalf it would be sent; do not make a legal conclusion where classification is uncertain.
2. Verify the contact's source, URL, date, business identity, and relevance without assuming publication equals consent.
3. Record relationship basis, consent type (`express`, `potential implied`, `none`, or `unknown`), documented consent basis, status, and any evidence/expiry requiring legal review.
4. Check last contact, unsubscribe, complaints, and the authoritative **global** suppression source across every agent, campaign, account, and channel. A suppressed or unsubscribed address cannot be overridden by another agent or list.
5. Confirm the draft truthfully identifies the sender, provides required contact information and a clear functioning unsubscribe mechanism, and avoids deception. Have a qualified reviewer confirm current requirements.
6. Set one result: `PASS FOR HUMAN-APPROVED SEND`, `DO NOT SEND`, or `MANUAL/LEGAL REVIEW REQUIRED`. Unclear basis always results in **DO NOT SEND** pending founder/manual review.
7. Preserve an auditable decision record in the access-controlled CRM/compliance system, not sensitive contact data in Git. Re-check suppression and approval at actual send time.

## Output format

```markdown
# CASL gate record <controlled-record-id>
Message/channel/date: ...
Contact source | URL | source date: ...
Business identity: ...
Relationship basis: ...
Consent type | basis | evidence/expiry: ...
CASL status: PASS | DO NOT SEND | MANUAL REVIEW REQUIRED
Last contacted: ...
Unsubscribe status | global suppression status: ...
Sender identification/unsubscribe review: ...
Reviewer/approval scope/expiry: ...
Notes: This is an operational record, not legal advice.
```

## Quality checks

All required fields are present; source evidence is reproducible; public-address discovery is not treated as automatic permission; scope and any time limit are reviewed; sender/unsubscribe elements are checked; global suppression is authoritative; send-time recheck is specified; no PII/contact list is committed to Git.

## Failure conditions

**DO NOT SEND** if any required field is missing, consent/legal basis is unclear, suppression or unsubscribe is active, sender identity/unsubscribe requirements are not satisfied, evidence is stale or contradictory, or approval does not cover the message. Never infer a pass to meet a campaign deadline.

## Escalation conditions

Escalate uncertain classification, implied-consent basis/expiry, third-party lists, cross-border questions, complaints, or conflicting records to founder/manual review and qualified Canadian counsel where appropriate. External or bulk sending additionally requires the MONEY/ACTION gate.

## Related operating controls

Follow [Marketing Operating Model](../../../docs/MARKETING-OPERATING-MODEL.md). Apply the LEGAL GATE, SAFETY GATE, and MONEY/ACTION GATE whenever the proposed work crosses their scope.
