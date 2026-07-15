const express = require('express');
const { ObjectId } = require('mongodb');
const { getDb } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { calculateCurrentStatus } = require('../services/availabilityService');

const router = express.Router();

/**
 * PATCH /api/garage/availability
 * Updates the availability mode, manual status, and business hours.
 */
router.patch('/', requireAuth, requireRole('GARAGE'), async (req, res) => {
  const db = getDb();
  const garages = db.collection('garages');
  
  const { availabilityMode, manualStatus, businessHours } = req.body;

  try {
    const update = {
      statusUpdatedAt: new Date()
    };

    if (availabilityMode) update.availabilityMode = availabilityMode;
    if (manualStatus) update.manualStatus = manualStatus;
    if (businessHours) update.businessHours = businessHours;

    const result = await garages.findOneAndUpdate(
      { ownerUserId: String(req.user.id) },
      { $set: update },
      { returnDocument: 'after' }
    );

    const updatedGarage = result?.value || result;

    if (!updatedGarage || !updatedGarage._id) {
      return res.status(404).json({ msg: 'Garage profile not found. Please create one first.' });
    }

    // Return the dynamically calculated status
    const currentStatus = calculateCurrentStatus(updatedGarage);

    return res.status(200).json({ 
      msg: 'Availability updated successfully',
      availabilityMode: updatedGarage.availabilityMode,
      manualStatus: updatedGarage.manualStatus,
      currentStatus,
      businessHours: updatedGarage.businessHours,
      statusUpdatedAt: updatedGarage.statusUpdatedAt
    });

  } catch (e) {
    return res.status(500).json({ msg: 'Error updating availability', error: String(e && e.message ? e.message : e) });
  }
});

/**
 * GET /api/garage/availability/:garageId
 * Retrieves the current availability of a specific garage.
 */
router.get('/:garageId', async (req, res) => {
  const db = getDb();
  const garages = db.collection('garages');

  try {
    const garage = await garages.findOne({ _id: new ObjectId(String(req.params.garageId)) });
    if (!garage) {
      return res.status(404).json({ msg: 'Garage not found' });
    }

    const currentStatus = calculateCurrentStatus(garage);

    return res.status(200).json({
      availabilityMode: garage.availabilityMode || 'AUTO',
      manualStatus: garage.manualStatus || 'CLOSED',
      currentStatus,
      businessHours: garage.businessHours || null,
      statusUpdatedAt: garage.statusUpdatedAt || null
    });
  } catch (e) {
    return res.status(500).json({ msg: 'Error fetching availability', error: String(e && e.message ? e.message : e) });
  }
});

module.exports = router;
