const express = require('express');
const { DateTime } = require('luxon');

const { getDb } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get(['/', ''], requireAuth, async (req, res) => {
  const db = getDb();
  const vehiclesCol = db.collection('vehicles');
  const servicesCol = db.collection('services');

  try {
    const vehicles = await vehiclesCol
      .find({ ownerId: req.user.id, isArchived: { $ne: true } })
      .toArray();

    const vehicleIds = vehicles.map((v) => String(v._id));
    const services = await servicesCol
      .find({ vehicleId: { $in: vehicleIds }, isArchived: { $ne: true } })
      .toArray();

    const expensesByMonth = new Map();
    const categoryCounts = new Map();

    const fleetKmByVehicle = new Map();
    for (const v of vehicles) {
      const km = parseInt(v.currentOdometerKm || 0, 10);
      fleetKmByVehicle.set(String(v._id), {
        name: `${v.brand || ''} ${v.variant || ''}`.trim() || 'Unknown Vehicle',
        maxKm: Number.isNaN(km) ? 0 : km
      });
    }

    for (const s of services) {
      // Monthly expenses
      try {
        const dt = DateTime.fromISO(String(s.serviceDate || ''), { zone: 'utc' });
        const monthKey = dt.isValid ? dt.toFormat('yyyy-MM') : null;
        const cost = Number.isNaN(parseFloat(s.totalCost || 0)) ? 0 : parseFloat(s.totalCost || 0);
        if (monthKey) {
          expensesByMonth.set(monthKey, (expensesByMonth.get(monthKey) || 0) + cost);
        }
      } catch (e) {
        // ignore
      }

      // Categories
      const cat = s.serviceCategory || 'Other';
      categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);

      // Fleet km
      try {
        const sKm = parseInt(s.odometerKm || 0, 10);
        const vId = s.vehicleId;
        if (fleetKmByVehicle.has(vId) && !Number.isNaN(sKm)) {
          const cur = fleetKmByVehicle.get(vId);
          if (sKm > cur.maxKm) cur.maxKm = sKm;
        }
      } catch (e) {
        // ignore
      }
    }

    const sortedMonths = [...expensesByMonth.keys()].sort();
    const expenseTrend = sortedMonths.map((m) => ({ month: m, cost: expensesByMonth.get(m) }));

    const categoryDistribution = [...categoryCounts.entries()].map(([name, value]) => ({ name, value }));

    const fleetItems = [...fleetKmByVehicle.values()];
    const totalFleetKm = fleetItems.reduce((acc, item) => acc + (item.maxKm || 0), 0);
    const usageDistribution = fleetItems
      .filter((v) => (v.maxKm || 0) > 0)
      .map((v) => ({ name: v.name || 'Unknown', km: v.maxKm }));

    return res.status(200).json({
      expenseTrend,
      categoryDistribution,
      totalFleetKm,
      usageDistribution,
      totalVehicles: vehicles.length,
      totalServices: services.length
    });
  } catch (e) {
    return res.status(500).json({ msg: 'Error generating analytics', error: String(e && e.message ? e.message : e) });
  }
});

router.get('/garage', requireAuth, requireRole('GARAGE'), async (req, res) => {
  const db = getDb();
  const garagesCol = db.collection('garages');
  const bookingsCol = db.collection('bookings');
  const garageServicesCol = db.collection('garageServices');

  try {
    const garage = await garagesCol.findOne({ ownerUserId: String(req.user.id), isActive: { $ne: false } });
    if (!garage) {
      return res.status(400).json({ msg: 'Create your garage profile first' });
    }

    const [bookings, services] = await Promise.all([
      bookingsCol.find({ garageId: garage._id }).toArray(),
      garageServicesCol.find({ garageId: garage._id }).toArray()
    ]);

    const monthlyBookings = new Map();
    const monthlyRevenue = new Map();
    const statusCounts = new Map();
    const serviceCounts = new Map();

    let totalRevenue = 0;
    let completedCount = 0;
    let pendingCount = 0;

    for (const b of bookings) {
      const dt = DateTime.fromJSDate(b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt), { zone: 'utc' });
      const monthKey = dt.isValid ? dt.toFormat('MMM yy') : null;

      if (monthKey) {
        monthlyBookings.set(monthKey, (monthlyBookings.get(monthKey) || 0) + 1);
      }

      const status = String(b.status || 'UNKNOWN').toUpperCase();
      statusCounts.set(status, (statusCounts.get(status) || 0) + 1);

      if (status === 'PENDING' || status === 'REQUESTED') pendingCount++;
      if (status === 'COMPLETED') {
        completedCount++;
        const price = parseFloat((b.snapshots && b.snapshots.service && b.snapshots.service.price) || 0);
        if (!Number.isNaN(price)) {
          totalRevenue += price;
          if (monthKey) {
            monthlyRevenue.set(monthKey, (monthlyRevenue.get(monthKey) || 0) + price);
          }
        }
      }

      const serviceTitle = (b.snapshots && b.snapshots.service && b.snapshots.service.title) || 'Other';
      serviceCounts.set(serviceTitle, (serviceCounts.get(serviceTitle) || 0) + 1);
    }

    // Build month-sorted arrays aligned across booking and revenue charts
    const allMonths = [...new Set([...monthlyBookings.keys(), ...monthlyRevenue.keys()])].sort((a, b) => {
      const parse = (s) => DateTime.fromFormat(s, 'MMM yy', { zone: 'utc' }).toMillis();
      return parse(a) - parse(b);
    });

    const bookingsByMonth = allMonths.map((m) => ({ month: m, count: monthlyBookings.get(m) || 0 }));
    const revenueByMonth = allMonths.map((m) => ({ month: m, revenue: monthlyRevenue.get(m) || 0 }));

    const statusDistribution = [...statusCounts.entries()].map(([name, value]) => ({ name, value }));

    const topServices = [...serviceCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, bookings]) => ({ name, bookings }));

    return res.status(200).json({
      bookingsByMonth,
      revenueByMonth,
      statusDistribution,
      topServices,
      totalBookings: bookings.length,
      pendingCount,
      completedCount,
      totalRevenue,
      totalServices: services.length
    });
  } catch (e) {
    return res.status(500).json({ msg: 'Error generating garage analytics', error: String(e && e.message ? e.message : e) });
  }
});

module.exports = router;
