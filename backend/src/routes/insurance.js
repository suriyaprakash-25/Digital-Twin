const express = require('express');
const { ObjectId } = require('mongodb');
const { getDb } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { upload } = require('../utils/uploads');

const router = express.Router();

// Add insurance policy with file upload (PDF)
router.post('/add', requireAuth, upload.single('document'), async (req, res) => {
  const { vehicleId, provider, policyNumber, startDate, expiryDate } = req.body || {};
  const docFile = req.file;

  if (!vehicleId || !provider || !policyNumber || !startDate || !expiryDate) {
    return res.status(400).json({ msg: 'All text fields are required' });
  }

  if (!docFile) {
    return res.status(400).json({ msg: 'Insurance PDF document is required' });
  }

  const db = getDb();

  // Validate vehicle exists and user owns it
  let vehicleObjectId;
  try {
    vehicleObjectId = new ObjectId(vehicleId);
  } catch (e) {
    return res.status(400).json({ msg: 'Invalid vehicle ID' });
  }

  try {
    const vehicle = await db.collection('vehicles').findOne({ _id: vehicleObjectId, ownerId: req.user.id });
    if (!vehicle) {
      return res.status(404).json({ msg: 'Vehicle not found or unauthorized access' });
    }

    const documentUrl = `/uploads/${docFile.filename}`;

    const newInsurance = {
      vehicleId: String(vehicleId),
      provider,
      policyNumber,
      startDate,
      expiryDate,
      documentUrl,
      createdAt: new Date()
    };

    await db.collection('insurance').insertOne(newInsurance);

    // Also update vehicle's current insurance provider, expiry date and doc url if this is the newest
    // Fetch and check if this is the latest insurance policy
    const latestPolicy = await db.collection('insurance')
      .find({ vehicleId: String(vehicleId) })
      .sort({ expiryDate: -1 })
      .limit(1)
      .toArray();

    if (latestPolicy.length === 0 || expiryDate >= latestPolicy[0].expiryDate) {
      await db.collection('vehicles').updateOne(
        { _id: vehicleObjectId },
        {
          $set: {
            insuranceProvider: provider,
            insuranceExpiry: expiryDate,
            insuranceDocumentUrl: documentUrl
          }
        }
      );
    }

    return res.status(201).json({ msg: 'Insurance policy logged successfully', insurance: newInsurance });
  } catch (err) {
    console.error('Error logging insurance:', err);
    return res.status(500).json({ msg: 'Server error logging insurance', error: String(err && err.message ? err.message : err) });
  }
});

// Get all insurance policies for a vehicle
router.get('/:vehicleId', requireAuth, async (req, res) => {
  const { vehicleId } = req.params;
  const db = getDb();

  let vehicleObjectId;
  try {
    vehicleObjectId = new ObjectId(vehicleId);
  } catch (e) {
    return res.status(400).json({ msg: 'Invalid vehicle ID' });
  }

  try {
    // Validate vehicle ownership
    const vehicle = await db.collection('vehicles').findOne({ _id: vehicleObjectId, ownerId: req.user.id });
    if (!vehicle) {
      return res.status(404).json({ msg: 'Vehicle not found or unauthorized access' });
    }

    const policies = await db.collection('insurance')
      .find({ vehicleId: String(vehicleId) })
      .sort({ expiryDate: -1 })
      .toArray();

    return res.status(200).json(policies);
  } catch (err) {
    console.error('Error fetching insurance policies:', err);
    return res.status(500).json({ msg: 'Server error fetching policies', error: String(err && err.message ? err.message : err) });
  }
});

module.exports = router;
