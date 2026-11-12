/**
 * /api/garages: thin HTTP adapters over services/garages/*.
 * Routes parse the request, run the auth middleware and map results/errors to the existing
 * response contract ({ msg } on errors, plus { error } on unexpected 500s, as before).
 */
const express = require('express');

const { requireAuth, requireRole, optionalAuth } = require('../middleware/auth');
const { createUploader } = require('../utils/uploads');
const { AppError } = require('../core/errors');
const { setPaginationHeaders } = require('../core/pagination');
const { createRepositories } = require('../repositories');
const { createGarageServices } = require('../services/garages');
const { UPLOADS } = require('../services/garages/garageConstants');
const { invalidateCacheOnWrite, CACHE_KEYS } = require('../infrastructure/cache/cache');

const galleryUploader = createUploader();
const router = express.Router();
router.use(invalidateCacheOnWrite(CACHE_KEYS.GARAGE_LIST, CACHE_KEYS.GARAGE_DETAIL));

const garageOwner = [requireAuth, requireRole('GARAGE')];

/**
 * Wraps a handler: typed client errors become `{ msg }` with their status; anything else is a 500
 * with `failureMsg`. With `logLabel` the 500 body omits the raw error (upload routes, as before).
 */
function handle(failureMsg, handler, { logLabel } = {}) {
  return async (req, res) => {
    try {
      return await handler(req, res, createGarageServices({ repos: createRepositories() }));
    } catch (err) {
      if (err instanceof AppError && err.expose) return res.status(err.status).json({ msg: err.message });
      const detail = String(err && err.message ? err.message : err);
      if (logLabel) {
        console.error(`${logLabel}:`, detail);
        return res.status(500).json({ msg: failureMsg });
      }
      return res.status(500).json({ msg: failureMsg, error: detail });
    }
  };
}

// ── Owner profile ────────────────────────────────────────────────────────────

router.get('/me', ...garageOwner, handle('Error loading garage profile', async (req, res, { profile }) => {
  const garage = await profile.getMyProfile(req.user.id);
  return res.status(200).json(garage || { exists: false });
}));

router.post('/me', ...garageOwner, handle('Error saving garage profile', async (req, res, { profile }) => {
  const { created, id } = await profile.saveMyProfile(req.user.id, req.body || {});
  return created
    ? res.status(201).json({ msg: 'Garage profile created', id })
    : res.status(200).json({ msg: 'Garage profile updated', id });
}));

router.post('/gallery', ...garageOwner, galleryUploader.array('photos', UPLOADS.GALLERY_MAX_FILES), handle('Server error uploading photos', async (req, res, { profile }) => {
  const files = Array.isArray(req.files) ? req.files : [];
  if (files.length === 0) return res.status(400).json({ msg: 'No photos provided' });
  const { photoUrls, galleryPhotos } = await profile.addGalleryPhotos(req.user.id, files);
  return res.status(200).json({ msg: 'Photos uploaded successfully', photoUrls, galleryPhotos });
}, { logLabel: 'Error uploading gallery photos' }));

router.post('/photo', ...garageOwner, galleryUploader.single('photo'), handle('Server error uploading photo', async (req, res, { profile }) => {
  if (!req.file) return res.status(400).json({ msg: 'No photo provided' });
  const { photoUrl } = await profile.setProfilePhoto(req.user.id, req.file);
  return res.status(200).json({ msg: 'Photo uploaded successfully', photoUrl });
}, { logLabel: 'Error uploading garage photo' }));

router.patch('/me/capacity', ...garageOwner, handle('Error updating capacity', async (req, res, { profile }) => {
  const { maxCapacity } = await profile.updateCapacity(req.user.id, (req.body || {}).maxCapacity);
  return res.status(200).json({ msg: 'Capacity updated successfully', maxCapacity });
}));

// DELETE /api/garages/gallery: remove a photo from the caller's own gallery
router.delete('/gallery', ...garageOwner, handle('Error deleting gallery photo', async (req, res, { profile }) => {
  const { galleryPhotos } = await profile.removeGalleryPhoto(req.user.id, (req.body || {}).photoUrl);
  return res.status(200).json({ msg: 'Photo removed', galleryPhotos });
}));

// POST /api/garages/location: garage owner saves their map coordinates
router.post('/location', ...garageOwner, handle('Error saving location', async (req, res, { profile }) => {
  await profile.saveLocation(req.user.id, req.body || {});
  return res.status(200).json({ msg: 'Location saved successfully' });
}));

// ── Owner service catalogue ──────────────────────────────────────────────────

router.get('/me/services', ...garageOwner, handle('Error loading services', async (req, res, { catalog }) => {
  return res.status(200).json(await catalog.listMine(req.user.id));
}));

router.post('/me/services', ...garageOwner, handle('Error creating service', async (req, res, { catalog }) => {
  const { id } = await catalog.createMine(req.user.id, req.body || {});
  return res.status(201).json({ msg: 'Service created', id });
}));

router.put('/me/services/:serviceId', ...garageOwner, handle('Error updating service', async (req, res, { catalog }) => {
  await catalog.updateMine(req.user.id, req.params.serviceId, req.body || {});
  return res.status(200).json({ msg: 'Service updated' });
}));

router.delete('/me/services/:serviceId', ...garageOwner, handle('Error removing service', async (req, res, { catalog }) => {
  await catalog.archiveMine(req.user.id, req.params.serviceId);
  return res.status(200).json({ msg: 'Service removed' });
}));

// ── Public pages ─────────────────────────────────────────────────────────────

// GET /api/garages/details/:garageId: public detailed garage profile (cached snapshot)
router.get('/details/:garageId', handle('Error fetching garage details', async (req, res, { publicProfile }) => {
  return res.status(200).json(await publicProfile.getDetails(req.params.garageId));
}));

router.get('/:garageId/services', handle('Error fetching services', async (req, res, { catalog }) => {
  return res.status(200).json(await catalog.listPublic(req.params.garageId));
}));

router.get('/:garageId/gallery', handle('Error fetching gallery', async (req, res, { publicProfile }) => {
  return res.status(200).json(await publicProfile.getGallery(req.params.garageId));
}));

// ── Reviews ──────────────────────────────────────────────────────────────────

// GET /api/garages/:garageId/reviews?sort=&page=&limit=: optionalAuth so a signed-in customer
// learns whether they can review (req.user.id; tokens carry `sub`).
router.get('/:garageId/reviews', optionalAuth, handle('Error fetching reviews', async (req, res, { reviews }) => {
  const { body, pagination } = await reviews.listReviews(req.params.garageId, req.query, req.user);
  setPaginationHeaders(res, pagination);
  return res.status(200).json(body);
}));

// POST /api/garages/:garageId/reviews: one review per COMPLETED booking owned by the caller
router.post('/:garageId/reviews', requireAuth, handle('Error submitting review', async (req, res, { reviews }) => {
  const result = await reviews.createReview(req.params.garageId, req.user, req.body || {});
  return res.status(201).json({ msg: 'Review submitted successfully!', ...result });
}));

// POST /api/garages/:garageId/reviews/:reviewId/reply: owner response
router.post('/:garageId/reviews/:reviewId/reply', ...garageOwner, handle('Error posting reply', async (req, res, { reviews }) => {
  const reply = await reviews.replyToReview(req.user, req.params.reviewId, req.body || {});
  return res.status(200).json({ msg: 'Reply posted successfully', reply });
}));

// DELETE /api/garages/:garageId/reviews/:reviewId: admin removal
router.delete('/:garageId/reviews/:reviewId', requireAuth, requireRole('ADMIN'), handle('Error deleting review', async (req, res, { reviews }) => {
  await reviews.deleteReview(req.params.reviewId);
  return res.status(200).json({ msg: 'Review deleted by admin' });
}));

module.exports = router;
