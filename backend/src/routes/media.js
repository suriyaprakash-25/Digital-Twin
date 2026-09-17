const express = require('express');
const { ObjectId } = require('mongodb');
const { getDb } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { upload } = require('../utils/uploads');
const {
  persistUploadedFile,
  deletePersistedFile,
  removeTemporaryFile
} = require('../services/persistentFileStorage');

const router = express.Router();

function toObjectId(id) {
  try {
    return new ObjectId(String(id));
  } catch {
    return null;
  }
}

// Helper function to check authorization
async function isAuthorizedForEntity(req, entityType, entityId) {
  if (req.user.role === 'ADMIN') return true;

  const db = getDb();
  const objId = toObjectId(entityId);
  if (!objId) return false;

  if (entityType === 'VEHICLE') {
    const vehicle = await db.collection('vehicles').findOne({ _id: objId });
    if (!vehicle) return false;
    return String(vehicle.ownerId) === String(req.user.id);
  }

  if (entityType === 'BOOKING') {
    const booking = await db.collection('bookings').findOne({ _id: objId });
    if (!booking) return false;
    if (String(booking.userId) === String(req.user.id)) return true;

    if (req.user.role === 'GARAGE') {
      const garage = await db.collection('garages').findOne({ _id: booking.garageId });
      return garage && String(garage.ownerUserId) === String(req.user.id);
    }
    return false;
  }

  if (entityType === 'SERVICE') {
    const service = await db.collection('services').findOne({ _id: objId });
    if (!service) return false;
    if (String(service.ownerId) === String(req.user.id)) return true;

    if (req.user.role === 'GARAGE' && String(service.createdBy) === String(req.user.id)) {
      return true;
    }
    return false;
  }

  return false;
}

// Upload new media
router.post('/upload', requireAuth, (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ msg: err.message || 'File upload failed' });
    }
    next();
  });
}, async (req, res) => {
  let persisted = null;

  try {
    if (!req.file) {
      return res.status(400).json({ msg: 'No file uploaded' });
    }

    const { entityId, entityType, category } = req.body;
    if (!entityId || !entityType || !category) {
      removeTemporaryFile(req.file);
      return res.status(400).json({ msg: 'entityId, entityType, and category are required' });
    }

    const normalizedEntityType = String(entityType).toUpperCase();
    const normalizedCategory = String(category).toUpperCase();
    const isAuthorized = await isAuthorizedForEntity(req, normalizedEntityType, entityId);
    if (!isAuthorized) {
      removeTemporaryFile(req.file);
      return res.status(403).json({ msg: 'Forbidden: You do not have permission to attach media to this entity' });
    }

    persisted = await persistUploadedFile(req.file, {
      folder: `driveportz/media/${normalizedEntityType.toLowerCase()}`,
      resourceType: 'image'
    });

    const db = getDb();
    const mediaCollection = db.collection('media');
    const newMedia = {
      entityId: String(entityId),
      entityType: normalizedEntityType,
      category: normalizedCategory,
      url: persisted.url,
      storageProvider: persisted.storageProvider,
      storageKey: persisted.storageKey,
      resourceType: persisted.resourceType || 'image',
      uploadedBy: req.user.id,
      role: req.user.role,
      createdAt: new Date()
    };

    const result = await mediaCollection.insertOne(newMedia);
    return res.status(201).json({
      msg: 'File uploaded successfully',
      media: { _id: result.insertedId, ...newMedia }
    });
  } catch (err) {
    console.error('Upload Error:', err.message);
    if (!persisted) removeTemporaryFile(req.file);
    if (persisted) await deletePersistedFile(persisted);
    return res.status(500).json({ msg: 'Server error during upload' });
  }
});

// Get media by entity
router.get('/:entityType/:entityId', requireAuth, async (req, res) => {
  try {
    const entityType = String(req.params.entityType).toUpperCase();
    const entityId = req.params.entityId;

    const isAuthorized = await isAuthorizedForEntity(req, entityType, entityId);
    if (!isAuthorized) {
      return res.status(403).json({ msg: 'Forbidden: You do not have permission to view media for this entity' });
    }

    const db = getDb();
    const media = await db.collection('media').find({ entityType, entityId: String(entityId) }).toArray();
    return res.status(200).json(media);
  } catch (err) {
    console.error('Fetch Media Error:', err.message);
    return res.status(500).json({ msg: 'Server error while fetching media' });
  }
});

// Delete media
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const objId = toObjectId(req.params.id);
    if (!objId) return res.status(400).json({ msg: 'Invalid media ID' });

    const db = getDb();
    const mediaCollection = db.collection('media');
    const mediaDoc = await mediaCollection.findOne({ _id: objId });
    if (!mediaDoc) {
      return res.status(404).json({ msg: 'Media not found' });
    }

    const isAuthorized = await isAuthorizedForEntity(req, mediaDoc.entityType, mediaDoc.entityId);
    if (!isAuthorized && String(mediaDoc.uploadedBy) !== String(req.user.id)) {
      return res.status(403).json({ msg: 'Forbidden: You do not have permission to delete this media' });
    }

    await deletePersistedFile({
      url: mediaDoc.url,
      storageProvider: mediaDoc.storageProvider,
      storageKey: mediaDoc.storageKey,
      resourceType: mediaDoc.resourceType || 'image'
    });
    await mediaCollection.deleteOne({ _id: objId });

    return res.status(200).json({ msg: 'Media deleted successfully' });
  } catch (err) {
    console.error('Delete Media Error:', err.message);
    return res.status(500).json({ msg: 'Server error while deleting media' });
  }
});

module.exports = router;
