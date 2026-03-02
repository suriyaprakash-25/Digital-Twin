const { MongoClient } = require('mongodb');

let client;
let db;
let lastError;

function getMongoStatus() {
  return {
    connected: Boolean(db),
    dbName: db ? db.databaseName : null,
    lastError: lastError ? String(lastError && lastError.message ? lastError.message : lastError) : null
  };
}

async function connectToMongo(config) {
  if (db) return db;

  try {
    lastError = undefined;
    client = new MongoClient(config.mongoUri);

    await client.connect();
    console.log("✅ MongoDB client connected");

    db = config.mongoDbName ? client.db(config.mongoDbName) : client.db();

    // ping database
    await db.command({ ping: 1 });
    console.log("📡 Database ping successful");
    console.log("🗄️ Using DB:", db.databaseName);

    return db;
  } catch (err) {
    lastError = err;
    console.error("❌ MongoDB connection failed:", err && err.message ? err.message : err);
    throw err;
  }
}

function getDb() {
  if (!db) {
    throw new Error('MongoDB not connected yet');
  }
  return db;
}

module.exports = { connectToMongo, getDb, getMongoStatus };