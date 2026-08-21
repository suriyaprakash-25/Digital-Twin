# DrivePortz Phase 5: Payment Reconciliation Engine & Dispute Management System

## 1. Executive Overview
Phase 5 introduces the automated **Payment Reconciliation Engine (Phase 5A)** and the customer-facing **Payment Dispute Management System (Phase 5B)** for DrivePortz.

### Key Capabilities:
- **Multi-Source Reconciliation**: Authoritative cross-verification between Razorpay Gateway, DrivePortz Payment records, Invoices, Garage Earnings ledger, and Settlement payouts.
- **Deterministic Discrepancy Classification**: Automated detection of `AMOUNT_MISMATCH`, `STATUS_MISMATCH`, `REFUND_MISMATCH`, `PAYMENT_NOT_FOUND`, `INVOICE_NOT_FOUND`, and `EARNINGS_MISMATCH` with integer paise precision.
- **Admin Reconciliation Console**: `/admin/reconciliation` with summary KPIs, manual batch triggers (recent 24h/48h), and audit resolutions.
- **Payment Dispute Resolution Center**: Vehicle owners can raise disputes with categories, descriptions, disputed amounts, and Cloudinary evidence attachments directly from `/payment-history`.
- **Append-Only Timeline**: Transparent chronological logging in `dispute_events` (`USER` → `GARAGE` → `ADMIN` → `REFUND_COMPLETED` → `RESOLVED`).
- **Direct Refund Integration**: Dispute refund resolutions (`REFUND_FULL` / `REFUND_PARTIAL`) directly invoke the existing Phase 3 Razorpay refund engine and trigger Phase 4 earnings reconciliation.

---

## 2. Reconciliation Engine Architecture (Phase 5A)

### Data Cross-Verification Pipeline
```
       Razorpay Gateway
              │
              ▼
   DrivePortz Payment Records
              │
              ▼
           Invoice
              │
              ▼
       Garage Earnings
              │
              ▼
       Refund Records
              │
              ▼
     Settlement Records
              │
              ▼
   Reconciliation Assessment
 (MATCHED | MISMATCH | MISSING)
```

### Reconciliation Statuses & Mismatch Types
- **`RECONCILIATION_STATUS`**:
  - `MATCHED`: All payment, invoice, refund, and earnings figures align 100%.
  - `MISMATCH`: Variances detected in amount, status, refund, or ledger allocation.
  - `MISSING`: Payment exists in DrivePortz but cannot be located on Razorpay.
  - `PENDING`: Transaction check queued.
  - `RESOLVED`: Audited and resolved by an administrator with resolution notes.
- **`MISMATCH_TYPE`**:
  - `AMOUNT_MISMATCH`: DrivePortz gross amount differs from Razorpay amount.
  - `STATUS_MISMATCH`: Status differs (e.g. `CAPTURED` vs `failed`).
  - `CURRENCY_MISMATCH`: Currency differs from expected INR.
  - `REFUND_MISMATCH`: DrivePortz refund ledger total differs from Razorpay `amount_refunded`.
  - `PAYMENT_NOT_FOUND`: Payment ID not found on gateway.
  - `INVOICE_NOT_FOUND`: Corresponding invoice or service record missing.
  - `EARNINGS_MISMATCH`: Gross revenue in earnings ledger differs from paid amount.

---

## 3. Payment Dispute Lifecycle (Phase 5B)

```
[Customer Raises Dispute]
           │
           ▼
    (State: OPEN)
    (Timeline: DISPUTE_CREATED)
           │
 ┌─────────┴─────────┐
 │                   │
[Garage Responds]   [Customer Cancels]
 │                   │
 ▼                   ▼
(State: UNDER_REVIEW) (State: CANCELLED)
 │
 ▼
[Admin Review & Decision]
 ├─────────────────────────────────────────┐
 │                                         │
[Resolution: REFUND_FULL / REFUND_PARTIAL] [Resolution: REJECT_DISPUTE]
 │                                         │
 ▼                                         ▼
(State: RESOLVED)                        (State: REJECTED)
(Gateway Refund Executed & Earnings Reconciled)
```

### Categories Supported:
- `INCORRECT_AMOUNT`
- `DUPLICATE_PAYMENT`
- `SERVICE_NOT_PROVIDED`
- `POOR_SERVICE`
- `REFUND_NOT_RECEIVED`
- `WRONG_REFUND_AMOUNT`
- `PAYMENT_FAILED_BUT_CHARGED`
- `INVOICE_ISSUE`
- `OTHER`

---

## 4. API Reference

### Payment Reconciliation Endpoints (`/api/admin/reconciliation`)
| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/admin/reconciliation/summary` | Admin | Returns aggregate metrics (`matched`, `mismatched`, `missing`, `resolved`, `totalMismatchAmount`). |
| `GET` | `/api/admin/reconciliation` | Admin | Paginated, filterable reconciliation audit records. |
| `GET` | `/api/admin/reconciliation/:id` | Admin | Full multi-source inspection report. |
| `POST` | `/api/admin/reconciliation/run` | Admin | Triggers single payment or recent batch reconciliation (up to 50 records). |
| `POST` | `/api/admin/reconciliation/:id/resolve` | Admin | Resolves a discrepancy with audit note and logs to `reconciliation_audit_logs`. |

### User Dispute Endpoints (`/api/disputes`)
| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/disputes` | User | Submits a new dispute with optional multipart evidence attachment. |
| `GET` | `/api/disputes` | User | Lists disputes created by the authenticated user. |
| `GET` | `/api/disputes/:id` | User / Garage / Admin | Returns dispute report with append-only activity timeline. |
| `POST` | `/api/disputes/:id/respond` | User | Submits follow-up user explanation when under review. |
| `POST` | `/api/disputes/:id/cancel` | User | Cancels an open dispute. |

### Garage Partner Dispute Endpoints (`/api/garage/disputes`)
| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/garage/disputes` | Garage | Lists disputes pertaining to invoices serviced by the garage. |
| `GET` | `/api/garage/disputes/:id` | Garage | Inspects customer claim and invoice background. |
| `POST` | `/api/garage/disputes/:id/respond` | Garage | Records garage explanation and transitions dispute to `UNDER_REVIEW`. |

### Admin Dispute Arbitration Endpoints (`/api/admin/disputes`)
| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/admin/disputes/summary` | Admin | Global dispute volume, open counts, and claim metrics. |
| `GET` | `/api/admin/disputes` | Admin | Filterable, searchable global dispute list. |
| `GET` | `/api/admin/disputes/:id` | Admin | Full dispute dossier with customer claim, garage statement, and timeline. |
| `POST` | `/api/admin/disputes/:id/resolve` | Admin | Authorizes resolution (`REFUND_FULL`, `REFUND_PARTIAL`, `INVOICE_CORRECTION`, `NO_ACTION`). |
| `POST` | `/api/admin/disputes/:id/reject` | Admin | Dismisses customer claim with justification. |

---

## 5. Security & Financial Integrity

1. **Strict Ownership Isolation**:
   - Customers can only raise and view disputes on payments belonging to their account.
   - Garages can only view disputes linked to their service center.
2. **Integer Paise Financial Calculations**:
   - All comparisons and dispute sums operate on integer paise (`paise = amount * 100`).
   - Disputed amounts cannot exceed original payment transaction totals.
3. **No Automatic Overwrites**:
   - Reconciliation checks never alter database payment records automatically.
   - Discrepancies are flagged for administrator audit review.
4. **Append-Only Auditing**:
   - Timeline events in `dispute_events` and resolution logs in `reconciliation_audit_logs` are strictly append-only.

---

## 6. Testing & Deployment Verification

### Run Automated Test Suite:
```bash
node scratch/test_phase5_suite.js
```

### Production Frontend Build:
```bash
cd frontend
npm run build
```
