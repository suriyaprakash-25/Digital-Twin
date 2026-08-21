const { ObjectId } = require('mongodb');
const { getDb } = require('../db');
const { SETTLEMENT_STATUS } = require('./settlementStateMachine');
const { HOLD_REASON } = require('../models/SettlementSchedule');
const { logFinancialAudit } = require('./auditService');

const HIGH_VALUE_THRESHOLD_RUPEES = parseFloat(process.env.HIGH_VALUE_SETTLEMENT_THRESHOLD) || 50000;

function safeObjectId(id) {
  try { return new ObjectId(String(id)); } catch { return null; }
}

/**
 * Places a hold on a settlement / garage
 */
async function placeSettlementHold({ settlementId, garageId, reason, note, adminId, ip, userAgent, dbInstance }) {
  const db = dbInstance || getDb();
  const holds = db.collection('settlement_holds');
  const settlements = db.collection('settlements');
  const now = new Date();

  let targetSettlement = null;
  if (settlementId) {
    const sId = safeObjectId(settlementId);
    targetSettlement = sId ? await settlements.findOne({ _id: sId }) : await settlements.findOne({ settlementId });
  }

  const holdDoc = {
    settlementId: targetSettlement ? targetSettlement.settlementId : settlementId || null,
    settlementObjectId: targetSettlement ? targetSettlement._id : null,
    garageId: String(garageId || targetSettlement?.garageId),
    reason: reason || HOLD_REASON.MANUAL_ADMIN_HOLD,
    note: note || 'Administrative review hold',
    active: true,
    placedBy: String(adminId),
    placedAt: now,
    releasedBy: null,
    releasedAt: null,
    releaseNote: null,
    createdAt: now,
    updatedAt: now
  };

  const insertRes = await holds.insertOne(holdDoc);

  await logFinancialAudit({
    actorId: String(adminId),
    actorRole: 'ADMIN',
    garageId: holdDoc.garageId,
    settlementId: holdDoc.settlementId,
    action: 'SETTLEMENT_HOLD_PLACED',
    resourceType: 'SETTLEMENT_HOLD',
    resourceId: String(insertRes.insertedId),
    ip,
    userAgent,
    afterState: { reason: holdDoc.reason, note: holdDoc.note },
    dbInstance: db
  });

  return { success: true, holdId: insertRes.insertedId, hold: holdDoc };
}

/**
 * Releases an active settlement hold
 */
async function releaseSettlementHold({ holdId, settlementId, releaseNote, adminId, ip, userAgent, dbInstance }) {
  const db = dbInstance || getDb();
  const holds = db.collection('settlement_holds');
  const now = new Date();

  const hId = safeObjectId(holdId);
  const query = hId ? { _id: hId, active: true } : { settlementId, active: true };
  const hold = await holds.findOne(query);

  if (!hold) {
    throw new Error('Active settlement hold not found');
  }

  await holds.updateOne(
    { _id: hold._id },
    {
      $set: {
        active: false,
        releasedBy: String(adminId),
        releasedAt: now,
        releaseNote: releaseNote || 'Hold cleared by admin',
        updatedAt: now
      }
    }
  );

  await logFinancialAudit({
    actorId: String(adminId),
    actorRole: 'ADMIN',
    garageId: hold.garageId,
    settlementId: hold.settlementId,
    action: 'SETTLEMENT_HOLD_RELEASED',
    resourceType: 'SETTLEMENT_HOLD',
    resourceId: String(hold._id),
    ip,
    userAgent,
    afterState: { releasedAt: now, releaseNote },
    dbInstance: db
  });

  return { success: true, message: 'Settlement hold released successfully' };
}

/**
 * Records an approval on a settlement with Maker-Checker and dual-approval validation
 */
async function approveSettlement({ settlementId, adminId, role, ip, userAgent, dbInstance }) {
  const db = dbInstance || getDb();
  const settlements = db.collection('settlements');
  const holds = db.collection('settlement_holds');
  const now = new Date();

  const sId = safeObjectId(settlementId);
  const settlement = sId ? await settlements.findOne({ _id: sId }) : await settlements.findOne({ settlementId });

  if (!settlement) {
    throw new Error('Settlement record not found');
  }

  // 1. Check Active Holds
  const activeHold = await holds.findOne({
    $or: [{ settlementId: settlement.settlementId }, { garageId: settlement.garageId }],
    active: true
  });
  if (activeHold) {
    throw new Error(`Cannot approve settlement: Active hold present (${activeHold.reason})`);
  }

  // 2. Maker-Checker Enforcement: Requester cannot approve own settlement
  if (settlement.requestedBy && settlement.requestedBy === String(adminId)) {
    throw new Error('Maker-Checker violation: Requester cannot approve their own settlement');
  }

  // 3. Prevent duplicate approval by same admin
  const existingApprovals = settlement.approvals || [];
  const alreadyApproved = existingApprovals.some(a => String(a.adminId) === String(adminId));
  if (alreadyApproved) {
    throw new Error('Admin has already approved this settlement');
  }

  const requestedAmount = parseFloat(settlement.requestedAmount) || 0;
  const isHighValue = settlement.isHighValue !== undefined ? settlement.isHighValue : (requestedAmount >= HIGH_VALUE_THRESHOLD_RUPEES);
  const requiredApprovalCount = isHighValue ? 2 : 1;

  const newApproval = {
    adminId: String(adminId),
    role: role || 'FINANCE_ADMIN',
    action: 'APPROVED',
    timestamp: now,
    ip: ip || '127.0.0.1',
    userAgent: userAgent || 'DrivePortz Core'
  };

  const updatedApprovals = [...existingApprovals, newApproval];
  const newApprovalCount = updatedApprovals.length;

  let newStatus = settlement.status;
  if (newApprovalCount >= requiredApprovalCount) {
    newStatus = SETTLEMENT_STATUS.APPROVED;
  } else {
    newStatus = SETTLEMENT_STATUS.UNDER_REVIEW;
  }

  await settlements.updateOne(
    { _id: settlement._id },
    {
      $set: {
        status: newStatus,
        approvals: updatedApprovals,
        approvalCount: newApprovalCount,
        requiredApprovalCount,
        isHighValue,
        approvedBy: String(adminId),
        approvedAt: now,
        updatedAt: now
      }
    }
  );

  await logFinancialAudit({
    actorId: String(adminId),
    actorRole: role || 'FINANCE_ADMIN',
    garageId: settlement.garageId,
    settlementId: settlement.settlementId,
    action: 'SETTLEMENT_APPROVED',
    resourceType: 'SETTLEMENT',
    resourceId: String(settlement._id),
    ip,
    userAgent,
    afterState: {
      status: newStatus,
      approvalCount: newApprovalCount,
      requiredApprovalCount
    },
    dbInstance: db
  });

  return {
    success: true,
    status: newStatus,
    approvalCount: newApprovalCount,
    requiredApprovalCount,
    isFullyApproved: newApprovalCount >= requiredApprovalCount
  };
}

module.exports = {
  HIGH_VALUE_THRESHOLD_RUPEES,
  placeSettlementHold,
  releaseSettlementHold,
  approveSettlement
};
