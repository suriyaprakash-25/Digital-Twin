const express = require('express');
const { ObjectId } = require('mongodb');
const { getDb } = require('../db');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { loadConfig } = require('../config');
const {
  createCashfreeOrder,
  verifyCashfreePayment,
  verifyCashfreeWebhook,
  fetchCashfreeOrder,
  createCashfreeRefund
} = require('../services/cashfreeService');
const { PAYMENT_STATUS } = require('../models/Payment');
const { notifyUser } = require('../services/notifications');
const { recordPaymentEarnings, reconcileRefundEarnings } = require('../services/earningsService');
const { idempotencyMiddleware } = require('../middleware/idempotency');
const { paymentCreationLimiter, refundLimiter } = require('../middleware/financialRateLimit');
const { evaluateTransactionRisk } = require('../services/paymentRiskService');
const { logFinancialAudit } = require('../services/auditService');
const { beginWebhookEvent, markWebhookEventProcessed } = require('../models/PaymentWebhookEvent');
const { isPaymentOrderAuthorized, isGarageUserAuthorizedForPayment } = require('../security/paymentAuthorization');

const router = express.Router();

function toObjectId(id) {
  try {
    return new ObjectId(String(id));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// POST /api/payments/create-order
// Creates a Cashfree Order for an unpaid service invoice
// ---------------------------------------------------------------------------
router.post('/create-order', requireAuth, paymentCreationLimiter, idempotencyMiddleware, async (req, res) => {
  const { invoiceId, serviceId } = req.body || {};
  const targetId = serviceId || invoiceId;

  if (!targetId) {
    return res.status(400).json({ success: false, message: 'Service or Invoice ID is required' });
  }

  const db = getDb();
  const services  = db.collection('services');
  const invoices  = db.collection('invoices');
  const vehicles  = db.collection('vehicles');
  const payments  = db.collection('payments');

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
        if (targetDoc.serviceId) {
          const psId = toObjectId(targetDoc.serviceId);
          const sDoc = await services.findOne(
            psId
              ? { $or: [{ _id: psId }, { _id: String(targetDoc.serviceId) }] }
              : { _id: String(targetDoc.serviceId) }
          );
          if (sDoc) targetDoc = { ...sDoc, ...targetDoc };
        }
      }
    }

    if (!targetDoc) {
      return res.status(404).json({ success: false, message: 'Service record or invoice not found' });
    }

    // Ownership check
    let vehicle = null;
    if (targetDoc.vehicleId) {
      const vObjectId = toObjectId(targetDoc.vehicleId);
      vehicle = vObjectId
        ? await vehicles.findOne({ _id: vObjectId, isArchived: { $ne: true } })
        : await vehicles.findOne({ $or: [{ _id: String(targetDoc.vehicleId) }, { id: String(targetDoc.vehicleId) }], isArchived: { $ne: true } });
    } else if (targetDoc.vehicleNumber) {
      vehicle = await vehicles.findOne({ vehicleNumber: targetDoc.vehicleNumber, isArchived: { $ne: true } });
    }

    const isOwner = isPaymentOrderAuthorized({ user: req.user, vehicle, targetDoc });
    if (!isOwner) {
      return res.status(403).json({ success: false, message: 'Forbidden: You are not authorized to pay for this invoice' });
    }

    if (targetDoc.invoiceStatus === 'CANCELLED' || targetDoc.status === 'CANCELLED') {
      return res.status(400).json({ success: false, message: 'Cannot pay for a cancelled invoice' });
    }

    if (targetDoc.paymentStatus === 'PAID' || targetDoc.status === PAYMENT_STATUS.CAPTURED || targetDoc.status === 'PAID') {
      return res.status(400).json({ success: false, message: 'This service invoice is already paid' });
    }

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

    // Authoritative amount from database
    const totalCost = Number(
      targetDoc.totalAmount  !== undefined ? targetDoc.totalAmount  :
      targetDoc.totalCost    !== undefined ? targetDoc.totalCost    :
      targetDoc.amount       !== undefined ? targetDoc.amount       :
      targetDoc.price        !== undefined ? targetDoc.price        :
      targetDoc.cost         || 0
    );

    if (Number.isNaN(totalCost) || totalCost <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid service amount. Invoice total must be greater than zero.' });
    }

    const invoiceNumber = targetDoc.invoiceNumber || `DP-INV-2026-${String(targetDoc._id).slice(-6).toUpperCase()}`;

    // Risk Assessment (non-blocking)
    try {
      await evaluateTransactionRisk({
        userId:    req.user.id,
        garageId:  targetDoc.garageId || targetDoc.createdBy,
        invoiceId: targetDoc._id,
        amount:    totalCost,
        operation: 'PAYMENT',
        dbInstance: db
      });
    } catch (riskErr) {
      console.warn('Risk evaluation warning:', riskErr.message);
    }

    // Build unique Cashfree order ID (max 50 chars, alphanumeric + _ -)
    const cfOrderId = `DP_${String(targetDoc._id || targetId).slice(-10)}_${Date.now().toString().slice(-7)}`;

    // User info for prefill
    const user = req.user || {};

    // Create Cashfree order
    let cfOrder;
    try {
      cfOrder = await createCashfreeOrder({
        amountInRupees: totalCost,
        orderId: cfOrderId,
        customer: {
          id:    String(user.id || user._id || `cust_${Date.now()}`),
          name:  user.name  || user.displayName || 'Customer',
          email: user.email || '',
          phone: user.phone || '9999999999'
        },
        meta: {
          serviceId:     String(targetDoc.serviceId || targetDoc._id || targetId),
          invoiceNumber,
          vehicleId:     String(targetDoc.vehicleId || (vehicle ? vehicle._id : '')),
          userId:        String(user.id || ''),
          vehicleNumber: vehicle?.vehicleNumber || targetDoc.vehicleNumber || 'Vehicle',
          note:          `Invoice ${invoiceNumber} - ${targetDoc.serviceType || 'Automotive Service'}`
        }
      });
    } catch (cfErr) {
      console.error('Cashfree order creation error:', cfErr?.response?.data || cfErr.message);
      return res.status(500).json({
        success: false,
        message: 'Failed to create payment order with Cashfree. ' + (cfErr?.response?.data?.message || cfErr.message || ''),
        error:   cfErr?.response?.data || cfErr.message
      });
    }

    // Persist payment attempt
    const paymentDoc = {
      invoiceId:         String(targetDoc._id || targetId),
      invoiceNumber,
      serviceId:         String(targetDoc.serviceId || targetDoc._id || targetId),
      vehicleId:         String(targetDoc.vehicleId || (vehicle ? vehicle._id : '')),
      vehicleNumber:     vehicle?.vehicleNumber || targetDoc.vehicleNumber || 'N/A',
      userId:            String(user.id),
      garageId:          targetDoc.garageId ? String(targetDoc.garageId) : (targetDoc.createdBy ? String(targetDoc.createdBy) : null),
      garageName:        targetDoc.garageName || 'Authorized Service Center',
      serviceType:       targetDoc.serviceType || targetDoc.title || 'Automotive Service',
      amount:            totalCost,
      amountPaise:       Math.round(totalCost * 100),
      currency:          'INR',
      cfOrderId,
      cashfreeOrderId:   cfOrder.cf_order_id || cfOrderId,
      paymentSessionId:  cfOrder.payment_session_id || null,
      status:            PAYMENT_STATUS.CREATED,
      paymentMethod:     null,
      failureReason:     null,
      paidAt:            null,
      createdAt:         new Date(),
      updatedAt:         new Date()
    };

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
            cfOrderId,
            cashfreeOrderId:  cfOrder.cf_order_id || cfOrderId,
            paymentSessionId: cfOrder.payment_session_id || null,
            amountPaise:      Math.round(totalCost * 100),
            amount:           totalCost,
            invoiceNumber,
            vehicleNumber:    vehicle?.vehicleNumber || targetDoc.vehicleNumber || 'N/A',
            garageName:       targetDoc.garageName || 'Authorized Service Center',
            serviceType:      targetDoc.serviceType || targetDoc.title || 'Automotive Service',
            status:           PAYMENT_STATUS.CREATED,
            updatedAt:        new Date()
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
        actorId:      req.user.id,
        actorRole:    'USER',
        action:       'PAYMENT_ORDER_CREATED',
        resourceType: 'PAYMENT',
        resourceId:   paymentRecordId,
        afterState:   { cfOrderId, amount: totalCost },
        req,
        dbInstance:   db
      });
    } catch (auditErr) {
      console.warn('Audit logging warning:', auditErr.message);
    }

    return res.status(200).json({
      success:          true,
      message:          'Cashfree order created successfully',
      cfOrderId,
      orderId:          cfOrderId,
      paymentSessionId: cfOrder.payment_session_id,
      amount:           totalCost,
      currency:         'INR',
      invoiceNumber,
      keyId:            cfOrder.payment_session_id,
      order: {
        id:               cfOrderId,
        keyId:            cfOrder.payment_session_id,
        cfOrderId,
        orderId:          cfOrderId,
        paymentSessionId: cfOrder.payment_session_id,
        amount:           totalCost,
        amountPaise:      Math.round(totalCost * 100),
        currency:         'INR',
        invoiceNumber,
        garageName:       targetDoc.garageName || 'Authorized Service Center',
        serviceType:      targetDoc.serviceType || targetDoc.title || 'Automotive Service',
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

// ---------------------------------------------------------------------------
// POST /api/payments/verify
// Called by frontend after Cashfree checkout redirect / JS callback.
// We re-verify order status directly with Cashfree API (server-side).
// ---------------------------------------------------------------------------
router.post('/verify', optionalAuth, async (req, res) => {
  const { cfOrderId, orderId, serviceId } = req.body || {};
  const resolvedOrderId = cfOrderId || orderId;

  if (!resolvedOrderId) {
    return res.status(400).json({
      success: false,
      message: 'Payment verification failed: cfOrderId is required'
    });
  }

  const db = getDb();
  const payments = db.collection('payments');
  const services  = db.collection('services');

  try {
    // 1. Locate stored payment record
    const payment = await payments.findOne({
      $or: [{ cfOrderId: resolvedOrderId }, { cashfreeOrderId: resolvedOrderId }]
    });
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found for this order ID' });
    }

    // 2. Authorize user ownership if authenticated
    if (req.user && String(payment.userId) !== String(req.user.id) && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Forbidden: Unauthorized payment verification attempt' });
    }

    // 3. Idempotency – already captured
    if (payment.status === PAYMENT_STATUS.CAPTURED) {
      return res.status(200).json({
        success: true,
        message: 'Payment is already verified and confirmed',
        payment: {
          id:         String(payment._id),
          cfOrderId:  payment.cfOrderId,
          paymentId:  payment.cashfreePaymentId || null,
          amount:     payment.amount,
          status:     payment.status,
          paidAt:     payment.paidAt
        }
      });
    }

    // 4. Server-side verification via Cashfree API
    const { verified, paymentId, method, status: cfStatus } = await verifyCashfreePayment(resolvedOrderId);

    if (!verified) {
      if (cfStatus !== 'ACTIVE' && cfStatus !== 'PENDING') {
        await payments.updateOne(
          { _id: payment._id },
          { $set: { status: PAYMENT_STATUS.FAILED, failureReason: `Cashfree order status: ${cfStatus}`, updatedAt: new Date() } }
        );
      }
      return res.status(400).json({
        success: false,
        status: cfStatus,
        message: `Payment not confirmed by Cashfree. Status: ${cfStatus}`
      });
    }

    const paidAt = new Date();

    // 5. Mark payment record as CAPTURED
    await payments.updateOne(
      { _id: payment._id },
      {
        $set: {
          status:              PAYMENT_STATUS.CAPTURED,
          cashfreePaymentId:   paymentId,
          paymentMethod:       method,
          paidAt,
          updatedAt:           paidAt
        }
      }
    );

    // 6. Mark corresponding service/invoice as PAID
    const targetServiceId = payment.serviceId || serviceId || payment.invoiceId;
    if (targetServiceId || payment.invoiceNumber) {
      const sObjectId = toObjectId(targetServiceId);
      const queryList = [];
      if (targetServiceId) {
        queryList.push({ _id: String(targetServiceId) }, { id: String(targetServiceId) });
        if (sObjectId) queryList.push({ _id: sObjectId });
      }
      if (payment.invoiceNumber) queryList.push({ invoiceNumber: payment.invoiceNumber });

      await services.updateOne(
        { $or: queryList },
        {
          $set: {
            paymentStatus: 'PAID',
            paidAt,
            paymentId:     paymentId,
            paymentMethod: method,
            cfOrderId:     resolvedOrderId,
            updatedAt:     paidAt
          }
        }
      ).catch(() => {});

      const invoices = db.collection('invoices');
      await invoices.updateOne(
        { $or: queryList },
        { $set: { status: 'PAID', paidAt, paymentId, paymentMethod: method, updatedAt: paidAt } }
      ).catch(() => {});
    }

    // 7. Cleanup stale pending attempts
    const cleanupFilters = [];
    if (payment.invoiceNumber && payment.invoiceNumber !== '—') cleanupFilters.push({ invoiceNumber: payment.invoiceNumber });
    if (payment.invoiceId) {
      cleanupFilters.push({ invoiceId: String(payment.invoiceId) });
      const invObj = toObjectId(payment.invoiceId);
      if (invObj) cleanupFilters.push({ _id: invObj });
    }
    if (payment.serviceId) {
      cleanupFilters.push({ serviceId: String(payment.serviceId) });
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

    // 8. Garage earnings ledger
    try {
      const updatedPaymentDoc = await payments.findOne({ _id: payment._id });
      if (updatedPaymentDoc) await recordPaymentEarnings({ payment: updatedPaymentDoc, dbInstance: db });
    } catch (earnErr) {
      console.warn('Error recording garage earnings ledger:', earnErr.message);
    }

    // 9. Notifications
    try {
      if (payment.userId) {
        await notifyUser(payment.userId, {
          title: 'Payment Successful',
          body:  `Your payment of ₹${payment.amount} for ${payment.serviceType || 'Service'} has been confirmed. (Invoice: ${payment.invoiceNumber || 'N/A'})`,
          data:  { type: 'PAYMENT_SUCCESS', paymentId, serviceId: String(payment.serviceId || ''), invoiceNumber: payment.invoiceNumber || '' }
        });
      }
      if (payment.garageId) {
        await notifyUser(payment.garageId, {
          title: 'Payment Received',
          body:  `Payment of ₹${payment.amount} received from customer for ${payment.vehicleNumber || 'Vehicle'}.`,
          data:  { type: 'PAYMENT_SUCCESS', paymentId, serviceId: String(payment.serviceId || ''), invoiceNumber: payment.invoiceNumber || '' }
        });
      }
    } catch (notifErr) {
      console.warn('Error sending payment notification:', notifErr.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Payment verified and captured successfully!',
      payment: {
        id:            String(payment._id),
        invoiceNumber: payment.invoiceNumber,
        cfOrderId:     resolvedOrderId,
        paymentId,
        amount:        payment.amount,
        currency:      'INR',
        serviceType:   payment.serviceType,
        garageName:    payment.garageName,
        vehicleNumber: payment.vehicleNumber,
        status:        PAYMENT_STATUS.CAPTURED,
        paidAt
      }
    });
  } catch (err) {
    console.error('Error in /verify:', err);
    return res.status(500).json({ success: false, message: 'Internal server error verifying payment' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/payments/:paymentId/refund
// Initiates a Cashfree refund for a captured payment
// ---------------------------------------------------------------------------
router.post('/:paymentId/refund', requireAuth, refundLimiter, idempotencyMiddleware, async (req, res) => {
  const { paymentId } = req.params;
  const { amount, reason = 'Customer requested refund' } = req.body || {};

  const db = getDb();
  const payments = db.collection('payments');
  const services  = db.collection('services');

  try {
    const pObjectId = toObjectId(paymentId);
    const payment = pObjectId
      ? await payments.findOne({ $or: [{ _id: pObjectId }, { cashfreePaymentId: paymentId }] })
      : await payments.findOne({ cashfreePaymentId: paymentId });

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found' });
    }

    const isAuthorized = await isGarageUserAuthorizedForPayment({ user: req.user, payment, db });
    if (!isAuthorized) {
      return res.status(403).json({ success: false, message: 'Forbidden: You are not authorized to refund this payment' });
    }

    if (payment.status !== PAYMENT_STATUS.CAPTURED && payment.status !== PAYMENT_STATUS.PARTIALLY_REFUNDED) {
      return res.status(400).json({
        success: false,
        message: `Only captured payments can be refunded. Current status is ${payment.status}`
      });
    }

    if (!payment.cfOrderId) {
      return res.status(400).json({ success: false, message: 'No Cashfree order ID associated with this payment record' });
    }

    const originalAmount    = parseFloat(payment.amount) || 0;
    const alreadyRefunded   = parseFloat(payment.totalRefundedAmount) || 0;
    const maxRefundable     = Math.max(0, originalAmount - alreadyRefunded);

    if (maxRefundable <= 0) {
      return res.status(400).json({ success: false, message: 'This payment has already been fully refunded' });
    }

    const requestedAmount = amount !== undefined ? parseFloat(amount) : maxRefundable;
    if (isNaN(requestedAmount) || requestedAmount <= 0 || requestedAmount > maxRefundable) {
      return res.status(400).json({ success: false, message: `Invalid refund amount. Must be between ₹1 and ₹${maxRefundable}` });
    }

    const refundReceipt = `ref_${String(payment._id).slice(-6)}_${Date.now().toString().slice(-6)}`;

    let cfRefund;
    try {
      cfRefund = await createCashfreeRefund({
        cfOrderId:      payment.cfOrderId,
        refundId:       refundReceipt,
        amountInRupees: requestedAmount,
        reason:         String(reason).slice(0, 100)
      });
    } catch (cfErr) {
      console.error('Cashfree refund API error:', cfErr?.response?.data || cfErr.message);
      return res.status(500).json({
        success: false,
        message: 'Failed to process refund with Cashfree',
        error:   cfErr?.response?.data || cfErr.message
      });
    }

    const newTotalRefunded = alreadyRefunded + requestedAmount;
    const isFullyRefunded  = newTotalRefunded >= originalAmount;
    const newStatus        = isFullyRefunded ? PAYMENT_STATUS.REFUNDED : PAYMENT_STATUS.PARTIALLY_REFUNDED;
    const refundedAt       = new Date();

    const refundEntry = {
      refundId:     cfRefund.refund_id || refundReceipt,
      cfRefundId:   cfRefund.cf_refund_id || null,
      amount:       requestedAmount,
      currency:     'INR',
      reason,
      status:       cfRefund.refund_status || 'PENDING',
      receipt:      refundReceipt,
      createdAt:    refundedAt
    };

    await payments.updateOne(
      { _id: payment._id },
      {
        $set:  { status: newStatus, totalRefundedAmount: newTotalRefunded, refundedAt, updatedAt: refundedAt },
        $push: { refunds: refundEntry }
      }
    );

    if (payment.serviceId) {
      const sObjectId   = toObjectId(payment.serviceId);
      const serviceQuery = sObjectId
        ? { $or: [{ _id: sObjectId }, { _id: String(payment.serviceId) }] }
        : { _id: String(payment.serviceId) };
      await services.updateOne(serviceQuery, {
        $set: { paymentStatus: newStatus, totalRefundedAmount: newTotalRefunded, refundedAt, updatedAt: refundedAt }
      });
    }

    try {
      const updatedPaymentDoc = await payments.findOne({ _id: payment._id });
      if (updatedPaymentDoc) {
        await reconcileRefundEarnings({ payment: updatedPaymentDoc, refundAmount: requestedAmount, dbInstance: db });
      }
    } catch (recErr) {
      console.warn('Error reconciling refund earnings:', recErr.message);
    }

    try {
      if (payment.userId) {
        await notifyUser(payment.userId, {
          title: isFullyRefunded ? 'Payment Refunded' : 'Partial Refund Processed',
          body:  `A refund of ₹${requestedAmount} has been processed for your invoice ${payment.invoiceNumber || ''}.`,
          data:  { type: 'REFUND_COMPLETED', cfOrderId: payment.cfOrderId, refundId: cfRefund.refund_id || refundReceipt, amount: String(requestedAmount) }
        });
      }
    } catch (notifErr) {
      console.warn('Error sending refund notification:', notifErr.message);
    }

    await logFinancialAudit({
      actorId:      req.user.id,
      actorRole:    req.user.role || 'ADMIN',
      action:       'REFUND_COMPLETED',
      resourceType: 'PAYMENT',
      resourceId:   String(payment._id),
      beforeState:  { status: payment.status, totalRefundedAmount: alreadyRefunded },
      afterState:   { status: newStatus, totalRefundedAmount: newTotalRefunded, refundAmount: requestedAmount },
      req,
      dbInstance:   db
    });

    return res.status(200).json({
      success: true,
      message: `Refund of ₹${requestedAmount} initiated successfully`,
      refund:  refundEntry,
      payment: {
        id:                  String(payment._id),
        status:              newStatus,
        totalRefundedAmount: newTotalRefunded,
        remainingAmount:     Math.max(0, originalAmount - newTotalRefunded)
      }
    });
  } catch (err) {
    console.error('Error initiating refund:', err);
    return res.status(500).json({ success: false, message: 'Internal server error processing refund' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/payments/:paymentId/refund-status
// ---------------------------------------------------------------------------
router.get('/:paymentId/refund-status', requireAuth, async (req, res) => {
  const { paymentId } = req.params;
  const db = getDb();
  const payments = db.collection('payments');

  try {
    const pObjectId = toObjectId(paymentId);
    const payment = pObjectId
      ? await payments.findOne({ $or: [{ _id: pObjectId }, { cashfreePaymentId: paymentId }] })
      : await payments.findOne({ cashfreePaymentId: paymentId });

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found' });
    }

    const isOwner =
      (String(payment.userId) === String(req.user.id)) ||
      (payment.garageId && String(payment.garageId) === String(req.user.id)) ||
      (req.user.role === 'ADMIN');

    if (!isOwner) return res.status(403).json({ success: false, message: 'Forbidden' });

    return res.status(200).json({
      success:             true,
      cfOrderId:           payment.cfOrderId,
      cashfreePaymentId:   payment.cashfreePaymentId,
      status:              payment.status,
      originalAmount:      payment.amount,
      totalRefundedAmount: payment.totalRefundedAmount || 0,
      refunds:             payment.refunds || []
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error loading refund status' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/payments/details/:id
// ---------------------------------------------------------------------------
router.get('/details/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const payments = db.collection('payments');
  const services  = db.collection('services');

  try {
    const pObjectId = toObjectId(id);
    const payment = pObjectId
      ? await payments.findOne({ $or: [{ _id: pObjectId }, { cfOrderId: id }, { cashfreePaymentId: id }] })
      : await payments.findOne({ $or: [{ cfOrderId: id }, { cashfreePaymentId: id }] });

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found' });
    }

    const isOwner =
      (String(payment.userId) === String(req.user.id)) ||
      (payment.garageId && String(payment.garageId) === String(req.user.id)) ||
      (req.user.role === 'ADMIN');

    if (!isOwner) return res.status(403).json({ success: false, message: 'Forbidden' });

    let service = null;
    if (payment.serviceId) {
      const sObjectId = toObjectId(payment.serviceId);
      service = sObjectId ? await services.findOne({ _id: sObjectId }) : null;
    }

    return res.status(200).json({
      success: true,
      payment: {
        id:                  String(payment._id),
        invoiceNumber:       payment.invoiceNumber || service?.invoiceNumber || '—',
        cfOrderId:           payment.cfOrderId,
        cashfreePaymentId:   payment.cashfreePaymentId || '—',
        // Alias fields for compatibility with existing UI components
        orderId:             payment.cfOrderId,
        paymentId:           payment.cashfreePaymentId || '—',
        amount:              payment.amount,
        currency:            payment.currency || 'INR',
        status:              payment.status,
        paymentMethod:       payment.paymentMethod || 'Online / Cashfree',
        serviceType:         payment.serviceType,
        garageName:          payment.garageName,
        vehicleNumber:       payment.vehicleNumber,
        serviceId:           payment.serviceId,
        userId:              payment.userId,
        garageId:            payment.garageId,
        failureReason:       payment.failureReason,
        totalRefundedAmount: payment.totalRefundedAmount || 0,
        refunds:             payment.refunds || [],
        paidAt:              payment.paidAt,
        refundedAt:          payment.refundedAt,
        createdAt:           payment.createdAt
      }
    });
  } catch (err) {
    console.error('Error fetching payment details:', err);
    return res.status(500).json({ success: false, message: 'Error fetching payment details' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/payments/cashfree-webhook
// Cashfree Webhook Handler – signed with HMAC-SHA256
// Header: x-webhook-signature, x-webhook-timestamp
// ---------------------------------------------------------------------------
router.post('/cashfree-webhook', async (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const timestamp = req.headers['x-webhook-timestamp'];

  if (!signature || !timestamp) {
    return res.status(400).json({ error: 'Missing Cashfree webhook headers' });
  }

  const rawBody = req.rawBody || JSON.stringify(req.body);
  const isValid = verifyCashfreeWebhook({ rawBody, timestamp, signature });

  if (!isValid) {
    console.warn('⚠️ Cashfree webhook signature mismatch rejected.');
    return res.status(400).json({ error: 'Invalid webhook signature' });
  }

  const eventPayload = req.body || {};
  const eventType    = eventPayload.type;         // e.g. "PAYMENT_SUCCESS_WEBHOOK"
  const data         = eventPayload.data || {};
  const cfOrderId    = data.order?.order_id;
  const cfPaymentId  = data.payment?.cf_payment_id ? String(data.payment.cf_payment_id) : null;
  const eventId      = eventPayload.event_time
    ? `${cfOrderId}_${eventType}_${eventPayload.event_time}`
    : `${cfOrderId}_${eventType}_${Date.now()}`;

  const db       = getDb();
  const payments = db.collection('payments');
  const services  = db.collection('services');

  try {
    const claim = await beginWebhookEvent({
      eventId,
      eventType:        eventType || 'unknown',
      cashfreePaymentId: cfPaymentId,
      cfOrderId,
      dbInstance: db
    });

    if (!claim.shouldProcess) {
      return res.status(200).json({ status: 'ok', message: 'Webhook already processed or currently processing' });
    }
  } catch (claimErr) {
    console.error('Webhook idempotency claim failed:', claimErr);
    return res.status(500).json({ error: 'Unable to establish webhook idempotency' });
  }

  try {
    if (eventType === 'PAYMENT_SUCCESS_WEBHOOK') {
      if (cfOrderId) {
        const paidAt  = new Date();
        const method  = data.payment?.payment_method?.type ? String(data.payment.payment_method.type).toUpperCase() : 'ONLINE';
        const payment = await payments.findOne({ $or: [{ cfOrderId }, { cashfreeOrderId: cfOrderId }] });

        if (payment && payment.status !== PAYMENT_STATUS.CAPTURED) {
          await payments.updateOne(
            { _id: payment._id },
            {
              $set: {
                status:            PAYMENT_STATUS.CAPTURED,
                cashfreePaymentId: cfPaymentId || payment.cashfreePaymentId,
                paymentMethod:     method,
                paidAt,
                updatedAt:         new Date()
              }
            }
          );

          if (payment.serviceId) {
            const sObjectId    = toObjectId(payment.serviceId);
            const serviceQuery = sObjectId
              ? { $or: [{ _id: sObjectId }, { _id: String(payment.serviceId) }] }
              : { _id: String(payment.serviceId) };

            await services.updateOne(serviceQuery, {
              $set: { paymentStatus: 'PAID', paidAt, paymentId: cfPaymentId, paymentMethod: method, cfOrderId }
            });
          }

          try {
            const updatedDoc = await payments.findOne({ _id: payment._id });
            if (updatedDoc) await recordPaymentEarnings({ payment: updatedDoc, dbInstance: db });
          } catch (earnErr) {
            console.warn('Webhook earnings ledger error:', earnErr.message);
          }
        }
      }
    } else if (eventType === 'PAYMENT_FAILED_WEBHOOK') {
      if (cfOrderId) {
        const errorMsg = data.payment?.error_details?.error_description || 'Payment failed via webhook';
        await payments.updateOne(
          { $or: [{ cfOrderId }, { cashfreeOrderId: cfOrderId }], status: { $ne: PAYMENT_STATUS.CAPTURED } },
          { $set: { status: PAYMENT_STATUS.FAILED, failureReason: errorMsg, updatedAt: new Date() } }
        );
      }
    } else if (eventType === 'REFUND_STATUS_WEBHOOK') {
      const refundStatus = data.refund?.refund_status;
      const refundAmount = data.refund ? (parseFloat(data.refund.refund_amount) || 0) : 0;

      if (cfOrderId && refundStatus === 'SUCCESS' && refundAmount > 0) {
        const payment = await payments.findOne({ $or: [{ cfOrderId }, { cashfreeOrderId: cfOrderId }] });
        if (payment) {
          const alreadyRefunded  = parseFloat(payment.totalRefundedAmount) || 0;
          const newTotalRefunded = Math.max(alreadyRefunded, refundAmount);
          const isFullyRefunded  = newTotalRefunded >= payment.amount;
          const newStatus        = isFullyRefunded ? PAYMENT_STATUS.REFUNDED : PAYMENT_STATUS.PARTIALLY_REFUNDED;

          await payments.updateOne(
            { _id: payment._id },
            { $set: { status: newStatus, totalRefundedAmount: newTotalRefunded, refundedAt: new Date(), updatedAt: new Date() } }
          );

          if (payment.serviceId) {
            const sObjectId    = toObjectId(payment.serviceId);
            const serviceQuery = sObjectId
              ? { $or: [{ _id: sObjectId }, { _id: String(payment.serviceId) }] }
              : { _id: String(payment.serviceId) };
            await services.updateOne(serviceQuery, {
              $set: { paymentStatus: newStatus, totalRefundedAmount: newTotalRefunded, refundedAt: new Date() }
            });
          }

          try {
            const updatedDoc = await payments.findOne({ _id: payment._id });
            if (updatedDoc) await reconcileRefundEarnings({ payment: updatedDoc, refundAmount, dbInstance: db });
          } catch (recErr) {
            console.warn('Webhook refund earnings reconciliation error:', recErr.message);
          }
        }
      }
    }

    await markWebhookEventProcessed(eventId, { status: 'PROCESSED', dbInstance: db });
    return res.status(200).json({ status: 'ok' });
  } catch (err) {
    if (eventId) {
      try {
        await markWebhookEventProcessed(eventId, {
          status:        'FAILED',
          failureReason: String(err?.message || err).slice(0, 500),
          dbInstance:    db
        });
      } catch (markErr) {
        console.error('Failed to mark webhook event as failed:', markErr.message);
      }
    }
    console.error('Error handling Cashfree webhook event:', err);
    return res.status(500).json({ error: 'Internal server error processing webhook' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/payments/status/:orderId
// ---------------------------------------------------------------------------
router.get('/status/:orderId', requireAuth, async (req, res) => {
  const { orderId } = req.params;
  const db = getDb();
  const payments = db.collection('payments');

  try {
    const payment = await payments.findOne({
      $or: [{ cfOrderId: orderId }, { cashfreeOrderId: orderId }]
    });
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment order not found' });
    }

    if (String(payment.userId) !== String(req.user.id) && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    return res.status(200).json({
      success: true,
      payment: {
        id:                  String(payment._id),
        invoiceNumber:       payment.invoiceNumber,
        cfOrderId:           payment.cfOrderId,
        cashfreePaymentId:   payment.cashfreePaymentId,
        // Alias for UI compatibility
        orderId:             payment.cfOrderId,
        paymentId:           payment.cashfreePaymentId,
        amount:              payment.amount,
        status:              payment.status,
        serviceType:         payment.serviceType,
        garageName:          payment.garageName,
        vehicleNumber:       payment.vehicleNumber,
        totalRefundedAmount: payment.totalRefundedAmount || 0,
        paidAt:              payment.paidAt
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error checking payment status' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/payments/history
// ---------------------------------------------------------------------------
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
        { cashfreePaymentId: regex },
        { cfOrderId: regex }
      ];
    }

    const userPayments = await payments.find(query).sort({ createdAt: -1 }).limit(100).toArray();

    // Deduplicate: if invoice is CAPTURED omit older pending attempts
    const capturedInvoiceKeys = new Set();
    userPayments.forEach(p => {
      if (p.status === PAYMENT_STATUS.CAPTURED || p.status === 'PAID') {
        if (p.invoiceNumber && p.invoiceNumber !== '—') capturedInvoiceKeys.add(p.invoiceNumber);
        if (p.serviceId) capturedInvoiceKeys.add(String(p.serviceId));
        if (p.invoiceId) capturedInvoiceKeys.add(String(p.invoiceId));
      }
    });

    const active = userPayments.filter(p => {
      if (p.status === PAYMENT_STATUS.CREATED || p.status === PAYMENT_STATUS.PENDING) {
        if (p.invoiceNumber && capturedInvoiceKeys.has(p.invoiceNumber)) return false;
        if (p.serviceId   && capturedInvoiceKeys.has(String(p.serviceId)))   return false;
        if (p.invoiceId   && capturedInvoiceKeys.has(String(p.invoiceId)))   return false;
      }
      return true;
    });

    const formatted = active.map(p => ({
      id:                  String(p._id),
      invoiceNumber:       p.invoiceNumber || '—',
      cfOrderId:           p.cfOrderId,
      cashfreePaymentId:   p.cashfreePaymentId || '—',
      // Aliases for UI compatibility
      orderId:             p.cfOrderId,
      paymentId:           p.cashfreePaymentId || '—',
      amount:              p.amount,
      currency:            p.currency || 'INR',
      serviceType:         p.serviceType || 'Automotive Service',
      garageName:          p.garageName || 'Authorized Service Center',
      vehicleNumber:       p.vehicleNumber || 'N/A',
      vehicleId:           p.vehicleId,
      serviceId:           p.serviceId,
      status:              p.status,
      paymentMethod:       p.paymentMethod || 'Online / Cashfree',
      totalRefundedAmount: p.totalRefundedAmount || 0,
      refunds:             p.refunds || [],
      date:                p.paidAt || p.createdAt
    }));

    return res.status(200).json({ success: true, payments: formatted });
  } catch (err) {
    console.error('Error fetching payment history:', err);
    return res.status(500).json({ success: false, message: 'Error fetching payment history' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/payments/customer/financial-summary
// ---------------------------------------------------------------------------
router.get('/customer/financial-summary', requireAuth, async (req, res) => {
  const db = getDb();
  const payments = db.collection('payments');
  const invoices  = db.collection('invoices');
  const userId    = String(req.user.id);

  try {
    const userPayments = await payments.find({ userId }).toArray();
    const userInvoices = await invoices.find({ customerId: userId }).toArray();

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
        if (p.serviceId   && capturedInvoiceKeys.has(String(p.serviceId)))   return false;
        if (p.invoiceId   && capturedInvoiceKeys.has(String(p.invoiceId)))   return false;
      }
      return true;
    });

    let totalPaidPaise = 0, pendingPaise = 0, refundPaise = 0;
    const statusDistribution = { PENDING: 0, AUTHORIZED: 0, CAPTURED: 0, FAILED: 0, PARTIALLY_REFUNDED: 0, REFUNDED: 0 };
    const vehicleSet = new Set();

    activeUserPayments.forEach(p => {
      const amtPaise = Math.round(Number(p.amountPaise || (p.amount * 100)) || 0);
      const refPaise = Math.round(Number(p.refundedPaise || ((p.totalRefundedAmount || 0) * 100)) || 0);

      if (p.status === PAYMENT_STATUS.CAPTURED || p.status === 'PAID') {
        totalPaidPaise += (amtPaise - refPaise); statusDistribution.CAPTURED++;
      } else if (p.status === PAYMENT_STATUS.REFUNDED) {
        refundPaise += amtPaise; statusDistribution.REFUNDED++;
      } else if (p.status === PAYMENT_STATUS.PARTIALLY_REFUNDED) {
        totalPaidPaise += (amtPaise - refPaise); refundPaise += refPaise; statusDistribution.PARTIALLY_REFUNDED++;
      } else if (p.status === PAYMENT_STATUS.PENDING || p.status === PAYMENT_STATUS.CREATED) {
        pendingPaise += amtPaise; statusDistribution.PENDING++;
      } else if (p.status === PAYMENT_STATUS.AUTHORIZED) {
        pendingPaise += amtPaise; statusDistribution.AUTHORIZED++;
      } else if (p.status === PAYMENT_STATUS.FAILED) {
        statusDistribution.FAILED++;
      }
      if (p.vehicleNumber) vehicleSet.add(p.vehicleNumber);
    });

    const recentActivity = activeUserPayments
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 10)
      .map(p => ({
        id:                  String(p._id),
        invoiceNumber:       p.invoiceNumber || '—',
        cfOrderId:           p.cfOrderId,
        cashfreePaymentId:   p.cashfreePaymentId || '—',
        orderId:             p.cfOrderId,
        paymentId:           p.cashfreePaymentId || '—',
        amount:              p.amount,
        status:              p.status,
        serviceType:         p.serviceType || 'Automotive Service',
        garageName:          p.garageName || 'Authorized Service Center',
        vehicleNumber:       p.vehicleNumber || 'N/A',
        totalRefundedAmount: p.totalRefundedAmount || 0,
        refunds:             p.refunds || [],
        date:                p.paidAt || p.createdAt
      }));

    return res.status(200).json({
      success: true,
      summary: {
        totalPaidAmount:    totalPaidPaise / 100,
        totalPaidPaise,
        pendingAmount:      pendingPaise / 100,
        pendingPaise,
        refundAmount:       refundPaise / 100,
        refundPaise,
        transactionsCount:  userPayments.length,
        invoicesCount:      userInvoices.length || userPayments.length,
        statusDistribution,
        vehicles:           Array.from(vehicleSet),
        recentActivity
      }
    });
  } catch (err) {
    console.error('Error computing customer financial summary:', err);
    return res.status(500).json({ success: false, message: 'Error computing financial summary' });
  }
});

module.exports = router;
