/**
 * Atomic capacity enforcement for a garage's active bookings (ACCEPTED + IN_PROGRESS).
 *
 * The old code counted active bookings and then wrote, with nothing in between, and only at request
 * time: accepting never checked capacity at all, and two concurrent accepts could both take the last
 * slot. Here the count and the capacity-consuming write run while holding a per-garage lease
 * (GarageRepository.acquireCapacityLock), so they are serialised per garage even on a standalone
 * mongod without transactions. Leases expire, so a crashed instance cannot block a garage forever.
 */
const crypto = require('crypto');
const { ConflictError } = require('../../core/errors');
const { CAPACITY, MSG } = require('./constants');
const { ACTIVE_STATUSES } = require('./bookingStateMachine');

const defaultSleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

/** The garage's configured capacity (legacy profiles without the field get the platform default). */
const maxCapacityOf = (garage) => (garage && garage.maxCapacity !== undefined && garage.maxCapacity !== null ? Number(garage.maxCapacity) : CAPACITY.DEFAULT_MAX);

class CapacityExceededError extends ConflictError {
  constructor(message = MSG.CAPACITY_FULL) {
    super(message, 'GARAGE_CAPACITY_FULL');
  }
}

function createCapacityGuard({ repos, now = () => new Date(), sleep = defaultSleep, settings = CAPACITY, newToken = () => crypto.randomBytes(12).toString('hex') }) {
  const { garages, bookings } = repos;

  const countActive = (garageId) => bookings.countForGarageInStatuses(garageId, ACTIVE_STATUSES);

  /** Advisory check used when an owner requests a booking (a request does not take a slot yet). */
  async function hasFreeSlot(garage) {
    return (await countActive(garage._id)) < maxCapacityOf(garage);
  }

  async function acquire(garageId, token) {
    for (let attempt = 1; attempt <= settings.LOCK_MAX_ATTEMPTS; attempt += 1) {
      const locked = await garages.acquireCapacityLock(garageId, { token, now: now(), ttlMs: settings.LOCK_TTL_MS });
      if (locked) return locked;
      if (attempt < settings.LOCK_MAX_ATTEMPTS) await sleep(settings.LOCK_RETRY_DELAY_MS);
    }
    throw new ConflictError(MSG.CAPACITY_BUSY, 'GARAGE_CAPACITY_BUSY');
  }

  /**
   * Runs `work` only if the garage has a free slot, with no other capacity-consuming write for the
   * same garage in between. Capacity is re-read from the locked garage document.
   */
  async function withReservedSlot(garage, work) {
    const token = newToken();
    const locked = await acquire(garage._id, token);
    try {
      if ((await countActive(garage._id)) >= maxCapacityOf(locked)) throw new CapacityExceededError();
      return await work();
    } finally {
      await garages.releaseCapacityLock(garage._id, token).catch((err) => console.warn('Capacity lock release failed:', err.message));
    }
  }

  return { hasFreeSlot, withReservedSlot };
}

module.exports = { createCapacityGuard, CapacityExceededError, maxCapacityOf };
