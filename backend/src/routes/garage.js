const express = require('express');
const { ObjectId } = require('mongodb');

const { getDb } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { createUploader } = require('../utils/uploads');
const {
  persistUploadedFile,
  deletePersistedFile,
  removeTemporaryFile
} = require('../services/persistentFileStorage');

const router = express.Router();
const billUpload = createUploader(
  ['application/pdf', 'image/png', 'image/jpeg'],
  10 * 1024 * 1024
);

router.post('/verify/:service_id', requireAuth, billUpload.single('billFile'), async (req, res) => {
  const serviceId = req.params.service_id;
  const verifierId = req.user.id;
  const verifierRole = req.user.role || 'Garage';

  const db = getDb();
  const services = db.collection('services');
  const vehicles = db.collection('vehicles');

  let persistedBill = null;
  let billStoredOnService = false;

  try {
    const service = await services.findOne({ _id: new ObjectId(serviceId), isArchived: { $ne: true } });
    if (!service) {
      removeTemporaryFile(req.file);
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
      if (!Number.isNaN(gKm) && !Number.isNaN(oKm) && Math.abs(gKm - oKm) > 50) {
        tamperFlag = true;
        tamperReasons.push(`Odometer Mismatch: Owner reported ${oKm}km, Garage reported ${gKm}km`);
      }
    }

    let billUrl = service.billUrl;
    if (req.file) {
      persistedBill = await persistUploadedFile(req.file, {
        folder: 'driveportz/service-bills',
        resourceType: 'auto'
      });
      billUrl = persistedBill.url;
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

    if (persistedBill) {
      updateData.billStorageProvider = persistedBill.storageProvider;
      updateData.billStorageKey = persistedBill.storageKey;
      updateData.billResourceType = persistedBill.resourceType || 'auto';
    }

    await services.updateOne({ _id: new ObjectId(serviceId) }, { $set: updateData });
    billStoredOnService = true;

    if (persistedBill && service.billUrl && service.billUrl !== persistedBill.url) {
      await deletePersistedFile({
        url: service.billUrl,
        storageProvider: service.billStorageProvider,
        storageKey: service.billStorageKey,
        resourceType: service.billResourceType || 'image'
      });
    }

    if (tamperFlag) {
      try {
        await vehicles.updateOne(
          { _id: new ObjectId(String(service.vehicleId)) },
          { $set: { hasTamperFlags: true } }
        );
      } catch {
        // Verification is already stored; vehicle flagging failure should not
        // make the financial/service record appear unverified.
      }
    }

    return res.status(200).json({
      msg: 'Service verified successfully',
      tamperDetected: tamperFlag,
      tamperReasons
    });
  } catch (e) {
    if (!billStoredOnService && persistedBill) {
      await deletePersistedFile(persistedBill);
    } else if (!persistedBill) {
      removeTemporaryFile(req.file);
    }
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
      } catch {
        // Preserve pending-list availability if an older vehicle reference is malformed.
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
