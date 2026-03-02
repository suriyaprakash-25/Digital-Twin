const express = require('express');
const { ObjectId } = require('mongodb');
const { DateTime } = require('luxon');

const { getDb } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { parseAnyDate } = require('../utils/dates');

const router = express.Router();

function calculateVehicleHealth(vehicle, services) {
  let score = 100;
  const behaviorNotes = [];
  const now = DateTime.utc();

  // 1. Expiries Analysis
  let expiredCount = 0;
  const expiryKeys = [
    { key: 'insuranceExpiry', name: 'Insurance' },
    { key: 'pucExpiry', name: 'PUC' },
    { key: 'rcExpiry', name: 'RC' },
    { key: 'fitnessExpiry', name: 'Fitness' }
  ];

  for (const item of expiryKeys) {
    const expiryStr = vehicle[item.key];
    if (!expiryStr) continue;
    const parsed = parseAnyDate(expiryStr);
    if (parsed && parsed < now) {
      expiredCount += 1;
      behaviorNotes.push(`${item.name} is expired.`);
    }
  }
  if (expiredCount > 0) {
    score -= expiredCount * 10;
  }

  // 2. Service Analysis
  if (!services || services.length === 0) {
    score -= 20;
    behaviorNotes.push('No service records found.');
  } else {
    const sorted = [...services].sort((a, b) => String(b.serviceDate || '').localeCompare(String(a.serviceDate || '')));
    const latest = sorted[0];
    const latestParsed = parseAnyDate(latest && latest.serviceDate);
    if (latestParsed) {
      const monthsSince = now.diff(latestParsed, 'days').days / 30.0;
      if (monthsSince > 6) {
        score -= 15;
        behaviorNotes.push('Overdue for service (> 6 months).');
      }
    }

    const verified = sorted.filter((s) => s.verifiedService === true);
    if (verified.length > 0) {
      score += Math.min(verified.length * 5, 15);
      behaviorNotes.push(`Consistent verified maintenance (${verified.length} records).`);
    }

    let majorIssues = 0;
    for (const s of sorted) {
      const notes = String(s.mechanicNotes || '').toLowerCase();
      const cat = String(s.serviceCategory || '').toLowerCase();
      if (notes.includes('accident') || notes.includes('crash') || cat.includes('major')) {
        majorIssues += 1;
      }
    }
    if (majorIssues > 0) {
      score -= majorIssues * 15;
      behaviorNotes.push('History of major accident/repair detected.');
    }

    let recentServices = 0;
    for (const s of sorted) {
      const sd = parseAnyDate(s.serviceDate);
      if (!sd) continue;
      if (now.diff(sd, 'days').days < 90) {
        const cat = String(s.serviceCategory || '').toLowerCase();
        if (cat === 'repair' || cat === 'breakdown') {
          recentServices += 1;
        }
      }
    }
    if (recentServices >= 2) {
      score -= 20;
      behaviorNotes.push('Frequent recent repairs detected indicating instability.');
    }
  }

  score = Math.max(0, Math.min(100, score));
  let condition;
  if (score >= 85) condition = 'Excellent';
  else if (score >= 70) condition = 'Good';
  else if (score >= 50) condition = 'Fair';
  else condition = 'Poor';

  return {
    healthScore: score,
    conditionLevel: condition,
    maintenanceBehavior: behaviorNotes.length > 0 ? behaviorNotes : ['Standard usage patterns.']
  };
}

router.get('/:vehicle_id', requireAuth, async (req, res) => {
  const vehicleId = req.params.vehicle_id;
  const db = getDb();
  const vehicles = db.collection('vehicles');
  const services = db.collection('services');

  try {
    const vehicle = await vehicles.findOne({
      _id: new ObjectId(vehicleId),
      ownerId: req.user.id,
      isArchived: { $ne: true }
    });

    if (!vehicle) {
      return res.status(404).json({ msg: 'Vehicle not found' });
    }

    const serviceList = await services
      .find({ vehicleId, isArchived: { $ne: true } })
      .toArray();

    const healthData = calculateVehicleHealth(vehicle, serviceList);
    return res.status(200).json(healthData);
  } catch (e) {
    return res.status(500).json({ msg: 'Error calculating vehicle health', error: String(e && e.message ? e.message : e) });
  }
});

module.exports = router;
module.exports.calculateVehicleHealth = calculateVehicleHealth;
