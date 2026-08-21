const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;
const { ObjectId } = require('mongodb');
const { getDb } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/adminMiddleware');
const { loadConfig } = require('../config');
const { DISPUTE_STATUS, DISPUTE_RESOLUTION } = require('../models/Dispute');
const { createDispute, logDisputeEvent, resolveDispute } = require('../services/disputeService');
const { notifyUser } = require('../services/notifications');
const { idempotencyMiddleware } = require('../middleware/idempotency');
const { disputeLimiter } = require('../middleware/financialRateLimit');
const { logFinancialAudit } = require('../services/auditService');

const config = loadConfig();

// Configure Cloudinary
if (config.cloudinary && config.cloudinary.cloudName) {
  cloudinary.config({
    cloud_name: config.cloudinary.cloudName,
    api_key: config.cloudinary.apiKey,
    api_secret: config.cloudinary.apiSecret
  });
}

// Multer storage
const uploadsDir = path.resolve(__dirname, '../../uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `dispute_${Date.now()}_${Math.random().toString(36).substring(7)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

function safeObjectId(id) {
  try {
    return new ObjectId(String(id));
  } catch {
    return null;
  }
}

// Process evidence upload
async function processEvidenceUpload(file) {
  if (!file) return null;

  if (config.cloudinary && config.cloudinary.cloudName) {
    try {
      const result = await cloudinary.uploader.upload(file.path, {
        folder: 'driveportz_disputes',
        resource_type: 'auto'
      });

      if (fs.existsSync(file.path)) {
        try { fs.unlinkSync(file.path); } catch {}
      }

      return {
        url: result.secure_url,
        cloudinaryPublicId: result.public_id,
        originalName: file.originalname,
        mimeType: file.mimetype,
        uploadedAt: new Date()
      };
    } catch (err) {
      console.warn('Cloudinary upload error in dispute attachment:', err.message);
    }
  }

  return {
    url: `/uploads/${path.basename(file.path)}`,
    cloudinaryPublicId: null,
    originalName: file.originalname,
    mimeType: file.mimetype,
    uploadedAt: new Date()
  };
}

// ──────────────────────── USER DISPUTE ENDPOINTS ────────────────────────
const userDisputeRouter = express.Router();

/**
 * POST /api/disputes
 * Create a new payment dispute
 */
userDisputeRouter.post('/', requireAuth, disputeLimiter, idempotencyMiddleware, upload.single('evidence'), async (req, res) => {
  const { paymentId, category, subject, description, disputedAmount } = req.body || {};

  if (!paymentId || !description) {
    return res.status(400).json({ success: false, message: 'Payment ID and description are required' });
  }

  try {
    const evidenceList = [];
    if (req.file) {
      const evidenceItem = await processEvidenceUpload(req.file);
      if (evidenceItem) evidenceList.push(evidenceItem);
    }

    const dispute = await createDispute({
      userId: req.user.id,
      paymentId,
      category,
      subject,
      description,
      disputedAmount,
      evidence: evidenceList
    });

    return res.status(201).json({
      success: true,
      message: `Dispute ${dispute.disputeNumber} submitted successfully`,
      dispute
    });
  } catch (err) {
    console.error('Error creating dispute:', err);
    return res.status(400).json({ success: false, message: err.message || 'Error submitting dispute' });
  }
});

/**
 * GET /api/disputes
 * List disputes raised by authenticated user
 */
userDisputeRouter.get('/', requireAuth, async (req, res) => {
  const { page = 1, limit = 20, status = 'ALL', search = '' } = req.query;
  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 20;
  const skip = (pageNum - 1) * limitNum;

  const db = getDb();
  const disputes = db.collection('payment_disputes');

  try {
    const query = { userId: String(req.user.id) };

    if (status && status !== 'ALL') {
      query.status = status;
    }

    if (search && search.trim() !== '') {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { disputeNumber: regex },
        { invoiceNumber: regex },
        { subject: regex },
        { garageName: regex }
      ];
    }

    const totalCount = await disputes.countDocuments(query);
    const rawList = await disputes
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .toArray();

    const formatted = rawList.map(d => ({
      id: String(d._id),
      disputeNumber: d.disputeNumber,
      invoiceNumber: d.invoiceNumber,
      garageName: d.garageName,
      serviceType: d.serviceType,
      vehicleNumber: d.vehicleNumber,
      category: d.category,
      subject: d.subject,
      disputedAmount: d.disputedAmount,
      status: d.status,
      resolution: d.resolution,
      date: d.createdAt
    }));

    return res.status(200).json({
      success: true,
      disputes: formatted,
      totalCount,
      totalPages: Math.ceil(totalCount / limitNum),
      currentPage: pageNum
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error loading disputes' });
  }
});

/**
 * GET /api/disputes/:id
 * Retrieve single dispute with events timeline
 */
userDisputeRouter.get('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const disputes = db.collection('payment_disputes');
  const events = db.collection('dispute_events');

  try {
    const dId = safeObjectId(id);
    const dispute = dId
      ? await disputes.findOne({ _id: dId })
      : await disputes.findOne({ disputeNumber: id });

    if (!dispute) {
      return res.status(404).json({ success: false, message: 'Dispute record not found' });
    }

    // Access control
    const isOwner = String(dispute.userId) === String(req.user.id);
    const isGarage = String(dispute.garageId) === String(req.user.id);
    const isAdmin = req.user.role === 'ADMIN';

    if (!isOwner && !isGarage && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const timeline = await events.find({ disputeId: String(dispute._id) }).sort({ createdAt: 1 }).toArray();

    return res.status(200).json({
      success: true,
      dispute: {
        id: String(dispute._id),
        ...dispute
      },
      timeline: timeline.map(t => ({
        id: String(t._id),
        actorRole: t.actorRole,
        action: t.action,
        message: t.message,
        metadata: t.metadata,
        date: t.createdAt
      }))
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error loading dispute details' });
  }
});

/**
 * POST /api/disputes/:id/respond
 * User response to an active dispute
 */
userDisputeRouter.post('/:id/respond', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { message } = req.body || {};

  if (!message || message.trim() === '') {
    return res.status(400).json({ success: false, message: 'Message is required' });
  }

  const db = getDb();
  const disputes = db.collection('payment_disputes');

  try {
    const dId = safeObjectId(id);
    const dispute = dId ? await disputes.findOne({ _id: dId }) : await disputes.findOne({ disputeNumber: id });

    if (!dispute) {
      return res.status(404).json({ success: false, message: 'Dispute not found' });
    }

    if (String(dispute.userId) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const now = new Date();

    await disputes.updateOne(
      { _id: dispute._id },
      {
        $set: {
          status: DISPUTE_STATUS.UNDER_REVIEW,
          userRespondedAt: now,
          updatedAt: now
        }
      }
    );

    await logDisputeEvent({
      disputeId: String(dispute._id),
      actorId: req.user.id,
      actorRole: 'USER',
      action: 'USER_RESPONDED',
      message: String(message).trim(),
      dbInstance: db
    });

    return res.status(200).json({ success: true, message: 'Response submitted successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error submitting response' });
  }
});

/**
 * POST /api/disputes/:id/cancel
 * User cancels an OPEN dispute
 */
userDisputeRouter.post('/:id/cancel', requireAuth, async (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const disputes = db.collection('payment_disputes');

  try {
    const dId = safeObjectId(id);
    const dispute = dId ? await disputes.findOne({ _id: dId }) : await disputes.findOne({ disputeNumber: id });

    if (!dispute) {
      return res.status(404).json({ success: false, message: 'Dispute not found' });
    }

    if (String(dispute.userId) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    if (dispute.status !== DISPUTE_STATUS.OPEN && dispute.status !== DISPUTE_STATUS.WAITING_FOR_USER) {
      return res.status(400).json({ success: false, message: 'Cannot cancel a dispute that is under review or resolved' });
    }

    const now = new Date();

    await disputes.updateOne(
      { _id: dispute._id },
      {
        $set: {
          status: DISPUTE_STATUS.CANCELLED,
          updatedAt: now
        }
      }
    );

    await logDisputeEvent({
      disputeId: String(dispute._id),
      actorId: req.user.id,
      actorRole: 'USER',
      action: 'DISPUTE_CANCELLED',
      message: 'Dispute cancelled by customer',
      dbInstance: db
    });

    return res.status(200).json({ success: true, message: 'Dispute cancelled successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error cancelling dispute' });
  }
});

// ──────────────────────── GARAGE DISPUTE ENDPOINTS ────────────────────────
const garageDisputeRouter = express.Router();

/**
 * GET /api/garage/disputes
 * List disputes concerning services completed by authenticated garage
 */
garageDisputeRouter.get('/', requireAuth, requireRole('GARAGE'), async (req, res) => {
  const { page = 1, limit = 20, status = 'ALL', search = '' } = req.query;
  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 20;
  const skip = (pageNum - 1) * limitNum;

  const db = getDb();
  const disputes = db.collection('payment_disputes');

  try {
    const query = { garageId: String(req.user.id) };

    if (status && status !== 'ALL') {
      query.status = status;
    }

    if (search && search.trim() !== '') {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { disputeNumber: regex },
        { invoiceNumber: regex },
        { subject: regex },
        { vehicleNumber: regex }
      ];
    }

    const totalCount = await disputes.countDocuments(query);
    const rawList = await disputes
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .toArray();

    const formatted = rawList.map(d => ({
      id: String(d._id),
      disputeNumber: d.disputeNumber,
      invoiceNumber: d.invoiceNumber,
      serviceType: d.serviceType,
      vehicleNumber: d.vehicleNumber,
      category: d.category,
      subject: d.subject,
      disputedAmount: d.disputedAmount,
      status: d.status,
      garageResponse: d.garageResponse,
      date: d.createdAt
    }));

    return res.status(200).json({
      success: true,
      disputes: formatted,
      totalCount,
      totalPages: Math.ceil(totalCount / limitNum),
      currentPage: pageNum
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error loading garage disputes' });
  }
});

/**
 * POST /api/garage/disputes/:id/respond
 * Garage submits explanation/response to a dispute
 */
garageDisputeRouter.post('/:id/respond', requireAuth, requireRole('GARAGE'), async (req, res) => {
  const { id } = req.params;
  const { response } = req.body || {};

  if (!response || response.trim() === '') {
    return res.status(400).json({ success: false, message: 'Response explanation is required' });
  }

  const db = getDb();
  const disputes = db.collection('payment_disputes');

  try {
    const dId = safeObjectId(id);
    const dispute = dId ? await disputes.findOne({ _id: dId }) : await disputes.findOne({ disputeNumber: id });

    if (!dispute) {
      return res.status(404).json({ success: false, message: 'Dispute not found' });
    }

    if (String(dispute.garageId) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: 'Forbidden: You do not own this service dispute' });
    }

    const now = new Date();

    await disputes.updateOne(
      { _id: dispute._id },
      {
        $set: {
          garageResponse: String(response).trim(),
          garageRespondedAt: now,
          status: DISPUTE_STATUS.UNDER_REVIEW,
          updatedAt: now
        }
      }
    );

    // Timeline event
    await logDisputeEvent({
      disputeId: String(dispute._id),
      actorId: req.user.id,
      actorRole: 'GARAGE',
      action: 'GARAGE_RESPONDED',
      message: String(response).trim(),
      dbInstance: db
    });

    // Notify customer
    await notifyUser(dispute.userId, {
      title: 'Garage Responded to Dispute',
      body: `The garage has submitted their response regarding dispute ${dispute.disputeNumber}.`,
      data: {
        type: 'GARAGE_RESPONSE',
        disputeId: String(dispute._id),
        disputeNumber: dispute.disputeNumber
      }
    }).catch(e => console.warn('User notif error:', e));

    return res.status(200).json({
      success: true,
      message: 'Garage response recorded successfully'
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error recording garage response' });
  }
});

// ──────────────────────── ADMIN DISPUTE ENDPOINTS ────────────────────────
const adminDisputeRouter = express.Router();

/**
 * GET /api/admin/disputes/summary
 * Returns global dispute statistics
 */
adminDisputeRouter.get('/summary', requireAdmin, async (req, res) => {
  const db = getDb();
  const disputes = db.collection('payment_disputes');

  try {
    const all = await disputes.find({}).toArray();

    let open = 0;
    let underReview = 0;
    let resolved = 0;
    let rejected = 0;
    let refundDisputes = 0;
    let totalDisputedVolume = 0;

    all.forEach(d => {
      totalDisputedVolume += parseFloat(d.disputedAmount) || 0;
      if (d.status === DISPUTE_STATUS.OPEN) open++;
      else if (d.status === DISPUTE_STATUS.UNDER_REVIEW || d.status === DISPUTE_STATUS.WAITING_FOR_GARAGE || d.status === DISPUTE_STATUS.WAITING_FOR_USER) underReview++;
      else if (d.status === DISPUTE_STATUS.RESOLVED) resolved++;
      else if (d.status === DISPUTE_STATUS.REJECTED) rejected++;

      if (d.category === 'REFUND_NOT_RECEIVED' || d.category === 'WRONG_REFUND_AMOUNT') refundDisputes++;
    });

    return res.status(200).json({
      success: true,
      summary: {
        totalDisputes: all.length,
        open,
        underReview,
        resolved,
        rejected,
        refundDisputes,
        totalDisputedVolume
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error loading admin dispute summary' });
  }
});

/**
 * GET /api/admin/disputes
 * List all global disputes
 */
adminDisputeRouter.get('/', requireAdmin, async (req, res) => {
  const { page = 1, limit = 20, status = 'ALL', category = 'ALL', search = '' } = req.query;
  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 20;
  const skip = (pageNum - 1) * limitNum;

  const db = getDb();
  const disputes = db.collection('payment_disputes');

  try {
    const query = {};
    if (status && status !== 'ALL') {
      query.status = status;
    }
    if (category && category !== 'ALL') {
      query.category = category;
    }

    if (search && search.trim() !== '') {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { disputeNumber: regex },
        { invoiceNumber: regex },
        { garageName: regex },
        { subject: regex },
        { vehicleNumber: regex }
      ];
    }

    const totalCount = await disputes.countDocuments(query);
    const rawList = await disputes
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .toArray();

    const formatted = rawList.map(d => ({
      id: String(d._id),
      disputeNumber: d.disputeNumber,
      invoiceNumber: d.invoiceNumber,
      garageName: d.garageName,
      serviceType: d.serviceType,
      vehicleNumber: d.vehicleNumber,
      category: d.category,
      subject: d.subject,
      disputedAmount: d.disputedAmount,
      status: d.status,
      resolution: d.resolution,
      resolutionNote: d.resolutionNote,
      date: d.createdAt
    }));

    return res.status(200).json({
      success: true,
      disputes: formatted,
      totalCount,
      totalPages: Math.ceil(totalCount / limitNum),
      currentPage: pageNum
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error loading admin disputes' });
  }
});

/**
 * GET /api/admin/disputes/:id
 * Retrieve full dispute report for administrator
 */
adminDisputeRouter.get('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const disputes = db.collection('payment_disputes');
  const events = db.collection('dispute_events');

  try {
    const dId = safeObjectId(id);
    const dispute = dId ? await disputes.findOne({ _id: dId }) : await disputes.findOne({ disputeNumber: id });

    if (!dispute) {
      return res.status(404).json({ success: false, message: 'Dispute not found' });
    }

    const timeline = await events.find({ disputeId: String(dispute._id) }).sort({ createdAt: 1 }).toArray();

    return res.status(200).json({
      success: true,
      dispute: {
        id: String(dispute._id),
        ...dispute
      },
      timeline: timeline.map(t => ({
        id: String(t._id),
        actorRole: t.actorRole,
        action: t.action,
        message: t.message,
        metadata: t.metadata,
        date: t.createdAt
      }))
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error loading dispute details' });
  }
});

/**
 * POST /api/admin/disputes/:id/resolve
 * Admin resolves dispute with optional full/partial refund
 */
adminDisputeRouter.post('/:id/resolve', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { resolution, resolutionNote, refundAmount } = req.body || {};

  try {
    const resolved = await resolveDispute({
      disputeId: id,
      adminId: req.user.id,
      resolution,
      resolutionNote,
      refundAmount
    });

    return res.status(200).json({
      success: true,
      message: `Dispute ${resolved.disputeNumber} resolved successfully`,
      dispute: resolved
    });
  } catch (err) {
    console.error('Error resolving dispute:', err);
    return res.status(400).json({ success: false, message: err.message || 'Error resolving dispute' });
  }
});

/**
 * POST /api/admin/disputes/:id/reject
 * Admin rejects dispute
 */
adminDisputeRouter.post('/:id/reject', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { resolutionNote } = req.body || {};

  try {
    const rejected = await resolveDispute({
      disputeId: id,
      adminId: req.user.id,
      resolution: DISPUTE_RESOLUTION.REJECT_DISPUTE,
      resolutionNote: resolutionNote || 'Dispute rejected after review'
    });

    return res.status(200).json({
      success: true,
      message: `Dispute ${rejected.disputeNumber} rejected`,
      dispute: rejected
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message || 'Error rejecting dispute' });
  }
});

module.exports = {
  userDisputeRouter,
  garageDisputeRouter,
  adminDisputeRouter
};
