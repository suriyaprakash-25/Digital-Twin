const express = require('express');
const { ObjectId } = require('mongodb');

const { getDb } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

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
      createdAt: garage.createdAt
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

module.exports = router;
