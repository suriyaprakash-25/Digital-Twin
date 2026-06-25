const path = require('path');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;
const { loadConfig } = require('../config');
const { getDb } = require('../db');
const { ObjectId } = require('mongodb');
const groqService = require('../services/groqService');
const { createDiagnosis, getDiagnosesByUser } = require('../models/Diagnosis');

const config = loadConfig();

// Configure Cloudinary
if (config.cloudinary && config.cloudinary.cloudName) {
  cloudinary.config({
    cloud_name: config.cloudinary.cloudName,
    api_key: config.cloudinary.apiKey,
    api_secret: config.cloudinary.apiSecret
  });
}

// Helper to upload to cloudinary
async function uploadToCloudinary(filePath) {
  if (!config.cloudinary || !config.cloudinary.cloudName) {
    // If not configured, just return a local placeholder or skip
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

async function analyzeSymptoms(req, res) {
  try {
    const { vehicleId, symptoms, selectedSymptoms } = req.body;
    const userId = req.user.id;
    
    const parsedSelectedSymptoms = selectedSymptoms ? JSON.parse(selectedSymptoms) : [];

    if (!vehicleId || (!symptoms && parsedSelectedSymptoms.length === 0)) {
      return res.status(400).json({ msg: 'Vehicle ID and symptoms are required.' });
    }

    // Handle uploaded files
    const imageUrls = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const url = await uploadToCloudinary(file.path);
        if (url) {
          imageUrls.push(url);
        }
        // Cleanup local file
        fs.unlinkSync(file.path);
      }
    }

    const db = getDb();
    
    // Fetch Vehicle Details
    const vehicle = await db.collection('vehicles').findOne({ _id: new ObjectId(vehicleId) });
    if (!vehicle) {
      return res.status(404).json({ msg: 'Vehicle not found.' });
    }

    // Fetch Last Service Records
    const services = await db.collection('services')
      .find({ vehicleId: new ObjectId(vehicleId) })
      .sort({ date: -1 })
      .limit(3)
      .toArray();

    // Compile inputs for AI
    const diagnosisInput = {
      vehicleDetails: vehicle,
      vehicleIQ: vehicle.healthScore || 85, // Fallback if missing
      symptoms: symptoms,
      selectedSymptoms: parsedSelectedSymptoms,
      lastServices: services.map(s => ({ type: s.type, date: s.date, cost: s.cost }))
    };

    // Call Groq API
    const aiResponse = await groqService.analyzeVehicleSymptoms(diagnosisInput);

    // Save Diagnosis to DB
    const diagnosisData = {
      userId,
      vehicleId,
      symptoms,
      selectedSymptoms: parsedSelectedSymptoms,
      imageUrls,
      aiResponse
    };
    const savedDiagnosis = await createDiagnosis(diagnosisData);

    res.status(200).json(savedDiagnosis);
  } catch (error) {
    console.error('Analyze Symptoms Error:', error);
    res.status(500).json({ msg: 'Unable to analyze currently. Please try again.', error: error.message });
  }
}

async function getHistory(req, res) {
  try {
    const userId = req.user.id;
    const history = await getDiagnosesByUser(userId);
    
    // Enhance with vehicle details
    const db = getDb();
    const enrichedHistory = await Promise.all(history.map(async (diag) => {
      const vehicle = await db.collection('vehicles').findOne({ _id: new ObjectId(diag.vehicleId) });
      return {
        ...diag,
        vehicleDetails: vehicle ? { brand: vehicle.brand, model: vehicle.model, number: vehicle.vehicleNumber } : null
      };
    }));

    res.status(200).json(enrichedHistory);
  } catch (error) {
    console.error('Get Diagnosis History Error:', error);
    res.status(500).json({ msg: 'Server Error' });
  }
}

module.exports = {
  analyzeSymptoms,
  getHistory
};
