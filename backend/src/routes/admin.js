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

module.exports = router;
