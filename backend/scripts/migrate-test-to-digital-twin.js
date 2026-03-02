/* eslint-disable no-console */
const { MongoClient } = require('mongodb');
const { loadConfig } = require('../src/config');

async function copyCollection(client, fromDb, toDb, collectionName) {
  const src = client.db(fromDb).collection(collectionName);
  const dst = client.db(toDb).collection(collectionName);

  const docs = await src.find({}).toArray();
  if (docs.length === 0) {
    console.log(`- ${fromDb}.${collectionName}: no documents`);
    return;
  }

  // Upsert by _id to avoid duplicates if re-run
  let upserts = 0;
  for (const doc of docs) {
    await dst.updateOne({ _id: doc._id }, { $set: doc }, { upsert: true });
    upserts += 1;
  }

  console.log(`- Copied ${upserts} docs: ${fromDb}.${collectionName} -> ${toDb}.${collectionName}`);
}

async function main() {
  const config = loadConfig();
  const uri = config.mongoUri;

  const client = new MongoClient(uri);
  await client.connect();
  console.log(`Connected to ${uri}`);

  // These are the collections used by this project backend
  const collections = ['users', 'vehicles', 'services'];

  for (const name of collections) {
    await copyCollection(client, 'test', 'digital_twin', name);
  }

  await client.close();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
