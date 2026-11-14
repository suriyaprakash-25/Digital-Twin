const { MongoClient } = require('mongodb');

let client;
let db;
let lastError;

const LOCAL_FALLBACK_URI = 'mongodb://127.0.0.1:27017';
const DEFAULT_POOL_SIZE = 20;
const SERVER_SELECTION_TIMEOUT_MS = 15000;
const SOCKET_TIMEOUT_MS = 45000;

function getMongoStatus() {
  return {
    connected: Boolean(db),
    dbName: db ? db.databaseName : null,
    lastError: lastError ? String(lastError && lastError.message ? lastError.message : lastError) : null
  };
}

/** Redacts credentials before a URI is logged. */
function redactUri(uri) {
  return String(uri || '').replace(/\/\/([^@/]+)@/, '//***@');
}

function clientOptions(config) {
  return {
    serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS,
    socketTimeoutMS: SOCKET_TIMEOUT_MS,
    retryWrites: true,
    retryReads: true,
    maxPoolSize: Number(config.mongoMaxPoolSize || process.env.MONGO_MAX_POOL_SIZE || DEFAULT_POOL_SIZE),
    // Read scaling: on a replica set, reads may be served by secondaries when explicitly configured
    // (e.g. MONGO_READ_PREFERENCE=secondaryPreferred). Money-moving code paths always read the
    // primary because they use findOneAndUpdate/transactions, which are primary-only.
    readPreference: config.mongoReadPreference || process.env.MONGO_READ_PREFERENCE || 'primary',
  };
}

async function initialiseDatabase(database) {
  await database.command({ ping: 1 });
  try {
    const { seedKnowledgeBase } = require('./utils/seedKb');
    await seedKnowledgeBase(database);
  } catch (sErr) {
    console.warn('Knowledge base seed skipped:', sErr.message);
  }
}

async function connectToMongo(config) {
  if (db) return db;

  try {
    lastError = undefined;
    console.log(`Connecting to MongoDB URI: ${redactUri(config.mongoUri)}...`);
    client = new MongoClient(config.mongoUri, clientOptions(config));
    await client.connect();
    db = config.mongoDbName ? client.db(config.mongoDbName) : client.db();
    await initialiseDatabase(db);
    console.log('🗄️ Using DB:', db.databaseName);
    return db;
  } catch (err) {
    lastError = err;
    db = undefined;
    // Never silently fall back outside local development: in production/staging a fallback to a
    // different database is split-brain financial data. Fail fast and let the platform restart us.
    const env = String(config.nodeEnv || process.env.NODE_ENV || 'development').toLowerCase();
    const fallbackAllowed = env === 'development' && process.env.MONGO_ALLOW_LOCAL_FALLBACK === 'true';
    if (!fallbackAllowed) {
      console.error('❌ MongoDB connection failed:', err && err.message ? err.message : err);
      throw err;
    }
    console.warn('⚠️ MongoDB connection failed; MONGO_ALLOW_LOCAL_FALLBACK=true so using local development database.');
    client = new MongoClient(LOCAL_FALLBACK_URI, { ...clientOptions(config), serverSelectionTimeoutMS: 3000 });
    await client.connect();
    db = client.db(config.mongoDbName || 'digital_twin');
    await initialiseDatabase(db);
    lastError = undefined;
    return db;
  }
}

function getDb() {
  if (!db) {
    throw new Error('MongoDB not connected yet');
  }
  return db;
}

/** The connected MongoClient (needed for sessions/transactions), or null before connect. */
function getMongoClient() {
  return client || null;
}

/** Graceful shutdown hook. */
async function closeMongo() {
  if (client) {
    await client.close();
  }
  client = undefined;
  db = undefined;
}

module.exports = { connectToMongo, getDb, getMongoClient, getMongoStatus, closeMongo, redactUri };
