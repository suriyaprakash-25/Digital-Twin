# DrivePortz — Mobility Digital Twin Platform

[![DrivePortz CI](https://github.com/suriyaprakash-25/Digital-Twin/actions/workflows/ci.yml/badge.svg)](https://github.com/suriyaprakash-25/Digital-Twin/actions/workflows/ci.yml)
[![Version](https://img.shields.io/badge/version-v1.7-teal.svg)](https://github.com/suriyaprakash-25/Digital-Twin/releases/tag/v1.7)
[![Node](https://img.shields.io/badge/node-%3E%3D22.0.0-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/react-19.2.0-blue.svg)](https://react.dev/)
[![Vite](https://img.shields.io/badge/vite-7.3.1-purple.svg)](https://vitejs.dev/)
[![MongoDB](https://img.shields.io/badge/mongodb-native_driver_6.10-forestgreen.svg)](https://www.mongodb.com/)
[![License](https://img.shields.io/badge/license-Private-red.svg)]()

> **DrivePortz** is an enterprise-grade automotive mobility digital twin and service marketplace platform. It bridges vehicle owners, verified partner garages, and administrative treasury governance with real-time vehicle passport telematics, automated Indian GST invoicing, Cashfree payment processing, and maker-checker dual-governance settlement lifecycles.

---

## 🌟 Platform Capabilities

### 1. Vehicle Owners (`USER`)
- **Digital Twin & Telemetry:** Dynamic vehicle passport tracking mileage, maintenance history, AI vehicle health diagnostics, service reminders, and resale valuation.
- **Service Hub Booking:** Real-time garage discovery, slot booking, and live mechanic status tracking (`REQUESTED` $\rightarrow$ `ACCEPTED` $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `COMPLETED`).
- **Seamless Checkout:** Cashfree Drop.js embedded checkout, instant payment status verification, and downloadable GST tax invoices.
- **Ownership Transfer & Disputes:** Cryptographic token-backed ownership passport transfers and transactional refund disputes.

### 2. Partner Garages (`GARAGE`)
- **Capacity & Job Management:** Real-time slot management with atomic capacity locks, service logging, and digital repair order completion.
- **GST Billing & Invoicing:** Authoritative server-computed 18% GST splits (9% CGST + 9% SGST), labor/parts breakdown, and credit note issuance.
- **Financial Center & Ledger:** Double-entry ledger tracking gross volume, platform commissions, net earnings, and available payout balances in integer paise.
- **Settlement Payouts:** On-demand and automated scheduled settlement requests with balance locking and payout profile verification.

### 3. Platform Administration (`ADMIN`)
- **Treasury & Settlement Governance:** Dual-governance maker-checker authorization for high-value payouts, administrative holds, and payout dispute management.
- **Reconciliation Engine:** Automated multi-way reconciliation matching internal ledger transactions against Cashfree payment gateway records.
- **Fraud & Risk Intelligence:** Real-time risk event detection, suspicious booking flags, and operational health monitoring.

---

## 🏗️ Architecture & System Design (v1.7)

DrivePortz is engineered as a **Layered Modular Monolith** designed for high concurrency correctness, zero double-charge/payout tolerance, and defense-in-depth security:

```
Browser SPA (React 19 / Vite 7)
       │ HTTPS / In-Memory Access Token / HttpOnly Session Cookie (dp_session)
       ▼
Reverse Proxy / CDN (Render / Vercel)
       │ Strict CORS / Rate Limiting (MongoRateLimitStore) / Security Headers
       ▼
Stateless Node.js 22 API Cluster
  ├── routes/          Thin HTTP adapters (validation, auth middleware, pagination headers)
  ├── services/        Domain business logic & compare-and-swap (CAS) state machines
  ├── repositories/    BaseRepository & 19 entity repositories (100% DB isolation)
  ├── security/        Recursive NoSQL injection stripping, vehicle access policy, token versioning
  ├── infrastructure/  LRU Cache + RedisCacheProvider, CircuitBreakers, Mongo Job Queue, EventBus
  └── models/          Schema validations, compound indexes, and deduplication constraints
       │
       ├── MongoDB 7 / Replica Set / Atlas (ACID Transactions & CAS Atomic Updates)
       ├── Redis (Distributed Cache Provider - optional / cross-instance sync)
       └── External Gateways (Cashfree PG, Groq AI, Cloudinary, Firebase Admin FCM)
```

### Key Architectural Highlights
- **100% Repository Pattern:** All database operations are encapsulated in [BaseRepository.js](backend/src/repositories/BaseRepository.js) and 19 domain repositories. Zero direct `db.collection()` calls exist in domain services.
- **Compare-and-Swap (CAS) State Machines:** Booking, settlement, dispute, and transfer lifecycles are governed by strict transition matrices with atomic CAS database filters, eliminating race conditions and double transitions.
- **Cursor & Header-Based Pagination:** Service history (`GET /api/services/:vehicle_id`) and entity listings enforce bounded pagination with standard `X-Total-Count`, `X-Page`, `X-Limit`, and `X-Total-Pages` response headers.
- **Pluggable Horizontal Caching:** Features `CacheProvider` interface with default in-memory LRU + TTL caching and a distributed [RedisCacheProvider](backend/src/infrastructure/cache/cache.js) supporting cross-node prefix invalidation and graceful fallback.
- **Defense-in-Depth Security:**
  - Zero `localStorage` token storage: Short-lived access tokens are kept in memory only; persistent sessions use secure `httpOnly` `dp_session` cookies.
  - Global NoSQL injection sanitizer recursively strips `$` and `.` operators.
  - CI supply-chain scanner ([supply-chain-guard.mjs](scripts/supply-chain-guard.mjs)) verifies all source files against obfuscated code and malicious loaders.

---

## 🚀 Quickstart & Setup

### Prerequisites
- **Node.js:** v22.x LTS
- **MongoDB:** v7.x (local instance or MongoDB Atlas cluster)
- **Redis (Optional):** v7.x (required only when `CACHE_PROVIDER=redis`)

### 1. Repository Setup
```bash
git clone https://github.com/suriyaprakash-25/Digital-Twin.git
cd Digital-Twin
```

### 2. Backend Configuration & Startup
```bash
cd backend
cp .env.example .env
npm install
```

Configure `backend/.env`:
```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://127.0.0.1:27017
MONGO_DB_NAME=driveportz
JWT_SECRET_KEY=your_minimum_32_character_jwt_secret_here
FRONTEND_URL=http://localhost:5173

# Payment Gateway (Cashfree)
CASHFREE_APP_ID=your_cashfree_app_id
CASHFREE_SECRET_KEY=your_cashfree_secret_key
CASHFREE_MODE=TEST # or PROD

# Optional Distributed Cache
CACHE_PROVIDER=memory # or redis
REDIS_URL=redis://127.0.0.1:6379
```

Run backend in development mode:
```bash
npm run dev
```

### 3. Frontend Configuration & Startup
```bash
cd ../frontend
cp .env.example .env
npm install
```

Configure `frontend/.env`:
```env
VITE_API_URL=http://localhost:5000/api
VITE_CASHFREE_MODE=sandbox # or production
```

Run frontend development server:
```bash
npm run dev
# App will launch at http://localhost:5173
```

---

## 🧪 Testing & Verification

DrivePortz enforces an exhaustive suite of static, unit, contract, and dynamic browser tests:

```bash
# In the backend directory:
npm run test:recommended-steps  # Verifies Repository migration, Cursor pagination, and RedisCacheProvider
npm run test:hardening          # Verifies origin normalisation, CORS policies, and RBAC guards
npm run test:contracts          # Tests API contract schemas between Frontend and Backend
npm run test:refactor           # Executes core unit abstractions (Cache, Breaker, State Machines, Queue)
npm test                        # Runs full verification test suite

# In the frontend directory:
npm test                        # Runs 79 Vitest unit and component integration tests
npm run lint                    # Runs ESLint code quality checks
npm run build                   # Compiles production bundle with code-splitting
```

### Supply-Chain Security Check
Verify zero unauthorized dependencies or hidden payload scripts across all tracked files:
```bash
node scripts/supply-chain-guard.mjs
```

---

## 📦 Release v1.7 Notes

- **Full Domain Repository Migration:** Refactored `settlementEligibilityService.js` and `settlementForecastService.js` to route 100% of operations through `SettlementRepository` and `EarningsRepository`.
- **Standardized Service History Pagination:** Added cursor- and header-based pagination to `GET /api/services/:vehicle_id` exposing `X-Total-Count`, `X-Page`, `X-Limit`, and `X-Total-Pages`.
- **Distributed Horizontal Caching:** Implemented `RedisCacheProvider` subclassing `CacheProvider` with prefix invalidation (`dp:cache:`), millisecond TTL eviction, and safe error fallback.
- **Architectural Grade:** System evaluation scored **95.2 / 100 (Grade: A+)** across Functional, Non-Functional, SOLID, LLD, and 12-Step HLD categories. Full evaluation documented in [evaluation_system_design_report.md](ARCHITECTURE.md).

---

## 📄 License & Intellectual Property

Copyright © 2026 DrivePortz. All rights reserved.  
Confidential and proprietary software.
