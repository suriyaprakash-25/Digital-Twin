const express = require('express');
const { ObjectId } = require('mongodb');
const { getDb } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { createUploader } = require('../utils/uploads');
const {
  persistUploadedFile,
  deletePersistedFile,
  removeTemporaryFile
} = require('../services/persistentFileStorage');

const router = express.Router();
const insuranceUpload = createUploader(['application/pdf'], 10 * 1024 * 1024);

// Add insurance policy with a persistent PDF upload.
router.post('/add', requireAuth, insuranceUpload.single('document'), async (req, res) => {
  const { vehicleId, provider, policyNumber, startDate, expiryDate } = req.body || {};
  const docFile = req.file;

  if (!vehicleId || !provider || !policyNumber || !startDate || !expiryDate) {
    removeTemporaryFile(docFile);
    return res.status(400).json({ msg: 'All text fields are required' });
  }

  if (!docFile) {
    return res.status(400).json({ msg: 'Insurance PDF document is required' });
  }

  const db = getDb();

  let vehicleObjectId;
  try {
    vehicleObjectId = new ObjectId(vehicleId);
  } catch {
    removeTemporaryFile(docFile);
    return res.status(400).json({ msg: 'Invalid vehicle ID' });
  }

  let persistedDocument = null;
  let policyStored = false;

  try {
    const vehicle = await db.collection('vehicles').findOne({
      _id: vehicleObjectId,
      ownerId: req.user.id,
      isArchived: { $ne: true }
    });
    if (!vehicle) {
      removeTemporaryFile(docFile);
      return res.status(404).json({ msg: 'Vehicle not found or unauthorized access' });
    }

    persistedDocument = await persistUploadedFile(docFile, {
      folder: 'driveportz/insurance',
      resourceType: 'auto'
    });

    const newInsurance = {
      vehicleId: String(vehicleId),
      ownerId: String(req.user.id),
      provider: String(provider).trim(),
      policyNumber: String(policyNumber).trim(),
      startDate,
      expiryDate,
      documentUrl: persistedDocument.url,
      documentStorageProvider: persistedDocument.storageProvider,
      documentStorageKey: persistedDocument.storageKey,
      documentResourceType: persistedDocument.resourceType || 'auto',
      createdAt: new Date()
    };

    const insertResult = await db.collection('insurance').insertOne(newInsurance);
    newInsurance._id = insertResult.insertedId;
    policyStored = true;

    const latestPolicy = await db.collection('insurance')
      .find({ vehicleId: String(vehicleId) })
      .sort({ expiryDate: -1 })
      .limit(1)
      .toArray();

    if (latestPolicy.length > 0 && String(latestPolicy[0]._id) === String(insertResult.insertedId)) {
      await db.collection('vehicles').updateOne(
        { _id: vehicleObjectId, ownerId: req.user.id },
        {
          $set: {
            insuranceProvider: newInsurance.provider,
            insuranceExpiry: expiryDate,
            insuranceDocumentUrl: persistedDocument.url,
            insuranceDocumentStorageProvider: persistedDocument.storageProvider,
            insuranceDocumentStorageKey: persistedDocument.storageKey,
            insuranceDocumentResourceType: persistedDocument.resourceType || 'auto'
          }
        }
      );
    }

    return res.status(201).json({
      msg: 'Insurance policy logged successfully',
      insurance: newInsurance
    });
  } catch (err) {
    if (!policyStored && persistedDocument) {
      await deletePersistedFile(persistedDocument);
    } else if (!persistedDocument) {
      removeTemporaryFile(docFile);
    }
    console.error('Error logging insurance:', err);
    return res.status(500).json({ msg: 'Server error logging insurance' });
  }
});

// Get all insurance policies for a vehicle.
router.get('/:vehicleId', requireAuth, async (req, res) => {
  const { vehicleId } = req.params;
  const db = getDb();

  let vehicleObjectId;
  try {
    vehicleObjectId = new ObjectId(vehicleId);
  } catch {
    return res.status(400).json({ msg: 'Invalid vehicle ID' });
  }

  try {
    const vehicle = await db.collection('vehicles').findOne({
      _id: vehicleObjectId,
      ownerId: req.user.id,
      isArchived: { $ne: true }
    });
    if (!vehicle) {
      return res.status(404).json({ msg: 'Vehicle not found or unauthorized access' });
    }

    const policies = await db.collection('insurance')
      .find({ vehicleId: String(vehicleId), ownerId: String(req.user.id) })
      .sort({ expiryDate: -1 })
      .toArray();

    return res.status(200).json(policies);
  } catch (err) {
    console.error('Error fetching insurance policies:', err);
    return res.status(500).json({ msg: 'Server error fetching policies' });
  }
});

module.exports = router;
