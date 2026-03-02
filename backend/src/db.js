const { MongoClient } = require('mongodb');

let client;
let db;

async function connectToMongo(config) {
  if (db) return db;

  client = new MongoClient(config.mongoUri);
  await client.connect();
  db = config.mongoDbName ? client.db(config.mongoDbName) : client.db();
  return db;
}

function getDb() {
  if (!db) {
    throw new Error('MongoDB not connected yet');
  }
  return db;
}

module.exports = { connectToMongo, getDb };
