# DrivePortz Phase 4: Platform Commission, Garage Earnings & Settlement Management System

## 1. Executive Summary
Phase 4 implements the complete financial ledger, platform commission engine, garage earnings management, and settlement payout system for DrivePortz. It introduces:

- **Platform Commission Engine**: Backend-driven, configurable platform fee (`PLATFORM_COMMISSION_RATE=5`) calculated in integer paise.
- **Immutable Commission Snapshotting**: Rate, platform fee, and net garage earnings are frozen on `payment.captured` so historical accounting remains untouched when commission rates change.
- **Garage Earnings Ledger (`garage_earnings`)**: Dedicated collection tracking gross bill, platform fee, net earnings, available balance, and settlement states.
- **Settlement Management (`settlements`)**: Atomic settlement ID generation (`DP-SET-2026-XXXXXX`), available balance verification, minimum payout rules (₹500), and state lifecycle (`REQUESTED` → `APPROVED` → `COMPLETED`).
- **Refund Reconciliation**: Automated proportional deduction adjustments on refunds without corrupting settled accounting history.
- **Isolated Settlement Provider**: Modular `SettlementProvider` abstraction supporting `MockSettlementProvider` (safe Test Mode default) and `RazorpayRouteSettlementProvider`.
- **Administrative Control**: `/admin/commissions` and `/admin/settlements` with approval, rejection, and payout execution workflows.

---

## 2. Mathematical Model & Precision
All monetary operations are computed strictly in **integer paise** before floating-point conversion:

```javascript
// Integer paise calculation formula
const grossPaise = Math.round(invoiceAmountInRupees * 100);
const commissionPaise = Math.round((grossPaise * commissionRate) / 100);
const garageNetPaise = grossPaise - commissionPaise;

const platformCommissionRupees = commissionPaise / 100;
const garageNetAmountRupees = garageNetPaise / 100;
```

### Example:
- **Customer Bill (Gross)**: ₹5,000.00 (500,000 paise)
- **DrivePortz Platform Fee (5%)**: ₹250.00 (25,000 paise)
- **Garage Net Earnings**: ₹4,750.00 (475,000 paise)

---

## 3. Financial State Lifecycles

### A. Earnings Ledger Lifecycle (`garage_earnings`)
```
[Payment Captured: ₹5,000]
            │
            ▼
     (State: AVAILABLE) ───────────────┐
            │                          │
   [Garage Requests Payout]     [Customer Refund: ₹1,000]
            │                          │
            ▼                          ▼
(State: SETTLEMENT_PENDING)   (State: REFUND_ADJUSTMENT)
            │                  (Net adjusted to ₹3,800)
    [Admin Processes Payout]
            │
            ▼
     (State: SETTLED)
```

### B. Settlement Request Lifecycle (`settlements`)
```
[Garage Request: DP-SET-2026-000001]
                 │
                 ▼
         (State: REQUESTED)
         ┌───────┴───────┐
         │               │
  [Admin Approves]  [Admin Rejects]
         │               │
         ▼               ▼
 (State: APPROVED)  (State: CANCELLED)
         │          (Earnings unlocked to AVAILABLE)
 [Execute Payout]
         │
         ▼
(State: COMPLETED)
(Earnings marked SETTLED)
```

---

## 4. Database Collections & Schema

### A. `garage_earnings` Collection
```javascript
{
  _id: ObjectId("..."),
  garageId: "67a2...",
  userId: "67a0...",
  vehicleId: "67a1...",
  serviceId: "67b8...",
  invoiceId: "67b8...",
  invoiceNumber: "DP-INV-2026-000001",
  paymentId: "67c1...",
  razorpayPaymentId: "pay_Qz982...",
  serviceType: "Periodic Maintenance Service",
  vehicleNumber: "TN09AB1234",
  garageName: "Apex Auto Care",
  grossPaise: 500000,
  grossAmount: 5000,
  platformCommissionPaise: 25000,
  platformCommission: 250,
  garageNetPaise: 475000,
  garageNetAmount: 4750,
  refundAmountPaise: 0,
  refundAmount: 0,
  netAfterRefundPaise: 475000,
  netAfterRefund: 4750,
  currency: "INR",
  commissionRate: 5,
  commissionType: "PERCENTAGE",
  commissionSnapshot: {
    rate: 5,
    type: "PERCENTAGE",
    commissionPaise: 25000,
    commissionAmount: 250,
    garageNetPaise: 475000,
    garageNetAmount: 4750,
    calculatedAt: ISODate("...")
  },
  status: "AVAILABLE", // AVAILABLE | SETTLEMENT_PENDING | SETTLED | REFUND_ADJUSTMENT | CANCELLED
  settlementId: null,
  settledAt: null,
  createdAt: ISODate("..."),
  updatedAt: ISODate("...")
}
```

### B. `settlements` Collection
```javascript
{
  _id: ObjectId("..."),
  settlementId: "DP-SET-2026-000001",
  garageId: "67a2...",
  requestedAmount: 4750,
  approvedAmount: 4750,
  currency: "INR",
  status: "COMPLETED", // REQUESTED | UNDER_REVIEW | APPROVED | PROCESSING | COMPLETED | FAILED | CANCELLED
  earningsIds: ["67c2..."],
  destinationAccountId: "Account ending in 7291",
  notes: "Weekly payout request",
  transferId: "mock_trf_DP_SET_2026_000001_1782",
  provider: "MOCK_TEST_MODE",
  requestedAt: ISODate("..."),
  approvedAt: ISODate("..."),
  completedAt: ISODate("..."),
  createdAt: ISODate("..."),
  updatedAt: ISODate("...")
}
```

### Indexes Created:
- `garage_earnings`: `paymentId` (unique), `invoiceId`, `garageId + status`, `garageId + createdAt: -1`, `settlementId` (sparse), `status`.
- `settlements`: `settlementId` (unique), `garageId + status`, `garageId + createdAt: -1`, `status + requestedAt: -1`.
- `garage_payout_profiles`: `garageId` (unique).

---

## 5. API Reference

### Garage Earnings & Settlements (`/api/garage`)
| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/garage/earnings/summary` | Garage | Returns aggregated revenue, commission fee, net earnings, and available balance. |
| `GET` | `/api/garage/earnings` | Garage | Returns paginated, searchable earnings ledger with status filters. |
| `GET` | `/api/garage/earnings/:id` | Garage / Admin | Returns single earnings record with commission snapshot breakdown. |
| `GET` | `/api/garage/settlements` | Garage | Returns settlement requests history. |
| `POST` | `/api/garage/settlements/request` | Garage | Validates available balance & minimum threshold, locks earnings, and creates `DP-SET-2026-XXXXXX`. |
| `GET` | `/api/garage/settlements/:id` | Garage / Admin | Returns settlement audit details and included earnings. |
| `GET` | `/api/garage/payout-profile` | Garage | Returns masked registered bank account details. |
| `PUT` | `/api/garage/payout-profile` | Garage | Saves/updates garage payout bank details. |

### Admin Financial Management (`/api/admin`)
| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/admin/commissions/summary` | Admin | Returns platform-wide gross transaction volume, commission revenues, and payout totals. |
| `GET` | `/api/admin/commissions/all` | Admin | Returns global paginated commission ledger. |
| `GET` | `/api/admin/settlements` | Admin | Returns global settlements list with KPIs. |
| `POST` | `/api/admin/settlements/:id/approve` | Admin | Approves a garage settlement request. |
| `POST` | `/api/admin/settlements/:id/reject` | Admin | Rejects settlement and unlocks linked earnings back to `AVAILABLE`. |
| `POST` | `/api/admin/settlements/:id/process` | Admin | Executes payout through `SettlementProvider` and marks earnings `SETTLED`. |

---

## 6. Settlement Provider Isolation (Safe Test Mode vs Route)
To ensure safety and avoid accidental real-money transfers:
- **Default Mode**: `SETTLEMENT_PROVIDER=mock` executes simulated transfers (`MOCK_TEST_MODE`), generating verified ledger audits and timestamps without moving live funds.
- **Production Mode**: `SETTLEMENT_PROVIDER=razorpay` enables direct Razorpay Route Linked Account transfers only when `providerAccountId` is verified on Razorpay.

---

## 7. Environment Variables Required

### Backend (`backend/.env`):
```env
PLATFORM_COMMISSION_RATE=5
PLATFORM_COMMISSION_TYPE=PERCENTAGE
MIN_SETTLEMENT_AMOUNT=500
SETTLEMENT_PROVIDER=mock
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
```

### Frontend (`frontend/.env`):
```env
VITE_API_URL=https://driveportz.onrender.com
VITE_RAZORPAY_KEY_ID=rzp_test_...
```
