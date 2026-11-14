/**
 * Ownership-transfer use cases: initiate (seller), accept / reject (buyer), cancel (seller) and the
 * buyer's pending inbox. Dependencies are injected (repositories, Mongo client, notifier, access
 * policy, clock), so this module never touches getDb() and is unit-tested with fakes.
 *
 * Accept is a single atomic, idempotent unit of work:
 *   1. compare-and-swap the transfer pending -> accepted (the commit point; exactly one caller wins);
 *   2. compare-and-swap the vehicle from the seller to the buyer (never moves a vehicle twice);
 *   3. idempotent follow-ups: close the seller's history period, insert the buyer's period under a
 *      deterministic _id, re-point service records and diagnoses, close stale pending requests.
 * On a replica set all of it runs in one transaction (runInTransaction). On a standalone mongod the
 * CAS filters keep it safe, and an interrupted run is re-driven by the buyer retrying accept.
 */
const { toObjectId, idValues } = require('../../repositories/BaseRepository');
const { ValidationError, ForbiddenError, NotFoundError, ConflictError } = require('../../core/errors');
const { runInTransaction: defaultRunInTransaction } = require('../../core/transaction');
const { TRANSFER_STATUS: STATUS, assertTransferTransition } = require('./transferStateMachine');
const {
  MSG, REASONS, DEFAULT_NAMES, NOTIFICATION_TYPES, OPEN_BOOKING_STATUSES, ACCEPTANCE, MONGO_DUPLICATE_KEY,
} = require('./constants');
const { toPendingTransferView, fallbackHistoryEntry, vehicleLabel } = require('./presenters');

const CODES = Object.freeze({
  NOT_PENDING: 'TRANSFER_NOT_PENDING',
  OWNERSHIP_CHANGED: 'TRANSFER_OWNERSHIP_CHANGED',
  OPEN_BOOKINGS: 'TRANSFER_OPEN_BOOKINGS',
  IN_PROGRESS: 'TRANSFER_ACCEPT_IN_PROGRESS',
});

const PENDING_VEHICLE_PROJECTION = Object.freeze({ brand: 1, model: 1, year: 1, manufacturingYear: 1, vehicleNumber: 1 });
const BUYER_PROJECTION = Object.freeze({ _id: 1, email: 1, isDisabled: 1 });

function requireObjectId(raw, requiredMsg, invalidMsg) {
  if (!raw) throw new ValidationError(requiredMsg);
  const objectId = toObjectId(raw);
  if (!objectId) throw new ValidationError(invalidMsg);
  return objectId;
}

/**
 * Only the designated party may act. Others get the same 404 the legacy route returned for a
 * non-pending transfer, so a stranger cannot learn the state of someone else's transfer.
 */
function assertParty(transfer, partyId, userId, forbiddenMsg) {
  if (!transfer) throw new NotFoundError(MSG.PENDING_NOT_FOUND);
  if (String(partyId) !== String(userId)) {
    if (transfer.status === STATUS.PENDING) throw new ForbiddenError(forbiddenMsg);
    throw new NotFoundError(MSG.PENDING_NOT_FOUND);
  }
}

/**
 * @param {{ repos: object, client?: object, notifyUser: Function, isOwner: Function,
 *           runInTransaction?: Function, ensureIndexes?: () => Promise<void>, now?: () => Date,
 *           logger?: { error: Function } }} deps
 */
function createOwnershipTransferService({
  repos, client = null, notifyUser, isOwner, runInTransaction = defaultRunInTransaction,
  ensureIndexes = async () => {}, now = () => new Date(), logger = console,
}) {
  /** Notifications are best effort: a push failure never fails or rolls back a transfer. */
  async function notify(userId, message) {
    try {
      await notifyUser(String(userId), message);
    } catch (err) {
      logger.error('Failed to send ownership transfer notification:', err);
    }
  }

  async function initiateTransfer(user, body = {}) {
    const { vehicleId, buyerEmail } = body;
    if (!vehicleId || !buyerEmail || typeof buyerEmail !== 'string') throw new ValidationError(MSG.INITIATE_REQUIRED);
    const vehicleObjectId = requireObjectId(vehicleId, MSG.INITIATE_REQUIRED, MSG.INVALID_VEHICLE_ID);

    const vehicle = await repos.vehicles.findActiveById(vehicleObjectId);
    if (!vehicle || !isOwner(user, vehicle)) throw new NotFoundError(MSG.VEHICLE_NOT_OWNED);

    const email = buyerEmail.trim().toLowerCase();
    if (email === String(user.email || '').toLowerCase()) throw new ValidationError(MSG.SELF_TRANSFER);
    const buyer = await repos.users.findOne({ email }, { projection: BUYER_PROJECTION });
    if (!buyer || buyer.isDisabled === true) throw new NotFoundError(MSG.BUYER_NOT_FOUND);
    if (String(buyer._id) === String(user.id)) throw new ValidationError(MSG.SELF_TRANSFER);

    const canonicalVehicleId = String(vehicle._id);
    await ensureIndexes();
    if (await repos.transfers.findPendingForVehicle(canonicalVehicleId)) throw new ValidationError(MSG.ALREADY_PENDING);

    let result;
    try {
      result = await repos.transfers.insertPending({
        vehicleId: canonicalVehicleId,
        sellerId: String(user.id),
        sellerName: user.name || DEFAULT_NAMES.SELLER,
        buyerId: String(buyer._id),
        buyerEmail: email,
        createdAt: now(),
      });
    } catch (err) {
      // Two concurrent initiations: the unique partial index lets exactly one pending row exist.
      if (err && err.code === MONGO_DUPLICATE_KEY) throw new ValidationError(MSG.ALREADY_PENDING);
      throw err;
    }

    await notify(buyer._id, {
      title: 'Ownership Transfer Request',
      body: `${user.name || DEFAULT_NAMES.SELLER_SHORT} requested to transfer ownership of vehicle ${vehicleLabel(vehicle)} to you.`,
      data: { vehicleId: canonicalVehicleId, transferId: String(result.insertedId), type: NOTIFICATION_TYPES.REQUEST },
    });
    return { transferId: result.insertedId };
  }

  async function hasOpenBookings(vehicleId) {
    const open = await repos.bookings.count({ vehicleId: { $in: idValues(vehicleId) }, status: { $in: OPEN_BOOKING_STATUSES } });
    return open > 0;
  }

  /**
   * Step 3 of accept. Every write is idempotent and safe to run concurrently, so a replay can
   * re-drive it after an interrupted run on a standalone mongod.
   */
  async function applyFollowUps(transfer, buyer, at, vehicle, session) {
    const options = { session };
    const fromIso = at.toISOString();
    const closed = await repos.ownershipHistory.closeOpenEntry(transfer.vehicleId, transfer.sellerId, fromIso, options);
    if (!closed.matchedCount && (await repos.ownershipHistory.listForVehicle([transfer.vehicleId])).length === 0) {
      // Vehicle predates history tracking: keep the seller's period on the timeline.
      const previous = fallbackHistoryEntry(vehicle, transfer.vehicleId);
      await repos.ownershipHistory.insertOnce({ _id: `${transfer._id}:previous`, ...previous, ownerId: transfer.sellerId, toDate: fromIso }, options);
    }
    await repos.ownershipHistory.insertOnce({
      _id: transfer._id,
      vehicleId: transfer.vehicleId,
      ownerId: String(buyer.id),
      ownerName: buyer.name || DEFAULT_NAMES.BUYER,
      fromDate: fromIso,
      toDate: null,
      transferId: String(transfer._id),
    }, options);
    const vehicleIds = idValues(transfer.vehicleId);
    await repos.transfers.repointServiceRecords(vehicleIds, buyer.id, options);
    await repos.diagnoses.reassignVehicle(vehicleIds, buyer.id, options);
    await repos.transfers.rejectOtherPending(transfer.vehicleId, transfer._id, REASONS.ANOTHER_ACCEPTED, at, options);
    await repos.transfers.markFinalized(transfer._id, at, options);
  }

  const buyerSnapshot = (user) => ({ id: String(user.id), name: user.name || DEFAULT_NAMES.BUYER, phone: user.phone || '' });

  /**
   * A repeated accept. Finalised (or legacy pre-refactor) acceptances return success with no side
   * effects; one still inside its grace window is a concurrent duplicate (409); an older,
   * unfinalised one is an interrupted standalone run and is re-driven to completion.
   */
  async function replayAcceptance(transfer, user) {
    if (!transfer || transfer.status !== STATUS.ACCEPTED || String(transfer.buyerId) !== String(user.id)) {
      throw new ConflictError(MSG.NO_LONGER_PENDING, CODES.NOT_PENDING);
    }
    if (transfer.finalizedAt || !transfer.acceptedAt) return { replayed: true };
    const acceptedAt = new Date(transfer.acceptedAt);
    if (now().getTime() - acceptedAt.getTime() < ACCEPTANCE.RECOVERY_GRACE_MS) {
      throw new ConflictError(MSG.ACCEPT_IN_PROGRESS, CODES.IN_PROGRESS);
    }
    const vehicle = await repos.vehicles.findById(transfer.vehicleId);
    const ownedByBuyer = vehicle && isOwner(user, vehicle);
    const moved = ownedByBuyer || (vehicle && await repos.vehicles.reassignOwner(vehicle._id, transfer.sellerId, buyerSnapshot(user)));
    if (!moved) {
      await repos.transfers.voidUnfinalizedAcceptance(transfer._id, REASONS.OWNERSHIP_CHANGED, now());
      throw new ConflictError(MSG.OWNERSHIP_CHANGED, CODES.OWNERSHIP_CHANGED);
    }
    await applyFollowUps(transfer, user, acceptedAt, vehicle, undefined);
    return { replayed: true };
  }

  async function rejectBySystem(transferObjectId, reason) {
    await repos.transfers.transitionStatus(transferObjectId, STATUS.PENDING, STATUS.REJECTED, { reason, rejectedAt: now() });
  }

  async function acceptTransfer(user, body = {}) {
    const transferObjectId = requireObjectId(body.transferId, MSG.TRANSFER_ID_REQUIRED, MSG.INVALID_TRANSFER_ID);
    const transfer = await repos.transfers.findByObjectId(transferObjectId);
    assertParty(transfer, transfer && transfer.buyerId, user.id, MSG.NOT_BUYER_ACCEPT);
    if (transfer.status === STATUS.ACCEPTED) return replayAcceptance(transfer, user);
    if (transfer.status !== STATUS.PENDING) throw new NotFoundError(MSG.PENDING_NOT_FOUND);
    assertTransferTransition(transfer.status, STATUS.ACCEPTED);

    const vehicleObjectId = toObjectId(transfer.vehicleId);
    const vehicle = vehicleObjectId ? await repos.vehicles.findActiveById(vehicleObjectId) : null;
    if (!vehicle) throw new NotFoundError(MSG.VEHICLE_NOT_FOUND);
    if (!isOwner({ id: transfer.sellerId }, vehicle)) {
      await rejectBySystem(transferObjectId, REASONS.OWNERSHIP_CHANGED);
      throw new ConflictError(MSG.OWNERSHIP_CHANGED, CODES.OWNERSHIP_CHANGED);
    }
    if (await hasOpenBookings(vehicle._id)) throw new ConflictError(MSG.OPEN_BOOKINGS, CODES.OPEN_BOOKINGS);

    const at = now();
    let usedTransaction = false;
    try {
      await runInTransaction(client, async (session) => {
        usedTransaction = Boolean(session);
        const claimed = await repos.transfers.transitionStatus(
          transferObjectId, STATUS.PENDING, STATUS.ACCEPTED, { acceptedAt: at, completedAt: at }, { session },
        );
        if (!claimed) throw new ConflictError(MSG.NO_LONGER_PENDING, CODES.NOT_PENDING);
        const moved = await repos.vehicles.reassignOwner(vehicle._id, transfer.sellerId, buyerSnapshot(user), { session });
        if (!moved) throw new ConflictError(MSG.OWNERSHIP_CHANGED, CODES.OWNERSHIP_CHANGED);
        await applyFollowUps(transfer, user, at, vehicle, session);
      });
    } catch (err) {
      if (err && err.code === CODES.NOT_PENDING) return replayAcceptance(await repos.transfers.findByObjectId(transferObjectId), user);
      if (err && err.code === CODES.OWNERSHIP_CHANGED) {
        // A transaction rolled the claim back to pending; without one, void the claimed row.
        if (usedTransaction) await rejectBySystem(transferObjectId, REASONS.OWNERSHIP_CHANGED);
        else await repos.transfers.voidUnfinalizedAcceptance(transferObjectId, REASONS.OWNERSHIP_CHANGED, now());
      }
      throw err;
    }

    await notify(transfer.sellerId, {
      title: 'Ownership Transfer Accepted',
      body: `${user.name || DEFAULT_NAMES.BUYER_SHORT} accepted the ownership transfer of vehicle ${vehicleLabel(vehicle)}.`,
      data: { vehicleId: transfer.vehicleId, type: NOTIFICATION_TYPES.ACCEPTED },
    });
    return { replayed: false };
  }

  /** Shared by reject (buyer) and cancel (seller): a single CAS out of `pending`. */
  async function closePending(user, body, { party, forbiddenMsg, to, timestampField, notifyParty, message }) {
    const transferObjectId = requireObjectId(body.transferId, MSG.TRANSFER_ID_REQUIRED, MSG.INVALID_TRANSFER_ID);
    const transfer = await repos.transfers.findByObjectId(transferObjectId);
    assertParty(transfer, transfer && transfer[party], user.id, forbiddenMsg);
    if (transfer.status !== STATUS.PENDING) throw new NotFoundError(MSG.PENDING_NOT_FOUND);
    assertTransferTransition(transfer.status, to);
    const changed = await repos.transfers.transitionStatus(transferObjectId, STATUS.PENDING, to, { [timestampField]: now() });
    // Lost a race (typically against accept): the transfer already left `pending`.
    if (!changed) throw new ConflictError(MSG.NO_LONGER_PENDING, CODES.NOT_PENDING);
    await notify(transfer[notifyParty], message(transfer));
  }

  function rejectTransfer(user, body = {}) {
    return closePending(user, body, {
      party: 'buyerId',
      forbiddenMsg: MSG.NOT_BUYER_REJECT,
      to: STATUS.REJECTED,
      timestampField: 'rejectedAt',
      notifyParty: 'sellerId',
      message: (t) => ({
        title: 'Ownership Transfer Rejected',
        body: `${user.name || DEFAULT_NAMES.BUYER_SHORT} rejected the ownership transfer request.`,
        data: { vehicleId: t.vehicleId, type: NOTIFICATION_TYPES.REJECTED },
      }),
    });
  }

  function cancelTransfer(user, body = {}) {
    return closePending(user, body, {
      party: 'sellerId',
      forbiddenMsg: MSG.NOT_SELLER_CANCEL,
      to: STATUS.CANCELLED,
      timestampField: 'cancelledAt',
      notifyParty: 'buyerId',
      message: (t) => ({
        title: 'Ownership Transfer Cancelled',
        body: `${user.name || DEFAULT_NAMES.SELLER_SHORT} cancelled the ownership transfer request.`,
        data: { vehicleId: t.vehicleId, type: NOTIFICATION_TYPES.CANCELLED },
      }),
    });
  }

  async function listPendingForBuyer(user) {
    const transfers = await repos.transfers.listPendingForBuyer(user.id);
    const vehicles = await repos.vehicles.findManyByIds(transfers.map((t) => t.vehicleId), PENDING_VEHICLE_PROJECTION);
    const byId = new Map(vehicles.map((v) => [String(v._id), v]));
    return transfers.map((t) => toPendingTransferView(t, byId.get(String(t.vehicleId))));
  }

  return { initiateTransfer, acceptTransfer, rejectTransfer, cancelTransfer, listPendingForBuyer };
}

module.exports = { createOwnershipTransferService, TRANSFER_ERROR_CODES: CODES };
