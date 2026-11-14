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
- `npm test` runs `test:ci`, a chain of standalone suites: hardening, refactor (architecture/security/concurrency regression suite, `test_refactor_architecture_suite.js`), payment-security, monitoring, pilot-*, deployment-standard, contracts, then phase suites. There is no test framework (no jest/mocha). Each `test_*.js` in `backend/` is a plain Node script using `assert` that connects to a real MongoDB (CI uses a `mongo:7` service with `MONGO_DB_NAME=driveportz_ci`).
- Run a single suite: `node test_payment_security_suite.js` (or any `npm run test:<name>`, see `package.json`). There is no per-test filter inside a suite.
- `npm run pilot:seed | pilot:cleanup | pilot:verify-notifications`: pilot account tooling. Note `test:pilot-tools` runs seed, verify and cleanup against the configured DB.

Frontend (`cd frontend`):
- `npm run dev`: Vite dev server. `npm run lint`: ESLint. `npm run build`: plain build.
- `npm run build:production`: validates env via `scripts/validate-production-env.mjs` first (requires `VITE_API_URL` and `VITE_GOOGLE_CLIENT_ID`), then builds. This is what Vercel and CI use.
- Browser smoke test: `tests/pilot-responsive.spec.js` (Playwright).
- Browser end-to-end journey (owner books → garage completes → owner pays → session restore → logout): `npx playwright test --config playwright.e2e.config.js --project e2e`. It seeds `driveportz_e2e` via `backend/scripts/e2e-seed.mjs` and starts the backend with `PAYMENT_GATEWAY=mock`, a deterministic gateway in `services/payments/gateways.js` that is refused in production. Install Playwright with `npm install --no-save --package-lock=false --legacy-peer-deps @playwright/test@1.55.0`, as CI does. `@playwright/test` is deliberately not in `package.json`; CI installs it with `--no-save`.

## CI and deployment constraints

- `.github/workflows/ci.yml`: backend `npm test` and `npm audit --omit=dev --audit-level=critical`; frontend lint and `build:production`; Playwright smoke. Render deploys only after checks pass (`autoDeployTrigger: checksPass` in `render.yaml`).
- Supply-chain guard: `node scripts/supply-chain-guard.mjs` (repo root) runs before `npm ci` in every CI job. An obfuscated loader was injected into this repo twice (in `frontend/vite.config.js` and an `init` file run from npm scripts). The guard fails on its signatures, on source lines over 1000 chars, on forbidden primitives in build configs, and on npm scripts that run anything other than `vite`/`vitest`/`eslint`/`nodemon`/`node server.js`/`node scripts/*.mjs`/`node test_*.js`/`npm run`. **Run it before any `npm run` script.** Keep `vite.config.js` under 100 lines with no `require(`, `createRequire`, `eval(`, `child_process` or URLs.
- Vercel deploys only `main` and `staging` (`frontend/vercel.json` `git.deploymentEnabled`). `VITE_API_URL` is the bare origin with no `/api` suffix. Payments use **Cashfree**. The checkout session and mode (`cashfreeMode`: sandbox or production) come from the backend `create-order` response. Do not add gateway keys to the frontend. Details in `PRODUCTION_DEPLOYMENT.md`.
- Production safe defaults in `render.yaml`: `SETTLEMENT_MODE=MOCK_TEST_MODE`, `SETTLEMENT_PROVIDER=mock`, `FINANCIAL_JOBS_ENABLED=false`. Don't flip these without the go-live steps (`GO_LIVE_CHECKLIST.md`, `PILOT_FINANCIAL_POLICY.md`). `NODE_ENV=production|staging` makes `loadConfig()` throw on env validation failures (`src/config/envValidator.js`).

## Backend architecture

- `server.js` is the composition root and exports `{ app, buildApp, start }`; it only listens when run directly, so tests can mount `buildApp()`.
  - Middleware order: request correlation, operational monitoring, security headers, strict CORS allowlist (`src/security/corsPolicy.js`; requests with no Origin header are allowed), size-aware JSON parser (1mb default, 12mb for `/api/copilot`, `/api/vehicle-doctor` and `/api/media`), then `sanitizeRequest`, which strips Mongo `$`/`.` keys.
  - The parser keeps `req.rawBody` for `/api/payments/cashfree-webhook` so the Cashfree signature can be verified.
  - Routes come from the `ROUTES` table. Order matters: `/api/admin` falls through to `/api/admin/settlements`.
  - Then come `notFoundHandler` and `errorHandler`. Errors are JSON `{success:false,msg,message,code,requestId}` and never carry stack traces.
  - On start it connects to Mongo, runs every `INDEX_INITIALISERS` entry, starts the `JobWorker`, and registers SIGTERM graceful shutdown. A new collection with indexes needs its `ensure*Indexes` added to `INDEX_INITIALISERS`.
- Layering: `routes/` (thin HTTP adapters) → `services/` (domain logic) → `models/` (index definitions). Cross-cutting layers:
  - `core/`: constants (no magic numbers), typed errors with `asyncHandler`, pagination, transactions, text helpers;
  - `infrastructure/`: cache, `eventBus`, `jobQueue`, `resilientHttp` (timeouts plus circuit breaker), distributed `rateLimiters`;
  - `security/`: `vehicleAccess` policy, `httpHardening`, `paymentAuthorization`.

  Many routes are role-scoped variants of the same domain, e.g. `/api/disputes`, `/api/garage/disputes`, `/api/admin/disputes`. Check `server.js` before assuming a prefix. See `ARCHITECTURE.md` for the HLD walkthrough.
- List endpoints accept `?page&limit` (default 50, max 200) via `core/pagination.js`. Totals go in the `X-Total-Count`/`X-Page`/`X-Limit`/`X-Total-Pages` headers; body shapes are unchanged. User search text must go through `safeSearchRegex`, never `new RegExp(userInput)`.
- Auth: JWT via `middleware/auth.js`. Roles are normalized to `USER`, `GARAGE`, `ADMIN` (many aliases map in). The same normalization is duplicated in `frontend/src/utils/roles.js`, so keep both in sync. Public registration can never produce `ADMIN` (`normalizePublicRole`). `adminMiddleware.js` and `permissionMiddleware.js` gate admin routes.
- Money flow is the heart of the system. Payment logic lives in `services/payments/`:
  - `gateways.js` defines the `PaymentGateway` interface, with `CashfreeGateway` (primary) and `RazorpayGateway` (legacy records). `resolveGatewayForPayment` picks the gateway; never branch on id prefixes.
  - `paymentOrderService` creates checkout orders.
  - `paymentCaptureService` is the single compare-and-swap capture used by both `/verify` and the webhook. It flags stale-amount payments as `PARTIALLY_PAID`.
  - `refundService` makes an atomic reservation, calls the gateway polymorphically, then commits. It is shared by manual refunds, disputes and refund webhooks.
  - `paymentNotifications` subscribes to events and enqueues durable jobs.

  Supporting pieces:
  - `middleware/idempotency.js` reserves the key with an atomic insert. `requireIdempotency` makes the key mandatory and is used on admin settlement actions.
  - Settlement status changes MUST go through `transitionSettlement` (`services/settlementStateMachine.js`). It validates transitions with a compare-and-swap; process claims APPROVED→PROCESSING before calling the payout provider.
  - The flow continues: earnings → settlement (provider abstraction with mock mode; scheduler gated by `FINANCIAL_JOBS_ENABLED`) → reconciliation (via gateway snapshots), disputes, credit notes, treasury, tax, audit log, risk events, alerts and integrity checks.
- State machines: bookings, ownership transfers, settlements and disputes each have an `ALLOWED_TRANSITIONS` table and a compare-and-swap transition helper. Never write their `status` field directly.
- Authorization: `security/vehicleAccess.js` decides vehicle visibility. Garages see only vehicles they have booked or serviced, without purchase or document fields. Use `canAccessVehicle`/`toVehicleView` rather than ad-hoc role checks. Auth logic (tokens with `tokenVersion` revocation, password policy, hashed OTPs) is in `services/authService.js`.
- Sessions: login sets an httpOnly `dp_session` cookie (7d) and returns a 15-minute access token in the body (`typ:'access'`). `GET /api/auth/session` refreshes it using the cookie only; `POST /api/auth/logout` (`allDevices` revokes all). `requireAuth` accepts a Bearer header or the cookie. Cookie-authenticated non-GET requests need an `X-Requested-With` header, else 403 `CSRF_CHECK_FAILED`. Never store tokens in localStorage on the frontend. `requireAuth` caches the user for 30 s. Any code that changes a user's role, `tokenVersion` or `isDisabled` must call `invalidateAuthUser(userId)` (exported from middleware/auth.js).
- AI features: `groqService.js` (the only LLM provider; calls bounded by `withTimeout`) backs the Vehicle Doctor (`aiDoctorAgent`), the CoPilot assistant (`intentService`, `platformAgent`, `marketplaceAgent`, `emergencyAgent`, `knowledgeBaseAgent`) and `assistantController`. The frontend flag `FEATURES.AI_DOCTOR` in `frontend/src/config/features.js` is currently `false`.
- Integrations: Cloudinary for persistent uploads (`routes/media.js`; local `uploads/` is static-served but not durable on Render), Nodemailer behind an `EmailProvider` interface (`MockEmailProvider` for dev/CI, `ProductionEmailProvider` for SMTP), Firebase Admin for FCM push (optional).
- `backend/scratch/`, `audit_*.js`, `replace_localhost_fallbacks.js`, `migrate_*.js` and the `*.json` audit reports are one-off tooling, not part of the app or the test run.

## Frontend architecture

- `src/App.jsx` declares all routes. Three trees: public (landing, login/signup/OTP/reset), `ProtectedRoute` + `MainLayout` for owner and garage pages, and `AdminRoute` + `AdminLayout` for `pages/admin/*`.
- Every page is `React.lazy`-loaded. `vite.config.js` splits vendors into chunks: react, router, motion, charts, three, leaflet, firebase. Keep the entry chunk small; three.js loads only with the landing hero.
- `src/utils/api.js` is the ONLY HTTP gateway: no direct `axios`/`fetch` elsewhere.
  - Helpers: `apiGet/Post/Put/Patch/Delete/Upload`, plus `apiGetPage`/`getPagination` for the `X-Total-Count` headers.
  - Also: `createIdempotencyKey()`, `getErrorMessage(err)`, and the global 401 handler.
  - It prefixes `API_BASE_URL` (from `VITE_API_URL`) plus `/api`, so pass endpoints without `/api`.
  - Send an `Idempotency-Key` on money mutations. It is required on admin settlement actions.
- Auth state lives in `context/AuthContext` (storage in `utils/authStorage.js`); never read `localStorage` directly. `ProtectedRoute` takes `allowedRoles`. Data fetching uses the `useAsync`/`useApiQuery` hooks, which handle loading, error and retry states. Modals use `useDialog` for accessibility.
- `components/` is grouped by domain, mirroring backend domains (payment, settlement, dispute, risk, reconciliation, invoice, copilot, vehicle-doctor, feedback, and so on). Pages in `pages/` compose them.
- Cashfree checkout: `hooks/useCashfreeCheckout.js` (SDK loaded lazily by `utils/loadCashfree.js`) is shared by PaymentCenter and PaymentButton. The mode comes from the backend's `cashfreeMode`.
- Unit tests: `npm test` (vitest + Testing Library, `*.test.jsx` next to the code). CI runs them along with `npm run lint -- --max-warnings=0`.

## Docs worth knowing

Root-level `PAYMENT_*.md`, `PHASE*_SETUP.md`, `PRODUCTION_DEPLOYMENT.md`, `DISASTER_RECOVERY.md`, `GO_LIVE_CHECKLIST.md` and `API_INTEGRATION_AUDIT.md` hold phase-specific design and ops detail. `docs/pilot/` has the user, garage, admin and support guides. `backend/test_frontend_backend_contract_suite.js` checks that frontend API usage matches backend routes, so run it after adding or renaming endpoints.
