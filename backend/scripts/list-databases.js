/* eslint-disable no-console */
const { MongoClient } = require('mongodb');
const { loadConfig } = require('../src/config');

async function main() {
  const config = loadConfig();
  const client = new MongoClient(config.mongoUri);
  await client.connect();
  const admin = client.db().admin();
  const { databases } = await admin.listDatabases();
  console.log(databases.map((d) => d.name).sort().join('\n'));
  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
