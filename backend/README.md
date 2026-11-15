# DrivePortz Backend (Node.js 22 LTS)

Enterprise backend service powering the DrivePortz Mobility Digital Twin platform. Engineered as a layered modular monolith adhering to SOLID principles, compare-and-swap (CAS) state machines, and the repository pattern.

## Architecture & Directory Structure

```
backend/
├── src/
│   ├── routes/          # Express route adapters (HTTP parameter parsing, auth, and pagination headers)
│   ├── services/        # Core domain services & state machines (bookings, settlements, disputes, payments)
│   ├── repositories/    # BaseRepository & 19 entity repositories (MongoDB isolation)
│   ├── security/        # Access policies, NoSQL injection stripping, CORS, and auth validation
│   ├── infrastructure/  # Caching (LRU + Redis), resilient HTTP, job queue, and event bus
│   ├── core/            # Typed errors, aggregation helpers, constants, and transactions
│   ├── models/          # Schema indexes, compound keys, and deduplication constraints
│   ├── db.js            # MongoDB client connection pool & singleton lifecycle
│   └── server.js        # Express application bootstrap & graceful shutdown handler
├── scripts/             # Data seeds, cleanup tools, and supply chain scanner
└── test_*.js            # Comprehensive test suites (Hardening, Contracts, Phases, Refactor)
```

## Setup & Configuration

1. **Environment Configuration:**
   Copy the example environment configuration:
   ```bash
   cp .env.example .env
   ```

   Key environment variables:
   - `PORT=5000`
   - `NODE_ENV=development` (or `production`)
   - `MONGO_URI=mongodb://127.0.0.1:27017` (or MongoDB Atlas connection string)
   - `MONGO_DB_NAME=driveportz`
   - `JWT_SECRET_KEY=<required-min-32-chars>`
   - `FRONTEND_URL=http://localhost:5173`
   - `CASHFREE_APP_ID=<cashfree_app_id>`
   - `CASHFREE_SECRET_KEY=<cashfree_secret_key>`
   - `CASHFREE_MODE=TEST` (or `PROD`)
   - `CACHE_PROVIDER=memory` (or `redis` with `REDIS_URL=redis://127.0.0.1:6379`)

2. **Dependencies:**
   ```bash
   npm install
   ```

3. **Running the Server:**
   ```bash
   npm run dev    # Development with nodemon auto-reload
   npm start      # Production startup
   ```

## Test Suites

```bash
npm run test:recommended-steps  # Verifies Repository migration, Cursor pagination, and RedisCacheProvider
npm run test:hardening          # Origin normalization, CORS schemes, and RBAC escalation guards
npm run test:contracts          # Frontend <-> Backend API contracts
npm run test:refactor           # Core unit abstractions (Cache, Breaker, State Machines, Queue)
npm test                        # Runs full CI verification pipeline
```

## Security & Concurrency Rules

- **Zero Direct Collection Calls:** Services must query data through `repositories/` (e.g., `repos.settlements`, `repos.earnings`, `repos.garages`).
- **State Changes:** All entity status mutations must pass through their designated state machine (`bookingStateMachine`, `settlementStateMachine`, `disputeStateMachine`, `transferStateMachine`) using compare-and-swap atomic filters.
- **In-Memory Tokens & HttpOnly Sessions:** Client sessions use `dp_session` httpOnly cookies. Access tokens are kept in memory only and never stored in `localStorage`.
