require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { connectToMongo, getDb } = require('../src/db');
const { loadConfig } = require('../src/config');
const { ObjectId } = require('mongodb');

async function inspectVehicleServices() {
  const config = loadConfig();
  await connectToMongo(config);
  const db = getDb();

  const vehicleId = "6a3b52399161227b1916f72a";
  const vObj = new ObjectId(vehicleId);

  const vehicle = await db.collection('vehicles').findOne({
    $or: [{ _id: vObj }, { _id: vehicleId }]
  });
  console.log('Vehicle in DB:', vehicle);

  const services = await db.collection('services').find({
    $or: [
      { vehicleId: vehicleId },
      { vehicleId: vObj },
      { vehicle_id: vehicleId },
      { 'vehicle.id': vehicleId }
    ]
  }).toArray();

  console.log(`Found ${services.length} services for vehicle ${vehicleId}:`);
  console.log(JSON.stringify(services, null, 2));

  process.exit(0);
}

inspectVehicleServices().catch(e => { console.error(e); process.exit(1); });
