/**
 * Write side of payment disputes: raise (with optional evidence), respond, cancel, resolve/reject.
 *
 * Collaborators are injected (repositories, evidence storage, dispute-number generator, refund
 * service, notifications, audit log, clock), so the service never calls getDb().
 */
const { ValidationError, ForbiddenError, NotFoundError, ConflictError } = require('../../core/errors');
const { asString } = require('../../core/text');
const { toObjectId } = require('../../repositories/BaseRepository');
const {
  DISPUTE_STATUS, DISPUTE_RESOLUTION, DISPUTE_CATEGORY, TERMINAL_STATUSES, REFUND_RESOLUTIONS,
  EVIDENCE, LIMITS, DEFAULTS, ACTOR_ROLES, MSG,
} = require('./constants');
const { DISPUTE_ACTIONS, applyDisputeAction } = require('./disputeStateMachine');
// Statuses with captured funds ('PAID' is a legacy alias of CAPTURED).
const DISPUTABLE_PAYMENT_STATUSES = Object.freeze(['CAPTURED', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED']);

const RESOLUTIONS = new Set(Object.values(DISPUTE_RESOLUTION));
const CATEGORIES = new Set(Object.values(DISPUTE_CATEGORY));
const warn = (label) => (err) => console.warn(`${label}:`, err && err.message ? err.message : err);
const rupees = (amount) => amount.toLocaleString('en-IN');

/** Disputed amount: defaults to the full payment; must be positive and at most the payment amount. */
function parseDisputedAmount(value, maxAmount) {
  const amount = value !== undefined && value !== null && value !== '' ? Number.parseFloat(value) : maxAmount;
  if (Number.isNaN(amount) || amount <= 0) throw new ValidationError(MSG.INVALID_AMOUNT);
  if (amount > maxAmount) throw new ValidationError(`Disputed amount (₹${amount}) cannot exceed the paid transaction amount (₹${maxAmount})`);
  return amount;
}

function parseCategory(value) {
  const category = asString(value) || DEFAULTS.CATEGORY;
  if (!CATEGORIES.has(category)) throw new ValidationError(MSG.INVALID_CATEGORY);
  return category;
}

function buildDisputeDoc({ payment, userId, input, disputeNumber, evidence, at }) {
  const maxAmount = Number.parseFloat(payment.amount) || 0;
  const disputedAmount = parseDisputedAmount(input.disputedAmount, maxAmount);
  return {
    disputeNumber,
    paymentId: String(payment._id || payment.paymentId),
    razorpayPaymentId: payment.razorpayPaymentId || DEFAULTS.DASH,
    invoiceId: String(payment.invoiceId || payment.serviceId || ''),
    invoiceNumber: payment.invoiceNumber || DEFAULTS.DASH,
    userId: String(userId),
    garageId: String(payment.garageId || ''),
    garageName: payment.garageName || DEFAULTS.GARAGE_NAME,
    serviceType: payment.serviceType || DEFAULTS.SERVICE_TYPE,
    vehicleNumber: payment.vehicleNumber || DEFAULTS.NOT_AVAILABLE,
    vehicleId: String(payment.vehicleId || ''),
    category: parseCategory(input.category),
    subject: asString(input.subject, { maxLength: LIMITS.SUBJECT_MAX_LENGTH }) || DEFAULTS.SUBJECT,
    description: asString(input.description, { maxLength: LIMITS.TEXT_MAX_LENGTH }),
    disputedAmount,
    disputedAmountPaise: Math.round(disputedAmount * 100),
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
    createdAt: at,
    updatedAt: at,
  };
}

function evidenceItem(file, persisted, at) {
  return {
    url: persisted.url,
    storageProvider: persisted.storageProvider,
    storageKey: persisted.storageKey,
    resourceType: persisted.resourceType || EVIDENCE.RESOURCE_TYPE,
    originalName: file.originalname,
    mimeType: file.mimetype,
    uploadedAt: at,
  };
}

function createDisputeCommandService({ repos, queries, storage, nextDisputeNumber, initiateRefund, notifyUser, auditLog, now = () => new Date() }) {
  const { disputes, disputeEvents, payments, garages } = repos;

  /** Appends a timeline event (append-only). */
  async function logEvent({ disputeId, actorId, actorRole, action, message, metadata = {} }) {
    const event = {
      disputeId: String(disputeId),
      actorId: String(actorId || 'system'),
      actorRole: String(actorRole || ACTOR_ROLES.SYSTEM),
      action,
      message: message || '',
      metadata,
      createdAt: now(),
    };
    await disputeEvents.append(event);
    return event;
  }

  /** Payment by ObjectId, else by gateway payment id (legacy rows). */
  function findPayment(ref) {
    const _id = toObjectId(ref);
    return _id ? payments.findOne({ _id }) : payments.findOne({ $or: [{ paymentId: String(ref) }, { razorpayPaymentId: String(ref) }] });
  }

  /** Disputes store the garage document id; notifications go to the garage owner's user account. */
  async function garageRecipient(garageId) {
    if (!garageId) return null;
    const garage = await garages.findById(garageId).catch(() => null);
    return garage && garage.ownerUserId ? String(garage.ownerUserId) : String(garageId);
  }

  /** Validates the payment and duplicates BEFORE any evidence is stored. */
  async function loadDisputablePayment(userId, paymentId) {
    const payment = await findPayment(paymentId);
    if (!payment) throw new NotFoundError(MSG.PAYMENT_NOT_FOUND);
    if (String(payment.userId) !== String(userId)) throw new ForbiddenError(MSG.PAYMENT_NOT_OWNED);
    // Only payments that actually moved money can be disputed (not abandoned/failed checkouts).
    if (!DISPUTABLE_PAYMENT_STATUSES.includes(String(payment.status || '').toUpperCase())) {
      throw new ValidationError('Only completed payments can be disputed');
    }
    const existing = await disputes.findActiveForPayment(String(payment._id || payment.paymentId));
    if (existing) throw new ConflictError(`An active dispute (${existing.disputeNumber}) is already open for this payment`, 'DISPUTE_ALREADY_OPEN');
    return payment;
  }

  /**
   * Raise a dispute. `file` is an already type/signature-checked upload (it is persisted only once
   * the dispute is known to be valid, and deleted again if the insert fails); `evidence` is a list
   * of already-persisted items (legacy disputeService.createDispute callers).
   */
  async function create({ userId, input = {}, file = null, evidence = [] }) {
    let persisted = null;
    let stored = false; // once the dispute row exists it owns the evidence file
    try {
      if (!input.paymentId || !asString(input.description)) throw new ValidationError(MSG.PAYMENT_AND_DESCRIPTION_REQUIRED);
      const payment = await loadDisputablePayment(userId, input.paymentId);
      // Validate amount/category before touching storage (buildDisputeDoc throws the same errors later).
      parseDisputedAmount(input.disputedAmount, Number.parseFloat(payment.amount) || 0);
      parseCategory(input.category);
      const at = now();
      const items = [...(Array.isArray(evidence) ? evidence : [])];
      if (file) {
        persisted = await storage.persistUploadedFile(file, { folder: EVIDENCE.FOLDER, resourceType: EVIDENCE.RESOURCE_TYPE });
        items.push(evidenceItem(file, persisted, at));
      }
      const doc = buildDisputeDoc({ payment, userId, input, disputeNumber: await nextDisputeNumber(), evidence: items, at });
      const { insertedId } = await disputes.create(doc);
      stored = true;
      const id = String(insertedId);
      await logEvent({ disputeId: id, actorId: userId, actorRole: ACTOR_ROLES.USER, action: 'DISPUTE_CREATED', message: `Dispute opened by customer: ${doc.subject}`, metadata: { category: doc.category, amount: doc.disputedAmount } });
      const recipient = await garageRecipient(payment.garageId);
      if (recipient) {
        await notifyUser(recipient, {
          title: 'New Dispute Raised',
          body: `Customer raised a dispute (${doc.disputeNumber}) regarding invoice ${payment.invoiceNumber || DEFAULTS.NOT_AVAILABLE}.`,
          data: { type: 'NEW_DISPUTE', disputeId: id, disputeNumber: doc.disputeNumber },
        }).catch(warn('Dispute notification failed'));
      }
      return { id, ...doc };
    } catch (err) {
      if (!stored && persisted) await storage.deletePersistedFile(persisted).catch(warn('Evidence cleanup failed'));
      else if (!stored && file) storage.removeTemporaryFile(file);
      throw err;
    }
  }

  async function respondAsUser(user, idOrNumber, message) {
    const text = asString(message, { maxLength: LIMITS.TEXT_MAX_LENGTH });
    if (!text) throw new ValidationError(MSG.MESSAGE_REQUIRED);
    const dispute = await queries.requireDispute(idOrNumber, MSG.DISPUTE_NOT_FOUND);
    if (String(dispute.userId) !== String(user.id)) throw new ForbiddenError(MSG.FORBIDDEN);
    const at = now();
    await applyDisputeAction({ disputes, dispute, action: DISPUTE_ACTIONS.USER_RESPOND, fields: { userRespondedAt: at }, now: at });
    await logEvent({ disputeId: dispute._id, actorId: user.id, actorRole: ACTOR_ROLES.USER, action: 'USER_RESPONDED', message: text });
  }

  async function cancelByUser(user, idOrNumber) {
    const dispute = await queries.requireDispute(idOrNumber, MSG.DISPUTE_NOT_FOUND);
    if (String(dispute.userId) !== String(user.id)) throw new ForbiddenError(MSG.FORBIDDEN);
    await applyDisputeAction({ disputes, dispute, action: DISPUTE_ACTIONS.CANCEL, now: now() });
    await logEvent({ disputeId: dispute._id, actorId: user.id, actorRole: ACTOR_ROLES.USER, action: 'DISPUTE_CANCELLED', message: 'Dispute cancelled by customer' });
  }

  async function respondAsGarage(user, idOrNumber, response) {
    const text = asString(response, { maxLength: LIMITS.TEXT_MAX_LENGTH });
    if (!text) throw new ValidationError(MSG.RESPONSE_REQUIRED);
    const dispute = await queries.requireDispute(idOrNumber, MSG.DISPUTE_NOT_FOUND);
    if (!(await queries.isDisputeGarage(user, dispute))) throw new ForbiddenError(MSG.GARAGE_FORBIDDEN);
    const at = now();
    await applyDisputeAction({ disputes, dispute, action: DISPUTE_ACTIONS.GARAGE_RESPOND, fields: { garageResponse: text, garageRespondedAt: at }, now: at });
    await logEvent({ disputeId: dispute._id, actorId: user.id, actorRole: ACTOR_ROLES.GARAGE, action: 'GARAGE_RESPONDED', message: text });
    await notifyUser(dispute.userId, {
      title: 'Garage Responded to Dispute',
      body: `The garage has submitted their response regarding dispute ${dispute.disputeNumber}.`,
      data: { type: 'GARAGE_RESPONSE', disputeId: String(dispute._id), disputeNumber: dispute.disputeNumber },
    }).catch(warn('User notification failed'));
  }

  async function refundForResolution({ dispute, adminId, resolution, resolutionNote, refundAmount }) {
    const payment = await findPayment(dispute.paymentId);
    if (!payment) throw new NotFoundError(MSG.REFUND_PAYMENT_NOT_FOUND);
    const balance = Math.max(0, (Number.parseFloat(payment.amount) || 0) - (Number.parseFloat(payment.totalRefundedAmount) || 0) - (Number.parseFloat(payment.pendingRefundAmount) || 0));
    const amount = resolution === DISPUTE_RESOLUTION.REFUND_FULL ? balance : (Number.parseFloat(refundAmount) || dispute.disputedAmount);
    if (!(amount > 0) || amount > balance) {
      throw new ValidationError(`Refund amount ₹${amount} is invalid or exceeds remaining refundable balance of ₹${balance}`);
    }
    const result = await initiateRefund({
      payment,
      amount,
      reason: resolutionNote || `Dispute ${dispute.disputeNumber} resolution`,
      actor: { id: adminId, role: ACTOR_ROLES.ADMIN },
      context: { disputeNumber: dispute.disputeNumber, source: 'DISPUTE' },
    });
    const refund = result && result.refund;
    await logEvent({ disputeId: dispute._id, actorId: adminId, actorRole: ACTOR_ROLES.ADMIN, action: 'REFUND_COMPLETED', message: `Refund of ₹${rupees(amount)} processed successfully for dispute resolution.`, metadata: { amount, refundId: refund && refund.refundId, gateway: refund && refund.gateway } });
    await notifyUser(dispute.userId, {
      title: 'Refund Processed for Dispute',
      body: `Your dispute ${dispute.disputeNumber} was resolved with a refund of ₹${rupees(amount)}.`,
      data: { type: 'REFUND_COMPLETED', disputeId: String(dispute._id), disputeNumber: dispute.disputeNumber, amount: String(amount) },
    }).catch(warn('User notification failed'));
  }

  /**
   * Admin resolution (optionally with a gateway-neutral refund). A compare-and-swap claim lets
   * exactly one administrator resolve; the outcome is written only while that claim is held.
   */
  async function resolve({ disputeId, adminId, resolution, resolutionNote, refundAmount }) {
    const outcome = resolution || DISPUTE_RESOLUTION.NO_ACTION;
    if (!RESOLUTIONS.has(outcome)) throw new ValidationError(MSG.INVALID_RESOLUTION);
    const dispute = await queries.requireDispute(disputeId, MSG.DISPUTE_RECORD_NOT_FOUND);
    if (TERMINAL_STATUSES.includes(dispute.status)) throw new ConflictError(`Dispute is already ${dispute.status}`, 'DISPUTE_ALREADY_CLOSED');

    const at = now();
    if (!(await disputes.claimResolution(dispute, adminId, at))) throw new ConflictError(MSG.BEING_RESOLVED, 'DISPUTE_BEING_RESOLVED');
    try {
      if (REFUND_RESOLUTIONS.includes(outcome)) await refundForResolution({ dispute, adminId, resolution: outcome, resolutionNote, refundAmount });
    } catch (err) {
      await disputes.releaseResolutionClaim(dispute._id);
      throw err;
    }

    const finalStatus = outcome === DISPUTE_RESOLUTION.REJECT_DISPUTE ? DISPUTE_STATUS.REJECTED : DISPUTE_STATUS.RESOLVED;
    const isResolved = finalStatus === DISPUTE_STATUS.RESOLVED;
    const resolved = await disputes.finalizeResolution(dispute._id, adminId, {
      status: finalStatus,
      resolution: outcome,
      resolutionNote: asString(resolutionNote, { maxLength: LIMITS.TEXT_MAX_LENGTH }),
      resolvedAt: at,
      resolvedBy: String(adminId),
      updatedAt: at,
    });
    await logEvent({ disputeId: dispute._id, actorId: adminId, actorRole: ACTOR_ROLES.ADMIN, action: isResolved ? 'DISPUTE_RESOLVED' : 'DISPUTE_REJECTED', message: `Dispute marked as ${finalStatus}: ${resolutionNote || 'No notes provided'}`, metadata: { resolution } });
    await notifyUser(dispute.userId, {
      title: isResolved ? 'Dispute Resolved' : 'Dispute Closed',
      body: `Your dispute ${dispute.disputeNumber} has been ${finalStatus.toLowerCase()} by support.`,
      data: { type: isResolved ? 'DISPUTE_RESOLVED' : 'DISPUTE_REJECTED', disputeId: String(dispute._id), disputeNumber: dispute.disputeNumber },
    }).catch(warn('User notification failed'));
    await auditLog({ adminId: String(adminId), action: isResolved ? 'DISPUTE_RESOLVED' : 'DISPUTE_REJECTED', targetId: String(dispute._id), disputeNumber: dispute.disputeNumber, resolution, resolutionNote, timestamp: at });
    return resolved || disputes.findByIdOrNumber(String(dispute._id));
  }

  function reject({ disputeId, adminId, resolutionNote }) {
    return resolve({ disputeId, adminId, resolution: DISPUTE_RESOLUTION.REJECT_DISPUTE, resolutionNote: resolutionNote || DEFAULTS.REJECTION_NOTE });
  }

  return { logEvent, create, respondAsUser, cancelByUser, respondAsGarage, resolve, reject };
}

module.exports = { createDisputeCommandService, parseDisputedAmount, buildDisputeDoc };
