const express = require('express');
const { ObjectId } = require('mongodb');

const { getDb } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { notifyUser } = require('../services/notifications');

const router = express.Router();

function toObjectId(id) {
  return new ObjectId(String(id));
}

function safeDate(value) {
  if (!value) return null;
  const d = new Date(value);
  // eslint-disable-next-line no-restricted-globals
  if (isNaN(d.getTime())) return null;
  return d;
}

router.post('/', requireAuth, requireRole('USER'), async (req, res) => {
  const { garageId, serviceId, vehicleId, scheduledFor, notes } = req.body || {};

  if (!garageId || !serviceId || !vehicleId) {
    return res.status(400).json({ msg: 'garageId, serviceId, vehicleId are required' });
  }

  const scheduled = safeDate(scheduledFor);
  if (scheduledFor && !scheduled) {
    return res.status(400).json({ msg: 'scheduledFor must be a valid date/time' });
  }

  const db = getDb();
  const garages = db.collection('garages');
  const garageServices = db.collection('garageServices');
  const vehicles = db.collection('vehicles');
  const bookings = db.collection('bookings');

  try {
    const [garage, service, vehicle] = await Promise.all([
      garages.findOne({ _id: toObjectId(garageId), isActive: { $ne: false } }),
      garageServices.findOne({ _id: toObjectId(serviceId), isActive: { $ne: false }, isArchived: { $ne: true } }),
      vehicles.findOne({ _id: toObjectId(vehicleId), ownerId: String(req.user.id), isArchived: { $ne: true } })
    ]);

    if (!garage) return res.status(404).json({ msg: 'Garage not found' });
    if (!service) return res.status(404).json({ msg: 'Service not found' });
    if (!vehicle) return res.status(404).json({ msg: 'Vehicle not found' });

    const timeline = [{ status: 'REQUESTED', at: new Date(), by: 'USER' }];

    const doc = {
      userId: String(req.user.id),
      garageId: garage._id,
      serviceId: service._id,
      vehicleId: vehicle._id,
      scheduledFor: scheduled,
      notes: notes ? String(notes) : '',
      status: 'REQUESTED',
      timeline,
      snapshots: {
        garage: {
          name: garage.name,
          phone: garage.phone,
          address: garage.address,
          city: garage.city
        },
        service: {
          title: service.title,
          price: service.price,
          durationMins: service.durationMins
        },
        vehicle: {
          vehicleNumber: vehicle.vehicleNumber,
          brand: vehicle.brand,
          model: vehicle.model
        }
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await bookings.insertOne(doc);

    // Notify garage owner
    if (garage.ownerUserId) {
      await notifyUser(String(garage.ownerUserId), {
        title: 'New booking request',
        body: `${vehicle.vehicleNumber || 'A vehicle'} requested: ${service.title}`,
        data: {
          type: 'BOOKING_REQUEST',
          bookingId: String(result.insertedId)
        }
      });
    }

    return res.status(201).json({ msg: 'Booking requested', id: String(result.insertedId) });
  } catch (e) {
    return res.status(500).json({ msg: 'Error creating booking', error: String(e && e.message ? e.message : e) });
  }
});

router.get('/my', requireAuth, requireRole('USER'), async (req, res) => {
  const db = getDb();
  const bookings = db.collection('bookings');

  try {
    const docs = await bookings
      .find({ userId: String(req.user.id) })
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();

    return res.status(200).json(
      docs.map((b) => ({
        id: String(b._id),
        status: b.status,
        scheduledFor: b.scheduledFor,
        notes: b.notes,
        timeline: b.timeline || [],
        createdAt: b.createdAt,
        garage: b.snapshots && b.snapshots.garage,
        service: b.snapshots && b.snapshots.service,
        vehicle: b.snapshots && b.snapshots.vehicle
      }))
    );
  } catch (e) {
    return res.status(500).json({ msg: 'Error loading bookings', error: String(e && e.message ? e.message : e) });
  }
});

router.get('/garage', requireAuth, requireRole('GARAGE'), async (req, res) => {
  const db = getDb();
  const garages = db.collection('garages');
  const bookings = db.collection('bookings');

  try {
    const garage = await garages.findOne({ ownerUserId: String(req.user.id), isActive: { $ne: false } });
    if (!garage) {
      return res.status(400).json({ msg: 'Create your garage profile first' });
    }

    const docs = await bookings
      .find({ garageId: garage._id })
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray();

    return res.status(200).json(
      docs.map((b) => ({
        id: String(b._id),
        status: b.status,
        scheduledFor: b.scheduledFor,
        notes: b.notes,
        timeline: b.timeline || [],
        createdAt: b.createdAt,
        userId: b.userId,
        garage: b.snapshots && b.snapshots.garage,
        service: b.snapshots && b.snapshots.service,
        vehicle: b.snapshots && b.snapshots.vehicle
      }))
    );
  } catch (e) {
    return res.status(500).json({ msg: 'Error loading garage bookings', error: String(e && e.message ? e.message : e) });
  }
});

router.patch('/:bookingId/status', requireAuth, requireRole('GARAGE'), async (req, res) => {
  const { status } = req.body || {};
  const nextStatus = String(status || '').toUpperCase();
  const allowed = new Set(['ACCEPTED', 'REJECTED', 'IN_PROGRESS', 'COMPLETED']);

  if (!allowed.has(nextStatus)) {
    return res.status(400).json({ msg: 'Invalid status' });
  }

  const db = getDb();
  const garages = db.collection('garages');
  const bookings = db.collection('bookings');

  try {
    const garage = await garages.findOne({ ownerUserId: String(req.user.id), isActive: { $ne: false } });
    if (!garage) {
      return res.status(400).json({ msg: 'Create your garage profile first' });
    }

    const booking = await bookings.findOne({ _id: toObjectId(req.params.bookingId), garageId: garage._id });
    if (!booking) {
      return res.status(404).json({ msg: 'Booking not found' });
    }

    const timelineEntry = { status: nextStatus, at: new Date(), by: 'GARAGE' };

    await bookings.updateOne(
      { _id: booking._id },
      {
        $set: { status: nextStatus, updatedAt: new Date() },
        $push: { timeline: timelineEntry }
      }
    );

    // Notify user
    if (booking.userId) {
      const vehicleNumber = booking.snapshots && booking.snapshots.vehicle && booking.snapshots.vehicle.vehicleNumber;
      const serviceTitle = booking.snapshots && booking.snapshots.service && booking.snapshots.service.title;

      await notifyUser(String(booking.userId), {
        title: 'Booking update',
        body: `${serviceTitle || 'Service'} for ${vehicleNumber || 'your vehicle'} is now ${nextStatus.replace('_', ' ')}`,
        data: {
          type: 'BOOKING_UPDATE',
          bookingId: String(booking._id),
          status: nextStatus
        }
      });
    }

    return res.status(200).json({ msg: 'Booking updated' });
  } catch (e) {
    return res.status(500).json({ msg: 'Error updating booking', error: String(e && e.message ? e.message : e) });
  }
});

module.exports = router;
