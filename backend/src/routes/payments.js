const express = require('express');
const { ObjectId } = require('mongodb');
const { getDb } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { loadConfig } = require('../config');
const {
  createRazorpayOrder,
  verifyPaymentSignature,
  verifyWebhookSignature,
  fetchPaymentDetails,
  createRazorpayRefund,
  fetchRefundDetails
} = require('../services/razorpayService');
const { PAYMENT_STATUS } = require('../models/Payment');
const { notifyUser } = require('../services/notifications');
const { recordPaymentEarnings, reconcileRefundEarnings } = require('../services/earningsService');
const { idempotencyMiddleware } = require('../middleware/idempotency');
const { paymentCreationLimiter, refundLimiter } = require('../middleware/financialRateLimit');
const { evaluateTransactionRisk } = require('../services/paymentRiskService');
const { logFinancialAudit } = require('../services/auditService');

const router = express.Router();

function toObjectId(id) {
  try {
    return new ObjectId(String(id));
  } catch {
    return null;
  }
}

/**
 * POST /api/payments/create-order
 * Initiates Razorpay Order for an unpaid service invoice
 */
router.post('/create-order', requireAuth, paymentCreationLimiter, idempotencyMiddleware, async (req, res) => {
  const { invoiceId, serviceId } = req.body || {};
  const targetId = serviceId || invoiceId;

  if (!targetId) {
    return res.status(400).json({ success: false, message: 'Service or Invoice ID is required' });
  }

  const db = getDb();
  const services = db.collection('services');
  const invoices = db.collection('invoices');
  const vehicles = db.collection('vehicles');
  const payments = db.collection('payments');

  try {
    const sObjectId = toObjectId(targetId);
    const idList = [targetId, String(targetId)];
    if (sObjectId) idList.push(sObjectId);

    const queryFilters = [
      { _id: { $in: idList } },
      { id: { $in: idList } },
      { invoiceNumber: String(targetId) },
      { invoiceId: { $in: idList } }
    ];

    if (invoiceId && invoiceId !== targetId) {
      const invObjectId = toObjectId(invoiceId);
      const invList = [invoiceId, String(invoiceId)];
      if (invObjectId) invList.push(invObjectId);
      queryFilters.push(
        { _id: { $in: invList } },
        { invoiceNumber: String(invoiceId) },
        { invoiceId: { $in: invList } }
      );
    }

    let targetDoc = null;
    let docSource = 'services';

    // 1. Search services collection
    targetDoc = await services.findOne({ $or: queryFilters, isArchived: { $ne: true } });

    // 2. Search invoices collection
    if (!targetDoc) {
      targetDoc = await invoices.findOne({ $or: queryFilters });
      if (targetDoc) docSource = 'invoices';
    }

    // 3. Search payments collection
    if (!targetDoc) {
      targetDoc = await payments.findOne({ $or: queryFilters });
      if (targetDoc) {
        docSource = 'payments';
        // If payment doc has serviceId, try to enrich with service details
        if (targetDoc.serviceId) {
          const psId = toObjectId(targetDoc.serviceId);
          const sDoc = await services.findOne(psId ? { $or: [{ _id: psId }, { _id: String(targetDoc.serviceId) }] } : { _id: String(targetDoc.serviceId) });
          if (sDoc) {
            targetDoc = { ...sDoc, ...targetDoc };
          }
        }
      }
    }

    if (!targetDoc) {
      return res.status(404).json({ success: false, message: 'Service record or invoice not found' });
    }

    // Check ownership: authenticated user must be the vehicle owner or customer
    let vehicle = null;
    if (targetDoc.vehicleId) {
      const vObjectId = toObjectId(targetDoc.vehicleId);
      vehicle = vObjectId
        ? await vehicles.findOne({ _id: vObjectId, isArchived: { $ne: true } })
        : await vehicles.findOne({ $or: [{ _id: String(targetDoc.vehicleId) }, { id: String(targetDoc.vehicleId) }], isArchived: { $ne: true } });
    } else if (targetDoc.vehicleNumber) {
      vehicle = await vehicles.findOne({ vehicleNumber: targetDoc.vehicleNumber, isArchived: { $ne: true } });
    }

    const isOwner = (vehicle && String(vehicle.ownerId) === String(req.user.id)) ||
                    (targetDoc.ownerId && String(targetDoc.ownerId) === String(req.user.id)) ||
                    (targetDoc.userId && String(targetDoc.userId) === String(req.user.id)) ||
                    (targetDoc.customerId && String(targetDoc.customerId) === String(req.user.id)) ||
                    (req.user.role === 'ADMIN') ||
                    (!targetDoc.userId && !targetDoc.ownerId && !targetDoc.customerId);

    if (!isOwner) {
      return res.status(403).json({ success: false, message: 'Forbidden: You are not authorized to pay for this invoice' });
    }

    // Check if cancelled
    if (targetDoc.invoiceStatus === 'CANCELLED' || targetDoc.status === 'CANCELLED') {
      return res.status(400).json({ success: false, message: 'Cannot pay for a cancelled invoice' });
    }

    // Check if already paid
    if (targetDoc.paymentStatus === 'PAID' || targetDoc.status === PAYMENT_STATUS.CAPTURED || targetDoc.status === 'PAID') {
      return res.status(400).json({ success: false, message: 'This service invoice is already paid' });
    }

    // Check if an existing captured payment already exists in database
    const existingPaid = await payments.findOne({
      $or: [
        { serviceId: String(targetDoc._id) },
        { invoiceId: String(targetDoc._id) },
        { invoiceNumber: targetDoc.invoiceNumber }
      ].filter(f => Object.values(f)[0]),
      status: { $in: [PAYMENT_STATUS.CAPTURED, PAYMENT_STATUS.PAID] }
    });

    if (existingPaid) {
      return res.status(400).json({ success: false, message: 'This service invoice is already paid' });
    }

    // Authoritative amount calculation from database
    const totalCost = Number(
      targetDoc.totalAmount !== undefined
        ? targetDoc.totalAmount
        : targetDoc.totalCost !== undefined
        ? targetDoc.totalCost
        : targetDoc.amount !== undefined
        ? targetDoc.amount
        : targetDoc.price !== undefined
        ? targetDoc.price
        : targetDoc.cost || 0
    );

    if (Number.isNaN(totalCost) || totalCost <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid service amount. Invoice total must be greater than zero.' });
    }

    const amountInPaise = Math.round(totalCost * 100);
    const config = loadConfig();
    const keyId = config.razorpay?.keyId || process.env.RAZORPAY_KEY_ID || 'rzp_test_TSSWBNcFmDPpRK';

    const invoiceNumber = targetDoc.invoiceNumber || `DP-INV-2026-${String(targetDoc._id).slice(-6).toUpperCase()}`;

    // Risk Assessment (safe non-blocking)
    try {
      await evaluateTransactionRisk({
        userId: req.user.id,
        garageId: targetDoc.garageId || targetDoc.createdBy,
        invoiceId: targetDoc._id,
        amount: totalCost,
        operation: 'PAYMENT',
        dbInstance: db
      });
    } catch (riskErr) {
      console.warn('Risk evaluation warning:', riskErr.message);
    }

    // Generate unique internal reference
    const receipt = `rcpt_${String(targetDoc._id || targetId).slice(-8)}_${Date.now().toString().slice(-6)}`;

    // Create server-side order with Razorpay
    let razorpayOrder;
    try {
      razorpayOrder = await createRazorpayOrder({
        amountInPaise,
        receipt,
        notes: {
          serviceId: String(targetDoc.serviceId || targetDoc._id || targetId),
          invoiceNumber,
          vehicleId: String(targetDoc.vehicleId || (vehicle ? vehicle._id : '')),
          userId: String(req.user.id),
          vehicleNumber: vehicle?.vehicleNumber || targetDoc.vehicleNumber || 'Vehicle'
        }
      });
    } catch (rzpErr) {
      console.error('Razorpay order creation error:', rzpErr);
      return res.status(500).json({
        success: false,
        message: 'Failed to create payment order with payment gateway. ' + (rzpErr.message || ''),
        error: rzpErr.message
      });
    }

    // Record or update payment attempt in database
    const paymentDoc = {
      invoiceId: String(targetDoc._id || targetId),
      invoiceNumber,
      serviceId: String(targetDoc.serviceId || targetDoc._id || targetId),
      vehicleId: String(targetDoc.vehicleId || (vehicle ? vehicle._id : '')),
      vehicleNumber: vehicle?.vehicleNumber || targetDoc.vehicleNumber || 'N/A',
      userId: String(req.user.id),
      garageId: targetDoc.garageId ? String(targetDoc.garageId) : (targetDoc.createdBy ? String(targetDoc.createdBy) : null),
      garageName: targetDoc.garageName || 'Authorized Service Center',
      serviceType: targetDoc.serviceType || targetDoc.title || 'Automotive Service',
      amount: totalCost,
      amountPaise: amountInPaise,
      currency: 'INR',
      receipt,
      razorpayOrderId: razorpayOrder.id,
      status: PAYMENT_STATUS.CREATED,
      paymentMethod: null,
      failureReason: null,
      paidAt: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Check if an existing pending payment record already exists for this invoice
    const pendingQuery = [
      { invoiceNumber },
      { invoiceId: String(targetDoc._id || targetId) },
      { serviceId: String(targetDoc.serviceId || targetDoc._id || targetId) }
    ];
    if (targetDoc._id) pendingQuery.push({ _id: targetDoc._id });

    const existingPendingPayment = await payments.findOne({
      $or: pendingQuery,
      status: { $in: [PAYMENT_STATUS.CREATED, PAYMENT_STATUS.PENDING] }
    });

    let paymentRecordId;
    if (existingPendingPayment) {
      await payments.updateOne(
        { _id: existingPendingPayment._id },
        {
          $set: {
            razorpayOrderId: razorpayOrder.id,
            amountPaise: amountInPaise,
            amount: totalCost,
            receipt,
            invoiceNumber,
            vehicleNumber: vehicle?.vehicleNumber || targetDoc.vehicleNumber || 'N/A',
            garageName: targetDoc.garageName || 'Authorized Service Center',
            serviceType: targetDoc.serviceType || targetDoc.title || 'Automotive Service',
            status: PAYMENT_STATUS.CREATED,
            updatedAt: new Date()
          }
        }
      );
      paymentRecordId = String(existingPendingPayment._id);
    } else {
      const insertResult = await payments.insertOne(paymentDoc);
      paymentRecordId = String(insertResult.insertedId);
    }

    // Financial audit log
    try {
      await logFinancialAudit({
        actorId: req.user.id,
        actorRole: 'USER',
        action: 'PAYMENT_ORDER_CREATED',
        resourceType: 'PAYMENT',
        resourceId: paymentRecordId,
        afterState: { razorpayOrderId: razorpayOrder.id, amount: totalCost },
        req,
        dbInstance: db
      });
    } catch (auditErr) {
      console.warn('Audit logging warning:', auditErr.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Razorpay order created successfully',
      order: {
        id: razorpayOrder.id,
        amount: amountInPaise,
        currency: razorpayOrder.currency || 'INR',
        receipt: razorpayOrder.receipt,
        keyId,
        invoiceNumber,
        garageName: targetDoc.garageName || 'Authorized Service Center',
        serviceType: targetDoc.serviceType || targetDoc.title || 'Automotive Service',
        paymentRecordId
      }
    });
  } catch (err) {
    console.error('Error in /create-order:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error while creating payment order: ' + (err.message || 'Internal server error')
    });
  }
});

/**
 * POST /api/payments/verify
 * Verifies Razorpay HMAC signature and updates invoice status
 */
router.post('/verify', requireAuth, async (req, res) => {
  const { paymentId, razorpayOrderId, signature, serviceId } = req.body || {};

  if (!paymentId || !razorpayOrderId || !signature) {
    return res.status(400).json({
      success: false,
      message: 'Payment verification failed: paymentId, razorpayOrderId, and signature are required'
    });
  }

  const db = getDb();
  const payments = db.collection('payments');
  const services = db.collection('services');

  try {
    // 1. Locate stored payment record by server-stored order ID
    const payment = await payments.findOne({ razorpayOrderId });
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found for this order ID' });
    }

    // 2. Authorize user ownership
    if (String(payment.userId) !== String(req.user.id) && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Forbidden: Unauthorized payment verification attempt' });
    }

    // 3. Prevent duplicate processing if already captured
    if (payment.status === PAYMENT_STATUS.CAPTURED) {
      return res.status(200).json({
        success: true,
        message: 'Payment is already verified and confirmed',
        payment: {
          id: String(payment._id),
          orderId: payment.razorpayOrderId,
          paymentId: payment.razorpayPaymentId || paymentId,
          amount: payment.amount,
          status: payment.status,
          paidAt: payment.paidAt
        }
      });
    }

    // 4. Verify signature using timing-safe comparison
    const isValid = verifyPaymentSignature({
      orderId: payment.razorpayOrderId,
      paymentId,
      signature
    });

    if (!isValid) {
      await payments.updateOne(
        { _id: payment._id },
        {
          $set: {
            status: PAYMENT_STATUS.FAILED,
            failureReason: 'Signature mismatch / Tampering attempt detected',
            updatedAt: new Date()
          }
        }
      );
      return res.status(400).json({ success: false, message: 'Invalid payment signature. Verification failed.' });
    }

    // 5. Fetch payment details from Razorpay if available to obtain payment method
    let paymentMethod = 'Online / Razorpay';
    try {
      const rzpPayment = await fetchPaymentDetails(paymentId);
      if (rzpPayment && rzpPayment.method) {
        paymentMethod = rzpPayment.method.toUpperCase();
      }
    } catch (fetchErr) {
      // Non-critical, fallback to standard label
      console.warn('Could not fetch payment method details from Razorpay:', fetchErr.message);
    }

    const paidAt = new Date();

    // 6. Mark payment record as CAPTURED
    await payments.updateOne(
      { _id: payment._id },
      {
        $set: {
          status: PAYMENT_STATUS.CAPTURED,
          razorpayPaymentId: paymentId,
          razorpaySignature: signature,
          paymentMethod,
          paidAt,
          updatedAt: paidAt
        }
      }
    );

    // 7. Mark corresponding service/invoice record as PAID
    const targetServiceId = payment.serviceId || serviceId || payment.invoiceId;
    if (targetServiceId || payment.invoiceNumber) {
      const sObjectId = toObjectId(targetServiceId);
      const queryList = [];
      if (targetServiceId) {
        queryList.push({ _id: String(targetServiceId) }, { id: String(targetServiceId) });
        if (sObjectId) queryList.push({ _id: sObjectId });
      }
      if (payment.invoiceNumber) {
        queryList.push({ invoiceNumber: payment.invoiceNumber });
      }

      await services.updateOne(
        { $or: queryList },
        {
          $set: {
            paymentStatus: 'PAID',
            paidAt,
            paymentId,
            paymentMethod,
            razorpayOrderId: payment.razorpayOrderId,
            updatedAt: paidAt
          }
        }
      ).catch(() => {});

      const invoices = db.collection('invoices');
      await invoices.updateOne(
        { $or: queryList },
        {
          $set: {
            status: 'PAID',
            paidAt,
            paymentId,
            paymentMethod,
            updatedAt: paidAt
          }
        }
      ).catch(() => {});
    }

    // Clean up any stale duplicate pending attempts for this invoice
    const cleanupFilters = [];
    if (payment.invoiceNumber && payment.invoiceNumber !== '—') cleanupFilters.push({ invoiceNumber: payment.invoiceNumber });
    if (payment.invoiceId) {
      cleanupFilters.push({ invoiceId: String(payment.invoiceId) }, { _id: String(payment.invoiceId) });
      const invObj = toObjectId(payment.invoiceId);
      if (invObj) cleanupFilters.push({ _id: invObj });
    }
    if (payment.serviceId) {
      cleanupFilters.push({ serviceId: String(payment.serviceId) }, { _id: String(payment.serviceId) });
      const srvObj = toObjectId(payment.serviceId);
      if (srvObj) cleanupFilters.push({ _id: srvObj });
    }

    if (cleanupFilters.length > 0) {
      await payments.deleteMany({
        _id: { $ne: payment._id },
        $or: cleanupFilters,
        status: { $in: [PAYMENT_STATUS.CREATED, PAYMENT_STATUS.PENDING] }
      }).catch(err => console.warn('Cleanup stale pending payments warning:', err.message));
    }

    // 8. Create or update Garage Earnings Ledger with immutable commission snapshot
    try {
      const updatedPaymentDoc = await payments.findOne({ _id: payment._id });
      if (updatedPaymentDoc) {
        await recordPaymentEarnings({ payment: updatedPaymentDoc, dbInstance: db });
      }
    } catch (earnErr) {
      console.warn('Error recording garage earnings ledger:', earnErr.message);
    }

    // 9. Send notification to Customer and Garage
    try {
      if (payment.userId) {
        await notifyUser(payment.userId, {
          title: 'Payment Successful',
          body: `Your payment of ₹${payment.amount} for ${payment.serviceType || 'Service'} has been confirmed. (Invoice: ${payment.invoiceNumber || 'N/A'})`,
          data: {
            type: 'PAYMENT_SUCCESS',
            paymentId,
            serviceId: String(payment.serviceId || ''),
            invoiceNumber: payment.invoiceNumber || ''
          }
        });
      }
      if (payment.garageId) {
        await notifyUser(payment.garageId, {
          title: 'Payment Received',
          body: `Payment of ₹${payment.amount} received from customer for ${payment.vehicleNumber || 'Vehicle'}.`,
          data: {
            type: 'PAYMENT_SUCCESS',
            paymentId,
            serviceId: String(payment.serviceId || ''),
            invoiceNumber: payment.invoiceNumber || ''
          }
        });
      }
    } catch (notifErr) {
      console.warn('Error sending payment notification:', notifErr.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Payment verified and captured successfully!',
      payment: {
        id: String(payment._id),
        invoiceNumber: payment.invoiceNumber,
        orderId: payment.razorpayOrderId,
        paymentId,
        amount: payment.amount,
        currency: 'INR',
        serviceType: payment.serviceType,
        garageName: payment.garageName,
        vehicleNumber: payment.vehicleNumber,
        status: PAYMENT_STATUS.CAPTURED,
        paidAt
      }
    });
  } catch (err) {
    console.error('Error in /verify:', err);
    return res.status(500).json({ success: false, message: 'Internal server error verifying payment' });
  }
});

/**
 * POST /api/payments/:paymentId/refund
 * Initiates a full or partial refund for a captured payment
 */
router.post('/:paymentId/refund', requireAuth, refundLimiter, idempotencyMiddleware, async (req, res) => {
  const { paymentId } = req.params;
  const { amount, reason = 'Customer requested refund' } = req.body || {};

  const db = getDb();
  const payments = db.collection('payments');
  const services = db.collection('services');

  try {
    const pObjectId = toObjectId(paymentId);
    const payment = pObjectId
      ? await payments.findOne({ $or: [{ _id: pObjectId }, { razorpayPaymentId: paymentId }] })
      : await payments.findOne({ razorpayPaymentId: paymentId });

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found' });
    }

    // Authorization: Garage owner who created the service OR Admin
    const isAuthorized = (payment.garageId && String(payment.garageId) === String(req.user.id)) ||
                         (req.user.role === 'ADMIN') ||
                         (req.user.role === 'GARAGE' && String(payment.garageId) === String(req.user.id));

    if (!isAuthorized) {
      return res.status(403).json({ success: false, message: 'Forbidden: You are not authorized to refund this payment' });
    }

    // Verify payment is captured and eligible for refund
    if (payment.status !== PAYMENT_STATUS.CAPTURED && payment.status !== PAYMENT_STATUS.PARTIALLY_REFUNDED) {
      return res.status(400).json({
        success: false,
        message: `Only captured payments can be refunded. Current status is ${payment.status}`
      });
    }

    if (!payment.razorpayPaymentId) {
      return res.status(400).json({ success: false, message: 'No gateway payment ID associated with this record' });
    }

    // Calculate maximum refundable amount
    const originalAmount = parseFloat(payment.amount) || 0;
    const alreadyRefunded = parseFloat(payment.totalRefundedAmount) || 0;
    const maxRefundable = Math.max(0, originalAmount - alreadyRefunded);

    if (maxRefundable <= 0) {
      return res.status(400).json({ success: false, message: 'This payment has already been fully refunded' });
    }

    const requestedAmount = amount !== undefined ? parseFloat(amount) : maxRefundable;
    if (isNaN(requestedAmount) || requestedAmount <= 0 || requestedAmount > maxRefundable) {
      return res.status(400).json({
        success: false,
        message: `Invalid refund amount. Must be between ₹1 and ₹${maxRefundable}`
      });
    }

    const amountInPaise = Math.round(requestedAmount * 100);
    const refundReceipt = `ref_${String(payment._id).slice(-6)}_${Date.now().toString().slice(-6)}`;

    // Call Razorpay Refund API
    let rzpRefund;
    try {
      rzpRefund = await createRazorpayRefund({
        paymentId: payment.razorpayPaymentId,
        amountInPaise,
        receipt: refundReceipt,
        notes: {
          invoiceNumber: payment.invoiceNumber || '',
          serviceId: String(payment.serviceId || ''),
          reason: String(reason).slice(0, 100),
          refundInitiatedBy: String(req.user.id)
        }
      });
    } catch (rzpErr) {
      console.error('Razorpay refund API error:', rzpErr);
      return res.status(500).json({
        success: false,
        message: 'Failed to process refund with payment gateway',
        error: rzpErr.message
      });
    }

    const newTotalRefunded = alreadyRefunded + requestedAmount;
    const isFullyRefunded = newTotalRefunded >= originalAmount;
    const newStatus = isFullyRefunded ? PAYMENT_STATUS.REFUNDED : PAYMENT_STATUS.PARTIALLY_REFUNDED;
    const refundedAt = new Date();

    const refundEntry = {
      refundId: rzpRefund.id,
      amount: requestedAmount,
      currency: 'INR',
      reason,
      status: rzpRefund.status || 'processed',
      receipt: refundReceipt,
      createdAt: refundedAt
    };

    // Update payment record atomically
    await payments.updateOne(
      { _id: payment._id },
      {
        $set: {
          status: newStatus,
          totalRefundedAmount: newTotalRefunded,
          refundedAt,
          updatedAt: refundedAt
        },
        $push: {
          refunds: refundEntry
        }
      }
    );

    // Update service record status
    if (payment.serviceId) {
      const sObjectId = toObjectId(payment.serviceId);
      const serviceQuery = sObjectId
        ? { $or: [{ _id: sObjectId }, { _id: String(payment.serviceId) }] }
        : { _id: String(payment.serviceId) };

      await services.updateOne(serviceQuery, {
        $set: {
          paymentStatus: newStatus,
          totalRefundedAmount: newTotalRefunded,
          refundedAt,
          updatedAt: refundedAt
        }
      });
    }

    // Reconcile garage earnings ledger
    try {
      const updatedPaymentDoc = await payments.findOne({ _id: payment._id });
      if (updatedPaymentDoc) {
        await reconcileRefundEarnings({ payment: updatedPaymentDoc, refundAmount: requestedAmount, dbInstance: db });
      }
    } catch (recErr) {
      console.warn('Error reconciling refund earnings:', recErr.message);
    }

    // Send notifications
    try {
      if (payment.userId) {
        await notifyUser(payment.userId, {
          title: isFullyRefunded ? 'Payment Refunded' : 'Partial Refund Processed',
          body: `A refund of ₹${requestedAmount} has been processed for your invoice ${payment.invoiceNumber || ''}.`,
          data: {
            type: 'REFUND_COMPLETED',
            paymentId: payment.razorpayPaymentId,
            refundId: rzpRefund.id,
            amount: String(requestedAmount)
          }
        });
      }
    } catch (notifErr) {
      console.warn('Error sending refund notification:', notifErr.message);
    }

    // Financial audit log
    await logFinancialAudit({
      actorId: req.user.id,
      actorRole: req.user.role || 'ADMIN',
      action: 'REFUND_COMPLETED',
      resourceType: 'PAYMENT',
      resourceId: String(payment._id),
      beforeState: { status: payment.status, totalRefundedAmount: alreadyRefunded },
      afterState: { status: newStatus, totalRefundedAmount: newTotalRefunded, refundAmount: requestedAmount },
      req,
      dbInstance: db
    });

    return res.status(200).json({
      success: true,
      message: `Refund of ₹${requestedAmount} initiated successfully`,
      refund: refundEntry,
      payment: {
        id: String(payment._id),
        status: newStatus,
        totalRefundedAmount: newTotalRefunded,
        remainingAmount: Math.max(0, originalAmount - newTotalRefunded)
      }
    });
  } catch (err) {
    console.error('Error initiating refund:', err);
    return res.status(500).json({ success: false, message: 'Internal server error processing refund' });
  }
});

/**
 * GET /api/payments/:paymentId/refund-status
 * Checks the status of refunds for a given payment
 */
router.get('/:paymentId/refund-status', requireAuth, async (req, res) => {
  const { paymentId } = req.params;
  const db = getDb();
  const payments = db.collection('payments');

  try {
    const pObjectId = toObjectId(paymentId);
    const payment = pObjectId
      ? await payments.findOne({ $or: [{ _id: pObjectId }, { razorpayPaymentId: paymentId }] })
      : await payments.findOne({ razorpayPaymentId: paymentId });

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found' });
    }

    // Authorization
    const isOwner = (String(payment.userId) === String(req.user.id)) ||
                    (payment.garageId && String(payment.garageId) === String(req.user.id)) ||
                    (req.user.role === 'ADMIN');

    if (!isOwner) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    return res.status(200).json({
      success: true,
      paymentId: payment.razorpayPaymentId,
      status: payment.status,
      originalAmount: payment.amount,
      totalRefundedAmount: payment.totalRefundedAmount || 0,
      refunds: payment.refunds || []
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error loading refund status' });
  }
});

/**
 * GET /api/payments/details/:id
 * Fetches complete audit details of a payment transaction
 */
router.get('/details/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const payments = db.collection('payments');
  const services = db.collection('services');

  try {
    const pObjectId = toObjectId(id);
    const payment = pObjectId
      ? await payments.findOne({ $or: [{ _id: pObjectId }, { razorpayOrderId: id }, { razorpayPaymentId: id }] })
      : await payments.findOne({ $or: [{ razorpayOrderId: id }, { razorpayPaymentId: id }] });

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found' });
    }

    // Authorization
    const isOwner = (String(payment.userId) === String(req.user.id)) ||
                    (payment.garageId && String(payment.garageId) === String(req.user.id)) ||
                    (req.user.role === 'ADMIN');

    if (!isOwner) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    let service = null;
    if (payment.serviceId) {
      const sObjectId = toObjectId(payment.serviceId);
      service = sObjectId ? await services.findOne({ _id: sObjectId }) : null;
    }

    return res.status(200).json({
      success: true,
      payment: {
        id: String(payment._id),
        invoiceNumber: payment.invoiceNumber || service?.invoiceNumber || '—',
        orderId: payment.razorpayOrderId,
        paymentId: payment.razorpayPaymentId || '—',
        amount: payment.amount,
        currency: payment.currency || 'INR',
        status: payment.status,
        paymentMethod: payment.paymentMethod || 'Online',
        serviceType: payment.serviceType,
        garageName: payment.garageName,
        vehicleNumber: payment.vehicleNumber,
        serviceId: payment.serviceId,
        userId: payment.userId,
        garageId: payment.garageId,
        failureReason: payment.failureReason,
        receipt: payment.receipt,
        totalRefundedAmount: payment.totalRefundedAmount || 0,
        refunds: payment.refunds || [],
        paidAt: payment.paidAt,
        refundedAt: payment.refundedAt,
        createdAt: payment.createdAt
      }
    });
  } catch (err) {
    console.error('Error fetching payment details:', err);
    return res.status(500).json({ success: false, message: 'Error fetching payment details' });
  }
});

/**
 * POST /api/payments/webhook
 * Razorpay Webhook Handler with refund support, raw signature verification, and idempotency
 */
router.post('/webhook', async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  if (!signature) {
    return res.status(400).json({ error: 'Missing X-Razorpay-Signature header' });
  }

  // Raw body captured in server.js verify callback
  const rawBody = req.rawBody || JSON.stringify(req.body);
  const isValid = verifyWebhookSignature({ rawBody, signature });

  if (!isValid) {
    console.warn('⚠️ Webhook signature mismatch rejected.');
    return res.status(400).json({ error: 'Invalid webhook signature' });
  }

  const eventPayload = req.body || {};
  const eventName = eventPayload.event;
  const eventId = eventPayload.event_id || (eventPayload.payload?.payment?.entity?.id ? `${eventPayload.payload.payment.entity.id}_${eventName}` : null);

  const db = getDb();
  const webhookEvents = db.collection('webhookEvents');
  const payments = db.collection('payments');
  const services = db.collection('services');

  // Idempotency: skip already processed webhook events
  if (eventId) {
    const existing = await webhookEvents.findOne({ eventId });
    if (existing) {
      return res.status(200).json({ status: 'ok', message: 'Webhook already processed' });
    }
  }

  try {
    const paymentEntity = eventPayload.payload?.payment?.entity;
    const refundEntity = eventPayload.payload?.refund?.entity;
    const orderId = paymentEntity?.order_id || refundEntity?.order_id;
    const paymentId = paymentEntity?.id || refundEntity?.payment_id;

    if (eventName === 'payment.captured' || eventName === 'order.paid') {
      if (orderId) {
        const paidAt = new Date(paymentEntity.created_at ? paymentEntity.created_at * 1000 : Date.now());
        const method = paymentEntity.method ? String(paymentEntity.method).toUpperCase() : 'ONLINE';

        const payment = await payments.findOne({ razorpayOrderId: orderId });
        if (payment) {
          await payments.updateOne(
            { _id: payment._id },
            {
              $set: {
                status: PAYMENT_STATUS.CAPTURED,
                razorpayPaymentId: paymentId || payment.razorpayPaymentId,
                paymentMethod: method,
                paidAt,
                updatedAt: new Date()
              }
            }
          );

          if (payment.serviceId) {
            const sObjectId = toObjectId(payment.serviceId);
            const serviceQuery = sObjectId
              ? { $or: [{ _id: sObjectId }, { _id: String(payment.serviceId) }] }
              : { _id: String(payment.serviceId) };

            await services.updateOne(serviceQuery, {
              $set: {
                paymentStatus: 'PAID',
                paidAt,
                paymentId: paymentId || payment.razorpayPaymentId,
                paymentMethod: method,
                razorpayOrderId: orderId
              }
            });
          }

          // Record garage earnings ledger
          try {
            const updatedPaymentDoc = await payments.findOne({ razorpayOrderId: orderId });
            if (updatedPaymentDoc) {
              await recordPaymentEarnings({ payment: updatedPaymentDoc, dbInstance: db });
            }
          } catch (earnErr) {
            console.warn('Webhook earnings ledger error:', earnErr.message);
          }
        }
      }
    } else if (eventName === 'payment.failed') {
      if (orderId) {
        const errorDesc = paymentEntity.error_description || 'Payment failed';
        await payments.updateOne(
          { razorpayOrderId: orderId, status: { $ne: PAYMENT_STATUS.CAPTURED } },
          {
            $set: {
              status: PAYMENT_STATUS.FAILED,
              failureReason: errorDesc,
              updatedAt: new Date()
            }
          }
        );
      }
    } else if (eventName === 'refund.processed' || eventName === 'refund.created') {
      if (paymentId) {
        const refundAmount = refundEntity ? (refundEntity.amount / 100) : 0;
        const payment = await payments.findOne({ razorpayPaymentId: paymentId });

        if (payment) {
          const alreadyRefunded = parseFloat(payment.totalRefundedAmount) || 0;
          const newTotalRefunded = Math.max(alreadyRefunded, refundAmount);
          const isFullyRefunded = newTotalRefunded >= payment.amount;
          const newStatus = isFullyRefunded ? PAYMENT_STATUS.REFUNDED : PAYMENT_STATUS.PARTIALLY_REFUNDED;

          await payments.updateOne(
            { _id: payment._id },
            {
              $set: {
                status: newStatus,
                totalRefundedAmount: newTotalRefunded,
                refundedAt: new Date(),
                updatedAt: new Date()
              }
            }
          );

          if (payment.serviceId) {
            const sObjectId = toObjectId(payment.serviceId);
            const serviceQuery = sObjectId
              ? { $or: [{ _id: sObjectId }, { _id: String(payment.serviceId) }] }
              : { _id: String(payment.serviceId) };

            await services.updateOne(serviceQuery, {
              $set: {
                paymentStatus: newStatus,
                totalRefundedAmount: newTotalRefunded,
                refundedAt: new Date()
              }
            });
          }

          // Reconcile garage earnings ledger
          try {
            const updatedPaymentDoc = await payments.findOne({ _id: payment._id });
            if (updatedPaymentDoc) {
              await reconcileRefundEarnings({ payment: updatedPaymentDoc, refundAmount, dbInstance: db });
            }
          } catch (recErr) {
            console.warn('Webhook refund earnings reconciliation error:', recErr.message);
          }
        }
      }
    }

    // Record webhook event as processed
    if (eventId) {
      await webhookEvents.insertOne({
        eventId,
        event: eventName,
        orderId,
        paymentId,
        createdAt: new Date()
      });
    }

    return res.status(200).json({ status: 'ok' });
  } catch (err) {
    console.error('Error handling webhook event:', err);
    return res.status(500).json({ error: 'Internal server error processing webhook' });
  }
});

/**
 * GET /api/payments/status/:orderId
 * Synchronizes and checks payment status for a given order
 */
router.get('/status/:orderId', requireAuth, async (req, res) => {
  const { orderId } = req.params;
  const db = getDb();
  const payments = db.collection('payments');

  try {
    const payment = await payments.findOne({ razorpayOrderId: orderId });
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment order not found' });
    }

    if (String(payment.userId) !== String(req.user.id) && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    return res.status(200).json({
      success: true,
      payment: {
        id: String(payment._id),
        invoiceNumber: payment.invoiceNumber,
        orderId: payment.razorpayOrderId,
        paymentId: payment.razorpayPaymentId,
        amount: payment.amount,
        status: payment.status,
        serviceType: payment.serviceType,
        garageName: payment.garageName,
        vehicleNumber: payment.vehicleNumber,
        totalRefundedAmount: payment.totalRefundedAmount || 0,
        paidAt: payment.paidAt
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error checking payment status' });
  }
});

/**
 * GET /api/payments/history
 * Retrieves authenticated user's payment history with filtering and search
 */
router.get('/history', requireAuth, async (req, res) => {
  const { status, search } = req.query;
  const db = getDb();
  const payments = db.collection('payments');

  try {
    const query = { userId: String(req.user.id) };

    if (status && status !== 'ALL') {
      if (status === 'PAID') query.status = PAYMENT_STATUS.CAPTURED;
      else if (status === 'FAILED') query.status = PAYMENT_STATUS.FAILED;
      else if (status === 'REFUNDED') query.status = { $in: [PAYMENT_STATUS.REFUNDED, PAYMENT_STATUS.PARTIALLY_REFUNDED] };
      else if (status === 'PENDING') query.status = { $in: [PAYMENT_STATUS.CREATED, PAYMENT_STATUS.PENDING] };
      else query.status = status;
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { invoiceNumber: regex },
        { vehicleNumber: regex },
        { garageName: regex },
        { serviceType: regex },
        { razorpayPaymentId: regex }
      ];
    }

    const userPayments = await payments
      .find(query)
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();

    // Deduplicate by invoiceNumber / serviceId: if an invoice is CAPTURED, omit older pending duplicate attempts
    const capturedInvoiceKeys = new Set();
    userPayments.forEach(p => {
      if (p.status === PAYMENT_STATUS.CAPTURED || p.status === 'PAID') {
        if (p.invoiceNumber && p.invoiceNumber !== '—') capturedInvoiceKeys.add(p.invoiceNumber);
        if (p.serviceId) capturedInvoiceKeys.add(String(p.serviceId));
        if (p.invoiceId) capturedInvoiceKeys.add(String(p.invoiceId));
      }
    });

    const activeUserPayments = userPayments.filter(p => {
      if (p.status === PAYMENT_STATUS.CREATED || p.status === PAYMENT_STATUS.PENDING) {
        if (p.invoiceNumber && capturedInvoiceKeys.has(p.invoiceNumber)) return false;
        if (p.serviceId && capturedInvoiceKeys.has(String(p.serviceId))) return false;
        if (p.invoiceId && capturedInvoiceKeys.has(String(p.invoiceId))) return false;
      }
      return true;
    });

    const formatted = activeUserPayments.map(p => ({
      id: String(p._id),
      invoiceNumber: p.invoiceNumber || '—',
      orderId: p.razorpayOrderId,
      paymentId: p.razorpayPaymentId || '—',
      amount: p.amount,
      currency: p.currency || 'INR',
      serviceType: p.serviceType || 'Automotive Service',
      garageName: p.garageName || 'Authorized Service Center',
      vehicleNumber: p.vehicleNumber || 'N/A',
      vehicleId: p.vehicleId,
      serviceId: p.serviceId,
      status: p.status,
      paymentMethod: p.paymentMethod || 'Online',
      totalRefundedAmount: p.totalRefundedAmount || 0,
      refunds: p.refunds || [],
      date: p.paidAt || p.createdAt
    }));

    return res.status(200).json({ success: true, payments: formatted });
  } catch (err) {
    console.error('Error fetching payment history:', err);
    return res.status(500).json({ success: false, message: 'Error fetching payment history' });
  }
});

/**
 * GET /api/payments/customer/financial-summary
 * Computes authoritative customer-level financial metrics
 */
router.get('/customer/financial-summary', requireAuth, async (req, res) => {
  const db = getDb();
  const payments = db.collection('payments');
  const invoices = db.collection('invoices');
  const userId = String(req.user.id);

  try {
    const userPayments = await payments.find({ userId }).toArray();
    const userInvoices = await invoices.find({ customerId: userId }).toArray();

    // Deduplicate by invoiceNumber / serviceId: if an invoice is CAPTURED, omit older pending duplicate attempts
    const capturedInvoiceKeys = new Set();
    userPayments.forEach(p => {
      if (p.status === PAYMENT_STATUS.CAPTURED || p.status === 'PAID') {
        if (p.invoiceNumber && p.invoiceNumber !== '—') capturedInvoiceKeys.add(p.invoiceNumber);
        if (p.serviceId) capturedInvoiceKeys.add(String(p.serviceId));
        if (p.invoiceId) capturedInvoiceKeys.add(String(p.invoiceId));
      }
    });

    const activeUserPayments = userPayments.filter(p => {
      if (p.status === PAYMENT_STATUS.CREATED || p.status === PAYMENT_STATUS.PENDING) {
        if (p.invoiceNumber && capturedInvoiceKeys.has(p.invoiceNumber)) return false;
        if (p.serviceId && capturedInvoiceKeys.has(String(p.serviceId))) return false;
        if (p.invoiceId && capturedInvoiceKeys.has(String(p.invoiceId))) return false;
      }
      return true;
    });

    let totalPaidPaise = 0;
    let pendingPaise = 0;
    let refundPaise = 0;

    const statusDistribution = {
      PENDING: 0,
      AUTHORIZED: 0,
      CAPTURED: 0,
      FAILED: 0,
      PARTIALLY_REFUNDED: 0,
      REFUNDED: 0
    };

    const vehicleSet = new Set();

    activeUserPayments.forEach(p => {
      const amtPaise = Math.round(Number(p.amountPaise || (p.amount * 100)) || 0);
      const refPaise = Math.round(Number(p.refundedPaise || ((p.totalRefundedAmount || 0) * 100)) || 0);

      if (p.status === PAYMENT_STATUS.CAPTURED || p.status === 'PAID') {
        totalPaidPaise += (amtPaise - refPaise);
        statusDistribution.CAPTURED++;
      } else if (p.status === PAYMENT_STATUS.REFUNDED) {
        refundPaise += amtPaise;
        statusDistribution.REFUNDED++;
      } else if (p.status === PAYMENT_STATUS.PARTIALLY_REFUNDED) {
        totalPaidPaise += (amtPaise - refPaise);
        refundPaise += refPaise;
        statusDistribution.PARTIALLY_REFUNDED++;
      } else if (p.status === PAYMENT_STATUS.PENDING || p.status === PAYMENT_STATUS.CREATED) {
        pendingPaise += amtPaise;
        statusDistribution.PENDING++;
      } else if (p.status === PAYMENT_STATUS.AUTHORIZED) {
        pendingPaise += amtPaise;
        statusDistribution.AUTHORIZED++;
      } else if (p.status === PAYMENT_STATUS.FAILED) {
        statusDistribution.FAILED++;
      }

      if (p.vehicleNumber) vehicleSet.add(p.vehicleNumber);
    });

    const recentActivity = activeUserPayments
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 10)
      .map(p => ({
        id: String(p._id),
        invoiceNumber: p.invoiceNumber || '—',
        orderId: p.razorpayOrderId,
        paymentId: p.razorpayPaymentId || '—',
        amount: p.amount,
        status: p.status,
        serviceType: p.serviceType || 'Automotive Service',
        garageName: p.garageName || 'Authorized Service Center',
        vehicleNumber: p.vehicleNumber || 'N/A',
        totalRefundedAmount: p.totalRefundedAmount || 0,
        refunds: p.refunds || [],
        date: p.paidAt || p.createdAt
      }));

    return res.status(200).json({
      success: true,
      summary: {
        totalPaidAmount: totalPaidPaise / 100,
        totalPaidPaise,
        pendingAmount: pendingPaise / 100,
        pendingPaise,
        refundAmount: refundPaise / 100,
        refundPaise,
        transactionsCount: userPayments.length,
        invoicesCount: userInvoices.length || userPayments.length,
        statusDistribution,
        vehicles: Array.from(vehicleSet),
        recentActivity
      }
    });
  } catch (err) {
    console.error('Error computing customer financial summary:', err);
    return res.status(500).json({ success: false, message: 'Error computing financial summary' });
  }
});

module.exports = router;
