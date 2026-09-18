# DrivePortz Pilot — Emergency Troubleshooting

## 1. Site/API appears down
- Check the latest GitHub CI result and deployment status.
- Check the backend system health/status endpoints and MongoDB connectivity.
- Check Render/Vercel/provider dashboards using authorized team access.
- Do not rotate/redeploy multiple services at once unless the failure is understood; preserve evidence/logs first.

## 2. Users cannot log in
- Check whether the failure affects one user or everyone.
- Verify auth/API health, token expiry behavior and email/OTP provider status.
- Do not manually disclose/reset passwords in the database.
- For suspected compromise, suspend access according to the incident process and rotate affected credentials.

## 3. Payment failed or status is unclear
- Do **not** ask the customer to pay again until Payment History and gateway status are checked.
- Capture invoice number, Razorpay order/payment ID and booking/service reference.
- Check webhook/monitoring events and the payment record.
- Never mark a payment CAPTURED solely to make the UI look correct.
- Escalate duplicate charges or captured-without-service/invoice mismatches to Payments & Reconciliation immediately.

## 4. Booking is stuck
- Confirm current booking status and garage assignment.
- Confirm the garage is active/verified and the service still exists.
- Avoid deleting/recreating the booking unless the original record is preserved.
- If same-day service is blocked, treat it as HIGH priority.

## 5. Upload fails
- Confirm file type/size and Cloudinary configuration.
- Production uploads intentionally fail closed when persistent storage is unavailable.
- Do not switch production back to local ephemeral uploads as a workaround.

## 6. Vehicle Doctor / CoPilot fails
- Check AI provider health/rate limits and operational errors.
- Vehicle Doctor provider failures should return a retryable unavailable response rather than a fake diagnosis.
- For safety-related vehicle symptoms, direct the user to a qualified mechanic/emergency service rather than waiting for AI recovery.

## 7. Error spike
- Open Admin monitoring/Pilot Operations and identify the endpoint/provider involved.
- Check recent deployment changes.
- If a new release clearly caused the incident, prefer a controlled rollback to the last known-good commit over ad-hoc production edits.

## 8. Security or secret exposure
- Stop using the exposed credential.
- Rotate it at the provider.
- Update authorized deployment secrets.
- Revoke old tokens/keys where the provider supports revocation.
- Review logs/audit events for unauthorized use.
- Never commit replacement secrets to Git.

## Incident closure
Before closing an incident, record: impact, start/end time, affected users/garages, root cause (if known), mitigation, permanent fix, and follow-up owner.
