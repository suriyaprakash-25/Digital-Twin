const express = require('express');
const { ObjectId } = require('mongodb');

const { getDb } = require('../db');

const router = express.Router();

// Public marketplace listing: garages + their active services
router.get('/', async (req, res) => {
  const db = getDb();
  const garages = db.collection('garages');
  const garageServices = db.collection('garageServices');

  try {
    const garageDocs = await garages
      .find({ isActive: { $ne: false } })
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();

    const garageIds = garageDocs.map((g) => g._id);
    const services = await garageServices
      .find({ garageId: { $in: garageIds }, isActive: { $ne: false } })
      .sort({ createdAt: -1 })
      .toArray();

    const servicesByGarage = new Map();
    for (const s of services) {
      const key = String(s.garageId);
      if (!servicesByGarage.has(key)) servicesByGarage.set(key, []);
      servicesByGarage.get(key).push({
        id: String(s._id),
        title: s.title,
        description: s.description,
        price: s.price,
        durationMins: s.durationMins,
        isActive: Boolean(s.isActive !== false)
      });
    }

    const payload = garageDocs.map((g) => ({
      id: String(g._id),
      name: g.name,
      phone: g.phone,
      address: g.address,
      city: g.city,
      description: g.description,
      ownerUserId: g.ownerUserId,
      isActive: Boolean(g.isActive !== false),
      createdAt: g.createdAt,
      garageLocation: g.garageLocation || null,
      services: servicesByGarage.get(String(g._id)) || []
    }));

    return res.status(200).json(payload);
  } catch (e) {
    return res.status(500).json({ msg: 'Error loading marketplace', error: String(e && e.message ? e.message : e) });
  }
});

router.get('/garages/:garageId', async (req, res) => {
  const db = getDb();
  const garages = db.collection('garages');
  const garageServices = db.collection('garageServices');

  try {
    const garage = await garages.findOne({ _id: new ObjectId(String(req.params.garageId)), isActive: { $ne: false } });
    if (!garage) {
      return res.status(404).json({ msg: 'Garage not found' });
    }

    const services = await garageServices
      .find({ garageId: garage._id, isActive: { $ne: false } })
      .sort({ createdAt: -1 })
      .toArray();

    return res.status(200).json({
      id: String(garage._id),
      name: garage.name,
      phone: garage.phone,
      address: garage.address,
      city: garage.city,
      description: garage.description,
      services: services.map((s) => ({
        id: String(s._id),
        title: s.title,
        description: s.description,
        price: s.price,
        durationMins: s.durationMins
      }))
    });
  } catch (e) {
    return res.status(500).json({ msg: 'Error loading garage', error: String(e && e.message ? e.message : e) });
  }
});

module.exports = router;
