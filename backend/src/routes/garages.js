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
      maxCapacity: garage.maxCapacity !== undefined ? garage.maxCapacity : 20,
      isActive: Boolean(garage.isActive !== false),
      createdAt: garage.createdAt,
      garageLocation: garage.garageLocation || null,
      photoUrl: garage.photoUrl || null,
      galleryPhotos: Array.isArray(garage.galleryPhotos) ? garage.galleryPhotos : [],
      certifications: Array.isArray(garage.certifications) ? garage.certifications : [],
      specializations: Array.isArray(garage.specializations) ? garage.specializations : [],
      rating: garage.rating || 4.8,
      reviewCount: garage.reviewCount || 0
    });
  } catch (e) {
    return res.status(500).json({ msg: 'Error loading garage profile', error: String(e && e.message ? e.message : e) });
  }
});

router.post('/me', requireAuth, requireRole('GARAGE'), async (req, res) => {
  const db = getDb();
  const garages = db.collection('garages');

  const { name, phone, address, city, description, maxCapacity, certifications, specializations, galleryPhotos } = req.body || {};

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
      maxCapacity: maxCapacity !== undefined ? Number(maxCapacity) : 20,
      certifications: Array.isArray(certifications) ? certifications : [],
      specializations: Array.isArray(specializations) ? specializations : [],
      galleryPhotos: Array.isArray(galleryPhotos) ? galleryPhotos : [],
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

router.patch('/me/capacity', requireAuth, requireRole('GARAGE'), async (req, res) => {
  const db = getDb();
  const garages = db.collection('garages');
  const { maxCapacity } = req.body || {};

  const capacity = Number(maxCapacity);
  if (Number.isNaN(capacity) || capacity < 1) {
    return res.status(400).json({ msg: 'Capacity must be a positive number' });
  }

  try {
    const result = await garages.findOneAndUpdate(
      { ownerUserId: String(req.user.id) },
      { $set: { maxCapacity: capacity, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );
    const updated = result?.value || result;
    if (!updated) {
      return res.status(404).json({ msg: 'Garage profile not found' });
    }
    return res.status(200).json({ msg: 'Capacity updated successfully', maxCapacity: updated.maxCapacity });
  } catch (e) {
    return res.status(500).json({ msg: 'Error updating capacity', error: String(e && e.message ? e.message : e) });
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
        category: s.category || 'General Service',
        photoUrl: s.photoUrl || null,
        whatsIncluded: Array.isArray(s.whatsIncluded) ? s.whatsIncluded : [],
        bundledItems: Array.isArray(s.bundledItems) ? s.bundledItems : [],
        isPackage: Boolean(s.isPackage),
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

  const { title, description, price, durationMins, category, photoUrl, whatsIncluded, bundledItems, isPackage } = req.body || {};
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
      category: category ? String(category) : 'General Service',
      photoUrl: photoUrl ? String(photoUrl) : null,
      whatsIncluded: Array.isArray(whatsIncluded) ? whatsIncluded : [],
      bundledItems: Array.isArray(bundledItems) ? bundledItems : [],
      isPackage: Boolean(isPackage),
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

  const { title, description, price, durationMins, category, photoUrl, whatsIncluded, bundledItems, isPackage, isActive } = req.body || {};

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
    if (category !== undefined) update.category = String(category);
    if (photoUrl !== undefined) update.photoUrl = photoUrl ? String(photoUrl) : null;
    if (whatsIncluded !== undefined) update.whatsIncluded = Array.isArray(whatsIncluded) ? whatsIncluded : [];
    if (bundledItems !== undefined) update.bundledItems = Array.isArray(bundledItems) ? bundledItems : [];
    if (isPackage !== undefined) update.isPackage = Boolean(isPackage);
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

// GET /api/garages/details/:garageId — public detailed garage profile
router.get('/details/:garageId', async (req, res) => {
  const db = getDb();
  const garages = db.collection('garages');
  const garageServices = db.collection('garageServices');
  const reviewsCol = db.collection('reviews');
  const { calculateCurrentStatus, getCurrentTimeString } = require('../services/availabilityService');

  try {
    let garageId;
    try {
      garageId = new ObjectId(String(req.params.garageId));
    } catch {
      return res.status(400).json({ msg: 'Invalid Garage ID' });
    }

    const garage = await garages.findOne({ _id: garageId, isActive: { $ne: false } });
    if (!garage) {
      return res.status(404).json({ msg: 'Garage profile not found' });
    }

    const [servicesList, reviewsList] = await Promise.all([
      garageServices.find({ garageId, isActive: { $ne: false }, isArchived: { $ne: true } }).toArray(),
      reviewsCol.find({ garageId }).toArray()
    ]);

    const ratingDistribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let ratingSum = 0;
    reviewsList.forEach(r => {
      const star = Math.min(5, Math.max(1, Math.round(r.rating || 5)));
      ratingDistribution[star] = (ratingDistribution[star] || 0) + 1;
      ratingSum += (r.rating || 5);
    });

    const totalReviews = reviewsList.length;
    const averageRating = totalReviews > 0 ? parseFloat((ratingSum / totalReviews).toFixed(1)) : (garage.rating || 4.8);

    const currentStatus = calculateCurrentStatus(garage);

    return res.status(200).json({
      id: String(garage._id),
      name: garage.name,
      phone: garage.phone,
      email: garage.email || garage.contactEmail || `${garage.name.toLowerCase().replace(/[^a-z0-9]/g, '')}@driveportz.com`,
      address: garage.address,
      city: garage.city,
      description: garage.description || 'Authorized partner service center equipped with state-of-the-art diagnostic machinery and certified mechanics.',
      maxCapacity: garage.maxCapacity || 20,
      photoUrl: garage.photoUrl || null,
      galleryPhotos: Array.isArray(garage.galleryPhotos) && garage.galleryPhotos.length > 0 ? garage.galleryPhotos : [
        'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1517524008697-84bbe3c3fd98?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=800&auto=format&fit=crop'
      ],
      certifications: Array.isArray(garage.certifications) && garage.certifications.length > 0 ? garage.certifications : ['Bosch Authorized', 'DrivePortz Verified', 'ISO 9001 Certified'],
      specializations: Array.isArray(garage.specializations) && garage.specializations.length > 0 ? garage.specializations : ['Periodic Service', 'Engine Overhaul', 'AC Repair', 'Denting & Painting', 'Electricals'],
      rating: averageRating,
      reviewCount: totalReviews,
      ratingDistribution,
      experienceYears: garage.experienceYears || 8,
      partnerSince: garage.createdAt ? new Date(garage.createdAt).getFullYear() : 2024,
      isVerified: Boolean(garage.verified !== false),
      currentStatus,
      currentTime: getCurrentTimeString(),
      businessHours: garage.businessHours || {
        Monday: { isOpen: true, openTime: '09:00', closeTime: '19:00' },
        Tuesday: { isOpen: true, openTime: '09:00', closeTime: '19:00' },
        Wednesday: { isOpen: true, openTime: '09:00', closeTime: '19:00' },
        Thursday: { isOpen: true, openTime: '09:00', closeTime: '19:00' },
        Friday: { isOpen: true, openTime: '09:00', closeTime: '19:00' },
        Saturday: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
        Sunday: { isOpen: false, openTime: '10:00', closeTime: '16:00' }
      },
      facilities: garage.facilities || {
        parkingAvailable: true,
        pickupDrop: true,
        homeService: true,
        emergencyService: true
      },
      paymentMethods: garage.paymentMethods || ['Cash', 'UPI', 'Credit/Debit Card', 'Net Banking'],
      garageLocation: garage.garageLocation || null,
      services: servicesList.map(s => ({
        id: String(s._id),
        title: s.title,
        description: s.description,
        price: parseFloat(s.price || 0),
        durationMins: s.durationMins || 60,
        category: s.category || 'General Maintenance',
        photoUrl: s.photoUrl || null,
        whatsIncluded: s.whatsIncluded || [],
        isPackage: Boolean(s.isPackage)
      }))
    });

  } catch (e) {
    return res.status(500).json({ msg: 'Error fetching garage details', error: String(e && e.message ? e.message : e) });
  }
});

// GET /api/garages/:garageId/services — fetch services for garage
router.get('/:garageId/services', async (req, res) => {
  const db = getDb();
  const garageServices = db.collection('garageServices');
  try {
    const garageId = new ObjectId(String(req.params.garageId));
    const services = await garageServices.find({ garageId, isActive: { $ne: false }, isArchived: { $ne: true } }).toArray();
    return res.status(200).json(services.map(s => ({
      id: String(s._id),
      title: s.title,
      description: s.description,
      price: parseFloat(s.price || 0),
      durationMins: s.durationMins || 60,
      category: s.category || 'General Maintenance',
      photoUrl: s.photoUrl || null,
      whatsIncluded: s.whatsIncluded || [],
      isPackage: Boolean(s.isPackage)
    })));
  } catch (e) {
    return res.status(500).json({ msg: 'Error fetching services', error: String(e && e.message ? e.message : e) });
  }
});

// GET /api/garages/:garageId/gallery — fetch garage gallery photos
router.get('/:garageId/gallery', async (req, res) => {
  const db = getDb();
  const garages = db.collection('garages');
  try {
    const garage = await garages.findOne({ _id: new ObjectId(String(req.params.garageId)) });
    if (!garage) return res.status(404).json({ msg: 'Garage not found' });
    const photos = Array.isArray(garage.galleryPhotos) && garage.galleryPhotos.length > 0 ? garage.galleryPhotos : [
      'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1517524008697-84bbe3c3fd98?w=800&auto=format&fit=crop'
    ];
    return res.status(200).json({ galleryPhotos: photos });
  } catch (e) {
    return res.status(500).json({ msg: 'Error fetching gallery', error: String(e && e.message ? e.message : e) });
  }
});

// GET /api/garages/:garageId/reviews — fetch customer reviews
router.get('/:garageId/reviews', async (req, res) => {
  const db = getDb();
  const reviewsCol = db.collection('reviews');
  const bookingsCol = db.collection('bookings');
  const garages = db.collection('garages');

  try {
    let garageId;
    try {
      garageId = new ObjectId(String(req.params.garageId));
    } catch {
      return res.status(400).json({ msg: 'Invalid Garage ID' });
    }

    const { sort = 'newest' } = req.query;

    let sortOption = { createdAt: -1 };
    if (sort === 'rating_high') sortOption = { rating: -1, createdAt: -1 };
    if (sort === 'rating_low') sortOption = { rating: 1, createdAt: -1 };

    const reviews = await reviewsCol.find({ garageId }).sort(sortOption).toArray();

    // Calculate rating distribution
    const ratingDistribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let ratingSum = 0;

    const formattedReviews = reviews.map(r => {
      const star = Math.min(5, Math.max(1, Math.round(r.rating || 5)));
      ratingDistribution[star] = (ratingDistribution[star] || 0) + 1;
      ratingSum += (r.rating || 5);

      return {
        id: String(r._id),
        garageId: String(r.garageId),
        userId: String(r.userId),
        userName: r.userName || 'Customer',
        userPhotoUrl: r.userPhotoUrl || null,
        rating: r.rating || 5,
        reviewTitle: r.reviewTitle || '',
        reviewMessage: r.reviewMessage || '',
        vehicleModel: r.vehicleModel || 'Vehicle',
        serviceName: r.serviceName || 'General Service',
        reply: r.reply || null,
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString()
      };
    });

    const totalReviews = formattedReviews.length;
    const averageRating = totalReviews > 0 ? parseFloat((ratingSum / totalReviews).toFixed(1)) : 4.8;

    // Check user eligibility if token header supplied
    let userCanReview = false;
    let completedBookings = [];
    
    if (req.headers.authorization) {
      try {
        const jwt = require('jsonwebtoken');
        const token = req.headers.authorization.split(' ')[1];
        const { loadConfig } = require('../config');
        const decoded = jwt.verify(token, loadConfig().jwtSecret);
        if (decoded && decoded.id) {
          const userIdStr = String(decoded.id);
          let userIdObj = null;
          try { userIdObj = new ObjectId(userIdStr); } catch {}
          
          const userBookings = await bookingsCol.find({
            garageId,
            userId: { $in: [userIdStr, decoded.id, userIdObj].filter(Boolean) },
            status: 'COMPLETED'
          }).toArray();

          if (userBookings.length > 0) {
            userCanReview = true;
            completedBookings = userBookings.map(b => ({
              id: String(b._id),
              serviceName: (b.snapshots && b.snapshots.service && b.snapshots.service.title) || 'Completed Service',
              vehicleModel: (b.snapshots && b.snapshots.vehicle && `${b.snapshots.vehicle.brand} ${b.snapshots.vehicle.model}`) || 'Vehicle',
              date: b.createdAt ? new Date(b.createdAt).toLocaleDateString() : 'Recent'
            }));
          }
        }
      } catch {
        /* invalid token, ignore */
      }
    }

    return res.status(200).json({
      averageRating,
      totalReviews,
      ratingDistribution,
      userCanReview,
      completedBookings,
      reviews: formattedReviews
    });

  } catch (e) {
    return res.status(500).json({ msg: 'Error fetching reviews', error: String(e && e.message ? e.message : e) });
  }
});

// POST /api/garages/:garageId/reviews — submit a new review
router.post('/:garageId/reviews', requireAuth, async (req, res) => {
  const db = getDb();
  const reviewsCol = db.collection('reviews');
  const bookingsCol = db.collection('bookings');
  const garagesCol = db.collection('garages');
  const usersCol = db.collection('users');

  try {
    let garageId;
    try {
      garageId = new ObjectId(String(req.params.garageId));
    } catch {
      return res.status(400).json({ msg: 'Invalid Garage ID' });
    }

    const { rating, reviewTitle, reviewMessage, bookingId } = req.body || {};

    const numRating = parseInt(rating, 10);
    if (Number.isNaN(numRating) || numRating < 1 || numRating > 5) {
      return res.status(400).json({ msg: 'Rating is required (1 to 5 stars)' });
    }

    const cleanMessage = String(reviewMessage || '').trim();
    if (!cleanMessage || cleanMessage.length < 20) {
      return res.status(400).json({ msg: 'Review message must be at least 20 characters long' });
    }
    if (cleanMessage.length > 1000) {
      return res.status(400).json({ msg: 'Review message cannot exceed 1000 characters' });
    }

    // Verify user has completed service at this garage
    const userIdStr = String(req.user.id);
    let userIdObj = null;
    try { userIdObj = new ObjectId(userIdStr); } catch {}

    const completedBooking = await bookingsCol.findOne({
      garageId,
      userId: { $in: [userIdStr, req.user.id, userIdObj].filter(Boolean) },
      status: 'COMPLETED'
    });

    if (!completedBooking) {
      return res.status(403).json({ msg: 'Only customers with a completed service booking at this garage can write a review.' });
    }

    // Check duplicate review for booking
    if (bookingId) {
      const existingReview = await reviewsCol.findOne({ bookingId: new ObjectId(String(bookingId)) });
      if (existingReview) {
        return res.status(400).json({ msg: 'You have already submitted a review for this service booking.' });
      }
    }

    const userDoc = await usersCol.findOne({ _id: new ObjectId(String(req.user.id)) });

    const newReview = {
      garageId,
      userId: userIdStr,
      userName: userDoc?.name || req.user.name || 'Verified Customer',
      userPhotoUrl: userDoc?.photoUrl || null,
      bookingId: completedBooking ? completedBooking._id : null,
      serviceName: (completedBooking && completedBooking.snapshots && completedBooking.snapshots.service && completedBooking.snapshots.service.title) || 'Verified Service',
      vehicleModel: (completedBooking && completedBooking.snapshots && completedBooking.snapshots.vehicle && `${completedBooking.snapshots.vehicle.brand} ${completedBooking.snapshots.vehicle.model}`) || 'Vehicle',
      rating: numRating,
      reviewTitle: reviewTitle ? String(reviewTitle).slice(0, 150) : '',
      reviewMessage: cleanMessage,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await reviewsCol.insertOne(newReview);

    // Update garage rating stats in MongoDB
    const allReviews = await reviewsCol.find({ garageId }).toArray();
    const ratingSum = allReviews.reduce((sum, r) => sum + (r.rating || 5), 0);
    const newAverage = parseFloat((ratingSum / allReviews.length).toFixed(1));

    await garagesCol.updateOne(
      { _id: garageId },
      {
        $set: {
          rating: newAverage,
          reviewCount: allReviews.length,
          updatedAt: new Date()
        }
      }
    );

    return res.status(201).json({
      msg: 'Review submitted successfully!',
      review: {
        id: String(result.insertedId),
        ...newReview,
        createdAt: newReview.createdAt.toISOString()
      },
      averageRating: newAverage,
      totalReviews: allReviews.length
    });

  } catch (e) {
    return res.status(500).json({ msg: 'Error submitting review', error: String(e && e.message ? e.message : e) });
  }
});

// POST /api/garages/:garageId/reviews/:reviewId/reply — owner response
router.post('/:garageId/reviews/:reviewId/reply', requireAuth, requireRole('GARAGE'), async (req, res) => {
  const db = getDb();
  const reviewsCol = db.collection('reviews');
  const garagesCol = db.collection('garages');

  try {
    const { replyMessage } = req.body || {};
    if (!replyMessage || String(replyMessage).trim().length < 5) {
      return res.status(400).json({ msg: 'Reply message must be at least 5 characters' });
    }

    const garage = await garagesCol.findOne({ ownerUserId: String(req.user.id) });
    if (!garage) return res.status(403).json({ msg: 'Garage profile not found' });

    const reviewId = new ObjectId(String(req.params.reviewId));
    const review = await reviewsCol.findOne({ _id: reviewId, garageId: garage._id });
    if (!review) return res.status(404).json({ msg: 'Review not found' });

    const replyObj = {
      replyMessage: String(replyMessage).trim(),
      createdAt: new Date()
    };

    await reviewsCol.updateOne({ _id: reviewId }, { $set: { reply: replyObj, updatedAt: new Date() } });

    return res.status(200).json({ msg: 'Reply posted successfully', reply: replyObj });
  } catch (e) {
    return res.status(500).json({ msg: 'Error posting reply', error: String(e && e.message ? e.message : e) });
  }
});

// DELETE /api/garages/:garageId/reviews/:reviewId — admin delete review
router.delete('/:garageId/reviews/:reviewId', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const db = getDb();
  const reviewsCol = db.collection('reviews');
  const garagesCol = db.collection('garages');

  try {
    const reviewId = new ObjectId(String(req.params.reviewId));
    const review = await reviewsCol.findOne({ _id: reviewId });
    if (!review) return res.status(404).json({ msg: 'Review not found' });

    await reviewsCol.deleteOne({ _id: reviewId });

    // Recalculate garage rating
    const allReviews = await reviewsCol.find({ garageId: review.garageId }).toArray();
    const totalReviews = allReviews.length;
    const ratingSum = allReviews.reduce((sum, r) => sum + (r.rating || 5), 0);
    const newAverage = totalReviews > 0 ? parseFloat((ratingSum / totalReviews).toFixed(1)) : 4.8;

    await garagesCol.updateOne(
      { _id: review.garageId },
      { $set: { rating: newAverage, reviewCount: totalReviews } }
    );

    return res.status(200).json({ msg: 'Review deleted by admin' });
  } catch (e) {
    return res.status(500).json({ msg: 'Error deleting review', error: String(e && e.message ? e.message : e) });
  }
});

module.exports = router;
