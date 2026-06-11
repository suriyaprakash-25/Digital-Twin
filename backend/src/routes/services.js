const express = require('express');
const { ObjectId } = require('mongodb');

const { getDb } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/add', requireAuth, async (req, res) => {
  const data = req.body || {};
  const vehicleId = data.vehicleId;
  const serviceDate = data.serviceDate;
  const odometerKmRaw = data.odometerKm;
  const serviceCategory = data.serviceCategory;
  const serviceType = data.serviceType;

  if (!vehicleId || !serviceDate || odometerKmRaw === undefined || odometerKmRaw === null || !serviceCategory || !serviceType) {
    return res.status(400).json({ msg: 'Core details (vehicle, date, odometer, category, type) are required' });
  }

  let odometerKm;
  try {
    odometerKm = parseInt(odometerKmRaw, 10);
    if (Number.isNaN(odometerKm)) throw new Error('bad');
  } catch (e) {
    return res.status(400).json({ msg: 'Odometer reading must be a valid number' });
  }

  const db = getDb();
  const services = db.collection('services');
  const vehicles = db.collection('vehicles');

  const ownerId = req.user.id;
  let vehicleObjectId;
  try {
    vehicleObjectId = new ObjectId(vehicleId);
  } catch (e) {
    return res.status(400).json({ msg: 'Invalid vehicle ID' });
  }

  const vehicle = await vehicles.findOne({ _id: vehicleObjectId, ownerId });
  if (!vehicle) {
    return res.status(404).json({ msg: 'Vehicle not found or unauthorized' });
  }

  const last = await services
    .find({ vehicleId })
    .sort({ odometerKm: -1 })
    .limit(1)
    .toArray();

  let flaggedAbnormalJump = false;
  if (last && last.length > 0) {
    const lastKm = parseInt(last[0].odometerKm || 0, 10);
    if (odometerKm < lastKm) {
      return res.status(400).json({ msg: `Odometer reading (${odometerKm} km) cannot be less than previous record (${lastKm} km)` });
    }
    if (odometerKm - lastKm > 40000) {
      flaggedAbnormalJump = true;
    }
  }

  const partsReplaced = Array.isArray(data.partsReplaced) ? data.partsReplaced : [];
  let totalPartsCost = 0;
  for (const part of partsReplaced) {
    const c = part && part.cost;
    const n = typeof c === 'number' ? c : parseFloat(c || 0);
    if (!Number.isNaN(n)) totalPartsCost += n;
  }

  const laborCostNum = Number.isNaN(parseFloat(data.laborCost)) ? 0.0 : parseFloat(data.laborCost);
  const totalCost = totalPartsCost + laborCostNum;

  const newService = {
    vehicleId,
    serviceDate,
    odometerKm,
    serviceCategory,
    serviceType,

    partsReplaced,
    laborCost: laborCostNum,
    totalCost,
    warrantyMonths: data.warrantyMonths,
    mechanicNotes: data.mechanicNotes,

    garageName: data.garageName,
    location: data.location,
    verifiedService: data.verifiedService === true,

    recommendedKm: data.recommendedKm,
    recommendedDate: data.recommendedDate,

    billPhotoUrls: Array.isArray(data.billPhotoUrls) ? data.billPhotoUrls : [],

    abnormalKmJump: flaggedAbnormalJump,
    confidenceScore: flaggedAbnormalJump ? 80 : 100,
    ownerId,
    createdBy: ownerId,
    role: req.user.role || 'Vehicle Owner',
    verificationStatus: 'Pending',
    isArchived: false,
    createdAt: new Date()
  };

  try {
    await services.insertOne(newService);
    return res.status(201).json({ msg: 'Service record added successfully' });
  } catch (e) {
    return res.status(500).json({ msg: 'Error adding service record', error: String(e && e.message ? e.message : e) });
  }
});

router.get('/:vehicle_id', requireAuth, async (req, res) => {
  const vehicleId = req.params.vehicle_id;
  const db = getDb();
  const services = db.collection('services');
  const vehicles = db.collection('vehicles');

  const ownerId = req.user.id;
  let vehicleObjectId;
  try {
    vehicleObjectId = new ObjectId(vehicleId);
  } catch (e) {
    return res.status(400).json({ msg: 'Invalid vehicle ID' });
  }

  const vehicle = await vehicles.findOne({ _id: vehicleObjectId, ownerId });
  if (!vehicle) {
    return res.status(404).json({ msg: 'Vehicle not found or unauthorized' });
  }

  const cursor = services
    .find({ vehicleId, isArchived: { $ne: true } })
    .sort({ serviceDate: -1 });

  const results = [];
  for await (const s of cursor) {
    results.push({
      id: String(s._id),
      vehicleId: s.vehicleId,
      serviceDate: s.serviceDate,
      odometerKm: s.odometerKm || s.mileage,
      serviceCategory: s.serviceCategory || 'Periodic Maintenance',
      serviceType: s.serviceType,
      partsReplaced: s.partsReplaced || [],
      laborCost: s.laborCost || 0,
      totalCost: s.totalCost || s.cost,
      warrantyMonths: s.warrantyMonths,
      mechanicNotes: s.mechanicNotes,
      garageName: s.garageName,
      location: s.location,
      verifiedService: s.verifiedService === true,
      recommendedKm: s.recommendedKm,
      recommendedDate: s.recommendedDate,
      abnormalKmJump: s.abnormalKmJump || false,
      verificationStatus: s.verificationStatus || 'Pending',
      isArchived: s.isArchived || false,
      billPhotoUrls: Array.isArray(s.billPhotoUrls) ? s.billPhotoUrls : (s.billPhotoUrl ? [s.billPhotoUrl] : []),
      createdAt: s.createdAt ? new Date(s.createdAt).toISOString() : null
    });
  }

  return res.status(200).json(results);
});

// DELETE a service record
router.delete('/:service_id', requireAuth, async (req, res) => {
  const serviceId = req.params.service_id;
  const db = getDb();
  const services = db.collection('services');
  const vehicles = db.collection('vehicles');

  try {
    const serviceObjectId = new ObjectId(serviceId);
    
    // Find service to get vehicleId
    const service = await services.findOne({ _id: serviceObjectId });
    if (!service) {
      return res.status(404).json({ msg: 'Service record not found' });
    }

    // Verify ownership
    const vehicleObjectId = new ObjectId(service.vehicleId);
    const vehicle = await vehicles.findOne({ _id: vehicleObjectId, ownerId: req.user.id });
    if (!vehicle) {
      return res.status(403).json({ msg: 'Unauthorized: You do not own this vehicle' });
    }

    await services.deleteOne({ _id: serviceObjectId });
    return res.status(200).json({ msg: 'Service record deleted successfully' });
  } catch (e) {
    return res.status(500).json({ msg: 'Error deleting service record', error: String(e && e.message ? e.message : e) });
  }
});

module.exports = router;
