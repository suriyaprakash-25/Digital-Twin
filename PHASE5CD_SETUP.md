# DrivePortz Phase 5C & 5D: Payment Security, Risk Engine & Financial Reporting

## 1. Executive Summary
- **Phase 5C (Payment Security, Fraud/Risk Controls & Audit Hardening)** introduces deterministic transaction risk scoring (0–100), idempotent request caching, duplicate payment protections, refundable paise validation, rate limiting, and immutable financial audit logging.
- **Phase 5D (Financial Reporting, Statements & Export System)** introduces server-side authoritative financial reporting in integer paise, printable period statements (`DP-STM-YYYY-XXXXXX`), platform GMV/commission analytics, and multi-format streaming exports (CSV and XLSX) logged to `report_export_logs` (`DP-EXP-YYYY-XXXXXX`).

---

## 2. Phase 5C: Security & Risk Architecture

### Risk Scoring Matrix
Transactions are assigned a deterministic risk score from 0 to 100 based on weighted signals:
- **`LOW` (0–29)**: Standard low-friction transaction.
- **`MEDIUM` (30–59)**: Monitored transaction logged in `payment_risk_events`.
- **`HIGH` (60–79)**: Flagged for administrator review.
- **`CRITICAL` (80–100)**: Flagged with maximum alert for security investigation.

### Signal Triggers & Weights
| Signal | Description | Weight |
|---|---|---|
| `MULTIPLE_PAYMENT_ATTEMPTS` | >= 5 attempts for same invoice within 15 minutes | +35 |
| `MULTIPLE_SUCCESSFUL_PAYMENTS` | > 1 captured payment on same invoice | +50 |
| `HIGH_VALUE_TRANSACTION` | Amount >= ₹100,000 | +25 |
| `REPEATED_DISPUTES` | >= 3 disputes from user in last 30 days | +30 |
| `HIGH_REFUND_RATIO` | Refund amount >= 80% of invoice total | +35 |
| `EXCESSIVE_REFUNDS` | >= 5 refund requests against same transaction | +40 |

### Configuration Variables
```env
PAYMENT_RISK_ENABLED=true
PAYMENT_MAX_ATTEMPTS_PER_INVOICE=5
PAYMENT_ATTEMPT_WINDOW_MINUTES=15
PAYMENT_MAX_REFUNDS_PER_PAYMENT=5
DISPUTE_RISK_THRESHOLD=3
HIGH_VALUE_PAYMENT_THRESHOLD=100000
REFUND_RISK_THRESHOLD_PERCENT=80
```

### Idempotency Protection
- Supported Headers: `Idempotency-Key` or `X-Idempotency-Key`
- Behavior:
  - Identical key + identical request body: Returns cached response directly.
  - Identical key + modified request body: Returns `HTTP 422 Unprocessable Entity` (`IDEMPOTENCY_KEY_MISMATCH`).
  - Collection: `idempotency_keys` with 24-hour TTL index.

---

## 3. Phase 5D: Financial Reporting & Statement Engine

### Core Calculations (Integer Paise Precision)
All monetary aggregations operate strictly on server-side integer paise:
$$\text{grossPaise} = \sum \text{amount} \times 100$$
$$\text{platformCommissionPaise} = \sum \text{grossPaise} \times \frac{\text{snapshotRate}}{100}$$
$$\text{garageNetPaise} = \text{grossPaise} - \text{platformCommissionPaise} - \text{refundPaise}$$

### Statement & Export Numbering
- **Statements**: `DP-STM-YYYY-XXXXXX` (e.g. `DP-STM-2026-000001`)
- **Export Audits**: `DP-EXP-YYYY-XXXXXX` (e.g. `DP-EXP-2026-000001`)

---

## 4. API Reference

### Risk Management Endpoints (`/api/admin/risk`)
| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/admin/risk/summary` | Admin | KPI summary of risk events. |
| `GET` | `/api/admin/risk` | Admin | Filterable, paginated risk events list. |
| `GET` | `/api/admin/risk/:id` | Admin | Single risk event dossier with payment details. |
| `POST` | `/api/admin/risk/:id/action` | Admin | Actions: `MARK_REVIEWED`, `CLEAR_RISK`, `ESCALATE`. |

### Garage Reports Endpoints (`/api/garage/reports`)
| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/garage/reports/summary` | Garage | Returns period GMV, commission, net, refunds, and available balance. |
| `GET` | `/api/garage/reports/transactions` | Garage | Paginated period transactions list. |
| `GET` | `/api/garage/reports/statement` | Garage | Generates official printable statement with `DP-STM-YYYY-XXXXXX`. |
| `GET` | `/api/garage/reports/export` | Garage | Generates CSV or XLSX binary download. |

### Admin Platform Reports Endpoints (`/api/admin/reports`)
| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/admin/reports/summary` | Admin | Platform-wide GMV, commissions, net payouts, refunds, and daily trends. |
| `GET` | `/api/admin/reports/transactions` | Admin | Global transactions table. |
| `GET` | `/api/admin/reports/commissions` | Admin | Historical commission ledger using immutable `commissionSnapshot`. |
| `GET` | `/api/admin/reports/export` | Admin | Platform-wide CSV/XLSX export. |

---

## 5. Test Suite & Verification

### Run Automated Test Suite
```bash
cd backend
node test_phase5cd_suite.js
```

### Production Build Verification
```bash
cd frontend
npm run build
```
