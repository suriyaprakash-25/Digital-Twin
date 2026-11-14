# DrivePortz Architecture

This document walks the platform through the standard 12-step high-level design process and records the decisions taken in the evaluation-driven refactor of November 2026. File paths are relative to the repo root.

## 1. Requirements

**Functional.** Three roles, normalised to `USER`, `GARAGE` and `ADMIN` (`backend/src/middleware/auth.js`):

- **Vehicle owners** manage vehicles, service history, resale, insurance and ownership transfer. They book garages, pay online through Cashfree, and raise refund disputes.
- **Garages** manage their profile, service catalogue and availability. They accept and complete bookings, issue GST invoices, and track earnings, settlements and tax.
- **Admins** handle reconciliation, disputes, risk cases, treasury, settlement approval (maker-checker, with dual approval for high-value payouts) and pilot operations.

**Non-functional targets for the pilot**

| Area | Target |
|---|---|
| Availability | 99.5% for the API; payments degrade gracefully when the gateway is down |
| Latency | p95 under 300 ms for reads and under 800 ms for checkout (gateway call excluded) |
| Integrity | No double charge, double refund or double payout. Amounts are always computed server-side |
| Security | OWASP API Top 10 covered; PII visible only to parties with a business relationship |
| Operability | Correlation ids, structured logs, readiness probes, graceful shutdown, CI gates |

## 2. Scale estimates

These are **planning assumptions, not measurements**. Revisit them with real pilot telemetry.

| Metric | Pilot | 12-month target |
|---|---|---|
| Registered users | 1,000 | 100,000 |
| Garages | 50 | 2,000 |
| Daily active users | 200 | 15,000 |
| Peak API requests per second | 5 | 150 (read-heavy, about 9:1) |
| Payments per day | 50 | 5,000 |
| Payments stored after a year | about 20 K | about 2 M documents (about 2 KB each, about 4 GB) |

At 150 requests per second a single MongoDB replica set primary and two to four small Node instances are enough. The design priority is **correctness under concurrency**, not raw throughput. This is why the refactor focused on atomic updates, idempotency and exactly-once side effects before sharding or microservices.

## 3. Major components

```
Browser SPA (React/Vite, Vercel CDN)
   │ HTTPS, JWT bearer
   ▼
Load balancer (Render) ──► N × Node/Express API instances (stateless)
                              │
           ┌──────────────────┼────────────────────┬──────────────────┐
           ▼                  ▼                    ▼                  ▼
   MongoDB replica set    Job worker           Cache provider     External services
   (data, idempotency,    (same process,       (in-memory LRU,    Cashfree (payments),
    rate limits, jobs)     durable queue)       Redis-ready)      Groq (AI), Cloudinary,
                                                                  SMTP, FCM
```

Backend layers (`backend/src`):

| Layer | Responsibility | Examples |
|---|---|---|
| `routes/` | HTTP adapters: parse, authorise, delegate, format | `routes/payments.js` |
| `services/` | Domain logic | `services/payments/*`, `services/authService.js` |
| `security/` | Cross-cutting policy | `vehicleAccess.js`, `httpHardening.js`, `paymentAuthorization.js` |
| `infrastructure/` | Technical capabilities behind interfaces | cache, job queue, event bus, resilient HTTP, rate limiting |
| `core/` | Shared primitives | constants, typed errors, pagination, transactions, text |
| `models/` | Collection schemas and index definitions | `CoreIndexes.js`, `Payment.js` |

## 4. Data flow: online payment (the critical path)

1. `POST /api/payments/create-order` passes through the rate limiter and the idempotency reservation, then reaches `paymentOrderService`.
   - It resolves the invoice and authorises the payer.
   - It takes the amount from the database, never from the client.
   - It creates the gateway order through the `PaymentGateway` interface and inserts a new payment attempt.
2. The browser completes Cashfree checkout.
3. Two independent paths then confirm the payment:
   - `POST /api/payments/verify` re-verifies the order with Cashfree on the server.
   - The Cashfree webhook arrives with an HMAC signature, a fresh timestamp and a deduplicated event id.
4. Both paths call `paymentCaptureService.capturePayment`:
   - A **compare-and-swap** moves the payment to `CAPTURED`. Exactly one caller wins.
   - The gateway-confirmed amount is compared with the invoice's **current** total, which yields `PAID` or `PARTIALLY_PAID`.
   - The service and invoice updates run inside a transaction on replica sets.
   - The earnings write is idempotent because of a unique index on `paymentId`.
5. A `payment.captured` event is published on the event bus. A subscriber enqueues durable notification jobs, and the job worker delivers push and in-app notifications with retries.

Refunds follow the same pattern. The amount is first reserved atomically (`pendingRefundAmount`), then the owning gateway is called polymorphically, then the ledger is committed. Settlement payouts are claimed with an `APPROVED → PROCESSING` state-machine compare-and-swap before the payout provider is called.

## 5. Database

**Choice.** MongoDB with the native driver, Atlas or a replica set in production.

- **Why:** documents fit the heterogeneous vehicle and service records; there is mature Atlas tooling; the team was already on it.
- **What we gave up:** SQL's relational constraints. They are compensated by unique and partial indexes, compare-and-swap updates and the integrity scanner.

**Indexes**

- Financial collections: `models/Payment.js`, `Earnings.js`, and the others.
- Core collections were previously unindexed; `models/CoreIndexes.js` now covers them:
  - unique `users.email`;
  - `garages.ownerUserId`;
  - per-owner and per-garage listings on `vehicles`, `bookings`, `services` and `notifications`.

**Transactions.** `core/transaction.js` runs multi-document units of work in a real transaction when the deployment supports it (replica set or Atlas). Standalone mongod, used in local development and CI, cannot run transactions. There, safety comes from the compare-and-swap filters and unique indexes, which are what the concurrency tests exercise.

**Read scaling.** `MONGO_READ_PREFERENCE` (default `primary`) can route reads to secondaries, for example `secondaryPreferred` for reporting. Money paths use `findOneAndUpdate` or transactions, which always run on the primary, so they are unaffected.

## 6. Cache

`infrastructure/cache/cache.js` defines a `CacheProvider` interface with get, set, delete, invalidatePrefix, clear and a read-through `wrap` helper. `MemoryCacheProvider` is an LRU+TTL implementation.

- **What is cached:** the public marketplace listing (garage profiles and service catalogues) for 2 minutes. Live fields (open/closed status, active booking counts) are computed per request.
- **Invalidation:** any successful write on the garage and admin routers invalidates the prefix (`invalidateCacheOnWrite`).
- **Values are plain data** (no `ObjectId` instances), so a Redis provider can replace the memory provider by implementing the same interface (Open/Closed).
- **Deliberately not cached:** anything financial or per-user authorisation-sensitive.

## 7. Load balancing and horizontal scale

API instances are **stateless**, so any instance can serve any request:

- Sessions are JWTs, re-validated against the user document on every request, which allows instant revocation through `tokenVersion`.
- **Rate limits** use `MongoRateLimitStore`, shared by all instances. The default in-memory store would multiply every limit by the instance count.
- **Idempotency keys, job leases and job-registry locks** live in MongoDB.
- Uploads go to Cloudinary in production; local disk is a development fallback only.

Other settings:

- `trust proxy` is set to one hop in production, so per-client limits see the real client IP rather than the load balancer's.
- Render health checks use `/api/health/ready`, and `/api/status` reports the database state and each dependency's circuit-breaker state.

## 8. Messaging

`infrastructure/messaging` provides two pieces:

- **`eventBus`** (Observer pattern). Domain events (`payment.captured`, `refund.initiated`, and so on) decouple producers from side effects. A failing subscriber is isolated and cannot fail the producer.
- **`jobQueue`**, a durable MongoDB-backed queue.
  - **Delivery:** at-least-once, with jobs claimed through an atomic `findOneAndUpdate` lease.
  - **Retries:** exponential backoff, with a dead-letter state after 6 attempts.
  - **Deduplication:** `dedupeKey` makes enqueueing idempotent, so verify and the webhook for the same capture produce one notification.
  - **Worker:** each instance runs a worker; set `JOB_WORKER_ENABLED=false` to dedicate instances.

**Why MongoDB and not Kafka, RabbitMQ or SQS:** this volume needs no new infrastructure, and the queue has the same durability as the system of record. The `enqueue`/`JobWorker` interface can be re-implemented on SQS without changing producers.

## 9. Failure handling

| Failure | Handling |
|---|---|
| Gateway slow or down | Every outbound call has a timeout (`resilientHttp`); a per-dependency circuit breaker fails fast; only GETs are auto-retried |
| Duplicate request or double click | Idempotency key reserved atomically; replay returns the stored response; concurrent duplicates get a 409 |
| Verify and webhook race | Compare-and-swap capture; webhook event deduplication with a deterministic event id |
| Concurrent refunds or payouts | Atomic reservation and state-machine compare-and-swap; the loser gets a 409 |
| Side-effect failure (push or email) | Durable job with retries and dead-letter; never blocks or fails the payment |
| Instance crash mid-job | Lease expires and another instance retries the job |
| Deploy or SIGTERM | Graceful shutdown: stop accepting connections, drain in-flight requests and the job batch, close Mongo, force-exit after 15 s |
| Database unreachable at boot | Fail fast in every environment; the local fallback is opt-in for development only (`MONGO_ALLOW_LOCAL_FALLBACK=true`) |
| Unexpected exception | Central error middleware returns a JSON error with a `requestId`, no stack traces, and logs the details |

## 10. Security

- **Authentication**
  - Algorithm-pinned HS256 JWTs carrying a `tokenVersion`; a password reset or "log out everywhere" revokes every session.
  - The long-lived session lives in an **httpOnly cookie** (`dp_session`, Path `/api`) that scripts cannot read. The SPA keeps only a 15-minute access token in memory, refreshed via `GET /api/auth/session`; an access token cannot refresh itself. No credential is stored in localStorage.
  - CSRF: cookie-authenticated mutations must send `X-Requested-With` (a custom header forces a CORS preflight, which the origin allowlist rejects for foreign sites), plus SameSite cookies. See `PRODUCTION_DEPLOYMENT.md` → "Session cookies" for the same-site API domain.
  - bcrypt password hashing and a password policy.
  - OTPs come from `crypto.randomInt`, are stored as HMAC hashes, and the attempt limit applies on every OTP-checking path.
  - Login, signup, OTP and Google sign-in responses do not reveal whether an account exists.
  - Google sign-in requires `email_verified` and a trusted issuer.
- **Authorisation**
  - Role checks combine with resource policies: `security/vehicleAccess.js` and `paymentAuthorization.js`.
  - A garage cannot complete another garage's booking.
  - Settlement mutations require granular permissions and idempotency keys.
- **Input handling**
  - Global MongoDB operator stripping.
  - Escaped and bounded search regexes.
  - A 1 MB default body limit (12 MB only on AI and media routes).
  - Uploads must pass a type allowlist and a **magic-byte check**, with the file extension derived from the validated type.
- **Transport and headers:** a strict CORS allowlist, nosniff, `frame-ancestors 'none'`, CSP, HSTS in production, and `/uploads` served with `sandbox`.
- **Abuse protection:** distributed rate limits on authentication, payments, refunds, disputes, settlements, AI, feedback and payment verification.
- **Supply chain:** `scripts/supply-chain-guard.mjs` runs before `npm ci` in every CI job. It fails on the injected-loader signatures found in October 2026, on whitespace-padded overlong lines, and on npm scripts that execute unreviewed files.

## 11. Bottlenecks

**Fixed in this refactor**

- Unindexed core collections.
- Admin KPI endpoints that loaded whole collections into memory: payments, earnings and settlements are now aggregations.
- Unbounded lists, now paginated: vehicles, payment history, bookings and the marketplace.
- Notifications sent synchronously on the request path.
- Missing gateway timeouts.
- Rate limiting that was per-instance only.

**Fixed in the third pass**

- All nine large route files (`admin`, `garages`, `services`, `invoices`, `earnings`, `bookings`, `disputes`, `ownership`, `passport`) are thin adapters over services and repositories, with zero direct collection calls.
- Explicit state machines now cover bookings (`services/bookings/bookingStateMachine.js`) and ownership transfers (`services/ownership/transferStateMachine.js`), alongside settlements and disputes. All of them use compare-and-swap transitions.
- Settlement requests lock exact earnings rows atomically (no double payout or over-locking), and booking capacity is enforced under a per-garage lease.
- The public vehicle passport (JSON and PDF) exposes only an allow-list of fields.
- A browser end-to-end journey (`frontend/tests/e2e`) runs in CI against a real backend, using the mock payment gateway.

**Fixed in the second pass**

- Every admin KPI summary is now an aggregation (`core/aggregation.js`).
- Garage ratings are an aggregation, and review lists are paginated.
- The financial integrity scan streams through a cursor with batched invoice lookups (it was N+1) and writes issues with a single `bulkWrite`.
- The SPA entry chunk is 193 kB, down from 2,119 kB.
- `requireAuth` reads the user through a 30-second read-through cache, removing the hottest query. Code paths that change a user's role, `tokenVersion` or disabled flag call `invalidateAuthUser`; other instances converge within the TTL.

**Known and next**

1. Some older services still query collections directly rather than through repositories: `settlementEligibilityService`, `earningsService` and `settlementForecastService` (which also scans in memory). The routes layer is down to 115 direct calls from 295; `payments.js` passes collections into payment services.
2. Vehicle service history and the per-user admin detail are bounded but not yet paginated.
3. The `vendor-three` chunk (688 kB) loads only with the landing-page hero.

## 12. Trade-offs

| Decision | Benefit | Cost or risk |
|---|---|---|
| Modular monolith instead of microservices | One deploy, simple transactions, low operational load for a small team | Must keep module boundaries disciplined (`core`/`infrastructure`/`services`) |
| MongoDB queue instead of a broker | Zero new infrastructure; durability matches the database | Polling latency (2 s); throughput capped around hundreds of jobs per second |
| In-memory cache instead of Redis | No new dependency | Per-instance staleness up to the TTL; mitigated by caching only public listings |
| Compare-and-swap plus unique indexes as the baseline, transactions where available | Correct on standalone and replica-set deployments | Multi-collection updates are not atomic on standalone (development and CI only) |
| Headers-based pagination | Backward-compatible response bodies | Clients must read `X-Total-Count` to page |
| Garage vehicle visibility limited to business relationships | Closes a PII leak | Walk-in customers need an exact-plate lookup and owner confirmation before records are verified |
| Settlement mutations require idempotency keys | Exactly-once payouts | Clients must generate keys; old clients get a 400 |
