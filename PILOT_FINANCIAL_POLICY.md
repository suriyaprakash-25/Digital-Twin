# DrivePortz Pilot Financial Settlement Policy

## Pilot decision

DrivePortz will run the controlled pilot with **automatic garage payouts disabled**.

- `FINANCIAL_JOBS_ENABLED=false`
- `SETTLEMENT_MODE=MOCK_TEST_MODE`
- `SETTLEMENT_PROVIDER=mock`
- Customer payment records, invoices, earnings, reconciliation, disputes, risk controls and audit logs remain active.
- Garage payouts must be reviewed and settled manually outside the automated scheduler during the pilot.
- No code or operator should enable automated payout jobs until a provider-backed payout execution path has passed end-to-end idempotency, retry, reconciliation and rollback testing.

## Pilot operating procedure

1. Customer payment is verified and recorded.
2. Garage earnings are calculated and recorded by DrivePortz.
3. Admin reviews the settlement ledger, risk flags, disputes and reconciliation state.
4. Pilot operator performs the garage payout manually using the approved payment/banking process.
5. Operator records the settlement reference and supporting evidence in the DrivePortz administrative workflow.
6. Any mismatch is handled through reconciliation/dispute tooling before another payout is attempted.

## Exit criteria for live automated settlements

Automated settlement may be enabled only after all of the following are complete:

- Razorpay Route/live payout provider onboarding completed.
- Provider payout API integrated with idempotent execution.
- Failed payout retry performs a real provider retry rather than only changing status.
- Duplicate payout protection verified under concurrent requests.
- Webhook reconciliation verified for successful, failed and reversed payouts.
- Production monitoring/alerts cover failed or stuck payouts.
- Finance/admin approval workflow and audit trail verified with pilot data.
- A controlled low-value live payout test passes end to end.

Until these criteria are met, automatic settlement remains deliberately fail-closed.
