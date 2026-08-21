# DrivePortz Phase 3: Payment Intelligence, Refund Management, Notifications & Admin Payment System

## 1. Overview
Phase 3 builds on the Razorpay Standard Checkout foundation (Phase 1) and Garage Invoicing system (Phase 2) to provide a complete, audit-compliant financial intelligence suite for DrivePortz. It introduces:

- **State Machine Consistency**: `CREATED`, `PENDING`, `AUTHORIZED`, `CAPTURED`, `FAILED`, `REFUND_PENDING`, `REFUNDED`, `PARTIALLY_REFUNDED`.
- **Full & Partial Refunds**: Server-side Razorpay SDK integration (`POST /api/payments/:paymentId/refund`), maximum refundable validation, duplicate prevention, and refund audit records.
- **Payment Intelligence & Audit Modal**: `PaymentDetailsModal.jsx` displaying gateway IDs (`pay_...`, `order_...`), method, invoice number, vehicle/garage metadata, and full refund history.
- **Real-Time Payment Notifications**: `NotificationBell.jsx` in the top navigation bar with unread counts and direct deep-linking for `PAYMENT_SUCCESS`, `PAYMENT_FAILED`, `REFUND_COMPLETED`, and `INVOICE_FINALIZED`.
- **Garage Financial Dashboard & Analytics**: `/garage/payments` with KPIs (Total Revenue, Today's Revenue, This Month, Pending Payments, Refunded Amount), trend charts (7/30 days), and in-line refund triggers.
- **Admin Payment Center**: `/admin/payments` for global transaction oversight, platform metrics, and administrative dispute/refund management.

---

## 2. Payment & Refund State Flow

```
[Service Finalized: DP-INV-2026-000001]
                  │
                  ▼
          (State: CREATED)
                  │
   [Customer initiates Checkout]
                  │
                  ▼
          (State: PENDING)
          ┌───────┴───────┐
          │               │
  [Gateway Success] [Gateway Failure]
          │               │
          ▼               ▼
  (State: CAPTURED) (State: FAILED)
          │               │
   [Service: PAID] [Retry Payment Available]
          │
  [Refund Request]
          │
          ▼
   ┌──────┴───────────────────────────┐
   │                                  │
[Partial Amount]                [Full Amount]
   │                                  │
   ▼                                  ▼
(State: PARTIALLY_REFUNDED)     (State: REFUNDED)
```

---

## 3. Database Schema & Indexes

### Collection: `payments`
```javascript
{
  _id: ObjectId("..."),
  invoiceId: "67b8...",
  invoiceNumber: "DP-INV-2026-000001",
  serviceId: "67b8...",
  vehicleId: "67a1...",
  vehicleNumber: "TN09AB1234",
  userId: "67a0...",
  garageId: "67a2...",
  garageName: "Express Auto Care",
  serviceType: "Periodic Service (40,000 km)",
  amount: 4500,
  amountInPaise: 450000,
  currency: "INR",
  receipt: "rcpt_1782...",
  razorpayOrderId: "order_Qz9...",
  razorpayPaymentId: "pay_QzA...",
  paymentMethod: "UPI",
  status: "CAPTURED", // CREATED | PENDING | CAPTURED | FAILED | REFUNDED | PARTIALLY_REFUNDED
  totalRefundedAmount: 0,
  refunds: [
    {
      refundId: "rfnd_QzB...",
      amount: 500,
      currency: "INR",
      reason: "Billing discrepancy / overcharge",
      status: "processed",
      receipt: "ref_000001_847291",
      createdAt: ISODate("...")
    }
  ],
  paidAt: ISODate("..."),
  refundedAt: null,
  failureReason: null,
  createdAt: ISODate("..."),
  updatedAt: ISODate("...")
}
```

### Key Indexes
- `razorpayOrderId`: Unique, Sparse
- `razorpayPaymentId`: Unique, Sparse
- `userId` + `createdAt: -1`: Compound
- `garageId` + `createdAt: -1`: Compound
- `vehicleId` + `createdAt: -1`: Compound
- `invoiceNumber`: Single
- `status`: Single
- `refunds.refundId`: Sparse

---

## 4. API Reference

### Payment Endpoints (`/api/payments`)
| Method | Route | Access | Description |
|---|---|---|---|
| `POST` | `/api/payments/create-order` | Authenticated | Creates Razorpay order using authoritative server amount. |
| `POST` | `/api/payments/verify` | Authenticated | Verifies HMAC-SHA256 signature, transitions payment to `CAPTURED`, updates `services` to `PAID`, and triggers notifications. |
| `POST` | `/api/payments/:paymentId/refund` | Garage / Admin | Processes partial or full refund with Razorpay and updates state atomically. |
| `GET` | `/api/payments/:paymentId/refund-status` | Owner / Garage / Admin | Retrieves status of refunds for a specific payment. |
| `GET` | `/api/payments/details/:id` | Owner / Garage / Admin | Retrieves complete transaction audit trail and gateway metadata. |
| `GET` | `/api/payments/history` | Authenticated | Returns user's payments with status filters (`ALL`, `PAID`, `REFUNDED`, `FAILED`, `PENDING`) and search. |
| `POST` | `/api/payments/webhook` | Public (Signed) | Authoritative raw-body webhook handler for `payment.captured`, `payment.failed`, `refund.processed`. |

### Garage Revenue & Analytics Endpoints (`/api/garage/invoices`)
| Method | Route | Access | Description |
|---|---|---|---|
| `GET` | `/api/garage/invoices/garage/revenue/summary` | Garage | Returns `totalRevenue`, `todayRevenue`, `monthRevenue`, `pendingPayments`, `paidInvoices`, `refundedAmount`, `failedPayments`. |
| `GET` | `/api/garage/invoices/garage/payments/analytics` | Garage | Computes trend data (7 days, 30 days, 90 days) for revenue and refunds. |

### Admin Payment Management Endpoints (`/api/admin/payments`)
| Method | Route | Access | Description |
|---|---|---|---|
| `GET` | `/api/admin/payments/summary` | Admin | Global transaction KPIs (Total Volume, Captured, Failed, Refunded, Pending). |
| `GET` | `/api/admin/payments/all` | Admin | Paginated, filterable, and searchable list of global transactions. |

### Notification Endpoints (`/api/notifications`)
| Method | Route | Access | Description |
|---|---|---|---|
| `GET` | `/api/notifications` | Authenticated | Lists recent notifications for user. |
| `GET` | `/api/notifications/unread-count` | Authenticated | Returns unread notification count. |
| `PATCH` | `/api/notifications/read-all` | Authenticated | Marks all user notifications as read. |
| `PATCH` | `/api/notifications/:id/read` | Authenticated | Marks single notification as read. |

---

## 5. Security & Idempotency Measures
1. **Zero Client Trust on Amounts**: Payment and refund amounts are verified server-side against MongoDB records.
2. **Access Control Enforcement**: A user can only access their own payments; a garage can only view/refund payments for services it completed; admins use `requireAdmin` middleware.
3. **Double Refund Prevention**: `maxRefundable = Math.max(0, originalAmount - totalRefundedAmount)` prevents refunds exceeding original balance or duplicate refund execution.
4. **Timing-Safe Cryptographic Verifications**: Signature verification uses `crypto.timingSafeEqual`.
5. **Webhook Idempotency**: All webhook events are logged in the `webhookEvents` collection with unique `eventId` and processed only once.

---

## 6. Environment Variables Required

### Backend (`backend/.env`):
```env
RAZORPAY_KEY_ID=rzp_test_YourKeyIdHere
RAZORPAY_KEY_SECRET=YourRazorpaySecretHere
RAZORPAY_WEBHOOK_SECRET=YourWebhookSecretHere
MONGODB_URI=mongodb+srv://...
FRONTEND_URL=https://www.driveportz.com
```

### Frontend (`frontend/.env`):
```env
VITE_RAZORPAY_KEY_ID=rzp_test_YourKeyIdHere
VITE_API_URL=https://driveportz.onrender.com
```
