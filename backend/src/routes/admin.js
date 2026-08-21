const express = require('express');
const { ObjectId } = require('mongodb');

const { getDb } = require('../db');
const { requireAdmin } = require('../middleware/adminMiddleware');

const router = express.Router();

// ───────────────────────────── helpers ─────────────────────────────
function safeObjectId(id) {
  try {
    return new ObjectId(String(id));
  } catch {
    return null;
  }
}

// ───────────────────────── GET /api/admin/dashboard ─────────────────────────
router.get('/dashboard', requireAdmin, async (req, res) => {
  const db = getDb();

  try {
    const [
      totalUsers,
      totalGarages,
      totalVehicles,
      totalServices,
      verifiedGarages
    ] = await Promise.all([
      db.collection('users').countDocuments(),
      db.collection('garages').countDocuments({ isActive: { $ne: false } }),
      db.collection('vehicles').countDocuments({ isArchived: { $ne: true } }),
      db.collection('services').countDocuments({ isArchived: { $ne: true } }),
      db.collection('garages').countDocuments({ verified: true, isActive: { $ne: false } })
    ]);

    // Total revenue from completed bookings
    const revAgg = await db.collection('bookings').aggregate([
      { $match: { status: 'COMPLETED' } },
      {
        $group: {
          _id: null,
          total: { $sum: { $toDouble: { $ifNull: ['$snapshots.service.price', 0] } } }
        }
      }
    ]).toArray();

    const totalRevenue = revAgg.length > 0 ? revAgg[0].total : 0;

    return res.status(200).json({
      totalUsers,
      totalGarages,
      totalVehicles,
      totalServices,
      totalRevenue,
      verifiedGarages
    });
  } catch (e) {
    return res.status(500).json({ msg: 'Error loading dashboard', error: String(e && e.message ? e.message : e) });
  }
});

// ───────────────────────── GET /api/admin/users ─────────────────────────
router.get('/users', requireAdmin, async (req, res) => {
  const db = getDb();
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
  const search = (req.query.search || '').trim();
  const skip = (page - 1) * limit;

  try {
    const matchStage = {};
    if (search) {
      matchStage.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const totalCount = await db.collection('users').countDocuments(matchStage);

    const users = await db.collection('users').aggregate([
      { $match: matchStage },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $addFields: {
          _idStr: { $toString: '$_id' }
        }
      },
      {
        $lookup: {
          from: 'vehicles',
          localField: '_idStr',
          foreignField: 'ownerId',
          pipeline: [
            { $match: { isArchived: { $ne: true } } }
          ],
          as: '_vehicles'
        }
      },
      {
        $lookup: {
          from: 'services',
          localField: '_idStr',
          foreignField: 'ownerId',
          pipeline: [
            { $match: { isArchived: { $ne: true } } }
          ],
          as: '_services'
        }
      },
      {
        $project: {
          password: 0
        }
      }
    ]).toArray();

    const items = users.map((u) => ({
      id: String(u._id),
      name: u.name || '',
      email: u.email || '',
      role: u.role || 'USER',
      phone: u.phone || '',
      city: u.city || '',
      photoUrl: u.photoUrl || null,
      vehicleCount: (u._vehicles || []).length,
      serviceCount: (u._services || []).length,
      createdAt: u.createdAt || null
    }));

    return res.status(200).json({
      items,
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit)
    });
  } catch (e) {
    return res.status(500).json({ msg: 'Error loading users', error: String(e && e.message ? e.message : e) });
  }
});

// ───────────────────────── GET /api/admin/users/:id ─────────────────────────
router.get('/users/:id', requireAdmin, async (req, res) => {
  const db = getDb();
  const uid = safeObjectId(req.params.id);
  if (!uid) return res.status(400).json({ msg: 'Invalid user ID' });

  try {
    const user = await db.collection('users').findOne({ _id: uid });
    if (!user) return res.status(404).json({ msg: 'User not found' });

    const userId = String(user._id);

    const [vehicles, services] = await Promise.all([
      db.collection('vehicles').find({ ownerId: userId, isArchived: { $ne: true } }).toArray(),
      db.collection('services').find({ ownerId: userId, isArchived: { $ne: true } }).sort({ serviceDate: -1 }).toArray()
    ]);

    return res.status(200).json({
      id: userId,
      name: user.name || '',
      email: user.email || '',
      role: user.role || 'USER',
      phone: user.phone || '',
      city: user.city || '',
      bio: user.bio || '',
      photoUrl: user.photoUrl || null,
      createdAt: user.createdAt || null,
      vehicles: vehicles.map((v) => ({
        id: String(v._id),
        vehicleNumber: v.vehicleNumber,
        brand: v.brand,
        model: v.model,
        year: v.manufacturingYear || v.year,
        fuelType: v.fuelType,
        createdAt: v.createdAt
      })),
      services: services.map((s) => ({
        id: String(s._id),
        vehicleId: s.vehicleId,
        serviceDate: s.serviceDate,
        serviceType: s.serviceType,
        serviceCategory: s.serviceCategory,
        totalCost: s.totalCost || 0,
        garageName: s.garageName || '',
        createdAt: s.createdAt
      }))
    });
  } catch (e) {
    return res.status(500).json({ msg: 'Error loading user', error: String(e && e.message ? e.message : e) });
  }
});

// ───────────────────────── GET /api/admin/garages ─────────────────────────
router.get('/garages', requireAdmin, async (req, res) => {
  const db = getDb();
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
  const search = (req.query.search || '').trim();
  const skip = (page - 1) * limit;

  try {
    const matchStage = { isActive: { $ne: false } };
    if (search) {
      matchStage.$or = [
        { name: { $regex: search, $options: 'i' } },
        { city: { $regex: search, $options: 'i' } }
      ];
    }

    const totalCount = await db.collection('garages').countDocuments(matchStage);

    const garages = await db.collection('garages').aggregate([
      { $match: matchStage },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: 'bookings',
          localField: '_id',
          foreignField: 'garageId',
          as: '_bookings'
        }
      },
      {
        $lookup: {
          from: 'users',
          let: { ownerId: '$ownerUserId' },
          pipeline: [
            { $match: { $expr: { $eq: [{ $toString: '$_id' }, '$$ownerId'] } } },
            { $project: { name: 1, email: 1 } }
          ],
          as: '_owner'
        }
      }
    ]).toArray();

    const items = garages.map((g) => {
      const completedBookings = (g._bookings || []).filter((b) => b.status === 'COMPLETED');
      const revenue = completedBookings.reduce((acc, b) => {
        const p = parseFloat((b.snapshots && b.snapshots.service && b.snapshots.service.price) || 0);
        return acc + (Number.isNaN(p) ? 0 : p);
      }, 0);
      const owner = g._owner && g._owner[0];

      return {
        id: String(g._id),
        name: g.name || '',
        ownerName: owner ? owner.name : '',
        ownerEmail: owner ? owner.email : '',
        phone: g.phone || '',
        city: g.city || '',
        address: g.address || '',
        description: g.description || '',
        photoUrl: g.photoUrl || null,
        verified: g.verified === true,
        isActive: g.isActive !== false,
        servicesCompleted: completedBookings.length,
        totalBookings: (g._bookings || []).length,
        revenue,
        createdAt: g.createdAt || null
      };
    });

    return res.status(200).json({
      items,
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit)
    });
  } catch (e) {
    return res.status(500).json({ msg: 'Error loading garages', error: String(e && e.message ? e.message : e) });
  }
});

// ───────────────── PATCH /api/admin/garages/:id/verify ──────────────────
router.patch('/garages/:id/verify', requireAdmin, async (req, res) => {
  const db = getDb();
  const gid = safeObjectId(req.params.id);
  if (!gid) return res.status(400).json({ msg: 'Invalid garage ID' });

  try {
    const result = await db.collection('garages').updateOne(
      { _id: gid },
      { $set: { verified: true, updatedAt: new Date() } }
    );
    if (!result.matchedCount) return res.status(404).json({ msg: 'Garage not found' });
    return res.status(200).json({ msg: 'Garage verified successfully' });
  } catch (e) {
    return res.status(500).json({ msg: 'Error verifying garage', error: String(e && e.message ? e.message : e) });
  }
});

// ───────────────── PATCH /api/admin/garages/:id/unverify ──────────────────
router.patch('/garages/:id/unverify', requireAdmin, async (req, res) => {
  const db = getDb();
  const gid = safeObjectId(req.params.id);
  if (!gid) return res.status(400).json({ msg: 'Invalid garage ID' });

  try {
    const result = await db.collection('garages').updateOne(
      { _id: gid },
      { $set: { verified: false, updatedAt: new Date() } }
    );
    if (!result.matchedCount) return res.status(404).json({ msg: 'Garage not found' });
    return res.status(200).json({ msg: 'Garage unverified' });
  } catch (e) {
    return res.status(500).json({ msg: 'Error updating garage', error: String(e && e.message ? e.message : e) });
  }
});

// ───────────────── PATCH /api/admin/garages/:id/suspend ──────────────────
router.patch('/garages/:id/suspend', requireAdmin, async (req, res) => {
  const db = getDb();
  const gid = safeObjectId(req.params.id);
  if (!gid) return res.status(400).json({ msg: 'Invalid garage ID' });

  try {
    const result = await db.collection('garages').updateOne(
      { _id: gid },
      { $set: { isActive: false, verified: false, updatedAt: new Date() } }
    );
    if (!result.matchedCount) return res.status(404).json({ msg: 'Garage not found' });
    return res.status(200).json({ msg: 'Garage suspended' });
  } catch (e) {
    return res.status(500).json({ msg: 'Error suspending garage', error: String(e && e.message ? e.message : e) });
  }
});

// ───────────────── PATCH /api/admin/garages/:id/activate ──────────────────
router.patch('/garages/:id/activate', requireAdmin, async (req, res) => {
  const db = getDb();
  const gid = safeObjectId(req.params.id);
  if (!gid) return res.status(400).json({ msg: 'Invalid garage ID' });

  try {
    const result = await db.collection('garages').updateOne(
      { _id: gid },
      { $set: { isActive: true, updatedAt: new Date() } }
    );
    if (!result.matchedCount) return res.status(404).json({ msg: 'Garage not found' });
    return res.status(200).json({ msg: 'Garage activated' });
  } catch (e) {
    return res.status(500).json({ msg: 'Error activating garage', error: String(e && e.message ? e.message : e) });
  }
});

// ───────────────────────── GET /api/admin/revenue ─────────────────────────
router.get('/revenue', requireAdmin, async (req, res) => {
  const db = getDb();

  try {
    const revenueData = await db.collection('bookings').aggregate([
      { $match: { status: 'COMPLETED' } },
      {
        $group: {
          _id: '$garageId',
          totalServices: { $sum: 1 },
          totalRevenue: { $sum: { $toDouble: { $ifNull: ['$snapshots.service.price', 0] } } }
        }
      },
      { $sort: { totalRevenue: -1 } },
      {
        $lookup: {
          from: 'garages',
          localField: '_id',
          foreignField: '_id',
          as: '_garage'
        }
      },
      { $unwind: { path: '$_garage', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          garageId: { $toString: '$_id' },
          garageName: { $ifNull: ['$_garage.name', 'Unknown Garage'] },
          city: { $ifNull: ['$_garage.city', ''] },
          totalServices: 1,
          totalRevenue: 1,
          verified: { $ifNull: ['$_garage.verified', false] }
        }
      }
    ]).toArray();

    const grandTotal = revenueData.reduce((acc, r) => acc + (r.totalRevenue || 0), 0);
    const totalServices = revenueData.reduce((acc, r) => acc + (r.totalServices || 0), 0);

    return res.status(200).json({
      items: revenueData,
      grandTotal,
      totalServices,
      totalGarages: revenueData.length
    });
  } catch (e) {
    return res.status(500).json({ msg: 'Error loading revenue', error: String(e && e.message ? e.message : e) });
  }
});

// ───────────────────────── GET /api/admin/analytics ─────────────────────────
router.get('/analytics', requireAdmin, async (req, res) => {
  const db = getDb();

  try {
    // Monthly user registrations
    const monthlyUsers = await db.collection('users').aggregate([
      { $match: { createdAt: { $exists: true, $type: 'date' } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } },
      { $project: { month: '$_id', count: 1, _id: 0 } }
    ]).toArray();

    // Monthly vehicle registrations
    const monthlyVehicles = await db.collection('vehicles').aggregate([
      { $match: { createdAt: { $exists: true, $type: 'date' }, isArchived: { $ne: true } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } },
      { $project: { month: '$_id', count: 1, _id: 0 } }
    ]).toArray();

    // Monthly service records
    const monthlyServices = await db.collection('services').aggregate([
      { $match: { createdAt: { $exists: true, $type: 'date' }, isArchived: { $ne: true } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } },
      { $project: { month: '$_id', count: 1, _id: 0 } }
    ]).toArray();

    // Monthly revenue growth (from completed bookings)
    const monthlyRevenue = await db.collection('bookings').aggregate([
      { $match: { status: 'COMPLETED', createdAt: { $exists: true, $type: 'date' } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          revenue: { $sum: { $toDouble: { $ifNull: ['$snapshots.service.price', 0] } } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } },
      { $project: { month: '$_id', revenue: 1, count: 1, _id: 0 } }
    ]).toArray();

    // Top performing garages (by completed bookings count + revenue)
    const topGarages = await db.collection('bookings').aggregate([
      { $match: { status: 'COMPLETED' } },
      {
        $group: {
          _id: '$garageId',
          completedCount: { $sum: 1 },
          revenue: { $sum: { $toDouble: { $ifNull: ['$snapshots.service.price', 0] } } }
        }
      },
      { $sort: { revenue: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'garages',
          localField: '_id',
          foreignField: '_id',
          as: '_garage'
        }
      },
      { $unwind: { path: '$_garage', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          name: { $ifNull: ['$_garage.name', 'Unknown'] },
          city: { $ifNull: ['$_garage.city', ''] },
          completedCount: 1,
          revenue: 1,
          _id: 0
        }
      }
    ]).toArray();

    return res.status(200).json({
      monthlyUsers,
      monthlyVehicles,
      monthlyServices,
      monthlyRevenue,
      topGarages
    });
  } catch (e) {
    return res.status(500).json({ msg: 'Error loading analytics', error: String(e && e.message ? e.message : e) });
  }
});

// ───────────────────────── ADMIN PAYMENT MANAGEMENT ─────────────────────────

/**
 * GET /api/admin/payments/summary
 * Returns global platform payment KPIs
 */
router.get('/payments/summary', requireAdmin, async (req, res) => {
  const db = getDb();
  const payments = db.collection('payments');
  const services = db.collection('services');

  try {
    const allPayments = await payments.find({}).toArray();

    let totalVolume = 0;
    let successfulVolume = 0;
    let successfulCount = 0;
    let failedCount = 0;
    let totalRefundedAmount = 0;
    let refundedCount = 0;

    allPayments.forEach(p => {
      const amt = parseFloat(p.amount) || 0;
      totalVolume += amt;

      if (p.status === 'CAPTURED' || p.status === 'PAID') {
        successfulVolume += amt;
        successfulCount++;
      } else if (p.status === 'FAILED') {
        failedCount++;
      } else if (p.status === 'REFUNDED' || p.status === 'PARTIALLY_REFUNDED') {
        successfulVolume += amt;
        successfulCount++;
        refundedCount++;
      }

      totalRefundedAmount += parseFloat(p.totalRefundedAmount) || 0;
    });

    // Unpaid finalized services
    const pendingServices = await services.find({ paymentStatus: { $ne: 'PAID' }, isArchived: { $ne: true }, invoiceStatus: { $ne: 'CANCELLED' } }).toArray();
    const pendingAmount = pendingServices.reduce((sum, s) => sum + (parseFloat(s.totalAmount !== undefined ? s.totalAmount : (s.totalCost || 0)) || 0), 0);

    return res.status(200).json({
      success: true,
      summary: {
        totalVolume,
        successfulVolume,
        successfulCount,
        failedCount,
        totalRefundedAmount,
        refundedCount,
        pendingAmount,
        pendingCount: pendingServices.length,
        totalTransactions: allPayments.length
      }
    });
  } catch (err) {
    console.error('Error loading admin payment summary:', err);
    return res.status(500).json({ success: false, message: 'Error loading admin payment summary' });
  }
});

/**
 * GET /api/admin/payments/all
 * Paginated, searchable, filterable list of all system payments
 */
router.get('/payments/all', requireAdmin, async (req, res) => {
  const { page = 1, limit = 20, search = '', status = 'ALL' } = req.query;
  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 20;
  const skip = (pageNum - 1) * limitNum;

  const db = getDb();
  const payments = db.collection('payments');

  try {
    const query = {};

    if (status && status !== 'ALL') {
      if (status === 'PAID') query.status = 'CAPTURED';
      else if (status === 'FAILED') query.status = 'FAILED';
      else if (status === 'REFUNDED') query.status = { $in: ['REFUNDED', 'PARTIALLY_REFUNDED'] };
      else if (status === 'PENDING') query.status = { $in: ['CREATED', 'PENDING'] };
      else query.status = status;
    }

    if (search && search.trim() !== '') {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { invoiceNumber: regex },
        { razorpayPaymentId: regex },
        { razorpayOrderId: regex },
        { garageName: regex },
        { vehicleNumber: regex },
        { serviceType: regex }
      ];
    }

    const totalCount = await payments.countDocuments(query);
    const rawPayments = await payments
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .toArray();

    const formatted = rawPayments.map(p => ({
      id: String(p._id),
      invoiceNumber: p.invoiceNumber || '—',
      orderId: p.razorpayOrderId,
      paymentId: p.razorpayPaymentId || '—',
      amount: p.amount,
      currency: p.currency || 'INR',
      status: p.status,
      paymentMethod: p.paymentMethod || 'Online',
      garageName: p.garageName || 'Authorized Service Center',
      garageId: p.garageId,
      vehicleNumber: p.vehicleNumber || 'N/A',
      vehicleId: p.vehicleId,
      userId: p.userId,
      serviceType: p.serviceType || 'Automotive Service',
      serviceId: p.serviceId,
      totalRefundedAmount: p.totalRefundedAmount || 0,
      refunds: p.refunds || [],
      failureReason: p.failureReason,
      paidAt: p.paidAt,
      refundedAt: p.refundedAt,
      date: p.paidAt || p.createdAt
    }));

    return res.status(200).json({
      success: true,
      payments: formatted,
      totalCount,
      totalPages: Math.ceil(totalCount / limitNum),
      currentPage: pageNum
    });
  } catch (err) {
    console.error('Error loading admin payments:', err);
    return res.status(500).json({ success: false, message: 'Error loading admin payments' });
  }
});

// ───────────────────── ADMIN COMMISSION MANAGEMENT ─────────────────────

/**
 * GET /api/admin/commissions/summary
 * Returns global platform commission and financial metrics
 */
router.get('/commissions/summary', requireAdmin, async (req, res) => {
  const db = getDb();
  const earnings = db.collection('garage_earnings');

  try {
    const allEarnings = await earnings.find({}).toArray();

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    let totalGrossVolume = 0;
    let totalPlatformCommission = 0;
    let todayPlatformCommission = 0;
    let monthPlatformCommission = 0;
    let totalGarageEarnings = 0;
    let totalRefundAdjustments = 0;

    allEarnings.forEach(e => {
      const gross = parseFloat(e.grossAmount) || 0;
      const comm = parseFloat(e.platformCommission) || 0;
      const net = parseFloat(e.netAfterRefund !== undefined ? e.netAfterRefund : e.garageNetAmount) || 0;
      const ref = parseFloat(e.refundAmount) || 0;
      const created = new Date(e.createdAt || 0);

      totalGrossVolume += gross;
      totalPlatformCommission += comm;
      totalGarageEarnings += net;
      totalRefundAdjustments += ref;

      if (created >= todayStart) {
        todayPlatformCommission += comm;
      }
      if (created >= monthStart) {
        monthPlatformCommission += comm;
      }
    });

    const netPlatformRevenue = Math.max(0, totalPlatformCommission);

    return res.status(200).json({
      success: true,
      summary: {
        totalGrossVolume,
        totalPlatformCommission,
        todayPlatformCommission,
        monthPlatformCommission,
        totalGarageEarnings,
        totalRefundAdjustments,
        netPlatformRevenue,
        totalEarningRecords: allEarnings.length
      }
    });
  } catch (err) {
    console.error('Error loading admin commissions summary:', err);
    return res.status(500).json({ success: false, message: 'Error loading commission metrics' });
  }
});

/**
 * GET /api/admin/commissions/all
 * Paginated global commission and earnings transactions
 */
router.get('/commissions/all', requireAdmin, async (req, res) => {
  const { page = 1, limit = 20, status = 'ALL', search = '' } = req.query;
  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 20;
  const skip = (pageNum - 1) * limitNum;

  const db = getDb();
  const earnings = db.collection('garage_earnings');

  try {
    const query = {};
    if (status && status !== 'ALL') {
      query.status = status;
    }

    if (search && search.trim() !== '') {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { invoiceNumber: regex },
        { garageName: regex },
        { vehicleNumber: regex },
        { serviceType: regex },
        { paymentId: regex }
      ];
    }

    const totalCount = await earnings.countDocuments(query);
    const rawEarnings = await earnings
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .toArray();

    const formatted = rawEarnings.map(e => ({
      id: String(e._id),
      invoiceId: e.invoiceId,
      invoiceNumber: e.invoiceNumber,
      garageId: e.garageId,
      garageName: e.garageName || 'Authorized Service Center',
      serviceType: e.serviceType,
      vehicleNumber: e.vehicleNumber,
      paymentId: e.paymentId,
      razorpayPaymentId: e.razorpayPaymentId,
      grossAmount: e.grossAmount,
      platformCommission: e.platformCommission,
      garageNetAmount: e.garageNetAmount,
      refundAmount: e.refundAmount || 0,
      netAfterRefund: e.netAfterRefund !== undefined ? e.netAfterRefund : e.garageNetAmount,
      commissionRate: e.commissionRate,
      commissionType: e.commissionType,
      status: e.status,
      settlementId: e.settlementId,
      date: e.createdAt
    }));

    return res.status(200).json({
      success: true,
      commissions: formatted,
      totalCount,
      totalPages: Math.ceil(totalCount / limitNum),
      currentPage: pageNum
    });
  } catch (err) {
    console.error('Error loading admin commissions:', err);
    return res.status(500).json({ success: false, message: 'Error loading commission records' });
  }
});

// ───────────────────── ADMIN SETTLEMENT MANAGEMENT ─────────────────────

/**
 * GET /api/admin/settlements
 * List global settlements with status filters
 */
router.get('/settlements', requireAdmin, async (req, res) => {
  const { page = 1, limit = 20, status = 'ALL', search = '' } = req.query;
  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 20;
  const skip = (pageNum - 1) * limitNum;

  const db = getDb();
  const settlements = db.collection('settlements');
  const garages = db.collection('garages');

  try {
    const query = {};
    if (status && status !== 'ALL') {
      query.status = status;
    }
    if (search && search.trim() !== '') {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { settlementId: regex },
        { garageId: regex },
        { destinationAccountId: regex }
      ];
    }

    const totalCount = await settlements.countDocuments(query);
    const rawSettlements = await settlements
      .find(query)
      .sort({ requestedAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .toArray();

    // Fetch garage names
    const garageIds = [...new Set(rawSettlements.map(s => s.garageId))];
    const garageDocs = await garages.find({
      $or: [
        { _id: { $in: garageIds.map(id => safeObjectId(id)).filter(Boolean) } },
        { _id: { $in: garageIds } }
      ]
    }).toArray();

    const garageMap = {};
    garageDocs.forEach(g => {
      garageMap[String(g._id)] = g.name || g.garageName || 'Authorized Garage';
    });

    const formatted = rawSettlements.map(s => ({
      id: String(s._id),
      settlementId: s.settlementId,
      garageId: s.garageId,
      garageName: garageMap[String(s.garageId)] || 'Authorized Garage',
      requestedAmount: s.requestedAmount,
      approvedAmount: s.approvedAmount || s.requestedAmount,
      currency: s.currency || 'INR',
      status: s.status,
      earningsCount: s.earningsIds?.length || 0,
      earningsIds: s.earningsIds || [],
      destinationAccountId: s.destinationAccountId,
      notes: s.notes,
      transferId: s.transferId,
      provider: s.provider,
      requestedAt: s.requestedAt,
      approvedAt: s.approvedAt,
      processedAt: s.processedAt,
      completedAt: s.completedAt,
      failureReason: s.failureReason
    }));

    // Settlement KPIs
    const all = await settlements.find({}).toArray();
    let totalPendingVolume = 0;
    let totalSettledVolume = 0;
    let pendingCount = 0;
    let completedCount = 0;

    all.forEach(s => {
      const amt = parseFloat(s.approvedAmount || s.requestedAmount) || 0;
      if (s.status === 'REQUESTED' || s.status === 'UNDER_REVIEW' || s.status === 'APPROVED' || s.status === 'PROCESSING') {
        totalPendingVolume += amt;
        pendingCount++;
      } else if (s.status === 'COMPLETED') {
        totalSettledVolume += amt;
        completedCount++;
      }
    });

    return res.status(200).json({
      success: true,
      settlements: formatted,
      summary: {
        totalPendingVolume,
        totalSettledVolume,
        pendingCount,
        completedCount,
        totalRequests: all.length
      },
      totalCount,
      totalPages: Math.ceil(totalCount / limitNum),
      currentPage: pageNum
    });
  } catch (err) {
    console.error('Error loading admin settlements:', err);
    return res.status(500).json({ success: false, message: 'Error loading admin settlements' });
  }
});

/**
 * POST /api/admin/settlements/:id/approve
 * Admin approves a settlement request
 */
router.post('/settlements/:id/approve', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { approvedAmount, notes } = req.body || {};
  const db = getDb();
  const settlements = db.collection('settlements');

  try {
    const sId = safeObjectId(id);
    const settlement = sId ? await settlements.findOne({ _id: sId }) : await settlements.findOne({ settlementId: id });

    if (!settlement) {
      return res.status(404).json({ success: false, message: 'Settlement request not found' });
    }

    if (settlement.status !== 'REQUESTED' && settlement.status !== 'UNDER_REVIEW') {
      return res.status(400).json({ success: false, message: `Cannot approve settlement in ${settlement.status} status` });
    }

    const now = new Date();
    const finalApprovedAmount = approvedAmount ? parseFloat(approvedAmount) : settlement.requestedAmount;

    await settlements.updateOne(
      { _id: settlement._id },
      {
        $set: {
          status: 'APPROVED',
          approvedAmount: finalApprovedAmount,
          approvedBy: String(req.user.id),
          approvedAt: now,
          adminNotes: notes || 'Approved by administrator',
          updatedAt: now
        }
      }
    );

    // Audit log
    await db.collection('admin_audit_logs').insertOne({
      adminId: String(req.user.id),
      action: 'SETTLEMENT_APPROVED',
      targetId: String(settlement._id),
      settlementId: settlement.settlementId,
      oldStatus: settlement.status,
      newStatus: 'APPROVED',
      timestamp: now
    });

    return res.status(200).json({
      success: true,
      message: `Settlement ${settlement.settlementId} approved successfully`
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error approving settlement' });
  }
});

/**
 * POST /api/admin/settlements/:id/reject
 * Admin rejects settlement and unlocks earnings back to AVAILABLE
 */
router.post('/settlements/:id/reject', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body || {};
  const db = getDb();
  const settlements = db.collection('settlements');
  const earnings = db.collection('garage_earnings');

  try {
    const sId = safeObjectId(id);
    const settlement = sId ? await settlements.findOne({ _id: sId }) : await settlements.findOne({ settlementId: id });

    if (!settlement) {
      return res.status(404).json({ success: false, message: 'Settlement request not found' });
    }

    if (settlement.status === 'COMPLETED') {
      return res.status(400).json({ success: false, message: 'Cannot reject an already completed settlement' });
    }

    const now = new Date();

    // 1. Update settlement to CANCELLED
    await settlements.updateOne(
      { _id: settlement._id },
      {
        $set: {
          status: 'CANCELLED',
          failureReason: reason || 'Rejected by administrator',
          rejectedBy: String(req.user.id),
          updatedAt: now
        }
      }
    );

    // 2. Unlock earnings back to AVAILABLE
    if (settlement.earningsIds && settlement.earningsIds.length > 0) {
      const eObjectIds = settlement.earningsIds.map(eid => safeObjectId(eid)).filter(Boolean);
      await earnings.updateMany(
        { _id: { $in: eObjectIds } },
        {
          $set: {
            status: 'AVAILABLE',
            settlementId: null,
            updatedAt: now
          }
        }
      );
    }

    // Audit log
    await db.collection('admin_audit_logs').insertOne({
      adminId: String(req.user.id),
      action: 'SETTLEMENT_REJECTED',
      targetId: String(settlement._id),
      settlementId: settlement.settlementId,
      oldStatus: settlement.status,
      newStatus: 'CANCELLED',
      reason: reason || 'Admin rejection',
      timestamp: now
    });

    return res.status(200).json({
      success: true,
      message: `Settlement ${settlement.settlementId} rejected and earnings unlocked`
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error rejecting settlement' });
  }
});

/**
 * POST /api/admin/settlements/:id/process
 * Admin triggers payout processing via SettlementProvider
 */
router.post('/api/admin/settlements/:id/process', requireAdmin, async (req, res) => {
  // handled via router below
});

router.post('/settlements/:id/process', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const settlements = db.collection('settlements');
  const earnings = db.collection('garage_earnings');
  const payoutProfiles = db.collection('garage_payout_profiles');
  const { getSettlementProvider } = require('../services/settlementProvider');

  try {
    const sId = safeObjectId(id);
    const settlement = sId ? await settlements.findOne({ _id: sId }) : await settlements.findOne({ settlementId: id });

    if (!settlement) {
      return res.status(404).json({ success: false, message: 'Settlement not found' });
    }

    if (settlement.status === 'COMPLETED') {
      return res.status(400).json({ success: false, message: 'Settlement is already completed' });
    }

    const now = new Date();
    const payoutProfile = await payoutProfiles.findOne({ garageId: String(settlement.garageId) });
    const provider = getSettlementProvider();

    // Call settlement provider abstraction
    const result = await provider.processSettlement({ settlement, payoutProfile });

    if (result.success) {
      // Transition settlement to COMPLETED
      await settlements.updateOne(
        { _id: settlement._id },
        {
          $set: {
            status: 'COMPLETED',
            transferId: result.transferId,
            provider: result.provider,
            providerMessage: result.message,
            processedAt: now,
            completedAt: now,
            updatedAt: now
          }
        }
      );

      // Transition linked earnings to SETTLED
      if (settlement.earningsIds && settlement.earningsIds.length > 0) {
        const eObjectIds = settlement.earningsIds.map(eid => safeObjectId(eid)).filter(Boolean);
        await earnings.updateMany(
          { _id: { $in: eObjectIds } },
          {
            $set: {
              status: 'SETTLED',
              settledAt: now,
              updatedAt: now
            }
          }
        );
      }

      // Send settlement completed notification to garage
      const { notifyUser } = require('../services/notifications');
      await notifyUser(settlement.garageId, {
        title: 'Settlement Completed',
        body: `Settlement ${settlement.settlementId} for ₹${(settlement.approvedAmount || settlement.requestedAmount).toLocaleString('en-IN')} has been completed.`,
        data: {
          type: 'SETTLEMENT_COMPLETED',
          settlementId: settlement.settlementId,
          amount: String(settlement.approvedAmount || settlement.requestedAmount)
        }
      }).catch(e => console.warn('Settlement notif error:', e));

      // Audit log
      await db.collection('admin_audit_logs').insertOne({
        adminId: String(req.user.id),
        action: 'SETTLEMENT_PROCESSED',
        targetId: String(settlement._id),
        settlementId: settlement.settlementId,
        provider: result.provider,
        transferId: result.transferId,
        timestamp: now
      });

      return res.status(200).json({
        success: true,
        message: result.message || `Settlement ${settlement.settlementId} processed successfully`,
        transferId: result.transferId,
        status: 'COMPLETED'
      });
    } else {
      return res.status(500).json({ success: false, message: 'Settlement provider returned failure' });
    }
  } catch (err) {
    console.error('Error processing settlement payout:', err);
    return res.status(500).json({ success: false, message: err.message || 'Error processing settlement' });
  }
});

module.exports = router;

