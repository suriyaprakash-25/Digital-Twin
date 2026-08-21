# DrivePortz Phase 6: Automated Settlement Operations & Admin Financial Governance

## 1. Overview
- **Phase 6A (Automated Settlement Operations)** transitions DrivePortz from a purely manual settlement trigger system into an automated settlement scheduling, state-machine validated, and exponential-retry enabled operations engine while retaining safe `MOCK_TEST_MODE` financial execution.
- **Phase 6B (Admin Financial Governance)** establishes Maker-Checker separation of duties, dual-approval controls for high-value payouts (>= ₹50,000), administrative settlement holds, granular role-based permissions, and immutable financial audit logs.

---

## 2. Settlement State Machine

```
[REQUESTED] ──┬──> [UNDER_REVIEW] ──┬──> [APPROVED] ────> [PROCESSING] ──┬──> [SETTLED] (Terminal)
              │                     │        │                           │
              ├──> [APPROVED]       ├──> [REJECTED]                      └──> [FAILED]
              │                     │                                            │
              ├──> [REJECTED]       └──> [CANCELLED]                             ├──> [RETRY_PENDING] ──> [PROCESSING]
              │                                                                  │
              └──> [CANCELLED]                                                   └──> [FAILED_PERMANENTLY] (Terminal)
```

### Transition Validation Rules
- Terminal states (`SETTLED`, `REJECTED`, `FAILED_PERMANENTLY`, `CANCELLED`) can never transition backwards.
- `SETTLED` settlements cannot be modified or refunded through settlement routes.
- Illegal transitions are blocked server-side by `canTransitionSettlementStatus(from, to)`.

---

## 3. Settlement Eligibility Rules (14 Deterministic Checks)
Prior to creating or processing a settlement, `checkSettlementEligibility(garageId, amount)` validates:
1. **Garage Exists**: Registered in `garages` or `users`.
2. **Account Active**: `isActive !== false`.
3. **No Financial Suspension**: `isSuspended !== true`.
4. **Payout Profile Configured**: Linked bank account registered in `garage_payout_profiles`.
5. **Payout Profile Verified**: `isVerified === true` and status not `REJECTED`.
6. **No Active Holds**: Zero active holds in `settlement_holds`.
7. **No Active Settlement**: No conflicting active settlement in `REQUESTED`, `UNDER_REVIEW`, `APPROVED`, `PROCESSING`, or `RETRY_PENDING`.
8. **Integer Paise Balance**: Available balance calculated strictly in integer paise from `garage_earnings`.
9. **Minimum Threshold**: Requested amount >= `MIN_SETTLEMENT_AMOUNT` (₹500 = 50,000 paise).
10. **Sufficient Balance**: Requested amount <= Available balance.

---

## 4. Exponential Retry Engine
When an automated or mock gateway payout encounters a transient failure:
- **1st Retry**: 5 minutes
- **2nd Retry**: 15 minutes
- **3rd Retry**: 1 hour
- **4th Retry**: 6 hours
- **5th Retry**: 24 hours
- **After 5 Retries**: Transitions to `FAILED_PERMANENTLY` and safely unlocks locked earnings back to `AVAILABLE`.

---

## 5. Admin Governance & Permission Matrix

### Roles
- `SUPER_ADMIN`: Complete platform access.
- `FINANCE_ADMIN`: Payout approvals, processing, high-value reviews, commission management, financial reporting.
- `OPERATIONS_ADMIN`: Settlement reviews, dispute arbitration, hold placement/release, reconciliation. Cannot approve/execute financial payouts.
- `SUPPORT_ADMIN`: Read-only financial access for customer service.

### Permission Matrix
| Permission | SUPER_ADMIN | FINANCE_ADMIN | OPERATIONS_ADMIN | SUPPORT_ADMIN |
|---|:---:|:---:|:---:|:---:|
| `settlement:read` | ✅ | ✅ | ✅ | ✅ |
| `settlement:approve` | ✅ | ✅ | ❌ | ❌ |
| `settlement:process` | ✅ | ✅ | ❌ | ❌ |
| `settlement:reject` | ✅ | ✅ | ❌ | ❌ |
| `settlement:hold` | ✅ | ✅ | ✅ | ❌ |
| `settlement:retry` | ✅ | ✅ | ❌ | ❌ |
| `financial_report:read` | ✅ | ✅ | ✅ | ✅ |
| `risk:manage` | ✅ | ✅ | ✅ | ❌ |
| `reconciliation:resolve`| ✅ | ❌ | ✅ | ❌ |

---

## 6. Maker-Checker & High-Value Approvals

1. **Maker-Checker Rule**: The admin or garage requesting a settlement is strictly prohibited from approving it (`requestedBy !== approvedBy`).
2. **High-Value Threshold**: Defaults to ₹50,000 (`HIGH_VALUE_SETTLEMENT_THRESHOLD`).
3. **Dual Approval**:
   - First Approval: Transitions status from `REQUESTED` to `UNDER_REVIEW`.
   - Second Approval: By a **distinct** authorized administrator, transitions status to `APPROVED`.
   - Processing is rejected until `approvalCount >= requiredApprovalCount`.

---

## 7. Settlement Holds & Reasons
Administrators can place and release settlement holds with audit logging:
- `RISK_REVIEW`: High/Critical risk engine score.
- `RECONCILIATION_ISSUE`: Amount or ledger mismatch.
- `DISPUTE`: Active dispute opened by vehicle owner.
- `KYC_REVIEW`: Identity or GST compliance review.
- `PAYOUT_PROFILE_ISSUE`: Irregular bank account details.
- `MANUAL_ADMIN_HOLD`: Discretionary administrative pause.

---

## 8. API Reference

### Financial Operations Endpoints (`/api/admin/financial-operations` & `/api/admin/settlements`)
| Method | Endpoint | Auth | Permission | Purpose |
|---|---|---|---|---|
| `GET` | `/api/admin/financial-operations/summary` | Admin | `financial_report:read` | Operational KPIs (Pending, Holds, Retries). |
| `GET` | `/api/admin/settlements/pending` | Admin | `settlement:read` | Pending & Under-Review settlements. |
| `GET` | `/api/admin/settlements/high-value` | Admin | `settlement:read` | High-value settlements needing 2nd approval. |
| `POST` | `/api/admin/settlements/:id/approve` | Admin | `settlement:approve` | First approval (with `confirmation: true`). |
| `POST` | `/api/admin/settlements/:id/second-approve` | Admin | `settlement:approve` | Second approval for high-value items. |
| `POST` | `/api/admin/settlements/:id/reject` | Admin | `settlement:reject` | Rejection and fund unlocking. |
| `POST` | `/api/admin/settlements/:id/hold` | Admin | `settlement:hold` | Place settlement hold. |
| `POST` | `/api/admin/settlements/:id/release-hold` | Admin | `settlement:hold` | Release active hold. |
| `POST` | `/api/admin/settlements/:id/process` | Admin | `settlement:process` | Trigger payout execution (`MOCK_TEST_MODE`). |
| `POST` | `/api/admin/settlements/:id/retry` | Admin | `settlement:retry` | Manual retry trigger. |
| `GET` | `/api/admin/settlements/:id/audit` | Admin | `settlement:read` | Audit history for specific settlement. |

### Financial Audit Endpoints (`/api/admin/financial-audit`)
| Method | Endpoint | Auth | Permission | Purpose |
|---|---|---|---|---|
| `GET` | `/api/admin/financial-audit/summary` | Admin | `financial_report:read` | Audit counts by action categories. |
| `GET` | `/api/admin/financial-audit` | Admin | `financial_report:read` | Filterable, paginated audit ledger. |

---

## 9. Environment Variables

```env
SETTLEMENT_PROVIDER=mock
SETTLEMENT_MODE=MOCK_TEST_MODE
MIN_SETTLEMENT_AMOUNT=500
HIGH_VALUE_SETTLEMENT_THRESHOLD=50000
MAX_SETTLEMENT_RETRIES=5
```

---

## 10. Automated Test Suite & Build Verification

### Run Automated Tests
```bash
cd backend
node test_phase6ab_suite.js
```
*Expected: 38 passed, 0 failed.*

### Run Production Build
```bash
cd frontend
npm run build
```
*Expected: Built with 0 errors.*
