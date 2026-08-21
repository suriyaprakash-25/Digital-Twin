const express = require('express');
const { ObjectId } = require('mongodb');
const { getDb } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { loadConfig } = require('../config');
const { EARNINGS_STATUS, SETTLEMENT_STATUS } = require('../models/Earnings');
const { getGarageEarningsSummary } = require('../services/earningsService');
const { generateSettlementNumber } = require('../utils/settlementNumber');
const { notifyUser } = require('../services/notifications');

const router = express.Router();

function toObjectId(id) {
  try {
    return new ObjectId(String(id));
  } catch {
    return null;
  }
}

/**
 * GET /api/garage/earnings/summary
 * Retrieves financial ledger summary for authenticated garage
 */
router.get('/earnings/summary', requireAuth, requireRole('GARAGE'), async (req, res) => {
  try {
    const summary = await getGarageEarningsSummary(req.user.id);
    return res.status(200).json({ success: true, summary });
  } catch (err) {
    console.error('Error fetching garage earnings summary:', err);
    return res.status(500).json({ success: false, message: 'Error fetching earnings summary' });
  }
});

/**
 * GET /api/garage/earnings
 * Paginated, searchable, filterable list of garage earnings records
 */
router.get('/earnings', requireAuth, requireRole('GARAGE'), async (req, res) => {
  const { page = 1, limit = 15, status = 'ALL', search = '' } = req.query;
  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 15;
  const skip = (pageNum - 1) * limitNum;

  const db = getDb();
  const earnings = db.collection('garage_earnings');

  try {
    const query = { garageId: String(req.user.id) };

    if (status && status !== 'ALL') {
      if (status === 'AVAILABLE') {
        query.status = { $in: [EARNINGS_STATUS.AVAILABLE, EARNINGS_STATUS.REFUND_ADJUSTMENT] };
      } else {
        query.status = status;
      }
    }

    if (search && search.trim() !== '') {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { invoiceNumber: regex },
        { vehicleNumber: regex },
        { serviceType: regex },
        { paymentId: regex }
      ];
    }

    const totalCount = await earnings.countDocuments(query);
    const rawEarnings = await earnings
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .toArray();

    const formatted = rawEarnings.map(e => ({
      id: String(e._id),
      invoiceId: e.invoiceId,
      invoiceNumber: e.invoiceNumber,
      serviceId: e.serviceId,
      serviceType: e.serviceType,
      vehicleNumber: e.vehicleNumber,
      paymentId: e.paymentId,
      razorpayPaymentId: e.razorpayPaymentId,
      grossAmount: e.grossAmount,
      platformCommission: e.platformCommission,
      garageNetAmount: e.garageNetAmount,
      refundAmount: e.refundAmount || 0,
      netAfterRefund: e.netAfterRefund !== undefined ? e.netAfterRefund : e.garageNetAmount,
      commissionRate: e.commissionRate,
      commissionType: e.commissionType,
      status: e.status,
      settlementId: e.settlementId,
      date: e.createdAt
    }));

    return res.status(200).json({
      success: true,
      earnings: formatted,
      totalCount,
      totalPages: Math.ceil(totalCount / limitNum),
      currentPage: pageNum
    });
  } catch (err) {
    console.error('Error fetching garage earnings list:', err);
    return res.status(500).json({ success: false, message: 'Error fetching earnings list' });
  }
});

/**
 * GET /api/garage/earnings/:id
 * Single earning details with commission snapshot breakdown
 */
router.get('/earnings/:id', requireAuth, requireRole('GARAGE'), async (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const earnings = db.collection('garage_earnings');

  try {
    const eId = toObjectId(id);
    const earning = eId
      ? await earnings.findOne({ _id: eId })
      : await earnings.findOne({ paymentId: id });

    if (!earning) {
      return res.status(404).json({ success: false, message: 'Earnings record not found' });
    }

    if (String(earning.garageId) !== String(req.user.id) && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    return res.status(200).json({
      success: true,
      earning: {
        id: String(earning._id),
        ...earning
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error loading earning details' });
  }
});

/**
 * GET /api/garage/settlements
 * List settlements requested or processed for the authenticated garage
 */
router.get('/settlements', requireAuth, requireRole('GARAGE'), async (req, res) => {
  const { page = 1, limit = 20, status = 'ALL' } = req.query;
  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 20;
  const skip = (pageNum - 1) * limitNum;

  const db = getDb();
  const settlements = db.collection('settlements');

  try {
    const query = { garageId: String(req.user.id) };
    if (status && status !== 'ALL') {
      query.status = status;
    }

    const totalCount = await settlements.countDocuments(query);
    const rawSettlements = await settlements
      .find(query)
      .sort({ requestedAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .toArray();

    const formatted = rawSettlements.map(s => ({
      id: String(s._id),
      settlementId: s.settlementId,
      requestedAmount: s.requestedAmount,
      approvedAmount: s.approvedAmount || s.requestedAmount,
      currency: s.currency || 'INR',
      status: s.status,
      earningsCount: s.earningsIds?.length || 0,
      requestedAt: s.requestedAt,
      approvedAt: s.approvedAt,
      completedAt: s.completedAt,
      failureReason: s.failureReason,
      transferId: s.transferId
    }));

    return res.status(200).json({
      success: true,
      settlements: formatted,
      totalCount,
      totalPages: Math.ceil(totalCount / limitNum),
      currentPage: pageNum
    });
  } catch (err) {
    console.error('Error fetching garage settlements:', err);
    return res.status(500).json({ success: false, message: 'Error loading settlements' });
  }
});

/**
 * POST /api/garage/settlements/request
 * Request payout / settlement for available earnings
 */
router.post('/settlements/request', requireAuth, requireRole('GARAGE'), async (req, res) => {
  const { amount, notes } = req.body || {};
  const db = getDb();
  const earnings = db.collection('garage_earnings');
  const settlements = db.collection('settlements');
  const payoutProfiles = db.collection('garage_payout_profiles');

  try {
    // 1. Calculate authoritative available balance on backend
    const summary = await getGarageEarningsSummary(req.user.id, db);
    const availableBalance = summary.availableBalance || 0;

    const config = loadConfig();
    const minSettlementAmount = config.commission?.minSettlementAmount || 500;

    const requestedAmount = amount !== undefined ? parseFloat(amount) : availableBalance;

    if (isNaN(requestedAmount) || requestedAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Please specify a valid settlement amount' });
    }

    if (requestedAmount < minSettlementAmount) {
      return res.status(400).json({
        success: false,
        message: `Minimum settlement request amount is ₹${minSettlementAmount.toLocaleString('en-IN')}`
      });
    }

    if (requestedAmount > availableBalance) {
      return res.status(400).json({
        success: false,
        message: `Requested amount ₹${requestedAmount.toLocaleString('en-IN')} exceeds your available balance of ₹${availableBalance.toLocaleString('en-IN')}`
      });
    }

    // 2. Fetch available earnings records to lock
    const availableDocs = await earnings
      .find({
        garageId: String(req.user.id),
        status: { $in: [EARNINGS_STATUS.AVAILABLE, EARNINGS_STATUS.REFUND_ADJUSTMENT] }
      })
      .sort({ createdAt: 1 })
      .toArray();

    let accumulated = 0;
    const selectedEarningsIds = [];

    for (const doc of availableDocs) {
      if (accumulated >= requestedAmount) break;
      const net = parseFloat(doc.netAfterRefund !== undefined ? doc.netAfterRefund : doc.garageNetAmount) || 0;
      accumulated += net;
      selectedEarningsIds.push(doc._id);
    }

    // 3. Atomically generate settlement ID
    const settlementId = await generateSettlementNumber(db);
    const now = new Date();

    // 4. Fetch payout profile if existing
    const payoutProfile = await payoutProfiles.findOne({ garageId: String(req.user.id) });

    const settlementDoc = {
      settlementId,
      garageId: String(req.user.id),
      requestedAmount,
      approvedAmount: requestedAmount,
      currency: 'INR',
      status: SETTLEMENT_STATUS.REQUESTED,
      earningsIds: selectedEarningsIds.map(id => String(id)),
      destinationAccountId: payoutProfile?.bankAccountLast4 ? `Account ending in ${payoutProfile.bankAccountLast4}` : 'Default Garage Account',
      notes: notes || 'Garage requested withdrawal',
      requestedAt: now,
      approvedAt: null,
      processedAt: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now
    };

    await settlements.insertOne(settlementDoc);

    // 5. Lock selected earnings to SETTLEMENT_PENDING
    if (selectedEarningsIds.length > 0) {
      await earnings.updateMany(
        { _id: { $in: selectedEarningsIds } },
        {
          $set: {
            status: EARNINGS_STATUS.SETTLEMENT_PENDING,
            settlementId,
            updatedAt: now
          }
        }
      );
    }

    // 6. Send notification to garage
    try {
      await notifyUser(req.user.id, {
        title: 'Settlement Requested',
        body: `Settlement request ${settlementId} for ₹${requestedAmount.toLocaleString('en-IN')} has been submitted for review.`,
        data: {
          type: 'SETTLEMENT_REQUESTED',
          settlementId,
          amount: String(requestedAmount)
        }
      });
    } catch (notifErr) {
      console.warn('Error sending settlement notification:', notifErr.message);
    }

    return res.status(201).json({
      success: true,
      message: `Settlement request ${settlementId} for ₹${requestedAmount.toLocaleString('en-IN')} submitted successfully`,
      settlement: {
        id: String(settlementDoc._id),
        ...settlementDoc
      }
    });
  } catch (err) {
    console.error('Error submitting settlement request:', err);
    return res.status(500).json({ success: false, message: 'Error submitting settlement request' });
  }
});

/**
 * GET /api/garage/settlements/:id
 * Single settlement details with included earnings
 */
router.get('/settlements/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const settlements = db.collection('settlements');
  const earnings = db.collection('garage_earnings');

  try {
    const sObjectId = toObjectId(id);
    const settlement = sObjectId
      ? await settlements.findOne({ _id: sObjectId })
      : await settlements.findOne({ settlementId: id });

    if (!settlement) {
      return res.status(404).json({ success: false, message: 'Settlement not found' });
    }

    if (String(settlement.garageId) !== String(req.user.id) && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    // Fetch included earnings
    let includedEarnings = [];
    if (settlement.earningsIds && settlement.earningsIds.length > 0) {
      const eObjectIds = settlement.earningsIds.map(eid => toObjectId(eid)).filter(Boolean);
      includedEarnings = await earnings.find({ _id: { $in: eObjectIds } }).toArray();
    }

    return res.status(200).json({
      success: true,
      settlement: {
        id: String(settlement._id),
        ...settlement,
        includedEarnings: includedEarnings.map(e => ({
          id: String(e._id),
          invoiceNumber: e.invoiceNumber,
          vehicleNumber: e.vehicleNumber,
          serviceType: e.serviceType,
          grossAmount: e.grossAmount,
          platformCommission: e.platformCommission,
          garageNetAmount: e.garageNetAmount,
          netAfterRefund: e.netAfterRefund !== undefined ? e.netAfterRefund : e.garageNetAmount,
          status: e.status
        }))
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error loading settlement details' });
  }
});

/**
 * GET /api/garage/payout-profile
 * Retrieve masked payout bank profile
 */
router.get('/payout-profile', requireAuth, requireRole('GARAGE'), async (req, res) => {
  const db = getDb();
  const payoutProfiles = db.collection('garage_payout_profiles');

  try {
    const profile = await payoutProfiles.findOne({ garageId: String(req.user.id) });
    return res.status(200).json({
      success: true,
      profile: profile ? {
        accountHolderName: profile.accountHolderName,
        bankAccountLast4: profile.bankAccountLast4,
        bankName: profile.bankName,
        ifscMasked: profile.ifscMasked,
        verified: Boolean(profile.verified)
      } : null
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error loading payout profile' });
  }
});

/**
 * PUT /api/garage/payout-profile
 * Update payout profile with masked credentials
 */
router.put('/payout-profile', requireAuth, requireRole('GARAGE'), async (req, res) => {
  const { accountHolderName, accountNumber, ifscCode, bankName } = req.body || {};

  if (!accountHolderName || !accountNumber || !ifscCode) {
    return res.status(400).json({ success: false, message: 'Account holder, account number, and IFSC code are required' });
  }

  const db = getDb();
  const payoutProfiles = db.collection('garage_payout_profiles');

  try {
    const last4 = String(accountNumber).slice(-4);
    const maskedIfsc = String(ifscCode).toUpperCase().slice(0, 4) + '***' + String(ifscCode).toUpperCase().slice(-3);

    const updateDoc = {
      garageId: String(req.user.id),
      accountHolderName: String(accountHolderName).trim(),
      bankAccountLast4: last4,
      bankName: bankName ? String(bankName).trim() : 'Bank Account',
      ifscMasked: maskedIfsc,
      verified: true,
      updatedAt: new Date()
    };

    await payoutProfiles.updateOne(
      { garageId: String(req.user.id) },
      { $set: updateDoc, $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    );

    return res.status(200).json({
      success: true,
      message: 'Payout profile updated successfully',
      profile: {
        accountHolderName: updateDoc.accountHolderName,
        bankAccountLast4: updateDoc.bankAccountLast4,
        bankName: updateDoc.bankName,
        ifscMasked: updateDoc.ifscMasked,
        verified: true
      }
    });
  } catch (err) {
    console.error('Error saving payout profile:', err);
    return res.status(500).json({ success: false, message: 'Error saving payout profile' });
  }
});

module.exports = router;
