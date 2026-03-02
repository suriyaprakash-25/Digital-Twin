const express = require('express');
const { ObjectId } = require('mongodb');
const fs = require('fs');
const path = require('path');

const { getDb } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { upload, uploadsDir } = require('../utils/uploads');

const router = express.Router();

const ALLOWED_EXTENSIONS = new Set(['pdf', 'png', 'jpg', 'jpeg']);

function isAllowed(filename) {
  const parts = String(filename || '').split('.');
  if (parts.length < 2) return false;
  const ext = parts.pop().toLowerCase();
  return ALLOWED_EXTENSIONS.has(ext);
}

router.post('/verify/:service_id', requireAuth, upload.single('billFile'), async (req, res) => {
  const serviceId = req.params.service_id;
  const verifierId = req.user.id;
  const verifierRole = req.user.role || 'Garage';

  const db = getDb();
  const services = db.collection('services');
  const vehicles = db.collection('vehicles');

  try {
    const service = await services.findOne({ _id: new ObjectId(serviceId), isArchived: { $ne: true } });
    if (!service) {
      return res.status(404).json({ msg: 'Service record not found' });
    }

    const garageReportedKm = req.body.garageReportedKm;
    const repairSeverity = req.body.repairSeverity || 'Normal';
    const garageNotes = req.body.garageNotes || '';

    let tamperFlag = false;
    const tamperReasons = [];

    if (garageReportedKm) {
      const gKm = parseInt(garageReportedKm, 10);
      const oKm = parseInt(service.odometerKm || 0, 10);
      if (!Number.isNaN(gKm) && !Number.isNaN(oKm)) {
        if (Math.abs(gKm - oKm) > 50) {
          tamperFlag = true;
          tamperReasons.push(`Odometer Mismatch: Owner reported ${oKm}km, Garage reported ${gKm}km`);
        }
      }
    }

    let billUrl = service.billUrl;
    if (req.file && req.file.filename) {
      if (isAllowed(req.file.originalname)) {
        billUrl = `/uploads/${req.file.filename}`;
      } else {
        try {
          fs.unlinkSync(path.join(uploadsDir, req.file.filename));
        } catch (e) {
          // ignore
        }
      }
    }

    const updateData = {
      verifiedService: true,
      verificationStatus: !tamperFlag ? 'Verified' : 'Flagged',
      verifierId,
      verifierRole,
      garageReportedKm,
      repairSeverity,
      garageVerificationNotes: garageNotes,
      tamperFlag,
      tamperReasons,
      billUrl,
      verifiedAt: new Date()
    };

    await services.updateOne({ _id: new ObjectId(serviceId) }, { $set: updateData });

    if (tamperFlag) {
      try {
        await vehicles.updateOne({ _id: new ObjectId(String(service.vehicleId)) }, { $set: { hasTamperFlags: true } });
      } catch (e) {
        // ignore
      }
    }

    return res.status(200).json({
      msg: 'Service verified successfully',
      tamperDetected: tamperFlag,
      tamperReasons
    });
  } catch (e) {
    return res.status(500).json({ msg: 'Error verifying service', error: String(e && e.message ? e.message : e) });
  }
});

router.get('/pending', requireAuth, async (req, res) => {
  const db = getDb();
  const services = db.collection('services');
  const vehicles = db.collection('vehicles');

  try {
    const cursor = services
      .find({ verifiedService: { $ne: true }, isArchived: { $ne: true } })
      .sort({ serviceDate: -1 });

    const results = [];
    for await (const s of cursor) {
      let vehicleInfo = 'Unknown Vehicle';
      try {
        const v = await vehicles.findOne({ _id: new ObjectId(String(s.vehicleId)) });
        if (v) {
          vehicleInfo = `${v.brand || ''} ${v.model || ''} (${v.vehicleNumber || ''})`.trim();
        }
      } catch (e) {
        // ignore
      }

      results.push({
        id: String(s._id),
        vehicleId: s.vehicleId,
        vehicleInfo,
        serviceDate: s.serviceDate,
        odometerKm: s.odometerKm,
        serviceCategory: s.serviceCategory,
        garageName: s.garageName,
        ownerId: s.ownerId
      });
    }

    return res.status(200).json(results);
  } catch (e) {
    return res.status(500).json({ msg: 'Error fetching pending verifications', error: String(e && e.message ? e.message : e) });
  }
});

module.exports = router;
