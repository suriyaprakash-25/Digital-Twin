const express = require('express');
const { DateTime } = require('luxon');

const { getDb } = require('../db');
const { requireAuth } = require('../middleware/auth');

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

module.exports = router;
