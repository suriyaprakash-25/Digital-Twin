# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

DrivePortz (repo name "mobility-digital-twin"): a vehicle-ownership and garage-marketplace platform. Vehicle owners track vehicles/services/resale, book garages, and pay online. Garages manage services, availability, earnings, settlements and tax. Admins run reconciliation, disputes, risk, treasury and pilot operations. It is in a controlled pilot.

Two independent npm projects (no root workspace; root `package.json` is not used for builds). Node 22.x for both.

- `backend/`: Express 4 + MongoDB (native `mongodb` driver, no ORM), CommonJS. Deployed to Render.
- `frontend/`: React 19 + Vite 7 + Tailwind 4 SPA (ESM, JSX, `react-router-dom` v7). Deployed to Vercel.

## Commands

Backend (`cd backend`):
- `npm run dev`: nodemon. `npm start`: plain node. Needs MongoDB running and a `.env` (copy `.env.example`; `JWT_SECRET_KEY` is required, server throws without it). Default port 5000, default DB `digital_twin`.
- `npm test` runs `test:ci`, a chain of standalone suites: hardening, payment-security, monitoring, pilot-*, deployment-standard, contracts, then phase suites. There is no test framework (no jest/mocha). Each `test_*.js` in `backend/` is a plain Node script using `assert` that connects to a real MongoDB (CI uses a `mongo:7` service with `MONGO_DB_NAME=driveportz_ci`).
- Run a single suite: `node test_payment_security_suite.js` (or any `npm run test:<name>`, see `package.json`). There is no per-test filter inside a suite.
- `npm run pilot:seed | pilot:cleanup | pilot:verify-notifications`: pilot account tooling. Note `test:pilot-tools` runs seed, verify and cleanup against the configured DB.

Frontend (`cd frontend`):
- `npm run dev`: Vite dev server. `npm run lint`: ESLint. `npm run build`: plain build.
- `npm run build:production`: validates env via `scripts/validate-production-env.mjs` first (requires `VITE_API_URL` and `VITE_GOOGLE_CLIENT_ID`), then builds. This is what Vercel and CI use.
- Browser smoke test: `tests/pilot-responsive.spec.js` (Playwright). `@playwright/test` is deliberately not in `package.json`; CI installs it with `--no-save`.

## CI and deployment constraints

- `.github/workflows/ci.yml`: backend `npm test` and `npm audit --omit=dev --audit-level=critical`; frontend lint and `build:production`; Playwright smoke. Render deploys only after checks pass (`autoDeployTrigger: checksPass` in `render.yaml`).
- CI greps `frontend/vite.config.js` and fails on `require(`, `child_process`, `eval(`, `spawn(`, etc., or if it exceeds 100 lines. Keep that file small and free of those primitives.
- Vercel deploys only `main` and `staging` (`frontend/vercel.json` `git.deploymentEnabled`). `VITE_API_URL` is the bare origin with no `/api` suffix. Do not add `VITE_RAZORPAY_KEY_ID`; the Razorpay key comes from the backend `create-order` response. Details in `PRODUCTION_DEPLOYMENT.md`.
- Production safe defaults in `render.yaml`: `SETTLEMENT_MODE=MOCK_TEST_MODE`, `SETTLEMENT_PROVIDER=mock`, `FINANCIAL_JOBS_ENABLED=false`. Don't flip these without the go-live steps (`GO_LIVE_CHECKLIST.md`, `PILOT_FINANCIAL_POLICY.md`). `NODE_ENV=production|staging` makes `loadConfig()` throw on env validation failures (`src/config/envValidator.js`).

## Backend architecture

- `server.js` is the single entry point. It wires middleware in this order: request correlation, operational monitoring, strict CORS allowlist (`src/security/corsPolicy.js`; requests with no Origin header are allowed), JSON body parser (20mb). The parser keeps `req.rawBody` for `/api/payments/webhook` so the Razorpay signature can be verified. Then it mounts every router under `/api/...`, then connects to Mongo and calls each model's `ensure*Indexes()` before `listen`. A new collection with indexes needs its `ensure*Indexes` added to that startup block.
- Layering: `routes/` (HTTP, mounted in `server.js`) → `services/` (business logic) → `models/` (mostly index setup and collection helpers around `getDb()` from `src/db.js`). Many routes are role-scoped variants of the same domain, e.g. `/api/disputes`, `/api/garage/disputes`, `/api/admin/disputes`. Some routers are mounted at more than one path, so check `server.js` before assuming a prefix.
- Auth: JWT via `middleware/auth.js`. Roles are normalized to `USER`, `GARAGE`, `ADMIN` (many aliases map in). The same normalization is duplicated in `frontend/src/utils/roles.js`, so keep both in sync. Public registration can never produce `ADMIN` (`normalizePublicRole`). `adminMiddleware.js` and `permissionMiddleware.js` gate admin routes.
- Money flow is the heart of the system, with heavy hardening: Razorpay orders and signed webhooks (`PaymentWebhookEvent` dedupes events), `middleware/idempotency.js` (`Idempotency-Key` header), `financialRateLimit.js`, `security/paymentAuthorization.js`, then earnings → settlement (`SettlementSchedule`, `jobs/settlementJob.js`, scheduler gated by `FINANCIAL_JOBS_ENABLED`) → reconciliation, disputes, credit notes, treasury, tax, audit log, risk events, financial alerts and integrity checks. Settlement runs through a provider abstraction with a mock mode.
- AI features: `geminiService.js` and `groqService.js` back the Vehicle Doctor (`aiDoctorAgent`), the CoPilot assistant (`intentService`, `platformAgent`, `marketplaceAgent`, `emergencyAgent`, `knowledgeBaseAgent`) and `assistantController`. The frontend flag `FEATURES.AI_DOCTOR` in `frontend/src/config/features.js` is currently `false`.
- Integrations: Cloudinary for persistent uploads (`routes/media.js`; local `uploads/` is static-served but not durable on Render), Nodemailer behind an `EmailProvider` interface (`MockEmailProvider` for dev/CI, `ProductionEmailProvider` for SMTP), Firebase Admin for FCM push (optional).
- `backend/scratch/`, `audit_*.js`, `replace_localhost_fallbacks.js`, `migrate_*.js` and the `*.json` audit reports are one-off tooling, not part of the app or the test run.

## Frontend architecture

- `src/App.jsx` declares all routes. Three trees: public (landing, login/signup/OTP/reset), `ProtectedRoute` + `MainLayout` for owner and garage pages, and `AdminRoute` + `AdminLayout` for `pages/admin/*`.
- All API calls go through `src/utils/api.js` (`apiGet/Post/Patch/Put`). It prefixes `API_BASE_URL` (from `utils/config.js`, which reads `VITE_API_URL`) plus `/api`, and reads the JWT from `localStorage['token']`. Pass endpoints without the `/api` prefix.
- `components/` is grouped by domain, mirroring backend domains (payment, settlement, dispute, risk, reconciliation, invoice, copilot, vehicle-doctor, feedback, and so on). Pages in `pages/` compose them.
- Razorpay checkout is loaded lazily (`utils/loadRazorpay.js`). `services/paymentSyncService.js` handles payment state sync after checkout.

## Docs worth knowing

Root-level `PAYMENT_*.md`, `PHASE*_SETUP.md`, `PRODUCTION_DEPLOYMENT.md`, `DISASTER_RECOVERY.md`, `GO_LIVE_CHECKLIST.md` and `API_INTEGRATION_AUDIT.md` hold phase-specific design and ops detail. `docs/pilot/` has the user, garage, admin and support guides. `backend/test_frontend_backend_contract_suite.js` checks that frontend API usage matches backend routes, so run it after adding or renaming endpoints.
