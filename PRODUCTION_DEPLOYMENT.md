# DrivePortz Production Deployment & Infrastructure Guide

## 1. Hosting Architecture Overview

```
┌────────────────────────────────────────────────────────┐
│               CLOUDFLARE DNS / SSL (HTTPS)             │
├───────────────────────────┬────────────────────────────┤
│   FRONTEND (Vercel)       │   BACKEND (Render API)     │
│   https://www.driveportz.com│ https://driveportz.onrender.com│
└───────────────────────────┴────────────────────────────┘
                            │
               ┌────────────┴────────────┐
               ▼                         ▼
      MongoDB Atlas Cluster       Razorpay Payment Gateway
   (Replica Set with Indexes)      (Standard & Route Payouts)
```

---

## 2. Environment Variables Configuration

### Backend Production Environment (`.env` in Render):
```env
NODE_ENV=production
PORT=10000
MONGODB_URI=mongodb+srv://<USER>:<PASSWORD>@cluster.mongodb.net/digital_twin?retryWrites=true&w=majority
JWT_SECRET_KEY=<SECURE_64_CHAR_HEX_KEY>
JWT_EXPIRES_IN=7d
FRONTEND_URL=https://www.driveportz.com

# Razorpay Production Credentials
RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=<SECURE_RAZORPAY_SECRET>
RAZORPAY_WEBHOOK_SECRET=<SECURE_WEBHOOK_SECRET>

# Settlement & Governance Gates
SETTLEMENT_MODE=MOCK_TEST_MODE # Change to LIVE only after bank route verified
SETTLEMENT_PROVIDER=mock       # Change to razorpay_route for live payouts
MIN_SETTLEMENT_AMOUNT=500
HIGH_VALUE_SETTLEMENT_THRESHOLD=50000
MAX_SETTLEMENT_RETRIES=5

# SLA Config
SETTLEMENT_REVIEW_SLA_HOURS=24
SETTLEMENT_PROCESSING_SLA_HOURS=48
SETTLEMENT_FAILURE_SLA_HOURS=12

# Performance & Security
SLOW_REQUEST_THRESHOLD_MS=1000
PLATFORM_COMMISSION_RATE=5
```

### Frontend Production Environment (`.env` in Vercel):
```env
VITE_API_URL=https://driveportz.onrender.com/api
VITE_RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxxxxxx
```

---

## 3. Database Indexes Verification

All indexes are verified and initialized idempotently during startup:
1. `payments`: `{ paymentId: 1 }` (unique), `{ invoiceId: 1 }`, `{ status: 1 }`, `{ createdAt: -1 }`.
2. `payment_webhook_events`: `{ eventId: 1 }` (unique), `{ eventType: 1 }`.
3. `garage_earnings`: `{ garageId: 1, status: 1 }`, `{ settlementId: 1 }`.
4. `settlements`: `{ settlementId: 1 }` (unique), `{ garageId: 1, status: 1 }`.
5. `job_execution_logs`: `{ executionId: 1 }` (unique), `{ jobName: 1, startedAt: -1 }`.
6. `job_locks`: `{ jobName: 1 }` (unique), `{ expiresAt: 1 }` (TTL).
7. `financial_alerts`: `{ alertNumber: 1 }` (unique), `{ severity: 1, status: 1 }`.
8. `financial_integrity_issues`: `{ entityType: 1, entityId: 1, type: 1 }`.

---

## 4. Production Health & Probes

| Endpoint | Probe Type | Purpose |
|---|---|---|
| `GET /api/health/live` | Liveness | Returns `200 UP` if node process is running. |
| `GET /api/health/ready` | Readiness | Returns `200 READY` if MongoDB ping succeeds. |
| `GET /api/health/detailed` | Diagnostic | Returns database metrics, open alerts, and active configuration (Admin only). |
