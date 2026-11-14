const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { createUploader } = require('../utils/uploads');
const { limiters } = require('../infrastructure/rateLimit/rateLimiters');
const vehicleDoctorController = require('../controllers/vehicleDoctorController');

const MAX_DIAGNOSIS_IMAGES = 5;
// Images only, signature-verified, size-capped (previously: any file type, unlimited size).
const imageUpload = createUploader(['image/jpeg', 'image/png', 'image/webp']);

const router = express.Router();

// Each analysis calls a paid LLM: per-user rate limit protects cost and availability.
router.post('/analyze', requireAuth, limiters.ai, imageUpload.array('images', MAX_DIAGNOSIS_IMAGES), vehicleDoctorController.analyzeSymptoms);
router.get('/history', requireAuth, vehicleDoctorController.getHistory);

module.exports = router;
