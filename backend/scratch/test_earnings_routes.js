require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const http = require('http');
const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { connectToMongo, getDb } = require('../src/db');
const { loadConfig } = require('../src/config');
const earningsRouter = require('../src/routes/earnings');

async function testEarningsRoutes() {
  const config = loadConfig();
  await connectToMongo(config);
  const db = getDb();

  const app = express();
  app.use(express.json());
  app.use('/api/garage', earningsRouter);

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;

  // Find user for car24x
  const garageUser = await db.collection('users').findOne({ email: 'car24x@gmail.com' });
  if (!garageUser) throw new Error('Garage user not found');

  const token = jwt.sign(
    { sub: String(garageUser._id), role: 'GARAGE' },
    config.jwtSecret
  );

  console.log(`Express test server listening on port ${port}...`);

  // 1. Test Summary
  console.log('\n--- 1. Testing GET /api/garage/earnings/summary ---');
  const summaryRes = await axios.get(`http://localhost:${port}/api/garage/earnings/summary`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('Summary Result:', JSON.stringify(summaryRes.data, null, 2));

  // 2. Test List
  console.log('\n--- 2. Testing GET /api/garage/earnings ---');
  const listRes = await axios.get(`http://localhost:${port}/api/garage/earnings`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log(`Earnings List (Count: ${listRes.data.earnings.length}, Total: ${listRes.data.totalCount}):`);
  listRes.data.earnings.forEach(e => {
    console.log(`  - ${e.invoiceNumber} | Gross: ₹${e.grossAmount} | Net: ₹${e.garageNetAmount} | Status: ${e.status}`);
  });

  const grossTotal = summaryRes.data.summary.totalGrossRevenue;
  console.log(`\nVerified Gross Total: ₹${grossTotal}`);

  if (summaryRes.data.success && listRes.data.earnings.length === 3 && grossTotal > 8350) {
    console.log('🎉 SUCCESS: All 3 earnings records (₹8,351.57) are now returned correctly!');
    server.close();
    process.exit(0);
  } else {
    console.error('❌ Failed: Expected 3 earnings records and > ₹8,350 gross revenue');
    server.close();
    process.exit(1);
  }
}

testEarningsRoutes().catch(e => { console.error(e); process.exit(1); });
