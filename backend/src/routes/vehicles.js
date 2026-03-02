const express = require('express');
const { ObjectId } = require('mongodb');

const { getDb } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { upload, removeUploadByUrl } = require('../utils/uploads');
const { parseAnyDate, isPastDateOnly } = require('../utils/dates');

const router = express.Router();

router.post('/add', requireAuth, upload.single('rcBook'), async (req, res) => {
  const data = req.body || {};

  const vehicleNumber = data.vehicleNumber;
  const model = data.model;
  const year = data.year;
  const fuelType = data.fuelType;

  if (!vehicleNumber || !model || !year || !fuelType) {
    return res.status(400).json({ msg: 'Vehicle number, model, year, and fuel type are required' });
  }

  // Validations
  let yearInt;
  try {
    yearInt = parseInt(year, 10);
    const currentYear = new Date().getFullYear();
    if (Number.isNaN(yearInt) || yearInt < 1900 || yearInt > currentYear + 1) {
      return res.status(400).json({ msg: 'Manufacturing year must be a valid year' });
    }

    const now = new Date();
    const nowUtc = require('luxon').DateTime.fromJSDate(now, { zone: 'utc' });
    const toCheck = [
      { value: data.insuranceExpiry, name: 'Insurance Expiry' },
      { value: data.pucExpiry, name: 'PUC Expiry' },
      { value: data.rcExpiry, name: 'RC Expiry' },
      { value: data.roadTaxValidTill, name: 'Road Tax Valid Till' },
      { value: data.fitnessExpiry, name: 'Fitness Expiry' }
    ];
    for (const item of toCheck) {
      if (item.value) {
        const parsed = parseAnyDate(item.value);
        if (parsed && isPastDateOnly(parsed, nowUtc)) {
          return res.status(400).json({ msg: `${item.name} must be a future date` });
        }
      }
    }
  } catch (e) {
    return res.status(400).json({ msg: 'Invalid date or number format' });
  }

  const db = getDb();
  const vehicles = db.collection('vehicles');

  const existing = await vehicles.findOne({ vehicleNumber });
  if (existing) {
    if (req.file) {
      removeUploadByUrl(`/uploads/${req.file.filename}`);
    }
    return res.status(400).json({ msg: 'Vehicle with this number already exists' });
  }

  const ownerId = req.user.id;
  const rcBookUrl = req.file ? `/uploads/${req.file.filename}` : null;

  const newVehicle = {
    vehicleNumber,
    brand: data.brand,
    model,
    variant: data.variant,
    vehicleType: data.vehicleType,
    fuelType,
    color: data.color,
    manufacturingYear: yearInt,
    registrationDate: data.registrationDate,
    registeredRTO: data.registeredRTO,

    ownerName: data.ownerName,
    phone: data.phone,
    ownershipCount: data.ownershipCount ? parseInt(data.ownershipCount, 10) : 1,
    purchaseDate: data.purchaseDate,
    purchasePrice: data.purchasePrice ? parseFloat(data.purchasePrice) : null,

    insuranceProvider: data.insuranceProvider,
    insuranceExpiry: data.insuranceExpiry,
    pucExpiry: data.pucExpiry,
    rcExpiry: data.rcExpiry,
    roadTaxValidTill: data.roadTaxValidTill,
    fitnessExpiry: data.fitnessExpiry,

    chassisNumber: data.chassisNumber,
    engineNumber: data.engineNumber,
    rcBookUrl,

    currentOdometerKm: data.currentOdometerKm ? parseInt(data.currentOdometerKm, 10) : 0,
    averageMonthlyKm: data.averageMonthlyKm ? parseInt(data.averageMonthlyKm, 10) : 0,

    ownerId,
    createdBy: ownerId,
    role: req.user.role || 'Vehicle Owner',
    verificationStatus: 'Pending',
    isArchived: false,
    createdAt: new Date()
  };

  try {
    await vehicles.insertOne(newVehicle);
    return res.status(201).json({ msg: 'Vehicle added successfully' });
  } catch (e) {
    return res.status(500).json({ msg: 'Error adding vehicle', error: String(e && e.message ? e.message : e) });
  }
});

router.get('/myvehicles', requireAuth, async (req, res) => {
  const db = getDb();
  const vehicles = db.collection('vehicles');

  const cursor = vehicles.find({ ownerId: req.user.id, isArchived: { $ne: true } });
  const results = [];

  for await (const v of cursor) {
    results.push({
      id: String(v._id),
      vehicleNumber: v.vehicleNumber,
      brand: v.brand,
      model: v.model,
      variant: v.variant,
      vehicleType: v.vehicleType,
      year: v.manufacturingYear || v.year,
      fuelType: v.fuelType,
      color: v.color,
      registrationDate: v.registrationDate,
      registeredRTO: v.registeredRTO,
      ownerName: v.ownerName,
      phone: v.phone,
      ownershipCount: v.ownershipCount,
      purchaseDate: v.purchaseDate,
      purchasePrice: v.purchasePrice,
      insuranceProvider: v.insuranceProvider,
      insuranceExpiry: v.insuranceExpiry,
      pucExpiry: v.pucExpiry,
      rcExpiry: v.rcExpiry,
      roadTaxValidTill: v.roadTaxValidTill,
      fitnessExpiry: v.fitnessExpiry,
      chassisNumber: v.chassisNumber,
      engineNumber: v.engineNumber,
      currentOdometerKm: v.currentOdometerKm,
      averageMonthlyKm: v.averageMonthlyKm,
      ownerId: v.ownerId,
      rcBookUrl: v.rcBookUrl,
      verificationStatus: v.verificationStatus || 'Pending',
      isArchived: v.isArchived || false,
      createdAt: v.createdAt ? new Date(v.createdAt).toISOString() : null
    });
  }

  return res.status(200).json(results);
});

router.put('/:vehicle_id', requireAuth, upload.single('rcBook'), async (req, res) => {
  const vehicleId = req.params.vehicle_id;

  let objectId;
  try {
    objectId = new ObjectId(vehicleId);
  } catch (e) {
    return res.status(400).json({ msg: 'Error updating vehicle', error: 'Invalid vehicle ID' });
  }

  const data = req.body || {};
  const updateData = {};

  const directKeys = [
    'vehicleNumber',
    'brand',
    'model',
    'variant',
    'vehicleType',
    'fuelType',
    'color',
    'registrationDate',
    'registeredRTO',
    'ownerName',
    'phone',
    'purchaseDate',
    'insuranceProvider',
    'insuranceExpiry',
    'pucExpiry',
    'rcExpiry',
    'roadTaxValidTill',
    'fitnessExpiry',
    'chassisNumber',
    'engineNumber'
  ];

  for (const key of directKeys) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      updateData[key] = data[key];
    }
  }

  if (data.year) updateData.manufacturingYear = parseInt(data.year, 10);
  if (data.ownershipCount) updateData.ownershipCount = parseInt(data.ownershipCount, 10);
  if (data.purchasePrice) updateData.purchasePrice = parseFloat(data.purchasePrice);
  if (data.currentOdometerKm) updateData.currentOdometerKm = parseInt(data.currentOdometerKm, 10);
  if (data.averageMonthlyKm) updateData.averageMonthlyKm = parseInt(data.averageMonthlyKm, 10);

  const db = getDb();
  const vehicles = db.collection('vehicles');

  try {
    const vehicle = await vehicles.findOne({ _id: objectId, ownerId: req.user.id, isArchived: { $ne: true } });
    if (!vehicle) {
      if (req.file) removeUploadByUrl(`/uploads/${req.file.filename}`);
      return res.status(404).json({ msg: 'Vehicle not found or unauthorized' });
    }

    const nextVehicleNumber = updateData.vehicleNumber;
    if (nextVehicleNumber && nextVehicleNumber !== vehicle.vehicleNumber) {
      const conflict = await vehicles.findOne({ vehicleNumber: nextVehicleNumber });
      if (conflict) {
        if (req.file) removeUploadByUrl(`/uploads/${req.file.filename}`);
        return res.status(400).json({ msg: 'Vehicle with this number already exists' });
      }
    }

    if (req.file) {
      if (vehicle.rcBookUrl) {
        removeUploadByUrl(vehicle.rcBookUrl);
      }
      updateData.rcBookUrl = `/uploads/${req.file.filename}`;
    }

    if (Object.keys(updateData).length > 0) {
      await vehicles.updateOne({ _id: objectId }, { $set: updateData });
    }

    return res.status(200).json({ msg: 'Vehicle updated successfully' });
  } catch (e) {
    return res.status(500).json({ msg: 'Error updating vehicle', error: String(e && e.message ? e.message : e) });
  }
});

router.delete('/:vehicle_id', requireAuth, async (req, res) => {
  const vehicleId = req.params.vehicle_id;
  let objectId;
  try {
    objectId = new ObjectId(vehicleId);
  } catch (e) {
    return res.status(500).json({ msg: 'Error archiving vehicle', error: 'Invalid vehicle ID' });
  }

  const db = getDb();
  const vehicles = db.collection('vehicles');
  const services = db.collection('services');

  try {
    const vehicle = await vehicles.findOne({ _id: objectId, ownerId: req.user.id });
    if (!vehicle) {
      return res.status(404).json({ msg: 'Vehicle not found or unauthorized' });
    }

    await services.updateMany({ vehicleId: vehicleId }, { $set: { isArchived: true } });
    await vehicles.updateOne({ _id: objectId }, { $set: { isArchived: true } });

    return res.status(200).json({ msg: 'Vehicle archived successfully' });
  } catch (e) {
    return res.status(500).json({ msg: 'Error archiving vehicle', error: String(e && e.message ? e.message : e) });
  }
});

module.exports = router;
