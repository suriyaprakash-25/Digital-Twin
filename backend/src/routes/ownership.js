const express = require('express');
const { ObjectId } = require('mongodb');
const { getDb } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { notifyUser } = require('../services/notifications');

const router = express.Router();

// 1. Initiate ownership transfer (by current owner)
router.post('/transfer', requireAuth, async (req, res) => {
  const { vehicleId, buyerEmail } = req.body || {};

  if (!vehicleId || !buyerEmail) {
    return res.status(400).json({ msg: 'Vehicle ID and buyer email are required' });
  }

  const db = getDb();
  let vehicleObjectId;
  try {
    vehicleObjectId = new ObjectId(vehicleId);
  } catch (e) {
    return res.status(400).json({ msg: 'Invalid vehicle ID' });
  }

  try {
    // Verify vehicle belongs to user
    const vehicle = await db.collection('vehicles').findOne({ _id: vehicleObjectId, ownerId: req.user.id });
    if (!vehicle) {
      return res.status(404).json({ msg: 'Vehicle not found or unauthorized' });
    }

    if (buyerEmail.toLowerCase() === req.user.email.toLowerCase()) {
      return res.status(400).json({ msg: 'You cannot transfer ownership to yourself' });
    }

    // Find buyer
    const buyer = await db.collection('users').findOne({ email: buyerEmail.toLowerCase() });
    if (!buyer) {
      return res.status(404).json({ msg: 'Buyer with this email is not registered on Driveportz' });
    }

    // Check if there is already a pending transfer
    const existingPending = await db.collection('transfers').findOne({
      vehicleId: String(vehicleId),
      status: 'pending'
    });

    if (existingPending) {
      return res.status(400).json({ msg: 'There is already a pending transfer request for this vehicle' });
    }

    // Create transfer request
    const transferDoc = {
      vehicleId: String(vehicleId),
      sellerId: req.user.id,
      sellerName: req.user.name || 'Current Owner',
      buyerId: String(buyer._id),
      buyerEmail: buyerEmail.toLowerCase(),
      status: 'pending',
      createdAt: new Date()
    };

    const result = await db.collection('transfers').insertOne(transferDoc);

    // Send notification to buyer
    try {
      await notifyUser(String(buyer._id), {
        title: 'Ownership Transfer Request',
        body: `${req.user.name || 'Seller'} requested to transfer ownership of vehicle ${vehicle.brand} ${vehicle.model} (${vehicle.vehicleNumber}) to you.`,
        data: {
          vehicleId: String(vehicleId),
          transferId: String(result.insertedId),
          type: 'transfer_request'
        }
      });
    } catch (notifErr) {
      console.error('Failed to notify buyer:', notifErr);
    }

    return res.status(201).json({ msg: 'Transfer request initiated successfully', transferId: result.insertedId });
  } catch (err) {
    console.error('Error initiating transfer:', err);
    return res.status(500).json({ msg: 'Server error initiating transfer', error: String(err && err.message ? err.message : err) });
  }
});

// 2. Accept ownership transfer (by buyer)
router.post('/transfer/accept', requireAuth, async (req, res) => {
  const { transferId } = req.body || {};

  if (!transferId) {
    return res.status(400).json({ msg: 'Transfer ID is required' });
  }

  const db = getDb();
  let transferObjectId;
  try {
    transferObjectId = new ObjectId(transferId);
  } catch (e) {
    return res.status(400).json({ msg: 'Invalid transfer ID' });
  }

  try {
    // Find pending transfer
    const transfer = await db.collection('transfers').findOne({ _id: transferObjectId, status: 'pending' });
    if (!transfer) {
      return res.status(404).json({ msg: 'Pending transfer request not found' });
    }

    // Validate that the logged-in user is the designated buyer
    if (transfer.buyerId !== req.user.id) {
      return res.status(403).json({ msg: 'Unauthorized: You are not the designated buyer for this transfer' });
    }

    const vehicleObjectId = new ObjectId(transfer.vehicleId);
    const vehicle = await db.collection('vehicles').findOne({ _id: vehicleObjectId });
    if (!vehicle) {
      return res.status(404).json({ msg: 'Vehicle not found' });
    }

    const now = new Date().toISOString();

    // 1. Update the vehicle owner
    await db.collection('vehicles').updateOne(
      { _id: vehicleObjectId },
      {
        $set: {
          ownerId: req.user.id,
          ownerName: req.user.name || 'New Owner',
          phone: req.user.phone || ''
        }
      }
    );

    // 2. Terminate the old owner's history timeline
    await db.collection('ownershipHistory').updateOne(
      { vehicleId: transfer.vehicleId, ownerId: transfer.sellerId, toDate: null },
      { $set: { toDate: now } }
    );

    // 3. Insert the new owner's history timeline
    const historyDoc = {
      vehicleId: transfer.vehicleId,
      ownerId: req.user.id,
      ownerName: req.user.name || 'New Owner',
      fromDate: now,
      toDate: null
    };
    await db.collection('ownershipHistory').insertOne(historyDoc);

    // 4. Mark transfer as accepted
    await db.collection('transfers').updateOne(
      { _id: transferObjectId },
      { $set: { status: 'accepted', completedAt: new Date() } }
    );

    // 5. Clean up other pending transfers for the same vehicle
    await db.collection('transfers').updateMany(
      { vehicleId: transfer.vehicleId, status: 'pending' },
      { $set: { status: 'rejected', reason: 'Another transfer was accepted' } }
    );

    // Notify seller
    try {
      await notifyUser(transfer.sellerId, {
        title: 'Ownership Transfer Accepted',
        body: `${req.user.name || 'Buyer'} accepted the ownership transfer of vehicle ${vehicle.brand} ${vehicle.model} (${vehicle.vehicleNumber}).`,
        data: {
          vehicleId: transfer.vehicleId,
          type: 'transfer_accepted'
        }
      });
    } catch (notifErr) {
      console.error('Failed to notify seller:', notifErr);
    }

    return res.status(200).json({ msg: 'Ownership transferred successfully' });
  } catch (err) {
    console.error('Error accepting transfer:', err);
    return res.status(500).json({ msg: 'Server error accepting transfer', error: String(err && err.message ? err.message : err) });
  }
});

// 3. Reject ownership transfer (by buyer)
router.post('/transfer/reject', requireAuth, async (req, res) => {
  const { transferId } = req.body || {};

  if (!transferId) {
    return res.status(400).json({ msg: 'Transfer ID is required' });
  }

  const db = getDb();
  let transferObjectId;
  try {
    transferObjectId = new ObjectId(transferId);
  } catch (e) {
    return res.status(400).json({ msg: 'Invalid transfer ID' });
  }

  try {
    const transfer = await db.collection('transfers').findOne({ _id: transferObjectId, status: 'pending' });
    if (!transfer) {
      return res.status(404).json({ msg: 'Pending transfer request not found' });
    }

    if (transfer.buyerId !== req.user.id) {
      return res.status(403).json({ msg: 'Unauthorized: You are not the designated buyer' });
    }

    // Mark transfer as rejected
    await db.collection('transfers').updateOne(
      { _id: transferObjectId },
      { $set: { status: 'rejected', rejectedAt: new Date() } }
    );

    // Notify seller
    try {
      await notifyUser(transfer.sellerId, {
        title: 'Ownership Transfer Rejected',
        body: `${req.user.name || 'Buyer'} rejected the ownership transfer request.`,
        data: {
          vehicleId: transfer.vehicleId,
          type: 'transfer_rejected'
        }
      });
    } catch (notifErr) {
      console.error('Failed to notify seller:', notifErr);
    }

    return res.status(200).json({ msg: 'Ownership transfer request rejected' });
  } catch (err) {
    console.error('Error rejecting transfer:', err);
    return res.status(500).json({ msg: 'Server error rejecting transfer', error: String(err && err.message ? err.message : err) });
  }
});

// 4. Get pending transfers for logged-in user (as buyer)
router.get('/pending', requireAuth, async (req, res) => {
  const db = getDb();
  try {
    const pendingTransfers = await db.collection('transfers')
      .find({ buyerId: req.user.id, status: 'pending' })
      .toArray();

    // Attach vehicle details to each transfer record
    const extended = [];
    for (const t of pendingTransfers) {
      const v = await db.collection('vehicles').findOne({ _id: new ObjectId(t.vehicleId) });
      extended.push({
        id: String(t._id),
        vehicleId: t.vehicleId,
        sellerId: t.sellerId,
        sellerName: t.sellerName,
        buyerId: t.buyerId,
        buyerEmail: t.buyerEmail,
        createdAt: t.createdAt,
        vehicle: v ? {
          brand: v.brand,
          model: v.model,
          year: v.year || v.manufacturingYear,
          vehicleNumber: v.vehicleNumber
        } : null
      });
    }

    return res.status(200).json(extended);
  } catch (err) {
    console.error('Error loading pending transfers:', err);
    return res.status(500).json({ msg: 'Server error loading pending transfers', error: String(err && err.message ? err.message : err) });
  }
});

// 5. Get ownership history (Public)
router.get('/history/:vehicleId', async (req, res) => {
  const { vehicleId } = req.params;
  const db = getDb();

  let vehicleObjectId;
  try {
    vehicleObjectId = new ObjectId(vehicleId);
  } catch (e) {
    return res.status(400).json({ msg: 'Invalid vehicle ID' });
  }

  try {
    const vehicle = await db.collection('vehicles').findOne({ _id: vehicleObjectId, isArchived: { $ne: true } });
    if (!vehicle) {
      return res.status(404).json({ msg: 'Vehicle not found' });
    }

    const history = await db.collection('ownershipHistory')
      .find({ vehicleId: String(vehicleId) })
      .sort({ fromDate: 1 })
      .toArray();

    // Fallback: If no history logs are found, dynamically create the initial entry using vehicle purchase date or creation time
    if (history.length === 0) {
      const fallbackFromDate = vehicle.purchaseDate
        ? new Date(vehicle.purchaseDate).toISOString()
        : vehicle.createdAt || new Date(2024, 0, 1).toISOString();

      return res.status(200).json([{
        vehicleId: String(vehicleId),
        ownerId: vehicle.ownerId,
        ownerName: vehicle.ownerName || 'Original Owner',
        fromDate: fallbackFromDate,
        toDate: null
      }]);
    }

    return res.status(200).json(history.map(h => ({
      id: String(h._id),
      vehicleId: h.vehicleId,
      ownerId: h.ownerId,
      ownerName: h.ownerName,
      fromDate: h.fromDate,
      toDate: h.toDate
    })));
  } catch (err) {
    console.error('Error fetching ownership history:', err);
    return res.status(500).json({ msg: 'Server error fetching history', error: String(err && err.message ? err.message : err) });
  }
});

module.exports = router;
