const { connectToMongo, getDb } = require('../src/db');
const { loadConfig } = require('../src/config');
const { ObjectId } = require('mongodb');

function toObjectId(id) {
  try {
    return new ObjectId(String(id));
  } catch {
    return null;
  }
}

async function testLookup() {
  const config = loadConfig();
  await connectToMongo(config);
  const db = getDb();

  const bookingId = "6a89193ea797a6621efcd123";
  const bObj = toObjectId(bookingId);

  const resObjectId = await db.collection('bookings').findOne({ _id: bObj });
  console.log('Lookup by ObjectId:', resObjectId);

  const resString = await db.collection('bookings').findOne({ _id: String(bookingId) });
  console.log('Lookup by String:', resString ? 'FOUND!' : 'NOT FOUND');

  const resOr = await db.collection('bookings').findOne({
    $or: [{ _id: bObj }, { _id: String(bookingId) }, { id: String(bookingId) }]
  });
  console.log('Lookup by $or:', resOr ? 'FOUND!' : 'NOT FOUND');

  process.exit(0);
}

testLookup().catch(e => { console.error(e); process.exit(1); });
