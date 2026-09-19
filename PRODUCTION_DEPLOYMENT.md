# DrivePortz Production Deployment Standard

This document is the deployment source of truth for the controlled DrivePortz pilot.

## Production topology

| Layer | Provider | Production target |
| --- | --- | --- |
| Frontend | Vercel | `https://www.driveportz.com` |
| Backend API | Render | `https://driveportz.onrender.com` |
| Database | MongoDB Atlas | Production `driveportz` database |
| Persistent uploads | Cloudinary | Production DrivePortz folders |
| Payments | Razorpay | Server-side keys + signed webhooks |
| Email | SMTP | Production sender account |
| AI | Groq / Gemini | Server-side API keys only |

The frontend API origin is configured through exactly one public variable:

```env
VITE_API_URL=https://driveportz.onrender.com
```

Do **not** append `/api`. Application routes add `/api` themselves.

Razorpay checkout key IDs are returned by the authenticated backend `create-order` response. Do not configure `VITE_RAZORPAY_KEY_ID` in Vercel.

---

## Vercel production standard

Configure the Vercel project as follows:

| Setting | Required value |
| --- | --- |
| Git repository | `suriyaprakash-25/Digital-Twin` |
| Production branch | `main` |
| Root Directory | `frontend` |
| Framework | Vite |
| Node.js | 22.x |
| Install command | `npm ci` |
| Build command | `npm run build:production` |
| Output directory | `dist` |
| Primary domain | `www.driveportz.com` |
| Apex domain | Redirect `driveportz.com` → `www.driveportz.com` |

`frontend/vercel.json` is committed as infrastructure configuration and provides:
- Vite SPA deep-link rewriting to `index.html`;
- production security headers;
- immutable caching for fingerprinted assets;
- the same install/build/output commands listed above.

### Vercel Production environment variables

Required:

```env
VITE_API_URL=https://driveportz.onrender.com
VITE_GOOGLE_CLIENT_ID=<real Google OAuth web client ID>
```

Configure these together if Firebase web push is enabled:

```env
VITE_FIREBASE_API_KEY=<firebase web API key>
VITE_FIREBASE_AUTH_DOMAIN=<firebase auth domain>
VITE_FIREBASE_PROJECT_ID=<firebase project id>
VITE_FIREBASE_MESSAGING_SENDER_ID=<firebase sender id>
VITE_FIREBASE_APP_ID=<firebase app id>
VITE_FIREBASE_VAPID_KEY=<firebase web-push VAPID public key>
```

The Vercel production build fails closed when `VITE_API_URL` or the Google OAuth client ID is invalid. Partial Firebase core configuration is also rejected.

### Vercel Preview / staging policy

To avoid unnecessary Hobby-plan build consumption, automatic Vercel Git deployments are enabled only for:
- `main` → Production;
- `staging` → controlled Preview/Staging.

Ordinary feature branches do **not** automatically deploy to Vercel. GitHub CI and the Chromium/Edge browser-smoke suite remain the required validation path for those branches.

The `staging` Vercel environment must not receive production backend secrets. For authenticated integration testing, point its `VITE_API_URL` to a separate staging backend and staging database.

Until a staging backend exists, keep the `staging` deployment limited to UI validation and do not loosen production CORS to wildcard `*.vercel.app`.

---

## Render production standard

The repository Blueprint is `render.yaml`.

| Setting | Required value |
| --- | --- |
| Service | Existing DrivePortz backend web service |
| Branch | `main` |
| Root directory | `backend` |
| Runtime | Node |
| Node.js | 22.x, pinned in `backend/package.json` |
| Build command | `npm ci --omit=dev` |
| Start command | `npm start` |
| Health check | `/api/health/ready` |
| Auto deploy | After GitHub checks pass (`autoDeployTrigger: checksPass`) |

Render supplies `PORT`; do not hard-code a production port in the dashboard.

### Render production variables

Non-secret configuration:

```env
NODE_ENV=production
ENFORCE_PRODUCTION_READINESS=true
MONGO_DB_NAME=driveportz
FRONTEND_URL=https://www.driveportz.com
CORS_ALLOWED_ORIGINS=
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SETTLEMENT_MODE=MOCK_TEST_MODE
SETTLEMENT_PROVIDER=mock
ALLOW_MOCK_SETTLEMENTS_IN_PRODUCTION=true
FINANCIAL_JOBS_ENABLED=false
```

Secrets/private values must be configured in Render and never committed:

```text
MONGO_URI
JWT_SECRET_KEY
RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
GOOGLE_CLIENT_ID
GEMINI_API_KEY
GROQ_API_KEY
SMTP_USER
SMTP_PASS
SMTP_FROM_EMAIL
```

The frontend `VITE_GOOGLE_CLIENT_ID` and backend `GOOGLE_CLIENT_ID` should represent the same intended Google OAuth web application/audience.

Automatic financial payout jobs remain disabled during the controlled pilot. Manual settlement remains the approved pilot policy.

---

## Razorpay production routing

Webhook destination:

```text
https://driveportz.onrender.com/api/payments/webhook
```

The webhook secret belongs only in Render as `RAZORPAY_WEBHOOK_SECRET`.

The frontend does not need a Razorpay environment variable. The server returns the public checkout key ID only after authorizing and creating the payment order.

---

## Health endpoints

| Endpoint | Expected result |
| --- | --- |
| `GET /api/health/live` | HTTP 200, `status: UP` |
| `GET /api/health/ready` | HTTP 200, `status: READY`, MongoDB connected and ping succeeds |
| `GET /api/health` | HTTP 200 when core backend health is good |
| `GET /api/health/detailed` | Authenticated admin diagnostic endpoint |

Render uses the readiness endpoint as its deployment health check.

---

## Standard release flow

```text
feature branch
   ↓
pull request
   ↓
DrivePortz CI
   ├─ Backend verification
   ├─ Frontend security, lint and production build
   └─ Responsive browser smoke
   ↓
merge to main
   ↓
Vercel production deployment
Render deployment after checks pass
   ↓
run DrivePortz Production Smoke
   ↓
pilot traffic
```

Once `main` ruleset protection is enabled, require the three DrivePortz CI checks before merge.

---

## Post-deploy verification

GitHub includes a manual workflow:

`Actions → DrivePortz Production Smoke → Run workflow`

Defaults:
- frontend: `https://www.driveportz.com`
- backend: `https://driveportz.onrender.com`

It validates:
1. Vercel root availability;
2. SPA deep link `/login`;
3. expected Vercel security headers;
4. Render liveness;
5. Render readiness + MongoDB ping;
6. production CORS from the canonical frontend origin.

Equivalent local command:

```bash
FRONTEND_URL=https://www.driveportz.com \
BACKEND_URL=https://driveportz.onrender.com \
node scripts/verify-production-deployment.mjs
```

Do not call a deployment verified until this smoke check passes against the actual deployed environments.

---

## Rollback standard

If a deployment causes production regressions:
- Vercel: restore/promote the previous known-good production deployment.
- Render: roll back/redeploy the last known-good commit from the Deploys view.
- Preserve logs and incident evidence before making unrelated changes.
- Do not change multiple providers/secrets simultaneously unless the incident specifically requires it.

After rollback, run the production smoke workflow again.

---

## Remaining provider-side go-live gates

Repository configuration alone cannot prove account-level settings. Before the external pilot, confirm in the provider dashboards:

- Vercel Root Directory is `frontend` and Production Branch is `main`.
- Vercel Production variables match this document.
- `www.driveportz.com` is the production domain and the apex domain redirects correctly.
- Render is linked to the existing backend service/Blueprint and uses the current `main` branch.
- Render secret values have been rotated where required and old credentials revoked.
- MongoDB Atlas backups/recovery are enabled and tested according to the pilot recovery plan.
- Razorpay webhook points to the production backend and uses the current rotated webhook secret.
- The Production Smoke workflow passes after both deployments finish.
