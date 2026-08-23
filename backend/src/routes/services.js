const express = require('express');
const { ObjectId } = require('mongodb');

const { getDb } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { generateInvoiceNumber } = require('../utils/invoiceNumber');
const { createTaxSnapshot } = require('../services/taxService');
const { toPaise, fromPaise, addPaise } = require('../utils/money');
const { logFinancialAudit } = require('../services/auditService');
const { notifyUser } = require('../services/notifications');
const { PAYMENT_STATUS } = require('../models/Payment');

const router = express.Router();

function toObjectId(id) {
  try {
    return new ObjectId(String(id));
  } catch {
    return null;
  }
}

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

  let vehicleObjectId;
  try {
    vehicleObjectId = new ObjectId(vehicleId);
  } catch (e) {
    return res.status(400).json({ msg: 'Invalid vehicle ID' });
  }

  const vehicle = await vehicles.findOne({ _id: vehicleObjectId, isArchived: { $ne: true } });
  if (!vehicle) {
    return res.status(404).json({ msg: 'Vehicle not found or unauthorized' });
  }

  if (req.user.role !== 'GARAGE' && req.user.role !== 'ADMIN' && String(vehicle.ownerId) !== req.user.id) {
    return res.status(403).json({ msg: 'Unauthorized to add service to this vehicle' });
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

  const isGarage = req.user.role === 'GARAGE';

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
    verifiedService: isGarage ? true : (data.verifiedService === true),

    recommendedKm: data.recommendedKm,
    recommendedDate: data.recommendedDate,

    billPhotoUrls: Array.isArray(data.billPhotoUrls) ? data.billPhotoUrls : [],

    abnormalKmJump: flaggedAbnormalJump,
    confidenceScore: flaggedAbnormalJump ? 80 : 100,
    ownerId: String(vehicle.ownerId),
    createdBy: req.user.id,
    role: req.user.role || 'Vehicle Owner',
    verificationStatus: isGarage ? 'Verified' : 'Pending',
    isArchived: false,
    createdAt: new Date()
  };

  try {
    await services.insertOne(newService);
    if (odometerKm > (vehicle.currentOdometerKm || 0)) {
      await vehicles.updateOne({ _id: vehicleObjectId }, { $set: { currentOdometerKm: odometerKm } });
    }
    return res.status(201).json({ msg: 'Service record added successfully' });
  } catch (e) {
    return res.status(500).json({ msg: 'Error adding service record', error: String(e && e.message ? e.message : e) });
  }
});

// GET all services for a garage
router.get('/garage/all', requireAuth, async (req, res) => {
  if (req.user.role !== 'GARAGE') {
    return res.status(403).json({ msg: 'Unauthorized: Only garages can access this endpoint' });
  }

  const { page = 1, limit = 10, search = '', category = 'ALL', sortBy = 'date', sortOrder = 'desc' } = req.query;
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const skip = (pageNum - 1) * limitNum;

  const db = getDb();
  const services = db.collection('services');

  // Match condition for the garage
  const matchCondition = {
    createdBy: req.user.id,
    isArchived: { $ne: true }
  };

  if (category !== 'ALL') {
    matchCondition.serviceCategory = category;
  }

  // Build aggregation pipeline
  const pipeline = [
    { $match: matchCondition },
    {
      $addFields: {
        vehicleObjectId: { $toObjectId: "$vehicleId" }
      }
    },
    {
      $lookup: {
        from: 'vehicles',
        localField: 'vehicleObjectId',
        foreignField: '_id',
        as: 'vehicleDetails'
      }
    },
    {
      $unwind: { path: "$vehicleDetails", preserveNullAndEmptyArrays: true }
    },
    {
      $addFields: {
        ownerObjectId: { $toObjectId: "$ownerId" }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: 'ownerObjectId',
        foreignField: '_id',
        as: 'ownerDetails'
      }
    },
    {
      $unwind: { path: "$ownerDetails", preserveNullAndEmptyArrays: true }
    }
  ];

  // Search filter
  if (search.trim() !== '') {
    const s = search.trim();
    // Use regex for case-insensitive search
    const regex = new RegExp(s, 'i');
    pipeline.push({
      $match: {
        $or: [
          { 'vehicleDetails.registrationNumber': regex },
          { 'ownerDetails.name': regex },
          { 'ownerDetails.email': regex },
          { serviceType: regex }
        ]
      }
    });
  }

  // Sorting
  let sortObj = {};
  const order = sortOrder === 'asc' ? 1 : -1;
  if (sortBy === 'cost') {
    sortObj = { totalCost: order };
  } else {
    // default date
    sortObj = { serviceDate: order };
  }
  pipeline.push({ $sort: sortObj });

  // Facet for total count and paginated data
  pipeline.push({
    $facet: {
      metadata: [{ $count: "total" }],
      data: [{ $skip: skip }, { $limit: limitNum }]
    }
  });

  try {
    const result = await services.aggregate(pipeline).toArray();
    
    // Also get overall stats for this garage
    const statsPipeline = [
      { $match: { createdBy: req.user.id, isArchived: { $ne: true } } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$totalCost" },
          totalServices: { $sum: 1 }
        }
      }
    ];
    const statsResult = await services.aggregate(statsPipeline).toArray();
    
    const totalCount = result[0].metadata.length > 0 ? result[0].metadata[0].total : 0;
    const servicesData = result[0].data.map(s => ({
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
      verificationStatus: s.verificationStatus || 'Pending',
      paymentStatus: s.paymentStatus || 'UNPAID',
      paidAt: s.paidAt ? new Date(s.paidAt).toISOString() : null,
      paymentId: s.paymentId || null,
      createdAt: s.createdAt ? new Date(s.createdAt).toISOString() : null,
      vehicle: s.vehicleDetails ? {
        make: s.vehicleDetails.make,
        model: s.vehicleDetails.model,
        registrationNumber: s.vehicleDetails.registrationNumber,
        year: s.vehicleDetails.year
      } : null,
      customer: s.ownerDetails ? {
        name: s.ownerDetails.name,
        email: s.ownerDetails.email
      } : null,
      billPhotoUrls: Array.isArray(s.billPhotoUrls) ? s.billPhotoUrls : (s.billPhotoUrl ? [s.billPhotoUrl] : []),
    }));

    const stats = statsResult.length > 0 ? statsResult[0] : { totalRevenue: 0, totalServices: 0 };

    return res.status(200).json({
      services: servicesData,
      totalCount,
      totalPages: Math.ceil(totalCount / limitNum),
      currentPage: pageNum,
      stats: {
        totalRevenue: stats.totalRevenue,
        totalServices: stats.totalServices
      }
    });
  } catch (e) {
    return res.status(500).json({ msg: 'Error fetching garage services', error: String(e && e.message ? e.message : e) });
  }
});

/**
 * GET /api/services/completion-details
 * Retrieves prefill information for completing an in-progress service/booking
 * NOTE: Placed BEFORE router.get('/:vehicle_id') so Express does not capture 'completion-details' as a vehicleId param.
 */
router.get('/completion-details', requireAuth, async (req, res) => {
  const { bookingId, serviceId } = req.query;
  if (!bookingId && !serviceId) {
    return res.status(400).json({ success: false, message: 'bookingId or serviceId is required' });
  }

  const db = getDb();
  const bookings = db.collection('bookings');
  const services = db.collection('services');
  const vehicles = db.collection('vehicles');
  const users = db.collection('users');
  const garages = db.collection('garages');

  try {
    let bookingDoc = null;
    let serviceDoc = null;
    let vehicleDoc = null;
    let customerDoc = null;
    let garageDoc = null;

    if (bookingId) {
      const bObj = toObjectId(bookingId);
      bookingDoc = await bookings.findOne({
        $or: [
          ...(bObj ? [{ _id: bObj }] : []),
          { _id: String(bookingId) },
          { id: String(bookingId) }
        ]
      });
    }

    if (serviceId) {
      const sObj = toObjectId(serviceId);
      serviceDoc = await services.findOne({
        $or: [
          ...(sObj ? [{ _id: sObj }] : []),
          { _id: String(serviceId) },
          { id: String(serviceId) }
        ]
      });
    }

    // Resolve vehicle
    const vehicleId = bookingDoc?.vehicleId || serviceDoc?.vehicleId;
    if (vehicleId) {
      const vObj = toObjectId(vehicleId);
      vehicleDoc = await vehicles.findOne({
        $or: [
          ...(vObj ? [{ _id: vObj }] : []),
          { _id: String(vehicleId) },
          { id: String(vehicleId) }
        ]
      });
    }

    // Resolve garage
    if (req.user.role === 'GARAGE') {
      garageDoc = await garages.findOne({ ownerUserId: String(req.user.id), isActive: { $ne: false } });
    }
    if (!garageDoc && bookingDoc?.garageId) {
      const gObj = toObjectId(bookingDoc.garageId);
      garageDoc = await garages.findOne({
        $or: [
          ...(gObj ? [{ _id: gObj }] : []),
          { _id: String(bookingDoc.garageId) },
          { id: String(bookingDoc.garageId) }
        ]
      });
    }

    // Resolve customer
    const customerId = bookingDoc?.userId || serviceDoc?.ownerId || vehicleDoc?.ownerId;
    if (customerId) {
      const uObj = toObjectId(customerId);
      customerDoc = await users.findOne({
        $or: [
          ...(uObj ? [{ _id: uObj }] : []),
          { uid: String(customerId) },
          { _id: String(customerId) }
        ]
      });
    }

    const snapshotUser = bookingDoc?.snapshots?.user || {};
    const snapshotVehicle = bookingDoc?.snapshots?.vehicle || {};
    const snapshotService = bookingDoc?.snapshots?.service || {};
    const snapshotGarage = bookingDoc?.snapshots?.garage || {};

    return res.status(200).json({
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
        id: customerId ? String(customerId) : '',
        name: customerDoc?.name || snapshotUser.name || 'Customer',
        phone: customerDoc?.phone || snapshotUser.phone || '',
        email: customerDoc?.email || snapshotUser.email || ''
      },
      service: {
        category: serviceDoc?.serviceCategory || 'Periodic Maintenance',
        title: serviceDoc?.serviceType || snapshotService.title || 'General Service',
        date: serviceDoc?.serviceDate || new Date().toISOString().split('T')[0],
        price: serviceDoc?.totalCost || snapshotService.price || 0,
        odometer: serviceDoc?.odometerKm || vehicleDoc?.currentOdometerKm || ''
      },
      garage: {
        id: garageDoc ? String(garageDoc._id) : '',
        name: garageDoc?.name || snapshotGarage.name || 'Authorized Service Center',
        phone: garageDoc?.phone || snapshotGarage.phone || '',
        location: garageDoc?.city || garageDoc?.address || snapshotGarage.address || ''
      }
    });
  } catch (err) {
    console.error('Error fetching completion details:', err);
    return res.status(500).json({ success: false, message: 'Failed to load service completion details' });
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

/**
 * Service completion handler
 */
async function handleCompleteService(req, res) {
  const targetServiceId = req.params?.serviceId || req.body?.serviceId;
  const bookingId = req.body?.bookingId;
  const {
    vehicleId,
    odometer,
    odometerKm,
    serviceDate,
    serviceCategory,
    serviceType,
    mechanicNotes,
    parts = [],
    partsReplaced = [],
    labour = [],
    labor = [],
    additionalCharges = [],
    discount = 0,
    discountPaise = 0,
    warrantyMonths = 0,
    recommendedKm = 0,
    recommendedDate = '',
    billPhotoUrls = []
  } = req.body || {};

  const db = getDb();
  const services = db.collection('services');
  const bookings = db.collection('bookings');
  const vehicles = db.collection('vehicles');
  const garages = db.collection('garages');
  const users = db.collection('users');
  const invoices = db.collection('invoices');
  const payments = db.collection('payments');

  try {
    // 1. Authorization: User must be GARAGE or ADMIN
    if (req.user.role !== 'GARAGE' && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Forbidden: Only authorized garages can complete services' });
    }

    // Resolve Garage
    let garage = await garages.findOne({ ownerUserId: String(req.user.id), isActive: { $ne: false } });
    if (!garage && req.user.role === 'ADMIN') {
      garage = await garages.findOne({});
    }

    // 2. Resolve Booking and Service Records
    let bookingDoc = null;
    if (bookingId) {
      const bObj = toObjectId(bookingId);
      bookingDoc = bObj ? await bookings.findOne({ _id: bObj }) : await bookings.findOne({ _id: String(bookingId) });
    }

    let serviceDoc = null;
    if (targetServiceId) {
      const sObj = toObjectId(targetServiceId);
      serviceDoc = sObj ? await services.findOne({ _id: sObj }) : await services.findOne({ _id: String(targetServiceId) });
    }

    // Idempotency check: If service already has a finalized invoice and is COMPLETED, return existing invoice
    if (serviceDoc && (serviceDoc.status === 'COMPLETED' || serviceDoc.invoiceStatus === 'FINALIZED') && serviceDoc.invoiceNumber) {
      return res.status(200).json({
        success: true,
        message: 'Service is already completed and invoice generated',
        invoiceNumber: serviceDoc.invoiceNumber,
        grandTotal: serviceDoc.totalAmount || serviceDoc.totalCost,
        grandTotalPaise: serviceDoc.grandTotalPaise || Math.round((serviceDoc.totalAmount || serviceDoc.totalCost) * 100),
        status: 'COMPLETED'
      });
    }

    // Resolve Vehicle
    const resolvedVehicleId = vehicleId || serviceDoc?.vehicleId || bookingDoc?.vehicleId;
    if (!resolvedVehicleId) {
      return res.status(400).json({ success: false, message: 'Valid vehicle ID is required' });
    }
    const vObj = toObjectId(resolvedVehicleId);
    const vehicle = vObj ? await vehicles.findOne({ _id: vObj }) : await vehicles.findOne({ _id: String(resolvedVehicleId) });
    if (!vehicle) {
      return res.status(404).json({ success: false, message: 'Vehicle not found' });
    }

    // Resolve Customer ID
    const customerId = vehicle.ownerId || bookingDoc?.userId || serviceDoc?.ownerId;
    let customerUser = null;
    if (customerId) {
      const uObj = toObjectId(customerId);
      customerUser = uObj ? await users.findOne({ _id: uObj }) : await users.findOne({ $or: [{ uid: String(customerId) }, { _id: String(customerId) }] });
    }

    // 3. Authoritative Line Item Calculations in Integer Paise
    const allParts = parts.length > 0 ? parts : partsReplaced;
    let totalPartsPaise = 0;
    const normalizedParts = (Array.isArray(allParts) ? allParts : []).map(p => {
      const name = String(p.partName || p.name || 'Replaced Part').trim();
      const desc = String(p.description || p.brand || '').trim();
      const qty = Math.max(1, parseInt(p.quantity, 10) || 1);
      const rawPrice = p.unitPrice !== undefined ? p.unitPrice : (p.cost !== undefined ? p.cost : (p.unitPricePaise ? (p.unitPricePaise / 100) : 0));
      const unitPriceNum = Math.max(0, parseFloat(rawPrice) || 0);
      const unitPricePaise = toPaise(unitPriceNum);
      const lineTotalPaise = qty * unitPricePaise;
      totalPartsPaise = addPaise(totalPartsPaise, lineTotalPaise);
      return {
        partName: name,
        description: desc,
        quantity: qty,
        unitPrice: fromPaise(unitPricePaise),
        unitPricePaise,
        total: fromPaise(lineTotalPaise),
        totalPaise: lineTotalPaise
      };
    });

    const allLabour = labour.length > 0 ? labour : (labor.length > 0 ? labor : (req.body.laborCost ? [{ description: 'Labour Charges', quantity: 1, rate: req.body.laborCost }] : []));
    let totalLabourPaise = 0;
    const normalizedLabour = (Array.isArray(allLabour) ? allLabour : []).map(l => {
      const desc = String(l.description || 'Labour Service').trim();
      const qty = Math.max(1, parseFloat(l.quantity !== undefined ? l.quantity : (l.hours || 1)) || 1);
      const rawRate = l.rate !== undefined ? l.rate : (l.cost !== undefined ? l.cost : (l.ratePaise ? (l.ratePaise / 100) : 0));
      const rateNum = Math.max(0, parseFloat(rawRate) || 0);
      const ratePaise = toPaise(rateNum);
      const lineTotalPaise = Math.round(qty * ratePaise);
      totalLabourPaise = addPaise(totalLabourPaise, lineTotalPaise);
      return {
        description: desc,
        quantity: qty,
        hours: qty,
        rate: fromPaise(ratePaise),
        ratePaise,
        total: fromPaise(lineTotalPaise),
        totalPaise: lineTotalPaise
      };
    });

    let totalAdditionalPaise = 0;
    const normalizedAdditional = (Array.isArray(additionalCharges) ? additionalCharges : []).map(c => {
      const desc = String(c.description || 'Additional Charge').trim();
      const rawAmt = c.amount !== undefined ? c.amount : (c.amountPaise ? (c.amountPaise / 100) : 0);
      const amtNum = Math.max(0, parseFloat(rawAmt) || 0);
      const amtPaise = toPaise(amtNum);
      totalAdditionalPaise = addPaise(totalAdditionalPaise, amtPaise);
      return {
        description: desc,
        amount: fromPaise(amtPaise),
        amountPaise: amtPaise
      };
    });

    const subtotalPaise = addPaise(totalPartsPaise, totalLabourPaise, totalAdditionalPaise);
    const rawDiscount = discount !== undefined && discount !== 0 ? discount : (discountPaise ? (discountPaise / 100) : 0);
    const discountNum = Math.max(0, parseFloat(rawDiscount) || 0);
    const requestedDiscountPaise = toPaise(discountNum);
    const finalDiscountPaise = Math.min(subtotalPaise, requestedDiscountPaise);
    const taxablePaise = Math.max(0, subtotalPaise - finalDiscountPaise);

    // 4. Server-Side Tax Calculation via taxService (18% GST CGST/SGST/IGST Snapshot)
    const taxSnapshot = await createTaxSnapshot({
      amountPaise: taxablePaise,
      sellerState: garage?.stateCode || 'KA',
      buyerState: vehicle?.stateCode || 'KA',
      sellerGstin: garage?.gstin || null,
      buyerGstin: vehicle?.gstin || null,
      serviceCategory: serviceCategory || 'AUTOMOTIVE_SERVICE',
      dbInstance: db
    });

    const grandTotalPaise = taxablePaise + taxSnapshot.totalTaxPaise;
    const grandTotalAmount = fromPaise(grandTotalPaise);
    const subtotalAmount = fromPaise(subtotalPaise);
    const finalDiscountAmount = fromPaise(finalDiscountPaise);

    // 5. Generate Atomic Unique Invoice Number
    const invoiceNumber = await generateInvoiceNumber(db);
    const finalOdometer = parseInt(odometer !== undefined ? odometer : (odometerKm || vehicle.currentOdometerKm || 0), 10) || 0;

    // 6. Record or Update Service Document
    const servicePayload = {
      vehicleId: String(vehicle._id),
      serviceDate: serviceDate || new Date().toISOString().split('T')[0],
      odometerKm: finalOdometer,
      serviceCategory: serviceCategory || 'Periodic Maintenance',
      serviceType: serviceType || bookingDoc?.snapshots?.service?.title || 'Comprehensive Maintenance',
      mechanicNotes: mechanicNotes || '',
      status: 'COMPLETED',
      invoiceNumber,
      invoiceStatus: 'FINALIZED',
      paymentStatus: 'UNPAID',
      partsReplaced: normalizedParts,
      laborCharges: normalizedLabour,
      laborCost: fromPaise(totalLabourPaise),
      additionalCharges: normalizedAdditional,
      subtotalAmount,
      subtotalPaise,
      discountAmount: finalDiscountAmount,
      discountPaise: finalDiscountPaise,
      taxableAmount: fromPaise(taxablePaise),
      taxablePaise,
      taxSnapshot,
      taxAmount: taxSnapshot.totalTaxAmount,
      taxAmountPaise: taxSnapshot.totalTaxPaise,
      totalCost: grandTotalAmount,
      totalAmount: grandTotalAmount,
      grandTotalPaise,
      warrantyMonths: parseInt(warrantyMonths, 10) || 0,
      recommendedKm: parseInt(recommendedKm, 10) || 0,
      recommendedDate: recommendedDate || '',
      billPhotoUrls: Array.isArray(billPhotoUrls) ? billPhotoUrls : [],
      garageId: garage ? String(garage._id) : null,
      garageName: garage?.name || 'Authorized Service Center',
      ownerId: customerId ? String(customerId) : String(vehicle.ownerId),
      createdBy: String(req.user.id),
      isArchived: false,
      completedAt: new Date(),
      updatedAt: new Date()
    };

    let serviceRecordId;
    if (serviceDoc) {
      await services.updateOne({ _id: serviceDoc._id }, { $set: servicePayload });
      serviceRecordId = String(serviceDoc._id);
    } else {
      servicePayload.createdAt = new Date();
      const insRes = await services.insertOne(servicePayload);
      serviceRecordId = String(insRes.insertedId);
    }

    // Update vehicle odometer if higher
    if (finalOdometer > (vehicle.currentOdometerKm || 0)) {
      await vehicles.updateOne({ _id: vehicle._id }, { $set: { currentOdometerKm: finalOdometer } });
    }

    // 7. Update Booking Document (removes from In-Progress queue)
    if (bookingDoc) {
      await bookings.updateOne(
        { _id: bookingDoc._id },
        {
          $set: {
            status: 'COMPLETED',
            serviceId: serviceRecordId,
            invoiceNumber,
            updatedAt: new Date()
          },
          $push: {
            timeline: { status: 'COMPLETED', at: new Date(), by: 'GARAGE' }
          }
        }
      );
    }

    // 8. Upsert Invoice Document in `invoices` collection
    const invoiceDoc = {
      invoiceNumber,
      serviceId: serviceRecordId,
      bookingId: bookingDoc ? String(bookingDoc._id) : null,
      customerId: customerId ? String(customerId) : '',
      customerName: customerUser?.name || 'Customer',
      garageId: garage ? String(garage._id) : null,
      garageName: garage?.name || 'Authorized Service Center',
      vehicleId: String(vehicle._id),
      vehicleNumber: vehicle.vehicleNumber || vehicle.registrationNumber || 'N/A',
      vehicleBrand: vehicle.brand || vehicle.make || '',
      vehicleModel: vehicle.model || '',
      parts: normalizedParts,
      labour: normalizedLabour,
      additionalCharges: normalizedAdditional,
      subtotalAmount,
      subtotalPaise,
      discountAmount: finalDiscountAmount,
      discountPaise: finalDiscountPaise,
      taxSnapshot,
      grandTotalAmount,
      grandTotalPaise,
      status: 'UNPAID',
      paymentStatus: 'UNPAID',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    await invoices.updateOne({ invoiceNumber }, { $set: invoiceDoc }, { upsert: true });

    // 9. Prepare Pending Payment Document in `payments` collection
    const paymentDoc = {
      invoiceId: serviceRecordId,
      invoiceNumber,
      serviceId: serviceRecordId,
      vehicleId: String(vehicle._id),
      vehicleNumber: vehicle.vehicleNumber || vehicle.registrationNumber || 'N/A',
      userId: customerId ? String(customerId) : '',
      garageId: garage ? String(garage._id) : null,
      garageName: garage?.name || 'Authorized Service Center',
      serviceType: servicePayload.serviceType,
      amount: grandTotalAmount,
      amountPaise: grandTotalPaise,
      currency: 'INR',
      status: PAYMENT_STATUS.PENDING,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    await payments.updateOne(
      { invoiceNumber },
      { $set: paymentDoc },
      { upsert: true }
    );

    // 10. Financial Audit Log
    try {
      await logFinancialAudit({
        actorId: String(req.user.id),
        actorRole: 'GARAGE',
        action: 'SERVICE_COMPLETED',
        resourceType: 'SERVICE',
        resourceId: serviceRecordId,
        afterState: { invoiceNumber, grandTotal: grandTotalAmount, grandTotalPaise },
        req,
        dbInstance: db
      });
      await logFinancialAudit({
        actorId: String(req.user.id),
        actorRole: 'GARAGE',
        action: 'INVOICE_FINALIZED',
        resourceType: 'INVOICE',
        resourceId: invoiceNumber,
        afterState: { invoiceNumber, subtotalAmount, grandTotalAmount, taxSnapshot },
        req,
        dbInstance: db
      });
    } catch (auditErr) {
      console.warn('Audit logging warning:', auditErr.message);
    }

    // 11. Customer Notification (In-App & Email)
    if (customerId) {
      try {
        await notifyUser(String(customerId), {
          title: '🔔 Service Completed',
          body: `Your ${vehicle.brand || vehicle.make || 'vehicle'} (${vehicle.vehicleNumber || 'Vehicle'}) service is completed. Invoice ${invoiceNumber} for ₹${grandTotalAmount.toFixed(2)} is ready for payment.`,
          data: {
            type: 'SERVICE_COMPLETED',
            invoiceId: serviceRecordId,
            serviceId: serviceRecordId,
            invoiceNumber,
            vehicleId: String(vehicle._id),
            amount: grandTotalAmount,
            url: '/payments'
          }
        });
      } catch (notifErr) {
        console.warn('Customer notification warning:', notifErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Service completed and invoice generated successfully',
      invoiceNumber,
      serviceId: serviceRecordId,
      subtotal: subtotalAmount,
      tax: taxSnapshot.totalTaxAmount,
      grandTotal: grandTotalAmount,
      grandTotalPaise,
      taxSnapshot,
      paymentStatus: 'UNPAID',
      status: 'COMPLETED'
    });
  } catch (err) {
    console.error('Error completing service:', err);
    return res.status(500).json({
      success: false,
      message: 'Unable to complete service: ' + (err.message || 'Internal server error')
    });
  }
}

router.post('/complete', requireAuth, handleCompleteService);
router.post('/:serviceId/complete', requireAuth, handleCompleteService);

module.exports = router;
