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
    console.log(`Connecting to MongoDB URI: ${config.mongoUri}...`);
    client = new MongoClient(config.mongoUri, { serverSelectionTimeoutMS: 5000 });

    await client.connect();
    console.log("✅ MongoDB client connected");

    db = config.mongoDbName ? client.db(config.mongoDbName) : client.db();

    // ping database
    await db.command({ ping: 1 });
    console.log("📡 Database ping successful");
    console.log("🗄️ Using DB:", db.databaseName);

    // Seed Knowledge Base
    const { seedKnowledgeBase } = require('./utils/seedKb');
    await seedKnowledgeBase(db);

    return db;
  } catch (err) {
    console.warn("⚠️ Remote MongoDB connection failed, trying local fallback...");
    try {
      client = new MongoClient('mongodb://127.0.0.1:27017', { serverSelectionTimeoutMS: 3000 });
      await client.connect();
      db = client.db('digital_twin');
      await db.command({ ping: 1 });
      console.log("✅ Fallback: Connected to local MongoDB");
      console.log("🗄️ Using DB:", db.databaseName);
      return db;
    } catch (fallbackErr) {
      lastError = err;
      console.error("❌ MongoDB connection failed (both primary and local fallback):", err && err.message ? err.message : err);
      throw err;
    }
  }
}

function getDb() {
  if (!db) {
    throw new Error('MongoDB not connected yet');
  }
  return db;
}

module.exports = { connectToMongo, getDb, getMongoStatus };