require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { connectToMongo, getDb } = require('../src/db');
const { loadConfig } = require('../src/config');

async function inspectGarageData() {
  const config = loadConfig();
  await connectToMongo(config);
  const db = getDb();

  console.log('=== USERS (GARAGE ROLE) ===');
  const garageUsers = await db.collection('users').find({ role: { $in: ['GARAGE', 'garage', 'service_center'] } }).toArray();
  console.log(garageUsers.map(u => ({ _id: String(u._id), email: u.email, name: u.name, role: u.role })));

  console.log('\n=== GARAGES COLLECTION ===');
  const garages = await db.collection('garages').find({}).toArray();
  console.log(garages.map(g => ({ _id: String(g._id), ownerUserId: g.ownerUserId, name: g.name })));

  console.log('\n=== GARAGE_EARNINGS COLLECTION ===');
  const earnings = await db.collection('garage_earnings').find({}).toArray();
  console.log(JSON.stringify(earnings, null, 2));

  console.log('\n=== PAYMENTS COLLECTION (PAID / CAPTURED) ===');
  const payments = await db.collection('payments').find({ status: { $in: ['PAID', 'CAPTURED'] } }).toArray();
  console.log(payments.map(p => ({
    _id: String(p._id),
    invoiceNumber: p.invoiceNumber,
    serviceId: p.serviceId,
    amount: p.amount,
    garageId: p.garageId,
    garageName: p.garageName,
    status: p.status,
    paidAt: p.paidAt
  })));

  console.log('\n=== INVOICES COLLECTION ===');
  const invoices = await db.collection('invoices').find({ paymentStatus: 'PAID' }).toArray();
  console.log(invoices.map(i => ({
    _id: String(i._id),
    invoiceNumber: i.invoiceNumber,
    serviceId: i.serviceId,
    grandTotalAmount: i.grandTotalAmount,
    garageId: i.garageId,
    garageName: i.garageName,
    paymentStatus: i.paymentStatus
  })));

  process.exit(0);
}

inspectGarageData().catch(e => { console.error(e); process.exit(1); });
