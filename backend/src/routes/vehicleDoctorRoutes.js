const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { requireAuth } = require('../middleware/auth');
const vehicleDoctorController = require('../controllers/vehicleDoctorController');

// Multer setup for local temp storage
const upload = multer({ dest: path.join(__dirname, '../../uploads/') });

// Needs to be an express Router
const routerObj = express.Router();

routerObj.post('/analyze', requireAuth, upload.array('images', 5), vehicleDoctorController.analyzeSymptoms);
routerObj.get('/history', requireAuth, vehicleDoctorController.getHistory);

module.exports = routerObj;
