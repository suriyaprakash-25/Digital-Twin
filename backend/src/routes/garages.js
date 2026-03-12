const express = require('express');
const fs = require('fs');
const { ObjectId } = require('mongodb');

const { getDb } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { upload, removeUploadByUrl } = require('../utils/uploads');

const router = express.Router();

router.get('/me', requireAuth, requireRole('GARAGE'), async (req, res) => {
  const db = getDb();
  const garages = db.collection('garages');

  try {
    const garage = await garages.findOne({ ownerUserId: String(req.user.id), isActive: { $ne: false } });
    if (!garage) {
      return res.status(200).json({ exists: false });
    }

    return res.status(200).json({
      exists: true,
      id: String(garage._id),
      name: garage.name,
      phone: garage.phone,
      address: garage.address,
      city: garage.city,
      description: garage.description,
      isActive: Boolean(garage.isActive !== false),
      createdAt: garage.createdAt,
      garageLocation: garage.garageLocation || null,
      photoUrl: garage.photoUrl || null
    });
  } catch (e) {
    return res.status(500).json({ msg: 'Error loading garage profile', error: String(e && e.message ? e.message : e) });
  }
});

router.post('/me', requireAuth, requireRole('GARAGE'), async (req, res) => {
  const db = getDb();
  const garages = db.collection('garages');

  const { name, phone, address, city, description } = req.body || {};

  if (!name) {
    return res.status(400).json({ msg: 'Garage name is required' });
  }

  try {
    const update = {
      name: String(name),
      phone: phone ? String(phone) : '',
      address: address ? String(address) : '',
      city: city ? String(city) : '',
      description: description ? String(description) : '',
      ownerUserId: String(req.user.id),
      isActive: true,
      updatedAt: new Date()
    };

    const existing = await garages.findOne({ ownerUserId: String(req.user.id) });

    if (existing) {
      await garages.updateOne({ _id: existing._id }, { $set: update });
      return res.status(200).json({ msg: 'Garage profile updated', id: String(existing._id) });
    }

    const result = await garages.insertOne({
      ...update,
      createdAt: new Date()
    });

    return res.status(201).json({ msg: 'Garage profile created', id: String(result.insertedId) });
  } catch (e) {
    return res.status(500).json({ msg: 'Error saving garage profile', error: String(e && e.message ? e.message : e) });
  }
});

router.get('/me/services', requireAuth, requireRole('GARAGE'), async (req, res) => {
  const db = getDb();
  const garages = db.collection('garages');
  const garageServices = db.collection('garageServices');

  try {
    const garage = await garages.findOne({ ownerUserId: String(req.user.id), isActive: { $ne: false } });
    if (!garage) {
      return res.status(400).json({ msg: 'Create your garage profile first' });
    }

    const services = await garageServices
      .find({ garageId: garage._id, isArchived: { $ne: true } })
      .sort({ createdAt: -1 })
      .toArray();

    return res.status(200).json(
      services.map((s) => ({
        id: String(s._id),
        title: s.title,
        description: s.description,
        price: s.price,
        durationMins: s.durationMins,
        isActive: Boolean(s.isActive !== false)
      }))
    );
  } catch (e) {
    return res.status(500).json({ msg: 'Error loading services', error: String(e && e.message ? e.message : e) });
  }
});

router.post('/me/services', requireAuth, requireRole('GARAGE'), async (req, res) => {
  const db = getDb();
  const garages = db.collection('garages');
  const garageServices = db.collection('garageServices');

  const { title, description, price, durationMins } = req.body || {};
  if (!title) {
    return res.status(400).json({ msg: 'Service title is required' });
  }

  try {
    const garage = await garages.findOne({ ownerUserId: String(req.user.id), isActive: { $ne: false } });
    if (!garage) {
      return res.status(400).json({ msg: 'Create your garage profile first' });
    }

    const doc = {
      garageId: garage._id,
      title: String(title),
      description: description ? String(description) : '',
      price: price !== undefined && price !== null && String(price).trim() !== '' ? Number(price) : null,
      durationMins: durationMins !== undefined && durationMins !== null && String(durationMins).trim() !== '' ? Number(durationMins) : null,
      isActive: true,
      isArchived: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await garageServices.insertOne(doc);
    return res.status(201).json({ msg: 'Service created', id: String(result.insertedId) });
  } catch (e) {
    return res.status(500).json({ msg: 'Error creating service', error: String(e && e.message ? e.message : e) });
  }
});

router.put('/me/services/:serviceId', requireAuth, requireRole('GARAGE'), async (req, res) => {
  const db = getDb();
  const garages = db.collection('garages');
  const garageServices = db.collection('garageServices');

  const { title, description, price, durationMins, isActive } = req.body || {};

  try {
    const garage = await garages.findOne({ ownerUserId: String(req.user.id), isActive: { $ne: false } });
    if (!garage) {
      return res.status(400).json({ msg: 'Create your garage profile first' });
    }

    const update = {
      updatedAt: new Date()
    };
    if (title !== undefined) update.title = String(title);
    if (description !== undefined) update.description = String(description);
    if (price !== undefined) update.price = String(price).trim() === '' ? null : Number(price);
    if (durationMins !== undefined) update.durationMins = String(durationMins).trim() === '' ? null : Number(durationMins);
    if (isActive !== undefined) update.isActive = Boolean(isActive);

    const result = await garageServices.updateOne(
      { _id: new ObjectId(String(req.params.serviceId)), garageId: garage._id, isArchived: { $ne: true } },
      { $set: update }
    );

    if (!result.matchedCount) {
      return res.status(404).json({ msg: 'Service not found' });
    }

    return res.status(200).json({ msg: 'Service updated' });
  } catch (e) {
    return res.status(500).json({ msg: 'Error updating service', error: String(e && e.message ? e.message : e) });
  }
});

router.delete('/me/services/:serviceId', requireAuth, requireRole('GARAGE'), async (req, res) => {
  const db = getDb();
  const garages = db.collection('garages');
  const garageServices = db.collection('garageServices');

  try {
    const garage = await garages.findOne({ ownerUserId: String(req.user.id), isActive: { $ne: false } });
    if (!garage) {
      return res.status(400).json({ msg: 'Create your garage profile first' });
    }

    const result = await garageServices.updateOne(
      { _id: new ObjectId(String(req.params.serviceId)), garageId: garage._id },
      { $set: { isArchived: true, isActive: false, updatedAt: new Date() } }
    );

    if (!result.matchedCount) {
      return res.status(404).json({ msg: 'Service not found' });
    }

    return res.status(200).json({ msg: 'Service removed' });
  } catch (e) {
    return res.status(500).json({ msg: 'Error removing service', error: String(e && e.message ? e.message : e) });
  }
});

// POST /api/garages/photo — garage owner uploads a profile photo
router.post('/photo', requireAuth, requireRole('GARAGE'), upload.single('photo'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ msg: 'No photo uploaded' });
  }
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedTypes.includes(req.file.mimetype)) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ msg: 'Only image files (JPEG, PNG, WebP) are allowed' });
  }

  const db = getDb();
  const garages = db.collection('garages');

  try {
    const garage = await garages.findOne({ ownerUserId: String(req.user.id), isActive: { $ne: false } });
    if (!garage) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ msg: 'Create your garage profile first' });
    }

    if (garage.photoUrl) {
      removeUploadByUrl(garage.photoUrl);
    }

    const photoUrl = `http://localhost:5000/uploads/${req.file.filename}`;
    await garages.updateOne({ _id: garage._id }, { $set: { photoUrl, updatedAt: new Date() } });

    return res.status(200).json({ msg: 'Photo uploaded', photoUrl });
  } catch (e) {
    return res.status(500).json({ msg: 'Error uploading photo', error: String(e && e.message ? e.message : e) });
  }
});

// POST /api/garages/location — garage owner saves their map coordinates
router.post('/location', requireAuth, requireRole('GARAGE'), async (req, res) => {
  const db = getDb();
  const garages = db.collection('garages');

  const { latitude, longitude, address } = req.body || {};

  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return res.status(400).json({ msg: 'Valid latitude and longitude are required' });
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({ msg: 'Coordinates out of valid range' });
  }

  try {
    const existing = await garages.findOne({ ownerUserId: String(req.user.id) });
    if (!existing) {
      return res.status(404).json({ msg: 'Create your garage profile first' });
    }

    await garages.updateOne(
      { _id: existing._id },
      {
        $set: {
          garageLocation: {
            latitude: lat,
            longitude: lng,
            address: address ? String(address).slice(0, 500) : ''
          },
          updatedAt: new Date()
        }
      }
    );

    return res.status(200).json({ msg: 'Location saved successfully' });
  } catch (e) {
    return res.status(500).json({ msg: 'Error saving location', error: String(e && e.message ? e.message : e) });
  }
});

// GET /api/garages/location/:garageId — public endpoint to fetch a garage location
router.get('/location/:garageId', async (req, res) => {
  const db = getDb();
  const garages = db.collection('garages');

  try {
    const garage = await garages.findOne({ _id: new ObjectId(String(req.params.garageId)), isActive: { $ne: false } });
    if (!garage) {
      return res.status(404).json({ msg: 'Garage not found' });
    }

    if (!garage.garageLocation) {
      return res.status(200).json({ exists: false });
    }

    return res.status(200).json({
      exists: true,
      latitude: garage.garageLocation.latitude,
      longitude: garage.garageLocation.longitude,
      address: garage.garageLocation.address || ''
    });
  } catch (e) {
    return res.status(500).json({ msg: 'Error fetching location', error: String(e && e.message ? e.message : e) });
  }
});

module.exports = router;
