const fs = require('fs');
const cloudinary = require('cloudinary').v2;
const { loadConfig } = require('../config');
const { getDb } = require('../db');
const { ObjectId } = require('mongodb');
const groqService = require('../services/groqService');
const { createDiagnosis, getDiagnosesByUser } = require('../models/Diagnosis');

const config = loadConfig();

if (config.cloudinary && config.cloudinary.cloudName) {
  cloudinary.config({
    cloud_name: config.cloudinary.cloudName,
    api_key: config.cloudinary.apiKey,
    api_secret: config.cloudinary.apiSecret
  });
}

async function uploadToCloudinary(filePath) {
  if (!config.cloudinary || !config.cloudinary.cloudName) {
    return null;
  }
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: 'vehicle_doctor'
    });
    return result.secure_url;
  } catch (error) {
    console.error('Cloudinary Upload Error:', error);
    return null;
  }
}

function cleanupTempFiles(files = []) {
  for (const file of files || []) {
    if (!file?.path) continue;
    try {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    } catch (err) {
      console.warn('Vehicle Doctor temp cleanup failed:', err.message);
    }
  }
}

function parseSelectedSymptoms(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return null;
  }
}

async function analyzeSymptoms(req, res) {
  const uploadedFiles = Array.isArray(req.files) ? req.files : [];

  try {
    const { vehicleId, symptoms, selectedSymptoms } = req.body || {};
    const userId = String(req.user.id);
    const role = String(req.user.role || 'USER').toUpperCase();
    const parsedSelectedSymptoms = parseSelectedSymptoms(selectedSymptoms);

    if (parsedSelectedSymptoms === null) {
      cleanupTempFiles(uploadedFiles);
      return res.status(400).json({ msg: 'Selected symptoms must be a valid JSON array.' });
    }

    if (!vehicleId || (!String(symptoms || '').trim() && parsedSelectedSymptoms.length === 0)) {
      cleanupTempFiles(uploadedFiles);
      return res.status(400).json({ msg: 'Vehicle ID and symptoms are required.' });
    }

    if (!ObjectId.isValid(String(vehicleId))) {
      cleanupTempFiles(uploadedFiles);
      return res.status(400).json({ msg: 'Invalid vehicle ID.' });
    }

    const db = getDb();
    const vehicleQuery = { _id: new ObjectId(String(vehicleId)) };

    if (role !== 'ADMIN') {
      vehicleQuery.$or = [
        { ownerId: userId },
        { userId },
        { createdBy: userId }
      ];
    }

    const vehicle = await db.collection('vehicles').findOne(vehicleQuery);
    if (!vehicle) {
      cleanupTempFiles(uploadedFiles);
      return res.status(404).json({ msg: 'Vehicle not found or access denied.' });
    }

    const services = await db.collection('services')
      .find({
        $or: [
          { vehicleId: new ObjectId(String(vehicleId)) },
          { vehicleId: String(vehicleId) }
        ]
      })
      .sort({ serviceDate: -1, date: -1 })
      .limit(3)
      .toArray();

    const imageUrls = [];
    for (const file of uploadedFiles) {
      const url = await uploadToCloudinary(file.path);
      if (url) imageUrls.push(url);
      try {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      } catch (err) {
        console.warn('Vehicle Doctor temp cleanup failed:', err.message);
      }
    }

    const diagnosisInput = {
      vehicleDetails: vehicle,
      vehicleIQ: vehicle.healthScore || 85,
      symptoms: String(symptoms || '').trim(),
      selectedSymptoms: parsedSelectedSymptoms,
      lastServices: services.map((service) => ({
        type: service.type || service.serviceType || service.serviceCategory,
        date: service.date || service.serviceDate,
        cost: service.cost || service.totalCost || service.totalAmount
      }))
    };

    const aiResponse = await groqService.analyzeVehicleSymptoms(diagnosisInput);

    const diagnosisData = {
      userId,
      vehicleId: String(vehicleId),
      symptoms: diagnosisInput.symptoms,
      selectedSymptoms: parsedSelectedSymptoms,
      imageUrls,
      aiResponse
    };

    const savedDiagnosis = await createDiagnosis(diagnosisData);
    return res.status(200).json(savedDiagnosis);
  } catch (error) {
    cleanupTempFiles(uploadedFiles);
    console.error('Analyze Symptoms Error:', error);
    return res.status(503).json({
      msg: 'Vehicle Doctor is temporarily unavailable. Please try again later or consult a qualified mechanic for urgent concerns.'
    });
  }
}

async function getHistory(req, res) {
  try {
    const userId = req.user.id;
    const history = await getDiagnosesByUser(userId);
    const db = getDb();

    const enrichedHistory = await Promise.all(history.map(async (diag) => {
      if (!ObjectId.isValid(String(diag.vehicleId))) {
        return { ...diag, vehicleDetails: null };
      }

      const vehicle = await db.collection('vehicles').findOne({
        _id: new ObjectId(String(diag.vehicleId)),
        $or: [
          { ownerId: String(userId) },
          { userId: String(userId) },
          { createdBy: String(userId) }
        ]
      });

      return {
        ...diag,
        vehicleDetails: vehicle
          ? { brand: vehicle.brand, model: vehicle.model, number: vehicle.vehicleNumber }
          : null
      };
    }));

    return res.status(200).json(enrichedHistory);
  } catch (error) {
    console.error('Get Diagnosis History Error:', error);
    return res.status(500).json({ msg: 'Server Error' });
  }
}

module.exports = {
  analyzeSymptoms,
  getHistory,
  parseSelectedSymptoms
};
