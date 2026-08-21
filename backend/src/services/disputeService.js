const { ObjectId } = require('mongodb');
const { getDb } = require('../db');
const { DISPUTE_STATUS, DISPUTE_RESOLUTION } = require('../models/Dispute');
const { generateDisputeNumber } = require('../utils/disputeNumber');
const { notifyUser } = require('./notifications');
const { createRazorpayRefund } = require('./razorpayService');
const { reconcileRefundEarnings } = require('./earningsService');
const { PAYMENT_STATUS } = require('../models/Payment');

function safeObjectId(id) {
  try {
    return new ObjectId(String(id));
  } catch {
    return null;
  }
}

/**
 * Logs an append-only event to the dispute timeline
 */
async function logDisputeEvent({ disputeId, actorId, actorRole, action, message, metadata = {}, dbInstance }) {
  const db = dbInstance || getDb();
  const events = db.collection('dispute_events');

  const eventDoc = {
    disputeId: String(disputeId),
    actorId: String(actorId || 'system'),
    actorRole: String(actorRole || 'SYSTEM'),
    action,
    message: message || '',
    metadata,
    createdAt: new Date()
  };

  await events.insertOne(eventDoc);
  return eventDoc;
}

/**
 * Creates a new payment dispute
 */
async function createDispute({ userId, paymentId, category, subject, description, disputedAmount, evidence = [], dbInstance }) {
  const db = dbInstance || getDb();
  const payments = db.collection('payments');
  const disputes = db.collection('payment_disputes');

  const pId = safeObjectId(paymentId);
  const payment = pId
    ? await payments.findOne({ _id: pId })
    : await payments.findOne({ $or: [{ paymentId }, { razorpayPaymentId: paymentId }] });

  if (!payment) {
    throw new Error('Payment record not found');
  }

  // Authorization check: User must own payment
  if (String(payment.userId) !== String(userId)) {
    throw new Error('Unauthorized: Payment does not belong to this user account');
  }

  // Check duplicate active disputes
  const existingActive = await disputes.findOne({
    paymentId: String(payment._id || payment.paymentId),
    status: { $in: [DISPUTE_STATUS.OPEN, DISPUTE_STATUS.UNDER_REVIEW, DISPUTE_STATUS.WAITING_FOR_GARAGE, DISPUTE_STATUS.WAITING_FOR_USER] }
  });

  if (existingActive) {
    throw new Error(`An active dispute (${existingActive.disputeNumber}) is already open for this payment`);
  }

  const maxAmount = parseFloat(payment.amount) || 0;
  const numDisputedAmount = disputedAmount !== undefined && disputedAmount !== null && disputedAmount !== ''
    ? parseFloat(disputedAmount)
    : maxAmount;

  if (isNaN(numDisputedAmount) || numDisputedAmount <= 0) {
    throw new Error('Please provide a valid disputed amount');
  }

  if (numDisputedAmount > maxAmount) {
    throw new Error(`Disputed amount (₹${numDisputedAmount}) cannot exceed the paid transaction amount (₹${maxAmount})`);
  }

  const disputeNumber = await generateDisputeNumber(db);
  const now = new Date();

  const disputeDoc = {
    disputeNumber,
    paymentId: String(payment._id || payment.paymentId),
    razorpayPaymentId: payment.razorpayPaymentId || '—',
    invoiceId: String(payment.invoiceId || payment.serviceId || ''),
    invoiceNumber: payment.invoiceNumber || '—',
    userId: String(userId),
    garageId: String(payment.garageId || ''),
    garageName: payment.garageName || 'Authorized Service Center',
    serviceType: payment.serviceType || 'Automotive Service',
    vehicleNumber: payment.vehicleNumber || 'N/A',
    vehicleId: String(payment.vehicleId || ''),

    category: category || 'OTHER',
    subject: String(subject || 'Payment Dispute').trim(),
    description: String(description || '').trim(),
    disputedAmount: numDisputedAmount,
    disputedAmountPaise: Math.round(numDisputedAmount * 100),
    originalAmount: maxAmount,

    evidence: Array.isArray(evidence) ? evidence : [],
    status: DISPUTE_STATUS.OPEN,

    garageResponse: null,
    garageRespondedAt: null,
    adminResponse: null,
    resolution: null,
    resolutionNote: null,
    resolvedAt: null,
    resolvedBy: null,

    createdAt: now,
    updatedAt: now
  };

  const insertRes = await disputes.insertOne(disputeDoc);
  const createdId = String(insertRes.insertedId);

  // Log timeline event
  await logDisputeEvent({
    disputeId: createdId,
    actorId: userId,
    actorRole: 'USER',
    action: 'DISPUTE_CREATED',
    message: `Dispute opened by customer: ${disputeDoc.subject}`,
    metadata: { category: disputeDoc.category, amount: disputeDoc.disputedAmount },
    dbInstance: db
  });

  // Notify Garage
  if (payment.garageId) {
    await notifyUser(payment.garageId, {
      title: 'New Dispute Raised',
      body: `Customer raised a dispute (${disputeNumber}) regarding invoice ${payment.invoiceNumber || 'N/A'}.`,
      data: {
        type: 'NEW_DISPUTE',
        disputeId: createdId,
        disputeNumber
      }
    }).catch(e => console.warn('Dispute notif error:', e));
  }

  return { id: createdId, ...disputeDoc };
}

/**
 * Resolves a dispute with administrative actions (including full/partial refunds)
 */
async function resolveDispute({ disputeId, adminId, resolution, resolutionNote, refundAmount, dbInstance }) {
  const db = dbInstance || getDb();
  const disputes = db.collection('payment_disputes');
  const payments = db.collection('payments');
  const services = db.collection('services');

  const dId = safeObjectId(disputeId);
  const dispute = dId
    ? await disputes.findOne({ _id: dId })
    : await disputes.findOne({ disputeNumber: disputeId });

  if (!dispute) {
    throw new Error('Dispute record not found');
  }

  if (dispute.status === DISPUTE_STATUS.RESOLVED || dispute.status === DISPUTE_STATUS.REJECTED) {
    throw new Error(`Dispute is already ${dispute.status}`);
  }

  const now = new Date();
  let rzpRefundResult = null;

  // Handle Refund Resolutions
  if (resolution === DISPUTE_RESOLUTION.REFUND_FULL || resolution === DISPUTE_RESOLUTION.REFUND_PARTIAL) {
    const pId = safeObjectId(dispute.paymentId);
    const payment = pId
      ? await payments.findOne({ _id: pId })
      : await payments.findOne({ $or: [{ paymentId: dispute.paymentId }, { razorpayPaymentId: dispute.paymentId }] });

    if (!payment) {
      throw new Error('Original payment record not found for refund processing');
    }

    const maxRefundable = Math.max(0, (parseFloat(payment.amount) || 0) - (parseFloat(payment.totalRefundedAmount) || 0));
    const targetRefundAmt = resolution === DISPUTE_RESOLUTION.REFUND_FULL
      ? maxRefundable
      : (parseFloat(refundAmount) || dispute.disputedAmount);

    if (targetRefundAmt <= 0 || targetRefundAmt > maxRefundable) {
      throw new Error(`Refund amount ₹${targetRefundAmt} is invalid or exceeds remaining refundable balance of ₹${maxRefundable}`);
    }

    // Call Phase 3 Razorpay Refund engine if payment has a live razorpayPaymentId
    if (payment.razorpayPaymentId && payment.razorpayPaymentId.startsWith('pay_')) {
      try {
        rzpRefundResult = await createRazorpayRefund({
          paymentId: payment.razorpayPaymentId,
          amountInPaise: Math.round(targetRefundAmt * 100),
          notes: {
            disputeNumber: dispute.disputeNumber,
            reason: resolutionNote || 'Dispute resolution refund'
          }
        });
      } catch (err) {
        console.error('Dispute refund gateway error:', err);
        throw new Error(`Razorpay refund failed: ${err.message}`);
      }
    }

    // Update payment document
    const newTotalRefunded = (parseFloat(payment.totalRefundedAmount) || 0) + targetRefundAmt;
    const isFullyRefunded = newTotalRefunded >= payment.amount;
    const newStatus = isFullyRefunded ? PAYMENT_STATUS.REFUNDED : PAYMENT_STATUS.PARTIALLY_REFUNDED;

    await payments.updateOne(
      { _id: payment._id },
      {
        $set: {
          status: newStatus,
          totalRefundedAmount: newTotalRefunded,
          refundedAt: now,
          updatedAt: now
        },
        $push: {
          refunds: {
            refundId: rzpRefundResult?.id || `rfnd_disp_${Date.now()}`,
            amount: targetRefundAmt,
            currency: 'INR',
            reason: `Dispute ${dispute.disputeNumber} resolution`,
            status: 'processed',
            createdAt: now
          }
        }
      }
    );

    // Update service record
    if (payment.serviceId) {
      const sId = safeObjectId(payment.serviceId);
      await services.updateOne(
        sId ? { _id: sId } : { _id: String(payment.serviceId) },
        {
          $set: {
            paymentStatus: newStatus,
            totalRefundedAmount: newTotalRefunded,
            refundedAt: now
          }
        }
      );
    }

    // Reconcile garage earnings ledger
    const updatedPayment = await payments.findOne({ _id: payment._id });
    await reconcileRefundEarnings({ payment: updatedPayment, refundAmount: targetRefundAmt, dbInstance: db }).catch(e => console.warn('Dispute earnings reconciliation error:', e));

    // Log refund timeline event
    await logDisputeEvent({
      disputeId: String(dispute._id),
      actorId: adminId,
      actorRole: 'ADMIN',
      action: 'REFUND_COMPLETED',
      message: `Refund of ₹${targetRefundAmt.toLocaleString('en-IN')} processed successfully for dispute resolution.`,
      metadata: { amount: targetRefundAmt, refundId: rzpRefundResult?.id },
      dbInstance: db
    });

    // Send refund notification to user
    await notifyUser(dispute.userId, {
      title: 'Refund Processed for Dispute',
      body: `Your dispute ${dispute.disputeNumber} was resolved with a refund of ₹${targetRefundAmt.toLocaleString('en-IN')}.`,
      data: {
        type: 'REFUND_COMPLETED',
        disputeId: String(dispute._id),
        disputeNumber: dispute.disputeNumber,
        amount: String(targetRefundAmt)
      }
    }).catch(e => console.warn('User notif error:', e));
  }

  const finalStatus = resolution === DISPUTE_RESOLUTION.REJECT_DISPUTE ? DISPUTE_STATUS.REJECTED : DISPUTE_STATUS.RESOLVED;

  // Update dispute
  await disputes.updateOne(
    { _id: dispute._id },
    {
      $set: {
        status: finalStatus,
        resolution: resolution || DISPUTE_RESOLUTION.NO_ACTION,
        resolutionNote: String(resolutionNote || '').trim(),
        resolvedAt: now,
        resolvedBy: String(adminId),
        updatedAt: now
      }
    }
  );

  // Log final timeline event
  await logDisputeEvent({
    disputeId: String(dispute._id),
    actorId: adminId,
    actorRole: 'ADMIN',
    action: finalStatus === DISPUTE_STATUS.RESOLVED ? 'DISPUTE_RESOLVED' : 'DISPUTE_REJECTED',
    message: `Dispute marked as ${finalStatus}: ${resolutionNote || 'No notes provided'}`,
    metadata: { resolution },
    dbInstance: db
  });

  // Notify customer of final outcome
  await notifyUser(dispute.userId, {
    title: finalStatus === DISPUTE_STATUS.RESOLVED ? 'Dispute Resolved' : 'Dispute Closed',
    body: `Your dispute ${dispute.disputeNumber} has been ${finalStatus.toLowerCase()} by support.`,
    data: {
      type: finalStatus === DISPUTE_STATUS.RESOLVED ? 'DISPUTE_RESOLVED' : 'DISPUTE_REJECTED',
      disputeId: String(dispute._id),
      disputeNumber: dispute.disputeNumber
    }
  }).catch(e => console.warn('User notif error:', e));

  // Audit log
  await db.collection('admin_audit_logs').insertOne({
    adminId: String(adminId),
    action: finalStatus === DISPUTE_STATUS.RESOLVED ? 'DISPUTE_RESOLVED' : 'DISPUTE_REJECTED',
    targetId: String(dispute._id),
    disputeNumber: dispute.disputeNumber,
    resolution,
    resolutionNote,
    timestamp: now
  });

  return await disputes.findOne({ _id: dispute._id });
}

module.exports = {
  createDispute,
  logDisputeEvent,
  resolveDispute
};
