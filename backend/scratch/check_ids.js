require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { connectToMongo, getDb } = require('../src/db');
const { loadConfig } = require('../src/config');

async function checkIds() {
  const config = loadConfig();
  await connectToMongo(config);
  const db = getDb();

  const users = await db.collection('users').find({ role: { $in: ['GARAGE', 'garage', 'service_center'] } }).toArray();
  console.log('USERS:', users.map(u => ({ id: String(u._id), email: u.email, name: u.name, role: u.role })));

  const garages = await db.collection('garages').find({}).toArray();
  console.log('GARAGES:', garages.map(g => ({ id: String(g._id), ownerUserId: g.ownerUserId, name: g.name })));

  const earnings = await db.collection('garage_earnings').find({}).toArray();
  console.log('EARNINGS garageIds:');
  earnings.forEach(e => {
    console.log(`invoice: ${e.invoiceNumber}, gross: ${e.grossAmount}, garageId: ${e.garageId}`);
  });

  process.exit(0);
}

checkIds().catch(e => { console.error(e); process.exit(1); });
