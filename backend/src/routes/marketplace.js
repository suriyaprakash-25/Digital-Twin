const express = require('express');
const { ObjectId } = require('mongodb');

const { getDb } = require('../db');
const { calculateCurrentStatus } = require('../services/availabilityService');

const { getCache, CACHE_KEYS } = require('../infrastructure/cache/cache');
const { CACHE } = require('../core/constants');
const { parsePagination, setPaginationHeaders } = require('../core/pagination');

const router = express.Router();

const MARKETPLACE_DEFAULT_LIMIT = 100;

/**
 * Read-through cache of the slowly-changing part of the listing (garage profiles + their service
 * catalogues). Live fields (open/closed status, active booking counts) are computed per request.
 * Any garage write invalidates the prefix (see invalidateCacheOnWrite in routes/garages.js, admin.js).
 */
async function loadListingSnapshot(db, page) {
  const key = `${CACHE_KEYS.GARAGE_LIST}${page.page}:${page.limit}`;
  return getCache().wrap(key, CACHE.GARAGE_LIST_TTL_MS, async () => {
    const filter = { isActive: { $ne: false } };
    const [garageDocs, total] = await Promise.all([
      db.collection('garages').find(filter).sort({ createdAt: -1 }).skip(page.skip).limit(page.limit).toArray(),
      db.collection('garages').countDocuments(filter)
    ]);
    const services = await db.collection('garageServices')
      .find({ garageId: { $in: garageDocs.map((g) => g._id) }, isActive: { $ne: false } })
      .sort({ createdAt: -1 })
      .toArray();
    // Cache values must be plain data (portable to Redis): ids are stored as strings.
    return {
      garageDocs: garageDocs.map((g) => ({ ...g, _id: String(g._id) })),
      services: services.map((s) => ({ ...s, _id: String(s._id), garageId: String(s.garageId) })),
      total
    };
  });
}

// Public marketplace listing: garages + their active services (paginated, cached)
router.get('/', async (req, res) => {
  const db = getDb();

  try {
    const page = parsePagination(req.query, { defaultLimit: MARKETPLACE_DEFAULT_LIMIT });
    const { garageDocs: cachedGarages, services, total } = await loadListingSnapshot(db, page);
    const garageDocs = cachedGarages.map((g) => ({ ...g, _id: new ObjectId(g._id) }));
    const garageIds = garageDocs.map((g) => g._id);
    setPaginationHeaders(res, { total, page: page.page, limit: page.limit });

    // Aggregate active bookings counts for all listed garages
    const activeBookings = await db.collection('bookings').aggregate([
      { $match: { garageId: { $in: garageIds }, status: { $in: ['ACCEPTED', 'IN_PROGRESS'] } } },
      { $group: { _id: '$garageId', count: { $sum: 1 } } }
    ]).toArray();

    const activeCountsMap = new Map();
    for (const item of activeBookings) {
      activeCountsMap.set(String(item._id), item.count);
    }

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
      verified: g.verified === true,
      photoUrl: g.photoUrl || null,
      galleryPhotos: Array.isArray(g.galleryPhotos) ? g.galleryPhotos : [],
      createdAt: g.createdAt,
      garageLocation: g.garageLocation || null,
      services: servicesByGarage.get(String(g._id)) || [],
      availabilityMode: g.availabilityMode || 'AUTO',
      manualStatus: g.manualStatus || 'CLOSED',
      currentStatus: calculateCurrentStatus(g),
      businessHours: g.businessHours || null,
      maxCapacity: g.maxCapacity !== undefined ? g.maxCapacity : 20,
      activeBookingsCount: activeCountsMap.get(String(g._id)) || 0
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

    const activeBookingsCount = await db.collection('bookings').countDocuments({
      garageId: garage._id,
      status: { $in: ['ACCEPTED', 'IN_PROGRESS'] }
    });

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
      })),
      availabilityMode: garage.availabilityMode || 'AUTO',
      manualStatus: garage.manualStatus || 'CLOSED',
      currentStatus: calculateCurrentStatus(garage),
      businessHours: garage.businessHours || null,
      maxCapacity: garage.maxCapacity !== undefined ? garage.maxCapacity : 20,
      activeBookingsCount
    });
  } catch (e) {
    return res.status(500).json({ msg: 'Error loading garage', error: String(e && e.message ? e.message : e) });
  }
});

module.exports = router;
