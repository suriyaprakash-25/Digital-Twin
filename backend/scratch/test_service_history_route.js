require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const http = require('http');
const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { connectToMongo, getDb } = require('../src/db');
const { loadConfig } = require('../src/config');
const servicesRouter = require('../src/routes/services');

async function testServiceHistory() {
  const config = loadConfig();
  await connectToMongo(config);
  const db = getDb();

  const app = express();
  app.use(express.json());
  app.use('/api/services', servicesRouter);

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;

  // The vehicle owner for Suzuki Vitara (6a317814bab90dae448027e3)
  const ownerId = '6a317814bab90dae448027e3';
  const vehicleId = '6a3b52399161227b1916f72a';

  const token = jwt.sign(
    { sub: ownerId, role: 'USER' },
    config.jwtSecret
  );

  console.log(`Express test server listening on port ${port}...`);
  console.log(`Testing GET /api/services/${vehicleId} with owner token...`);

  try {
    const res = await axios.get(`http://localhost:${port}/api/services/${vehicleId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log('Status Code:', res.status);
    console.log(`Found ${res.data.length} services returned:`);
    console.log(JSON.stringify(res.data, null, 2));

    if (res.status === 200 && Array.isArray(res.data) && res.data.length >= 3) {
      console.log('\n🎉 ALL CHECKS PASSED: GET /api/services/:vehicle_id returned all 3 services for Suzuki Vitara!');
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

testServiceHistory().catch(e => { console.error(e); process.exit(1); });
