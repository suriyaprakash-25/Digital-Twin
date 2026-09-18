# DrivePortz Pilot Support Workflow

## Purpose
This workflow is the operational source of truth for pilot incidents. Every customer or garage issue should enter DrivePortz through the in-app Feedback button whenever possible so it is timestamped, categorized, visible to admins, and auditable.

## Ownership matrix

| Issue type | Primary handler | Target first response | Escalate when |
| --- | --- | ---: | --- |
| Payment Issue | **Payments & Reconciliation owner (admin on duty)** | 2 hours | payment captured but service/invoice disagrees, duplicate charge, refund ambiguity, or gateway/webhook mismatch |
| Booking Issue | **Pilot Operations owner (admin on duty)** | 4 hours | same-day booking blocked, garage/customer cannot agree on status, or service cannot proceed |
| Garage Complaint | **Garage Success owner (admin on duty)** | 8 hours | safety allegation, repeated garage complaint, abusive conduct, or evidence dispute |
| Account Issue | **Account & Access owner (admin on duty)** | 8 hours | account takeover suspicion, inaccessible account, OTP/reset failure, or incorrect role |
| Bug Report / Performance Issue | **Technical On-call owner** | 8–12 hours | crash, data loss risk, repeated 5xx, upload failure, or widespread outage |
| Product suggestion / general feedback | **Product Feedback owner** | 48 hours | no operational impact; review in pilot retrospective |

The admin who selects **Assign to me** becomes the named ticket owner. The role-based queue remains the escalation path if that person becomes unavailable.

## Status workflow
1. **NEW** — reported but not acknowledged.
2. **REVIEWED** — acknowledged/assigned and being investigated.
3. **RESOLVED** — user impact fixed or a safe operational workaround was delivered.
4. **ARCHIVED** — duplicate, non-actionable, or closed after review.

Do not mark an issue RESOLVED merely because it was forwarded to another person.

## Required handling notes
- Record the category, owner, priority, and final resolution in the admin Pilot Operations page.
- Never ask users to resend passwords, OTPs, full card details, Razorpay secrets, API keys, or government ID data through chat/WhatsApp.
- For a payment dispute, preserve payment/order/invoice IDs and gateway evidence before any refund action.
- For a booking dispute, preserve the booking status history and service record before manual changes.
- For a garage complaint, keep the complaint factual and avoid deleting evidence while it is being reviewed.
- For account-access incidents, verify identity using existing authenticated/recovery flows; do not bypass role checks manually.

## Severity guidance
- **URGENT** — financial loss, duplicate charge, security concern, or same-day pilot blocker.
- **HIGH** — booking/account/garage issue materially blocks a user.
- **MEDIUM** — degraded feature with a workaround.
- **LOW** — cosmetic issue, suggestion, or no current user impact.

## Escalation rule
If an issue is past its target response time, the Pilot Operations dashboard marks it as an SLA breach. The admin on duty must either take ownership immediately or explicitly hand it to the correct queue owner and document the handoff.
