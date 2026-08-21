const express = require('express');
const { ObjectId } = require('mongodb');
const { getDb } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { loadConfig } = require('../config');
const {
  createRazorpayOrder,
  verifyPaymentSignature,
  verifyWebhookSignature,
  fetchPaymentDetails
} = require('../services/razorpayService');
const { PAYMENT_STATUS } = require('../models/Payment');

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
router.post('/create-order', requireAuth, async (req, res) => {
  const { invoiceId, serviceId } = req.body || {};
  const targetId = serviceId || invoiceId;

  if (!targetId) {
    return res.status(400).json({ success: false, message: 'Service or Invoice ID is required' });
  }

  const db = getDb();
  const services = db.collection('services');
  const vehicles = db.collection('vehicles');
  const payments = db.collection('payments');

  try {
    const sObjectId = toObjectId(targetId);
    const serviceQuery = sObjectId
      ? { $or: [{ _id: sObjectId }, { _id: String(targetId) }, { id: String(targetId) }] }
      : { $or: [{ _id: String(targetId) }, { id: String(targetId) }] };

    const service = await services.findOne({ ...serviceQuery, isArchived: { $ne: true } });
    if (!service) {
      return res.status(404).json({ success: false, message: 'Service record or invoice not found' });
    }

    // Check ownership: authenticated user must be the vehicle owner or service owner
    const vObjectId = toObjectId(service.vehicleId);
    const vehicle = vObjectId
      ? await vehicles.findOne({ _id: vObjectId, isArchived: { $ne: true } })
      : await vehicles.findOne({ $or: [{ _id: String(service.vehicleId) }, { id: String(service.vehicleId) }], isArchived: { $ne: true } });

    const isOwner = (vehicle && String(vehicle.ownerId) === String(req.user.id)) ||
                    (service.ownerId && String(service.ownerId) === String(req.user.id)) ||
                    (service.userId && String(service.userId) === String(req.user.id)) ||
                    (req.user.role === 'ADMIN');

    if (!isOwner) {
      return res.status(403).json({ success: false, message: 'Forbidden: You are not authorized to pay for this invoice' });
    }

    // Check if cancelled
    if (service.invoiceStatus === 'CANCELLED') {
      return res.status(400).json({ success: false, message: 'Cannot pay for a cancelled invoice' });
    }

    // Check if already paid
    if (service.paymentStatus === 'PAID') {
      return res.status(400).json({ success: false, message: 'This service invoice is already paid' });
    }

    // Authoritative amount calculation from database
    const totalCost = Number(service.totalAmount !== undefined ? service.totalAmount : (service.totalCost !== undefined ? service.totalCost : (service.cost || 0)));
    if (Number.isNaN(totalCost) || totalCost <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid service amount. Invoice total must be greater than zero.' });
    }

    const amountInPaise = Math.round(totalCost * 100);
    const config = loadConfig();
    const keyId = config.razorpay?.keyId || process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder_key_id';

    const invoiceNumber = service.invoiceNumber || `DP-INV-2026-${String(service._id).slice(-6).toUpperCase()}`;

    // Generate unique internal reference
    const receipt = `rcpt_${String(service._id).slice(-8)}_${Date.now().toString().slice(-6)}`;

    // Create server-side order with Razorpay
    let razorpayOrder;
    try {
      razorpayOrder = await createRazorpayOrder({
        amountInPaise,
        receipt,
        notes: {
          serviceId: String(service._id),
          invoiceNumber,
          vehicleId: String(service.vehicleId),
          userId: String(req.user.id),
          vehicleNumber: vehicle?.vehicleNumber || 'Vehicle'
        }
      });
    } catch (rzpErr) {
      console.error('Razorpay order creation error:', rzpErr);
      return res.status(500).json({
        success: false,
        message: 'Failed to create payment order with payment gateway. Please check gateway configuration.',
        error: rzpErr.message
      });
    }

    // Record payment attempt in database
    const paymentDoc = {
      invoiceId: String(service._id),
      invoiceNumber,
      serviceId: String(service._id),
      vehicleId: String(service.vehicleId),
      vehicleNumber: vehicle?.vehicleNumber || 'N/A',
      userId: String(req.user.id),
      garageId: service.garageId ? String(service.garageId) : (service.createdBy ? String(service.createdBy) : null),
      garageName: service.garageName || 'Authorized Service Center',
      serviceType: service.serviceType || 'Periodic Maintenance',
      amount: totalCost,
      amountInPaise,
      currency: 'INR',
      receipt,
      razorpayOrderId: razorpayOrder.id,
      razorpayPaymentId: null,
      razorpaySignature: null,
      status: PAYMENT_STATUS.CREATED,
      paymentMethod: null,
      failureReason: null,
      paidAt: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const insertResult = await payments.insertOne(paymentDoc);

    return res.status(200).json({
      success: true,
      orderId: razorpayOrder.id,
      invoiceNumber,
      amount: amountInPaise,
      currency: 'INR',
      keyId,
      paymentId: String(insertResult.insertedId),
      service: {
        id: String(service._id),
        invoiceNumber,
        title: service.serviceType || 'Automotive Service',
        garageName: service.garageName || 'Authorized Service Center',
        vehicleNumber: vehicle?.vehicleNumber || '',
        totalCost
      }
    });
  } catch (err) {
    console.error('Error in /create-order:', err);
    return res.status(500).json({ success: false, message: 'Server error while creating payment order' });
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

    // 7. Mark corresponding service as PAID
    const targetServiceId = payment.serviceId || serviceId;
    const sObjectId = toObjectId(targetServiceId);
    const serviceQuery = sObjectId
      ? { $or: [{ _id: sObjectId }, { _id: String(targetServiceId) }] }
      : { _id: String(targetServiceId) };

    await services.updateOne(serviceQuery, {
      $set: {
        paymentStatus: 'PAID',
        paidAt,
        paymentId,
        paymentMethod,
        razorpayOrderId: payment.razorpayOrderId,
        updatedAt: paidAt
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Payment verified and captured successfully!',
      payment: {
        id: String(payment._id),
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
 * POST /api/payments/webhook
 * Razorpay Webhook Handler with raw signature verification and idempotency
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
    const orderId = paymentEntity?.order_id;
    const paymentId = paymentEntity?.id;

    if (orderId) {
      if (eventName === 'payment.captured' || eventName === 'order.paid') {
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
        }
      } else if (eventName === 'payment.failed') {
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
        orderId: payment.razorpayOrderId,
        paymentId: payment.razorpayPaymentId,
        amount: payment.amount,
        status: payment.status,
        serviceType: payment.serviceType,
        garageName: payment.garageName,
        vehicleNumber: payment.vehicleNumber,
        paidAt: payment.paidAt
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error checking payment status' });
  }
});

/**
 * GET /api/payments/history
 * Retrieves authenticated user's payment history
 */
router.get('/history', requireAuth, async (req, res) => {
  const db = getDb();
  const payments = db.collection('payments');

  try {
    const userPayments = await payments
      .find({ userId: String(req.user.id) })
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();

    const formatted = userPayments.map(p => ({
      id: String(p._id),
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
      date: p.paidAt || p.createdAt
    }));

    return res.status(200).json({ success: true, payments: formatted });
  } catch (err) {
    console.error('Error fetching payment history:', err);
    return res.status(500).json({ success: false, message: 'Error fetching payment history' });
  }
});

module.exports = router;
