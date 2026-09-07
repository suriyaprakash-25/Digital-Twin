require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { connectToMongo, getDb } = require('../src/db');
const { loadConfig } = require('../src/config');

async function inspect() {
  const config = loadConfig();
  await connectToMongo(config);
  const db = getDb();

  const services = await db.collection('services').find({}).sort({ createdAt: -1 }).limit(10).toArray();
  console.log('--- Services Collection (last 10) ---');
  console.log(JSON.stringify(services, null, 2));

  const invoices = await db.collection('invoices').find({}).sort({ createdAt: -1 }).limit(5).toArray();
  console.log('\n--- Invoices Collection (last 5) ---');
  console.log(JSON.stringify(invoices, null, 2));

  process.exit(0);
}

inspect().catch(e => { console.error(e); process.exit(1); });
