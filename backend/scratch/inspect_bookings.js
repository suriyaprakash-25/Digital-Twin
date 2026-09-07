const { connectToMongo, getDb } = require('../src/db');
const { loadConfig } = require('../src/config');

async function inspect() {
  const config = loadConfig();
  await connectToMongo(config);
  const db = getDb();

  const bookings = await db.collection('bookings').find({}).sort({ createdAt: -1 }).limit(5).toArray();
  console.log('Bookings:', JSON.stringify(bookings, null, 2));

  process.exit(0);
}

inspect().catch(e => { console.error(e); process.exit(1); });
