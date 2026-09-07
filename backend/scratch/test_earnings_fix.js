require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { connectToMongo, getDb } = require('../src/db');
const { loadConfig } = require('../src/config');

async function testFix() {
  const config = loadConfig();
  await connectToMongo(config);
  const db = getDb();

  const userId = '69b0cfe5c0fd33986199c63a'; // car24x user id

  // Resolve all garage IDs associated with this user
  const garageDoc = await db.collection('garages').findOne({ ownerUserId: String(userId) });
  const garageIds = [String(userId)];
  if (garageDoc) {
    garageIds.push(String(garageDoc._id));
  }

  console.log('Resolved Garage IDs for user:', garageIds);

  const earnings = await db.collection('garage_earnings').find({
    garageId: { $in: garageIds }
  }).toArray();

  console.log(`\nFound ${earnings.length} earnings records for car24x:`);
  let totalGross = 0;
  let totalFee = 0;
  let totalNet = 0;
  earnings.forEach(e => {
    console.log(`- ${e.invoiceNumber} | ${e.serviceType} | Gross: ₹${e.grossAmount} | Fee: ₹${e.platformCommission} | Net: ₹${e.garageNetAmount} | Status: ${e.status}`);
    totalGross += e.grossAmount;
    totalFee += e.platformCommission;
    totalNet += e.garageNetAmount;
  });

  console.log(`\nTotals:`);
  console.log(`Gross Revenue: ₹${totalGross.toFixed(2)}`);
  console.log(`Platform Fee: ₹${totalFee.toFixed(2)}`);
  console.log(`Net Earnings: ₹${totalNet.toFixed(2)}`);

  process.exit(0);
}

testFix().catch(e => { console.error(e); process.exit(1); });
