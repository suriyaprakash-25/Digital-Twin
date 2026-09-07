const express = require('express');
const { ObjectId } = require('mongodb');
const { getDb } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { upload, removeUploadByUrl } = require('../utils/uploads');

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
    console.log('VEHICLE CHECK:', { objId, vehicle, reqUserId: req.user.id });
    if (!vehicle) return false;
    return String(vehicle.ownerId) === String(req.user.id);
  }

  if (entityType === 'BOOKING') {
    const booking = await db.collection('bookings').findOne({ _id: objId });
    console.log('BOOKING CHECK:', { objId, booking, reqUserId: req.user.id });
    if (!booking) return false;
    if (String(booking.userId) === String(req.user.id)) return true;
    
    // Check if garage owner
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
    
    // Check if garage owner
    if (req.user.role === 'GARAGE') {
      // In services, createdBy is usually the garage owner ID if logged by garage
      if (String(service.createdBy) === String(req.user.id)) return true;
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
  try {
    if (!req.file) {
      return res.status(400).json({ msg: 'No file uploaded' });
    }

    const { entityId, entityType, category } = req.body;
    if (!entityId || !entityType || !category) {
      removeUploadByUrl(`/uploads/${req.file.filename}`);
      return res.status(400).json({ msg: 'entityId, entityType, and category are required' });
    }

    const isAuthorized = await isAuthorizedForEntity(req, entityType, entityId);
    if (!isAuthorized) {
      removeUploadByUrl(`/uploads/${req.file.filename}`);
      
      const db = getDb();
      let debugInfo = { reqUserId: req.user.id };
      if (entityType === 'VEHICLE') {
         const v = await db.collection('vehicles').findOne({ _id: toObjectId(entityId) });
         debugInfo.vehicle = v;
      }
      if (entityType === 'BOOKING') {
         const b = await db.collection('bookings').findOne({ _id: toObjectId(entityId) });
         debugInfo.booking = b;
      }
      
      return res.status(403).json({ msg: 'Forbidden: You do not have permission to attach media to this entity', debug: debugInfo });
    }

    const db = getDb();
    const mediaCollection = db.collection('media');

    const newMedia = {
      entityId,
      entityType,
      category,
      url: `/uploads/${req.file.filename}`,
      uploadedBy: req.user.id,
      role: req.user.role,
      createdAt: new Date()
    };

    const result = await mediaCollection.insertOne(newMedia);
    return res.status(201).json({ msg: 'File uploaded successfully', media: { _id: result.insertedId, ...newMedia } });
  } catch (err) {
    console.error('Upload Error:', err);
    if (req.file) removeUploadByUrl(`/uploads/${req.file.filename}`);
    return res.status(500).json({ msg: 'Server error during upload' });
  }
});

// Get media by entity
router.get('/:entityType/:entityId', requireAuth, async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    
    const isAuthorized = await isAuthorizedForEntity(req, entityType, entityId);
    if (!isAuthorized) {
      return res.status(403).json({ msg: 'Forbidden: You do not have permission to view media for this entity' });
    }

    const db = getDb();
    const query = { entityType, entityId };
    
    const media = await db.collection('media').find(query).toArray();
    return res.status(200).json(media);
  } catch (err) {
    console.error('Fetch Media Error:', err);
    return res.status(500).json({ msg: 'Server error while fetching media' });
  }
});

// Delete media
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const mediaId = req.params.id;
    let objId = toObjectId(mediaId);
    if (!objId) return res.status(400).json({ msg: 'Invalid media ID' });

    const db = getDb();
    const mediaCollection = db.collection('media');
    
    const mediaDoc = await mediaCollection.findOne({ _id: objId });
    if (!mediaDoc) {
      return res.status(404).json({ msg: 'Media not found' });
    }

    const isAuthorized = await isAuthorizedForEntity(req, mediaDoc.entityType, mediaDoc.entityId);
    if (!isAuthorized && mediaDoc.uploadedBy !== req.user.id) {
       return res.status(403).json({ msg: 'Forbidden: You do not have permission to delete this media' });
    }

    removeUploadByUrl(mediaDoc.url);
    await mediaCollection.deleteOne({ _id: objId });

    return res.status(200).json({ msg: 'Media deleted successfully' });
  } catch (err) {
    console.error('Delete Media Error:', err);
    return res.status(500).json({ msg: 'Server error while deleting media' });
  }
});

module.exports = router;
