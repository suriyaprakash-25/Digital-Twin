/* eslint-disable no-console */
const { MongoClient } = require('mongodb');
const { loadConfig } = require('../src/config');

async function upsertAllDocs(srcCol, dstCol) {
  const docs = await srcCol.find({}).toArray();
  if (docs.length === 0) return 0;

  for (const doc of docs) {
    await dstCol.updateOne({ _id: doc._id }, { $set: doc }, { upsert: true });
  }
  return docs.length;
}

async function main() {
  const config = loadConfig();
  const uri = config.mongoUri;

  const fromDbName = 'test';
  const toDbName = 'digital_twin';

  const client = new MongoClient(uri);
  await client.connect();
  console.log(`Connected to ${uri}`);

  const fromDb = client.db(fromDbName);
  const toDb = client.db(toDbName);

  const collections = await fromDb.listCollections({}, { nameOnly: true }).toArray();
  if (collections.length === 0) {
    console.log(`No collections found in '${fromDbName}'. Dropping DB anyway.`);
  } else {
    console.log(`Found ${collections.length} collections in '${fromDbName}': ${collections.map((c) => c.name).join(', ')}`);
  }

  for (const { name } of collections) {
    const srcCol = fromDb.collection(name);
    const dstCol = toDb.collection(name);
    const copied = await upsertAllDocs(srcCol, dstCol);
    console.log(`- ${fromDbName}.${name} -> ${toDbName}.${name}: upserted ${copied} docs`);
  }

  const dropResult = await fromDb.dropDatabase();
  console.log(`Dropped '${fromDbName}' database:`, dropResult);

  await client.close();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
