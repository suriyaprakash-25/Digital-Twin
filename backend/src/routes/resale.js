const express = require('express');
const { ObjectId } = require('mongodb');
const { DateTime } = require('luxon');

const { getDb } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { calculateVehicleHealth } = require('./health');

const router = express.Router();

function calculateResaleReport(vehicle, services) {
  const purchasePrice = Number.isNaN(parseFloat(vehicle.purchasePrice)) ? 0 : parseFloat(vehicle.purchasePrice);
  const now = DateTime.utc().startOf('day');

  let ageYears = 0;
  if (vehicle.manufacturingYear) {
    const y = parseInt(vehicle.manufacturingYear, 10);
    if (!Number.isNaN(y)) ageYears = now.year - y;
  }

  let depreciationFactor = 1.0;
  if (ageYears > 0) {
    depreciationFactor *= 0.85;
    if (ageYears > 1) {
      depreciationFactor *= Math.pow(0.9, ageYears - 1);
    }
  }

  let baseValue = purchasePrice * depreciationFactor;

  let trustScore = 100;
  const trustFactors = [];

  // 1. Ownership count penalty
  try {
    const owners = parseInt(vehicle.ownershipCount || 1, 10);
    if (owners > 1) {
      const penalty = (owners - 1) * 5;
      trustScore -= penalty;
      trustFactors.push({ type: 'negative', reason: `Multiple owners (${owners})` });
    }
  } catch (e) {
    // ignore
  }

  // 2. Service history details
  let verifiedServicesCount = 0;
  let majorAccidentsCount = 0;
  for (const s of services || []) {
    if (s.verifiedService) verifiedServicesCount += 1;
    const notes = String(s.mechanicNotes || '').toLowerCase();
    const cat = String(s.serviceCategory || '').toLowerCase();
    if (notes.includes('accident') || notes.includes('crash') || cat.includes('major') || cat === 'accidental repair') {
      majorAccidentsCount += 1;
    }
  }

  // 3. Service records verification
  if (verifiedServicesCount > 0) {
    trustScore += Math.min(verifiedServicesCount * 5, 15);
    trustFactors.push({ type: 'positive', reason: `Verified service history (${verifiedServicesCount} records)` });
  }

  // 4. Major accidents penalty
  if (majorAccidentsCount > 0) {
    trustScore -= majorAccidentsCount * 15;
    baseValue *= 0.8;
    trustFactors.push({ type: 'negative', reason: 'Major accident/repair history' });
  }

  // 5. No service records penalty
  if (!services || services.length === 0) {
    trustScore -= 30;
    trustFactors.push({ type: 'negative', reason: 'No service records available' });
  }

  // 6. Maintenance gaps (if age > 0 and services count is less than ageYears)
  if (services && services.length > 0 && ageYears > 0 && services.length < ageYears) {
    trustScore -= 15;
    trustFactors.push({ type: 'negative', reason: 'Maintenance gaps detected (incomplete service history)' });
  }

  // 7. Vehicle Health / Condition
  const healthData = calculateVehicleHealth(vehicle, services || []);
  const healthScore = healthData.healthScore ?? 100;

  if (healthScore >= 85) {
    baseValue *= 1.05;
    trustScore += 5;
    trustFactors.push({ type: 'positive', reason: 'Excellent vehicle condition' });
  } else if (healthScore >= 70 && healthScore < 85) {
    trustFactors.push({ type: 'positive', reason: 'Good vehicle condition' });
  } else if (healthScore >= 50 && healthScore < 70) {
    baseValue *= 0.9;
    trustScore -= 10;
    trustFactors.push({ type: 'negative', reason: 'Average vehicle condition' });
  } else { // healthScore < 50 (Poor)
    baseValue *= 0.8;
    trustScore -= 25;
    trustFactors.push({ type: 'negative', reason: 'Poor vehicle condition' });
  }

  // 8. Insurance status
  let isInsuranceValid = false;
  if (vehicle && vehicle.insuranceExpiry) {
    const expDate = DateTime.fromISO(vehicle.insuranceExpiry).startOf('day');
    if (expDate.isValid && expDate >= now.startOf('day')) {
      isInsuranceValid = true;
    }
  }

  if (isInsuranceValid) {
    trustFactors.push({ type: 'positive', reason: 'Active insurance policy' });
  } else {
    trustScore -= 5;
    trustFactors.push({ type: 'negative', reason: 'Expired or missing insurance' });
  }

  trustScore = Math.max(0, Math.min(100, trustScore));

  const minValue = Math.trunc(baseValue * 0.95);
  const maxValue = Math.trunc(baseValue * 1.05);

  let riskLevel;
  if (trustScore >= 85) riskLevel = 'Low';
  else if (trustScore >= 65) riskLevel = 'Medium';
  else riskLevel = 'High';

  return {
    vehicleId: String(vehicle._id),
    originalPrice: purchasePrice,
    estimatedValueRange: {
      min: minValue,
      max: maxValue,
      mean: Math.trunc(baseValue)
    },
    trustScore,
    trustFactors,
    maintenanceQuality: healthData.conditionLevel || 'Good',
    riskLevel,
    ageYears
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

    const report = calculateResaleReport(vehicle, serviceList);
    return res.status(200).json(report);
  } catch (e) {
    return res.status(500).json({ msg: 'Error generating resale report', error: String(e && e.message ? e.message : e) });
  }
});

module.exports = router;
