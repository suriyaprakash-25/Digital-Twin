# Mobility Digital Twin Backend (Node.js)

This backend replaces the original Flask implementation with an Express + MongoDB + JWT server while keeping the same API paths used by the frontend (default: `http://localhost:5000`).

## Setup

1. Ensure MongoDB is running and accessible.
2. Create an env file:

```bash
cp .env.example .env
```

Edit `.env` if needed:

- `MONGO_URI=mongodb://127.0.0.1:27017`
- `MONGO_DB_NAME=digital_twin`

Collections used by the backend:

- `users`
- `vehicles`
- `services`

If you accidentally inserted documents into the default `test` database via Compass, you can copy them into `digital_twin`:

```bash
node scripts/migrate-test-to-digital-twin.js
```

To migrate *all* collections from `test` into `digital_twin` and then delete the `test` database:

```bash
node scripts/migrate-all-and-drop-test-db.js
```

3. Install dependencies:

```bash
npm install
```

## Run

```bash
npm run dev   # nodemon
# or
npm start
```

## Notes

- Uploads are stored in `backend/uploads/` and served at `/uploads/<filename>`.
- Node entrypoint is `backend/server.js`.
