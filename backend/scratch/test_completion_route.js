require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const http = require('http');
const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { connectToMongo, getDb } = require('../src/db');
const { loadConfig } = require('../src/config');
const servicesRouter = require('../src/routes/services');

async function testRoute() {
  const config = loadConfig();
  await connectToMongo(config);
  const db = getDb();

  const app = express();
  app.use(express.json());
  app.use('/api/services', servicesRouter);

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;

  // Find a real user in DB
  const user = await db.collection('users').findOne({ role: { $in: ['GARAGE', 'garage', 'USER', 'user'] } });
  if (!user) throw new Error('No user found');

  const token = jwt.sign(
    { sub: String(user._id), role: user.role },
    config.jwtSecret
  );

  console.log(`Express test server listening on port ${port}...`);

  try {
    const res = await axios.get(`http://localhost:${port}/api/services/completion-details`, {
      params: { bookingId: '6a89193ea797a6621efcd123' },
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log('Status Code:', res.status);
    console.log('Response Body:', JSON.stringify(res.data, null, 2));

    if (res.status === 200 && res.data.success && res.data.vehicle.vehicleNumber === 'TN35AD3313') {
      console.log('\n🎉 ALL CHECKS PASSED: GET /api/services/completion-details returned perfect prefill data for TN35AD3313 (Suzuki Vitara)!');
      server.close();
      process.exit(0);
    } else {
      console.error('❌ Data mismatch in response');
      server.close();
      process.exit(1);
    }
  } catch (err) {
    console.error('Request failed:', err.response?.status, err.response?.data || err.message);
    server.close();
    process.exit(1);
  }
}

testRoute().catch(e => { console.error(e); process.exit(1); });
