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

async function simulate() {
  const config = loadConfig();
  await connectToMongo(config);
  const db = getDb();

  const bookingId = "6a89193ea797a6621efcd123";
  const serviceId = "6a89193ea797a6621efcd123";

  const bookings = db.collection('bookings');
  const services = db.collection('services');
  const vehicles = db.collection('vehicles');
  const users = db.collection('users');
  const garages = db.collection('garages');

  let bookingDoc = null;
  let serviceDoc = null;
  let vehicleDoc = null;
  let customerDoc = null;
  let garageDoc = null;

  if (bookingId) {
    const bObj = toObjectId(bookingId);
    bookingDoc = bObj ? await bookings.findOne({ _id: bObj }) : await bookings.findOne({ _id: String(bookingId) });
  }

  if (serviceId) {
    const sObj = toObjectId(serviceId);
    serviceDoc = sObj ? await services.findOne({ _id: sObj }) : await services.findOne({ _id: String(serviceId) });
  }

  console.log('bookingDoc:', bookingDoc ? 'FOUND' : 'NULL');
  console.log('serviceDoc:', serviceDoc ? 'FOUND' : 'NULL');

  const vehicleId = bookingDoc?.vehicleId || serviceDoc?.vehicleId;
  console.log('vehicleId:', vehicleId);

  if (vehicleId) {
    const vObj = toObjectId(vehicleId);
    vehicleDoc = vObj ? await vehicles.findOne({ _id: vObj }) : await vehicles.findOne({ _id: String(vehicleId) });
  }
  console.log('vehicleDoc:', vehicleDoc ? 'FOUND' : 'NULL');

  const snapshotUser = bookingDoc?.snapshots?.user || {};
  const snapshotVehicle = bookingDoc?.snapshots?.vehicle || {};
  const snapshotService = bookingDoc?.snapshots?.service || {};
  const snapshotGarage = bookingDoc?.snapshots?.garage || {};

  const result = {
    success: true,
    bookingId: bookingDoc ? String(bookingDoc._id) : null,
    serviceId: serviceDoc ? String(serviceDoc._id) : null,
    vehicle: {
      id: vehicleDoc ? String(vehicleDoc._id) : (vehicleId ? String(vehicleId) : ''),
      vehicleNumber: vehicleDoc?.vehicleNumber || vehicleDoc?.registrationNumber || snapshotVehicle.vehicleNumber || 'N/A',
      brand: vehicleDoc?.brand || vehicleDoc?.make || snapshotVehicle.brand || '',
      model: vehicleDoc?.model || snapshotVehicle.model || '',
      year: vehicleDoc?.year || '',
      currentOdometerKm: vehicleDoc?.currentOdometerKm || serviceDoc?.odometerKm || 0
    },
    customer: {
      id: customerDoc ? String(customerDoc._id) : (bookingDoc?.userId ? String(bookingDoc.userId) : ''),
      name: customerDoc?.name || snapshotUser.name || 'Customer',
      phone: customerDoc?.phone || snapshotUser.phone || '',
      email: customerDoc?.email || snapshotUser.email || ''
    },
    service: {
      title: snapshotService.title || serviceDoc?.serviceType || serviceDoc?.serviceCategory || 'General Service',
      category: serviceDoc?.serviceCategory || 'Periodic Maintenance',
      price: snapshotService.price || serviceDoc?.totalAmount || 0,
      notes: bookingDoc?.notes || serviceDoc?.mechanicNotes || ''
    }
  };

  console.log('Result:', JSON.stringify(result, null, 2));
  process.exit(0);
}

simulate().catch(e => { console.error(e); process.exit(1); });
