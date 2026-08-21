# DrivePortz Payment System Setup Guide (Phase 1: Razorpay Standard Checkout)

> **Important Scope Notice:**
> Phase 1 implements **Razorpay Standard Checkout** for direct invoice payment capture. Phase 1 does **NOT** implement Razorpay Route, Linked Accounts, or automatic garage payouts (reserved for Phase 4).

---

## 1. Overview & Architecture

DrivePortz uses server-side Razorpay order generation and timing-safe signature verification to process online customer payments for automotive service bills:

```
[Vehicle Owner] -> Clicks "Pay ₹..." on Unpaid Service Bill
       ↓
[Frontend] -> Requests Razorpay Order from Backend (POST /api/payments/create-order)
       ↓
[Backend] -> Validates invoice in MongoDB (authoritative amount strictly calculated server-side in paise)
       ↓
[Razorpay API] -> Generates order_id
       ↓
[Frontend] -> Opens Razorpay Standard Hosted Checkout (https://checkout.razorpay.com/v1/checkout.js)
       ↓
[Customer] -> Completes Test/Live Payment
       ↓
[Frontend] -> Sends razorpay_payment_id, order_id, signature to Backend (POST /api/payments/verify)
       ↓
[Backend] -> Validates HMAC-SHA256 signature using crypto.timingSafeEqual
       ↓
[Backend] -> Marks Payment "CAPTURED" and Service Invoice "PAID"
       ↓
[Razorpay Webhook] -> (POST /api/payments/webhook) Independently verifies and confirms payment idempotently
```

---

## 2. Environment Variables

### Backend Configuration (Render / Local)

Set the following variables in `backend/.env` (locally) and under **Environment Variables** in the Render dashboard:

| Variable | Description | Example (Test Mode) |
|---|---|---|
| `RAZORPAY_KEY_ID` | Razorpay Key ID generated in Dashboard | `rzp_test_xxxxxxxxxxxxxx` |
| `RAZORPAY_KEY_SECRET` | Razorpay Key Secret (Keep confidential!) | `xxxxxxxxxxxxxxxxxxxxxxxx` |
| `RAZORPAY_WEBHOOK_SECRET` | Secret chosen when creating Webhook | `your_webhook_secret_here` |
| `FRONTEND_URL` | Production Frontend Domain | `https://www.driveportz.com` |

> [!CAUTION]
> **Never expose `RAZORPAY_KEY_SECRET` or `RAZORPAY_WEBHOOK_SECRET` to the frontend or source control.**

### Frontend Configuration (Vercel / Local)

Set the following in `frontend/.env` (locally) and under **Environment Variables** in the Vercel project dashboard:

| Variable | Description | Example |
|---|---|---|
| `VITE_API_URL` | Backend Render API Base URL | `https://driveportz.onrender.com` |
| `VITE_RAZORPAY_KEY_ID` | Razorpay Public Key ID only | `rzp_test_xxxxxxxxxxxxxx` |

> [!NOTE]
> Vite environment variables (`VITE_*`) are embedded during frontend build. When updating environment variables on Vercel, trigger a redeployment.

---

## 3. Razorpay Account Setup & Test Key Generation

1. Sign up or log in at [Razorpay Dashboard](https://dashboard.razorpay.com/).
2. Switch to **Test Mode** (toggle switch in the top header).
3. Navigate to **Account & Settings** -> **API Keys** -> **Generate Key**.
4. Copy the generated **Key ID** and **Key Secret**.
5. Add `Key ID` to backend and frontend environment variables.
6. Add `Key Secret` to backend environment variables only.

---

## 4. Razorpay Webhook Configuration

1. In the Razorpay Dashboard, navigate to **Account & Settings** -> **Webhooks**.
2. Click **Add New Webhook**.
3. **Webhook URL**:
   ```
   https://driveportz.onrender.com/api/payments/webhook
   ```
4. **Secret**: Enter a secure random string (e.g. 32 alphanumeric characters) and assign it to `RAZORPAY_WEBHOOK_SECRET` in backend Render environment variables.
5. **Active Events**: Check the following events:
   - `payment.captured`
   - `payment.failed`
   - `order.paid`
6. Click **Save**.

---

## 5. Test Payment Procedure

When testing on `localhost` or staging with test keys (`rzp_test_...`):

1. **Test Cards**:
   - Card Number: `4111 1111 1111 1111` or any standard Razorpay test card.
   - Expiry: Any future date (e.g., `12/30`).
   - CVV: `123`.
   - OTP: `1234` or click "Success" in the test simulator popup.
2. **Test UPI**:
   - Enter `success@razorpay` -> approve transaction in the test simulator.
3. **Test NetBanking**:
   - Select any bank -> click "Success".

---

## 6. Verification & Security Safeguards

- **Authoritative Amount**: Amounts are never accepted from the frontend. The backend queries MongoDB for the service invoice total and converts to paise.
- **Timing-Safe Signatures**: Signature verification uses `crypto.timingSafeEqual` to eliminate timing attack vulnerabilities.
- **Raw Webhook Body**: Express captures the exact raw body buffer before JSON parsing to guarantee signature validation accuracy.
- **Idempotency & Replay Protection**: Webhook event IDs and order IDs are indexed uniquely to prevent double-charging or duplicate database updates.
- **No Sensitive Credential Storage**: Card details, CVV, and UPI PINs are handled exclusively within Razorpay's PCI-DSS compliant checkout iframe.

---

## 7. Migration to Live Production Mode

When ready to accept real customer payments:

1. Complete Razorpay KYC and activate your account.
2. Toggle from **Test Mode** to **Live Mode** in the Razorpay Dashboard.
3. Generate **Live API Keys** (`rzp_live_...`).
4. Update `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in Render.
5. Update `VITE_RAZORPAY_KEY_ID` in Vercel and redeploy frontend.
6. Create a live webhook pointing to `https://driveportz.onrender.com/api/payments/webhook` with a live secret.
