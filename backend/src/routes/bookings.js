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
  const { garageId, serviceId, vehicleId, scheduledFor, notes, isCustomIssue, issueDetails } = req.body || {};

  if (!garageId || !vehicleId) {
    return res.status(400).json({ msg: 'garageId and vehicleId are required' });
  }
  
  if (!serviceId && !isCustomIssue) {
    return res.status(400).json({ msg: 'Either serviceId or isCustomIssue must be provided' });
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
    const garagePromise = garages.findOne({ _id: toObjectId(garageId), isActive: { $ne: false } });
    const vehiclePromise = vehicles.findOne({ _id: toObjectId(vehicleId), ownerId: String(req.user.id), isArchived: { $ne: true } });
    
    let servicePromise = null;
    if (serviceId) {
      servicePromise = garageServices.findOne({ _id: toObjectId(serviceId), isActive: { $ne: false }, isArchived: { $ne: true } });
    }

    const [garage, serviceResult, vehicle] = await Promise.all([
      garagePromise,
      servicePromise,
      vehiclePromise
    ]);

    if (!garage) return res.status(404).json({ msg: 'Garage not found' });
    if (serviceId && !serviceResult) return res.status(404).json({ msg: 'Service not found' });
    if (!vehicle) return res.status(404).json({ msg: 'Vehicle not found' });

    // Build effective service object
    const service = isCustomIssue ? {
      _id: null,
      title: 'Custom Vehicle Issue',
      price: 0,
      durationMins: null,
      isCustomIssue: true,
      issueDetails: issueDetails || null
    } : serviceResult;

    // Enforce capacity check
    const activeBookingsCount = await bookings.countDocuments({
      garageId: garage._id,
      status: { $in: ['ACCEPTED', 'IN_PROGRESS'] }
    });
    const maxCapacity = garage.maxCapacity !== undefined ? garage.maxCapacity : 20;

    if (activeBookingsCount >= maxCapacity) {
      return res.status(400).json({ msg: 'This garage has reached its maximum capacity. No slots available at this time.' });
    }

    const timeline = [{ status: 'REQUESTED', at: new Date(), by: 'USER' }];

    const doc = {
      userId: String(req.user.id),
      garageId: garage._id,
      serviceId: service._id,
      vehicleId: vehicle._id,
      isCustomIssue: Boolean(isCustomIssue),
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
          durationMins: service.durationMins,
          isCustomIssue: service.isCustomIssue,
          issueDetails: service.issueDetails
        },
        vehicle: {
          vehicleNumber: vehicle.vehicleNumber,
          brand: vehicle.brand,
          model: vehicle.model
        },
        user: {
          name: req.user.name || 'Vehicle Owner',
          phone: req.user.phone || '',
          email: req.user.email || ''
        }
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await bookings.insertOne(doc);

    // Asynchronous non-blocking notification dispatch
    setImmediate(async () => {
      try {
        if (garage.ownerUserId) {
          // 1. App Push Notification
          try {
            await notifyUser(String(garage.ownerUserId), {
              title: 'New booking request',
              body: `${vehicle.vehicleNumber || 'A vehicle'} requested: ${service.title}`,
              data: {
                type: 'BOOKING_REQUEST',
                bookingId: String(result.insertedId)
              }
            });
          } catch (pushErr) {
            console.warn('Warning sending app push notification to garage owner:', pushErr.message);
          }

          // 2. Fetch Owner's User Record for Email and Phone notifications
          try {
            const usersCol = db.collection('users');
            const ownerUser = await usersCol.findOne({
              $or: [
                { _id: toObjectId(garage.ownerUserId) },
                { _id: garage.ownerUserId }
              ]
            });

            if (ownerUser) {
              const { sendEmail } = require('../services/emailService');
              const { sendSms } = require('../services/smsService');

              const formattedDate = scheduled ? scheduled.toLocaleString() : 'As soon as possible';

              // Send Email to Garage Owner
              if (ownerUser.email) {
                await sendEmail({
                  to: ownerUser.email,
                  subject: `New Booking Request - ${garage.name}`,
                  text: `New booking request at ${garage.name}!\n\n` +
                        `Customer: ${req.user.name || 'Vehicle Owner'}\n` +
                        `Email: ${req.user.email || 'N/A'}\n` +
                        `Phone: ${req.user.phone || 'N/A'}\n` +
                        `Vehicle: ${vehicle.brand} ${vehicle.model} (${vehicle.vehicleNumber || 'N/A'})\n` +
                        `Service: ${service.title}\n` +
                        `Scheduled: ${formattedDate}\n` +
                        `Notes: ${notes || 'None'}\n\n` +
                        `Please log in to your dashboard to review this booking request.`,
                  html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.6;">
                      <h2 style="color: #0d9488; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">New Booking Request</h2>
                      <p>Hello <strong>${ownerUser.name || 'Garage Owner'}</strong>,</p>
                      <p>You have received a new booking request for your garage, <strong>${garage.name}</strong>.</p>
                      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 15px; margin: 15px 0;">
                        <h3 style="margin-top: 0; color: #475569;">Request Details:</h3>
                        <table style="width: 100%; border-collapse: collapse;">
                          <tr>
                            <td style="padding: 6px 0; font-weight: bold; width: 35%;">Customer:</td>
                            <td style="padding: 6px 0;">${req.user.name || 'Vehicle Owner'}</td>
                          </tr>
                          <tr>
                            <td style="padding: 6px 0; font-weight: bold;">Phone:</td>
                            <td style="padding: 6px 0;">${req.user.phone || 'N/A'}</td>
                          </tr>
                          <tr>
                            <td style="padding: 6px 0; font-weight: bold;">Email:</td>
                            <td style="padding: 6px 0;">${req.user.email || 'N/A'}</td>
                          </tr>
                          <tr>
                            <td style="padding: 6px 0; font-weight: bold;">Vehicle:</td>
                            <td style="padding: 6px 0;">${vehicle.brand} ${vehicle.model} (${vehicle.vehicleNumber || 'N/A'})</td>
                          </tr>
                          <tr>
                            <td style="padding: 6px 0; font-weight: bold;">Service:</td>
                            <td style="padding: 6px 0;">${service.title}</td>
                          </tr>
                          <tr>
                            <td style="padding: 6px 0; font-weight: bold;">Price:</td>
                            <td style="padding: 6px 0;">₹${service.price}</td>
                          </tr>
                          <tr>
                            <td style="padding: 6px 0; font-weight: bold;">Scheduled For:</td>
                            <td style="padding: 6px 0;">${formattedDate}</td>
                          </tr>
                          <tr>
                            <td style="padding: 6px 0; font-weight: bold;">Notes:</td>
                            <td style="padding: 6px 0;">${notes || 'None'}</td>
                          </tr>
                          ${isCustomIssue && service.issueDetails ? `
                          <tr>
                            <td style="padding: 6px 0; font-weight: bold;">Problem Description:</td>
                            <td style="padding: 6px 0;">${service.issueDetails.description}</td>
                          </tr>
                          <tr>
                            <td style="padding: 6px 0; font-weight: bold;">Problem Duration:</td>
                            <td style="padding: 6px 0;">${service.issueDetails.duration}</td>
                          </tr>
                          <tr>
                            <td style="padding: 6px 0; font-weight: bold;">Impact:</td>
                            <td style="padding: 6px 0;">${service.issueDetails.urgency}</td>
                          </tr>
                          ` : ''}
                        </table>
                      </div>
                      <p>Please log in to your dashboard to review and accept/reject this request.</p>
                      <p style="margin-top: 25px; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 10px;">
                        This is an automated notification from DrivePortz.
                      </p>
                    </div>
                  `
                }).catch(emailErr => console.warn('Email dispatch warning:', emailErr.message));
              }

              // Send SMS to Garage Owner
              if (ownerUser.phone) {
                const smsText = `New booking request at ${garage.name}! Customer ${req.user.name || 'Owner'} requested ${service.title} for ${vehicle.brand} ${vehicle.model} on ${formattedDate}. Log in to view.`;
                await sendSms(ownerUser.phone, smsText).catch(smsErr => console.warn('SMS dispatch warning:', smsErr.message));
              }
            }
          } catch (ownerErr) {
            console.warn('Warning sending email/SMS notification to garage owner:', ownerErr.message);
          }
        }

        // Notify requesting user
        await notifyUser(String(req.user.id), {
          title: 'Booking requested',
          body: `Your booking request for ${service.title} at ${garage.name} has been sent.`,
          data: {
            type: 'BOOKING_REQUEST',
            bookingId: String(result.insertedId)
          }
        }).catch(userNotifErr => console.warn('User notification warning:', userNotifErr.message));
      } catch (bgErr) {
        console.warn('Background booking notification error:', bgErr.message);
      }
    });

    return res.status(201).json({ msg: 'Booking requested', id: String(result.insertedId) });
  } catch (e) {
    return res.status(500).json({ msg: 'Error creating booking', error: String(e && e.message ? e.message : e) });
  }
});

router.get('/my', requireAuth, requireRole('USER'), async (req, res) => {
  const db = getDb();
  const bookings = db.collection('bookings');

  try {
    const userIdStr = String(req.user.id);
    let userIdObj = null;
    try { userIdObj = new ObjectId(userIdStr); } catch {}

    const docs = await bookings
      .find({ userId: { $in: [userIdStr, req.user.id, userIdObj].filter(Boolean) } })
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
        isCustomIssue: Boolean(b.isCustomIssue),
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

    // Fetch user profile details for bookings lacking full snapshot user info
    const usersCol = db.collection('users');
    const userIds = [...new Set(docs.map(b => b.userId).filter(Boolean))];
    const userObjectIds = userIds.map(id => {
      try { return new ObjectId(id); } catch { return null; }
    }).filter(Boolean);
    
    const userDocs = await usersCol.find({
      $or: [
        { _id: { $in: userObjectIds } },
        { uid: { $in: userIds } }
      ]
    }).toArray();

    const userMap = new Map();
    userDocs.forEach(u => {
      if (u._id) userMap.set(String(u._id), u);
      if (u.uid) userMap.set(String(u.uid), u);
    });

    return res.status(200).json(
      docs.map((b) => {
        const matchedUser = userMap.get(String(b.userId));
        const snapshotUser = (b.snapshots && b.snapshots.user) || {};
        const customer = {
          name: (snapshotUser.name && snapshotUser.name.trim()) || matchedUser?.name || 'Customer',
          phone: (snapshotUser.phone && snapshotUser.phone.trim()) || matchedUser?.phone || '',
          email: (snapshotUser.email && snapshotUser.email.trim()) || matchedUser?.email || ''
        };

        return {
          id: String(b._id),
          status: b.status,
          scheduledFor: b.scheduledFor,
          notes: b.notes,
          timeline: b.timeline || [],
          createdAt: b.createdAt,
          userId: b.userId,
          isCustomIssue: Boolean(b.isCustomIssue),
          customer,
          garage: b.snapshots && b.snapshots.garage,
          service: b.snapshots && b.snapshots.service,
          vehicle: b.snapshots && b.snapshots.vehicle
        };
      })
    );
  } catch (e) {
    return res.status(500).json({ msg: 'Error loading garage bookings', error: String(e && e.message ? e.message : e) });
  }
});

router.patch('/:bookingId/status', requireAuth, requireRole('GARAGE'), async (req, res) => {
  const { status } = req.body || {};
  const nextStatus = String(status || '').toUpperCase();
  const allowed = new Set(['ACCEPTED', 'REJECTED', 'IN_PROGRESS', 'COMPLETED', 'MORE_INFO_REQUIRED']);

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

router.patch('/:bookingId/request-info', requireAuth, requireRole('GARAGE'), async (req, res) => {
  const { message } = req.body || {};
  if (!message || message.trim().length === 0) {
    return res.status(400).json({ msg: 'Message is required' });
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

    const nextStatus = 'MORE_INFO_REQUIRED';
    const timelineEntry = { 
      status: nextStatus, 
      at: new Date(), 
      by: 'GARAGE', 
      message: message.trim() 
    };

    await bookings.updateOne(
      { _id: booking._id },
      {
        $set: { status: nextStatus, updatedAt: new Date() },
        $push: { timeline: timelineEntry }
      }
    );

    if (booking.userId) {
      await notifyUser(String(booking.userId), {
        title: 'More Information Required',
        body: `The garage requested more info regarding your Custom Issue.`,
        data: {
          type: 'BOOKING_UPDATE',
          bookingId: String(booking._id),
          status: nextStatus
        }
      });
    }

    return res.status(200).json({ msg: 'Request for info sent' });
  } catch (e) {
    return res.status(500).json({ msg: 'Error requesting info', error: String(e && e.message ? e.message : e) });
  }
});

router.patch('/:bookingId/provide-info', requireAuth, requireRole('USER'), async (req, res) => {
  const { message } = req.body || {};
  if (!message || message.trim().length === 0) {
    return res.status(400).json({ msg: 'Message is required' });
  }

  const db = getDb();
  const bookings = db.collection('bookings');

  try {
    const booking = await bookings.findOne({ _id: toObjectId(req.params.bookingId), userId: String(req.user.id) });
    if (!booking) {
      return res.status(404).json({ msg: 'Booking not found' });
    }

    const nextStatus = 'REQUESTED';
    const timelineEntry = { 
      status: nextStatus, 
      at: new Date(), 
      by: 'USER', 
      message: message.trim() 
    };

    await bookings.updateOne(
      { _id: booking._id },
      {
        $set: { status: nextStatus, updatedAt: new Date() },
        $push: { timeline: timelineEntry }
      }
    );

    // Notify garage
    const garages = db.collection('garages');
    const garage = await garages.findOne({ _id: booking.garageId });
    if (garage && garage.ownerUserId) {
      await notifyUser(String(garage.ownerUserId), {
        title: 'Customer Provided Info',
        body: `The customer provided the requested info for their Custom Issue.`,
        data: {
          type: 'BOOKING_UPDATE',
          bookingId: String(booking._id),
          status: nextStatus
        }
      });
    }

    return res.status(200).json({ msg: 'Info provided' });
  } catch (e) {
    return res.status(500).json({ msg: 'Error providing info', error: String(e && e.message ? e.message : e) });
  }
});

module.exports = router;
