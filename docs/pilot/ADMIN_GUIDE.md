# DrivePortz Pilot — Admin Guide

## Start-of-day checks
1. Confirm the production deployment is healthy.
2. Open **Admin → Pilot Operations**.
3. Review:
   - new users,
   - bookings created/completed and conversion,
   - payment success/failures,
   - AI usage,
   - recorded errors,
   - garage activity,
   - open/urgent/SLA-breached support items.
4. Check the operational monitoring and financial/risk areas for unusual events.

## Support triage
DrivePortz auto-routes operational feedback:
- Payment Issue → Payments & Reconciliation
- Booking Issue → Pilot Operations
- Garage Complaint → Garage Success
- Account Issue → Account & Access
- Bug/Performance Issue → Technical On-call

Use **Assign to me** when you take ownership. Move NEW → REVIEWED when acknowledged and to RESOLVED only after the impact is fixed or a safe workaround is delivered.

## Payments
Do not manually convert a failed/unknown payment into a successful one. Compare DrivePortz payment, invoice and Razorpay references first. Duplicate webhook delivery is expected to be idempotent; repeated financial side effects are not.

## Users and garages
- Public signup must never create ADMIN accounts.
- Verify a pilot garage only after confirming it is a trusted participant.
- Use normal role/ownership controls; do not “temporarily” bypass authorization in the database.

## Pilot data
Use the provided pilot seed/cleanup tools only with their explicit confirmation flags. Review the cleanup dry run and confirm a backup before production deletion.

## End-of-day notes
Record unresolved urgent/high issues, payment mismatches, major bugs, garage escalations and any workaround that must be revisited the next day.
