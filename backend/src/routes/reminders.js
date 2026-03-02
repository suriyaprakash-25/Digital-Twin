const express = require('express');
const { DateTime } = require('luxon');

const { getDb } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { parseAnyDate } = require('../utils/dates');

const router = express.Router();

function calculateRemindersForVehicle(vehicle, services) {
  const reminders = [];
  const now = DateTime.utc();
  const items = [
    { key: 'insuranceExpiry', label: 'Insurance Renewal' },
    { key: 'pucExpiry', label: 'PUC (Pollution) Renewal' },
    { key: 'rcExpiry', label: 'RC Expiry' },
    { key: 'fitnessExpiry', label: 'Fitness Certificate' }
  ];

  for (const item of items) {
    const expiryStr = vehicle[item.key];
    if (!expiryStr) continue;

    const expiry = parseAnyDate(expiryStr);
    if (!expiry) continue;

    const daysRemaining = Math.trunc(expiry.diff(now, 'days').days);
    let status = 'upcoming';
    let priority = 'low';

    if (daysRemaining < 0) {
      status = 'overdue';
      priority = 'critical';
    } else if (daysRemaining <= 15) {
      priority = 'high';
    } else if (daysRemaining <= 30) {
      priority = 'medium';
    }

    if (daysRemaining <= 60) {
      reminders.push({
        id: `${String(vehicle._id)}_${item.key}`,
        vehicleId: String(vehicle._id),
        vehicleName: `${vehicle.brand || ''} ${vehicle.model || ''}`.trim(),
        vehicleNumber: vehicle.vehicleNumber,
        title: item.label,
        dueDate: expiryStr,
        daysRemaining,
        status,
        priority,
        type: 'legal'
      });
    }
  }

  // Service Recommendation
  let recommendedDate = null;
  if (services && services.length > 0) {
    const sorted = [...services].sort((a, b) => String(b.serviceDate || '').localeCompare(String(a.serviceDate || '')));
    const latest = sorted[0];
    if (latest && latest.recommendedDate) {
      recommendedDate = latest.recommendedDate;
    } else {
      const lastDt = parseAnyDate(latest && latest.serviceDate);
      if (lastDt) {
        recommendedDate = lastDt.plus({ days: 180 }).toFormat('yyyy-MM-dd');
      }
    }
  } else {
    const reg = parseAnyDate(vehicle.registrationDate);
    if (reg) {
      recommendedDate = reg.plus({ days: 180 }).toFormat('yyyy-MM-dd');
    } else {
      recommendedDate = now.plus({ days: 180 }).toFormat('yyyy-MM-dd');
    }
  }

  if (recommendedDate) {
    const recDt = parseAnyDate(recommendedDate);
    if (recDt) {
      const daysRemaining = Math.trunc(recDt.diff(now, 'days').days);
      let status = 'upcoming';
      let priority = 'low';

      if (daysRemaining < 0) {
        status = 'overdue';
        priority = 'critical';
      } else if (daysRemaining <= 15) {
        priority = 'high';
      } else if (daysRemaining <= 30) {
        priority = 'medium';
      }

      if (daysRemaining <= 60) {
        reminders.push({
          id: `${String(vehicle._id)}_service`,
          vehicleId: String(vehicle._id),
          vehicleName: `${vehicle.brand || ''} ${vehicle.model || ''}`.trim(),
          vehicleNumber: vehicle.vehicleNumber,
          title: 'Scheduled Service Due',
          dueDate: recommendedDate,
          daysRemaining,
          status,
          priority,
          type: 'service'
        });
      }
    }
  }

  return reminders;
}

router.get(['/', ''], requireAuth, async (req, res) => {
  const db = getDb();
  const vehicles = db.collection('vehicles');
  const services = db.collection('services');

  try {
    const vehicleList = await vehicles
      .find({ ownerId: req.user.id, isArchived: { $ne: true } })
      .toArray();

    const all = [];
    for (const vehicle of vehicleList) {
      const serviceList = await services
        .find({ vehicleId: String(vehicle._id), isArchived: { $ne: true } })
        .toArray();
      all.push(...calculateRemindersForVehicle(vehicle, serviceList));
    }

    all.sort((a, b) => a.daysRemaining - b.daysRemaining);
    return res.status(200).json(all);
  } catch (e) {
    return res.status(500).json({ msg: 'Error calculating reminders', error: String(e && e.message ? e.message : e) });
  }
});

module.exports = router;
