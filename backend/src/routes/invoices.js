const express = require('express');
const { ObjectId } = require('mongodb');
const { getDb } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { generateInvoiceNumber } = require('../utils/invoiceNumber');
const { PAYMENT_STATUS } = require('../models/Payment');

const router = express.Router();

function toObjectId(id) {
  try {
    return new ObjectId(String(id));
  } catch {
    return null;
  }
}

/**
 * Helper to calculate authoritative totals from invoice line items
 */
function calculateInvoiceTotals(data = {}) {
  const parts = Array.isArray(data.partsReplaced) ? data.partsReplaced : [];
  let partsAmount = 0;

  const normalizedParts = parts.map(p => {
    const qty = Math.max(1, parseInt(p.quantity, 10) || 1);
    const unitPrice = Math.max(0, parseFloat(p.unitPrice !== undefined ? p.unitPrice : (p.cost || 0)) || 0);
    const cost = qty * unitPrice;
    partsAmount += cost;
    return {
      partName: String(p.partName || 'Service Part').trim(),
      brand: p.brand ? String(p.brand).trim() : '',
      quantity: qty,
      unitPrice,
      cost
    };
  });

  const laborAmount = Math.max(0, parseFloat(data.laborAmount !== undefined ? data.laborAmount : (data.laborCost || 0)) || 0);
  const additionalCharges = Math.max(0, parseFloat(data.additionalCharges || 0) || 0);
  const subtotal = partsAmount + laborAmount + additionalCharges;
  const discountAmount = Math.min(subtotal, Math.max(0, parseFloat(data.discountAmount || 0) || 0));
  const taxAmount = Math.max(0, parseFloat(data.taxAmount || 0) || 0);
  const totalAmount = Math.max(0, subtotal - discountAmount + taxAmount);

  return {
    partsReplaced: normalizedParts,
    partsAmount,
    laborAmount,
    additionalCharges,
    discountAmount,
    taxAmount,
    subtotal,
    totalAmount
  };
}

/**
 * GET /api/invoices/:serviceId
 * Returns detailed invoice for vehicle owner, garage, or admin
 */
router.get('/:serviceId', requireAuth, async (req, res) => {
  const { serviceId } = req.params;
  const db = getDb();
  const services = db.collection('services');
  const vehicles = db.collection('vehicles');
  const garages = db.collection('garages');
  const users = db.collection('users');

  try {
    const sId = toObjectId(serviceId);
    const serviceQuery = sId
      ? { $or: [{ _id: sId }, { id: String(serviceId) }, { invoiceNumber: String(serviceId) }] }
      : { $or: [{ _id: String(serviceId) }, { id: String(serviceId) }, { invoiceNumber: String(serviceId) }] };

    let service = await services.findOne({ ...serviceQuery, isArchived: { $ne: true } });

    if (!service) {
      // Check in invoices collection as fallback
      const invCol = db.collection('invoices');
      const invDoc = await invCol.findOne(serviceQuery);
      if (invDoc && invDoc.serviceId) {
        const sObj = toObjectId(invDoc.serviceId);
        service = sObj ? await services.findOne({ _id: sObj }) : await services.findOne({ _id: String(invDoc.serviceId) });
      }
    }

    if (!service) {
      return res.status(404).json({ success: false, message: 'Invoice / Service record not found' });
    }

    // Vehicle lookup
    const vId = toObjectId(service.vehicleId);
    const vehicle = vId
      ? await vehicles.findOne({ _id: vId, isArchived: { $ne: true } })
      : await vehicles.findOne({ id: String(service.vehicleId), isArchived: { $ne: true } });

    // Authorization: Must be vehicle owner, garage creator, or admin
    const isOwner = (vehicle && String(vehicle.ownerId) === String(req.user.id)) ||
                    (service.ownerId && String(service.ownerId) === String(req.user.id)) ||
                    (service.createdBy && String(service.createdBy) === String(req.user.id)) ||
                    (req.user.role === 'ADMIN');

    if (!isOwner) {
      return res.status(403).json({ success: false, message: 'Forbidden: Unauthorized to access this invoice' });
    }

    // Garage profile lookup
    let garage = null;
    if (service.createdBy) {
      garage = await garages.findOne({ ownerUserId: String(service.createdBy), isActive: { $ne: false } });
    }
    if (!garage && service.garageId) {
      const gId = toObjectId(service.garageId);
      if (gId) garage = await garages.findOne({ _id: gId });
    }

    // Customer profile lookup
    const customerId = vehicle ? vehicle.ownerId : service.ownerId;
    let customer = null;
    if (customerId) {
      const uId = toObjectId(customerId);
      const userDoc = uId ? await users.findOne({ _id: uId }) : await users.findOne({ uid: String(customerId) });
      if (userDoc) {
        customer = {
          name: userDoc.name || 'Vehicle Owner',
          email: userDoc.email || '',
          phone: userDoc.phone || ''
        };
      }
    }

    const totals = calculateInvoiceTotals(service);

    const invoiceData = {
      id: String(service._id),
      invoiceNumber: service.invoiceNumber || `DP-INV-2026-${String(service._id).slice(-6).toUpperCase()}`,
      invoiceStatus: service.invoiceStatus || (service.paymentStatus === 'PAID' ? 'FINALIZED' : 'FINALIZED'),
      paymentStatus: service.paymentStatus || 'UNPAID',
      serviceDate: service.serviceDate,
      serviceCategory: service.serviceCategory || 'Periodic Maintenance',
      serviceType: service.serviceType || 'Automotive Service',
      mechanicNotes: service.mechanicNotes || '',
      partsReplaced: service.partsReplaced || totals.partsReplaced,
      partsAmount: service.partsAmount !== undefined ? service.partsAmount : totals.partsAmount,
      laborCharges: service.laborCharges || [],
      laborAmount: service.laborAmount !== undefined ? service.laborAmount : (service.laborCost || totals.laborAmount),
      additionalCharges: service.additionalCharges || totals.additionalCharges,
      discountAmount: service.discountAmount !== undefined ? service.discountAmount : totals.discountAmount,
      taxableAmount: service.taxableAmount !== undefined ? service.taxableAmount : (totals.subtotal - totals.discountAmount),
      taxAmount: service.taxAmount !== undefined ? service.taxAmount : totals.taxAmount,
      taxSnapshot: service.taxSnapshot || null,
      subtotal: service.subtotalAmount !== undefined ? service.subtotalAmount : totals.subtotal,
      totalAmount: service.totalAmount !== undefined ? service.totalAmount : (service.totalCost || totals.totalAmount),
      paidAt: service.paidAt,
      paymentId: service.paymentId,
      paymentMethod: service.paymentMethod,
      razorpayOrderId: service.razorpayOrderId,
      garage: {
        name: garage?.name || service.garageName || 'Authorized Service Center',
        address: garage?.address || service.location || '',
        phone: garage?.phone || '',
        city: garage?.city || ''
      },
      vehicle: vehicle ? {
        id: String(vehicle._id),
        brand: vehicle.brand,
        model: vehicle.model,
        registrationNumber: vehicle.vehicleNumber || vehicle.registrationNumber,
        year: vehicle.year
      } : null,
      customer: customer || { name: 'Vehicle Owner', email: '', phone: '' },
      billPhotoUrls: Array.isArray(service.billPhotoUrls) ? service.billPhotoUrls : (service.billPhotoUrl ? [service.billPhotoUrl] : []),
      createdAt: service.createdAt,
      invoiceFinalizedAt: service.invoiceFinalizedAt
    };

    return res.status(200).json({ success: true, invoice: invoiceData });
  } catch (err) {
    console.error('Error fetching invoice:', err);
    return res.status(500).json({ success: false, message: 'Server error loading invoice details' });
  }
});

/**
 * GET /api/invoices/:serviceId/receipt
 * Returns verified receipt data for paid invoices
 */
router.get('/:serviceId/receipt', requireAuth, async (req, res) => {
  const { serviceId } = req.params;
  const db = getDb();
  const services = db.collection('services');
  const payments = db.collection('payments');
  const vehicles = db.collection('vehicles');
  const garages = db.collection('garages');
  const users = db.collection('users');

  try {
    const sId = toObjectId(serviceId);
    const service = sId
      ? await services.findOne({ _id: sId, isArchived: { $ne: true } })
      : await services.findOne({ id: serviceId, isArchived: { $ne: true } });

    if (!service) {
      return res.status(404).json({ success: false, message: 'Service invoice not found' });
    }

    if (service.paymentStatus !== 'PAID') {
      return res.status(400).json({ success: false, message: 'Receipt is only available for paid invoices' });
    }

    // Vehicle lookup
    const vId = toObjectId(service.vehicleId);
    const vehicle = vId
      ? await vehicles.findOne({ _id: vId, isArchived: { $ne: true } })
      : await vehicles.findOne({ id: String(service.vehicleId), isArchived: { $ne: true } });

    // Authorization
    const isOwner = (vehicle && String(vehicle.ownerId) === String(req.user.id)) ||
                    (service.ownerId && String(service.ownerId) === String(req.user.id)) ||
                    (service.createdBy && String(service.createdBy) === String(req.user.id)) ||
                    (req.user.role === 'ADMIN');

    if (!isOwner) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    // Payment record lookup
    const payment = await payments.findOne({
      $or: [
        { serviceId: String(service._id) },
        { invoiceId: String(service._id) },
        { razorpayPaymentId: service.paymentId }
      ]
    });

    let garage = null;
    if (service.createdBy) {
      garage = await garages.findOne({ ownerUserId: String(service.createdBy), isActive: { $ne: false } });
    }

    const customerId = vehicle ? vehicle.ownerId : service.ownerId;
    let customer = null;
    if (customerId) {
      const uId = toObjectId(customerId);
      const userDoc = uId ? await users.findOne({ _id: uId }) : await users.findOne({ uid: String(customerId) });
      if (userDoc) {
        customer = {
          name: userDoc.name || 'Vehicle Owner',
          email: userDoc.email || '',
          phone: userDoc.phone || ''
        };
      }
    }

    return res.status(200).json({
      success: true,
      receipt: {
        receiptNumber: `REC-${String(service._id).slice(-8).toUpperCase()}`,
        invoiceNumber: service.invoiceNumber || `DP-INV-2026-${String(service._id).slice(-6).toUpperCase()}`,
        paymentId: service.paymentId || payment?.razorpayPaymentId || 'VERIFIED',
        orderId: service.razorpayOrderId || payment?.razorpayOrderId,
        amount: service.totalAmount !== undefined ? service.totalAmount : service.totalCost,
        currency: 'INR',
        paymentMethod: service.paymentMethod || payment?.paymentMethod || 'Online (Razorpay)',
        paidAt: service.paidAt || payment?.paidAt || new Date(),
        serviceType: service.serviceType,
        garage: {
          name: garage?.name || service.garageName || 'Authorized Service Center',
          address: garage?.address || service.location || '',
          phone: garage?.phone || ''
        },
        vehicle: vehicle ? {
          brand: vehicle.brand,
          model: vehicle.model,
          registrationNumber: vehicle.vehicleNumber || vehicle.registrationNumber
        } : null,
        customer: customer || { name: 'Vehicle Owner', email: '' }
      }
    });
  } catch (err) {
    console.error('Error loading receipt:', err);
    return res.status(500).json({ success: false, message: 'Server error loading receipt' });
  }
});

/**
 * GET /api/garage/invoices
 * Lists all invoices for the authenticated garage
 */
router.get('/garage/all', requireAuth, requireRole('GARAGE'), async (req, res) => {
  const { page = 1, limit = 15, search = '', status = 'ALL' } = req.query;
  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 15;
  const skip = (pageNum - 1) * limitNum;

  const db = getDb();
  const services = db.collection('services');

  try {
    const matchCondition = {
      createdBy: String(req.user.id),
      isArchived: { $ne: true }
    };

    if (status === 'UNPAID') matchCondition.paymentStatus = { $ne: 'PAID' };
    else if (status === 'PAID') matchCondition.paymentStatus = 'PAID';
    else if (status === 'DRAFT') matchCondition.invoiceStatus = 'DRAFT';
    else if (status === 'FINALIZED') matchCondition.invoiceStatus = 'FINALIZED';
    else if (status === 'CANCELLED') matchCondition.invoiceStatus = 'CANCELLED';

    const pipeline = [
      { $match: matchCondition },
      {
        $addFields: {
          vehicleObjectId: { $toObjectId: "$vehicleId" },
          ownerObjectId: { $toObjectId: "$ownerId" }
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
      { $unwind: { path: "$vehicleDetails", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'users',
          localField: 'ownerObjectId',
          foreignField: '_id',
          as: 'ownerDetails'
        }
      },
      { $unwind: { path: "$ownerDetails", preserveNullAndEmptyArrays: true } }
    ];

    if (search && search.trim() !== '') {
      const regex = new RegExp(search.trim(), 'i');
      pipeline.push({
        $match: {
          $or: [
            { invoiceNumber: regex },
            { 'vehicleDetails.registrationNumber': regex },
            { 'vehicleDetails.vehicleNumber': regex },
            { 'ownerDetails.name': regex },
            { serviceType: regex }
          ]
        }
      });
    }

    pipeline.push({ $sort: { createdAt: -1 } });
    pipeline.push({
      $facet: {
        metadata: [{ $count: "total" }],
        data: [{ $skip: skip }, { $limit: limitNum }]
      }
    });

    const result = await services.aggregate(pipeline).toArray();
    const totalCount = result[0].metadata.length > 0 ? result[0].metadata[0].total : 0;

    const invoices = result[0].data.map(s => ({
      id: String(s._id),
      invoiceNumber: s.invoiceNumber || `DP-INV-2026-${String(s._id).slice(-6).toUpperCase()}`,
      invoiceStatus: s.invoiceStatus || (s.paymentStatus === 'PAID' ? 'FINALIZED' : 'FINALIZED'),
      paymentStatus: s.paymentStatus || 'UNPAID',
      serviceDate: s.serviceDate,
      serviceType: s.serviceType,
      serviceCategory: s.serviceCategory,
      totalAmount: s.totalAmount !== undefined ? s.totalAmount : (s.totalCost || 0),
      paidAt: s.paidAt,
      paymentId: s.paymentId,
      vehicle: s.vehicleDetails ? {
        brand: s.vehicleDetails.brand || s.vehicleDetails.make,
        model: s.vehicleDetails.model,
        registrationNumber: s.vehicleDetails.vehicleNumber || s.vehicleDetails.registrationNumber
      } : null,
      customer: s.ownerDetails ? {
        name: s.ownerDetails.name,
        email: s.ownerDetails.email,
        phone: s.ownerDetails.phone
      } : null,
      createdAt: s.createdAt
    }));

    return res.status(200).json({
      success: true,
      invoices,
      totalCount,
      totalPages: Math.ceil(totalCount / limitNum),
      currentPage: pageNum
    });
  } catch (err) {
    console.error('Error fetching garage invoices:', err);
    return res.status(500).json({ success: false, message: 'Error loading garage invoices' });
  }
});

/**
 * PUT /api/garage/invoices/:serviceId
 * Updates draft invoice line items
 */
router.put('/garage/:serviceId', requireAuth, requireRole('GARAGE'), async (req, res) => {
  const { serviceId } = req.params;
  const db = getDb();
  const services = db.collection('services');

  try {
    const sId = toObjectId(serviceId);
    const service = sId
      ? await services.findOne({ _id: sId, isArchived: { $ne: true } })
      : await services.findOne({ id: serviceId, isArchived: { $ne: true } });

    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    if (String(service.createdBy) !== String(req.user.id) && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Forbidden: You can only edit your own garage services' });
    }

    if (service.paymentStatus === 'PAID') {
      return res.status(400).json({ success: false, message: 'Cannot modify a paid invoice' });
    }

    const calculated = calculateInvoiceTotals(req.body);

    const updateDoc = {
      partsReplaced: calculated.partsReplaced,
      partsAmount: calculated.partsAmount,
      laborCost: calculated.laborAmount,
      laborAmount: calculated.laborAmount,
      additionalCharges: calculated.additionalCharges,
      discountAmount: calculated.discountAmount,
      taxAmount: calculated.taxAmount,
      subtotal: calculated.subtotal,
      totalCost: calculated.totalAmount,
      totalAmount: calculated.totalAmount,
      mechanicNotes: req.body.mechanicNotes !== undefined ? req.body.mechanicNotes : service.mechanicNotes,
      updatedAt: new Date()
    };

    await services.updateOne({ _id: service._id }, { $set: updateDoc });

    return res.status(200).json({
      success: true,
      message: 'Invoice bill items updated successfully',
      invoice: {
        id: String(service._id),
        ...updateDoc
      }
    });
  } catch (err) {
    console.error('Error updating invoice:', err);
    return res.status(500).json({ success: false, message: 'Server error updating invoice' });
  }
});

/**
 * POST /api/garage/invoices/:serviceId/finalize
 * Finalizes service invoice and generates unique invoice number
 */
router.post('/garage/:serviceId/finalize', requireAuth, requireRole('GARAGE'), async (req, res) => {
  const { serviceId } = req.params;
  const db = getDb();
  const services = db.collection('services');

  try {
    const sId = toObjectId(serviceId);
    const service = sId
      ? await services.findOne({ _id: sId, isArchived: { $ne: true } })
      : await services.findOne({ id: serviceId, isArchived: { $ne: true } });

    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    if (String(service.createdBy) !== String(req.user.id) && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Forbidden: You can only finalize your own garage services' });
    }

    if (service.paymentStatus === 'PAID') {
      return res.status(400).json({ success: false, message: 'Invoice is already paid and finalized' });
    }

    // Generate atomic invoice number if not already present
    let invoiceNumber = service.invoiceNumber;
    if (!invoiceNumber) {
      invoiceNumber = await generateInvoiceNumber(db);
    }

    // Compute final authoritative totals
    const calculated = calculateInvoiceTotals({
      ...service,
      ...(req.body || {})
    });

    const finalizeDoc = {
      invoiceNumber,
      invoiceStatus: 'FINALIZED',
      paymentStatus: service.paymentStatus || 'UNPAID',
      partsReplaced: calculated.partsReplaced,
      partsAmount: calculated.partsAmount,
      laborCost: calculated.laborAmount,
      laborAmount: calculated.laborAmount,
      additionalCharges: calculated.additionalCharges,
      discountAmount: calculated.discountAmount,
      taxAmount: calculated.taxAmount,
      subtotal: calculated.subtotal,
      totalCost: calculated.totalAmount,
      totalAmount: calculated.totalAmount,
      invoiceFinalizedAt: new Date(),
      updatedAt: new Date()
    };

    await services.updateOne({ _id: service._id }, { $set: finalizeDoc });

    return res.status(200).json({
      success: true,
      message: `Invoice finalized successfully with Invoice Number: ${invoiceNumber}`,
      invoiceNumber,
      totalAmount: calculated.totalAmount,
      invoiceStatus: 'FINALIZED'
    });
  } catch (err) {
    console.error('Error finalizing invoice:', err);
    return res.status(500).json({ success: false, message: 'Server error finalizing invoice' });
  }
});

/**
 * POST /api/garage/invoices/:serviceId/cancel
 * Cancels an unpaid invoice
 */
router.post('/garage/:serviceId/cancel', requireAuth, requireRole('GARAGE'), async (req, res) => {
  const { serviceId } = req.params;
  const db = getDb();
  const services = db.collection('services');

  try {
    const sId = toObjectId(serviceId);
    const service = sId
      ? await services.findOne({ _id: sId, isArchived: { $ne: true } })
      : await services.findOne({ id: serviceId, isArchived: { $ne: true } });

    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    if (String(service.createdBy) !== String(req.user.id) && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    if (service.paymentStatus === 'PAID') {
      return res.status(400).json({ success: false, message: 'Cannot cancel a paid invoice' });
    }

    await services.updateOne(
      { _id: service._id },
      { $set: { invoiceStatus: 'CANCELLED', updatedAt: new Date() } }
    );

    return res.status(200).json({ success: true, message: 'Invoice cancelled successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error cancelling invoice' });
  }
});

/**
 * GET /api/garage/payments
 * Retrieves payment transaction records for services completed by this garage
 */
router.get('/garage/payments/all', requireAuth, requireRole('GARAGE'), async (req, res) => {
  const db = getDb();
  const payments = db.collection('payments');
  const services = db.collection('services');

  try {
    // Locate all service IDs created by this garage
    const garageServices = await services
      .find({ createdBy: String(req.user.id), isArchived: { $ne: true } })
      .project({ _id: 1, invoiceNumber: 1 })
      .toArray();

    const serviceIds = garageServices.map(s => String(s._id));

    const paymentRecords = await payments
      .find({
        $or: [
          { serviceId: { $in: serviceIds } },
          { garageId: String(req.user.id) }
        ]
      })
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();

    const formatted = paymentRecords.map(p => ({
      id: String(p._id),
      invoiceNumber: p.invoiceNumber || '—',
      orderId: p.razorpayOrderId,
      paymentId: p.razorpayPaymentId || '—',
      amount: p.amount,
      currency: p.currency || 'INR',
      serviceType: p.serviceType || 'Automotive Service',
      vehicleNumber: p.vehicleNumber || 'N/A',
      status: p.status,
      paymentMethod: p.paymentMethod || 'Online',
      date: p.paidAt || p.createdAt
    }));

    return res.status(200).json({ success: true, payments: formatted });
  } catch (err) {
    console.error('Error loading garage payments:', err);
    return res.status(500).json({ success: false, message: 'Error loading garage payments' });
  }
});

/**
 * GET /api/garage/revenue
 * Computes verified database revenue statistics for garage dashboard
 */
router.get('/garage/revenue/summary', requireAuth, requireRole('GARAGE'), async (req, res) => {
  const db = getDb();
  const services = db.collection('services');
  const payments = db.collection('payments');

  try {
    const garageServices = await services
      .find({ createdBy: String(req.user.id), isArchived: { $ne: true } })
      .toArray();

    const serviceIds = garageServices.map(s => String(s._id));

    // Verified captured payments
    const capturedPayments = await payments
      .find({
        status: PAYMENT_STATUS.CAPTURED,
        $or: [
          { serviceId: { $in: serviceIds } },
          { garageId: String(req.user.id) }
        ]
      })
      .toArray();

    const totalRevenue = capturedPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    const paidInvoicesCount = capturedPayments.length;

    // Today's revenue calculation
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const todayRevenue = capturedPayments
      .filter(p => p.paidAt && new Date(p.paidAt) >= startOfToday)
      .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

    // This month's revenue calculation
    const startOfMonth = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), 1);
    const monthRevenue = capturedPayments
      .filter(p => p.paidAt && new Date(p.paidAt) >= startOfMonth)
      .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

    // Total refunded amount
    const refundedPayments = await payments
      .find({
        $or: [
          { status: { $in: [PAYMENT_STATUS.REFUNDED, PAYMENT_STATUS.PARTIALLY_REFUNDED] } },
          { totalRefundedAmount: { $gt: 0 } }
        ],
        $and: [
          {
            $or: [
              { serviceId: { $in: serviceIds } },
              { garageId: String(req.user.id) }
            ]
          }
        ]
      })
      .toArray();

    const refundedAmount = refundedPayments.reduce((sum, p) => sum + (parseFloat(p.totalRefundedAmount) || 0), 0);

    // Failed payments count
    const failedPaymentCount = await payments.countDocuments({
      status: PAYMENT_STATUS.FAILED,
      $or: [
        { serviceId: { $in: serviceIds } },
        { garageId: String(req.user.id) }
      ]
    });

    // Pending payments from finalized unpaid invoices
    const pendingServices = garageServices.filter(s => s.paymentStatus !== 'PAID' && s.invoiceStatus !== 'CANCELLED');
    const pendingPaymentsTotal = pendingServices.reduce((sum, s) => {
      const amt = s.totalAmount !== undefined ? s.totalAmount : (s.totalCost || 0);
      return sum + (parseFloat(amt) || 0);
    }, 0);

    return res.status(200).json({
      success: true,
      summary: {
        totalRevenue,
        paidInvoices: paidInvoicesCount,
        pendingPayments: pendingPaymentsTotal,
        todayRevenue,
        monthRevenue,
        refundedAmount,
        failedPayments: failedPaymentCount,
        totalServicesLogged: garageServices.length
      }
    });
  } catch (err) {
    console.error('Error loading garage revenue summary:', err);
    return res.status(500).json({ success: false, message: 'Error loading revenue summary' });
  }
});

/**
 * GET /api/garage/payments/analytics
 * Computes breakdown data for charts & trends
 */
router.get('/garage/payments/analytics', requireAuth, requireRole('GARAGE'), async (req, res) => {
  const { period = '7days' } = req.query;
  const db = getDb();
  const services = db.collection('services');
  const payments = db.collection('payments');

  try {
    const garageServices = await services
      .find({ createdBy: String(req.user.id), isArchived: { $ne: true } })
      .project({ _id: 1 })
      .toArray();

    const serviceIds = garageServices.map(s => String(s._id));

    let daysCount = 7;
    if (period === '30days') daysCount = 30;
    else if (period === '90days') daysCount = 90;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysCount);
    startDate.setHours(0, 0, 0, 0);

    const relevantPayments = await payments
      .find({
        status: { $in: [PAYMENT_STATUS.CAPTURED, PAYMENT_STATUS.PARTIALLY_REFUNDED, PAYMENT_STATUS.REFUNDED] },
        paidAt: { $gte: startDate },
        $or: [
          { serviceId: { $in: serviceIds } },
          { garageId: String(req.user.id) }
        ]
      })
      .sort({ paidAt: 1 })
      .toArray();

    // Group by Day
    const trendMap = {};
    for (let i = 0; i <= daysCount; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().split('T')[0];
      trendMap[key] = { date: key, label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), revenue: 0, refunds: 0, count: 0 };
    }

    relevantPayments.forEach(p => {
      if (p.paidAt) {
        const key = new Date(p.paidAt).toISOString().split('T')[0];
        if (trendMap[key]) {
          trendMap[key].revenue += parseFloat(p.amount) || 0;
          trendMap[key].refunds += parseFloat(p.totalRefundedAmount) || 0;
          trendMap[key].count += 1;
        }
      }
    });

    const trendData = Object.values(trendMap);

    return res.status(200).json({
      success: true,
      period,
      trends: trendData
    });
  } catch (err) {
    console.error('Error loading analytics:', err);
    return res.status(500).json({ success: false, message: 'Error loading analytics' });
  }
});

module.exports = router;
