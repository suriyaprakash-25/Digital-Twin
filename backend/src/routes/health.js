const express = require('express');
const { ObjectId } = require('mongodb');
const { DateTime } = require('luxon');

const { getDb } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { parseAnyDate } = require('../utils/dates');

const router = express.Router();

const calculateHealthScore = require('../utils/healthCalc');

function calculateVehicleHealth(vehicle, services) {
  const result = calculateHealthScore(vehicle, services);
  const behavior = [];

  if (result.breakdown.insuranceValid) behavior.push('Insurance policy is active.');
  else behavior.push('Insurance policy is expired or not logged.');

  if (result.breakdown.regularServices) behavior.push('Regular maintenance schedule followed.');
  else behavior.push('Fewer than 2 service records logged.');

  if (result.breakdown.verifiedRecords) behavior.push('Maintenance logged by verified workshops.');

  if (result.breakdown.recentService) behavior.push('Recent service record logged.');

  if (result.breakdown.noMajorRepairs) behavior.push('No major repairs or accidents flagged.');
  else behavior.push('Major repairs or accidental damage detected.');

  return {
    healthScore: result.healthScore,
    conditionLevel: result.conditionLevel,
    maintenanceBehavior: behavior
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
