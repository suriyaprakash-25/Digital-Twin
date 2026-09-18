const { getDb } = require('../db');

function normalizeDays(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 30;
  return Math.min(parsed, 365);
}

function asDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function inWindow(value, cutoff) {
  const date = asDate(value);
  return Boolean(date && date >= cutoff);
}

function percent(numerator, denominator) {
  if (!denominator) return 0;
  return Number(((numerator / denominator) * 100).toFixed(1));
}

async function getPilotAnalytics({ days = 30 } = {}, dbInstance) {
  const db = dbInstance || getDb();
  const periodDays = normalizeDays(days);
  const cutoff = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    newUsers,
    totalActiveGarages,
    bookings,
    payments,
    diagnoses,
    copilotMessages,
    errors,
    services,
    garages
  ] = await Promise.all([
    db.collection('users').countDocuments(),
    db.collection('users').countDocuments({ createdAt: { $gte: cutoff } }),
    db.collection('garages').countDocuments({ isActive: { $ne: false } }),
    db.collection('bookings').find({
      $or: [
        { createdAt: { $gte: cutoff } },
        { updatedAt: { $gte: cutoff } },
        { completedAt: { $gte: cutoff } }
      ]
    }).project({ status: 1, createdAt: 1, updatedAt: 1, completedAt: 1, garageId: 1 }).toArray(),
    db.collection('payments').find({ createdAt: { $gte: cutoff } })
      .project({ status: 1, createdAt: 1 }).toArray(),
    db.collection('diagnoses').countDocuments({ createdAt: { $gte: cutoff } }),
    db.collection('chat_history').countDocuments({ createdAt: { $gte: cutoff } }),
    db.collection('operational_error_events').countDocuments({
      timestamp: { $gte: cutoff },
      severity: 'ERROR'
    }),
    db.collection('services').find({
      $or: [
        { createdAt: { $gte: cutoff } },
        { updatedAt: { $gte: cutoff } },
        { serviceDate: { $gte: cutoff } }
      ]
    }).project({ garageId: 1, garageOwnerUserId: 1 }).toArray(),
    db.collection('garages').find({ isActive: { $ne: false } })
      .project({ name: 1, ownerUserId: 1 }).toArray()
  ]);

  const bookingsCreated = bookings.filter((booking) => inWindow(booking.createdAt, cutoff)).length;
  const completedBookings = bookings.filter((booking) => {
    if (String(booking.status || '').toUpperCase() !== 'COMPLETED') return false;
    return inWindow(booking.completedAt || booking.updatedAt || booking.createdAt, cutoff);
  });
  const bookingsCompleted = completedBookings.length;

  const paymentSuccess = payments.filter((payment) => String(payment.status || '').toUpperCase() === 'CAPTURED').length;
  const paymentFailed = payments.filter((payment) => String(payment.status || '').toUpperCase() === 'FAILED').length;
  const paymentAttempts = payments.length;

  const activeGarageIds = new Set();
  const garageBookingCounts = new Map();

  for (const booking of bookings) {
    if (!inWindow(booking.createdAt || booking.updatedAt || booking.completedAt, cutoff)) continue;
    if (!booking.garageId) continue;
    const id = String(booking.garageId);
    activeGarageIds.add(id);
    garageBookingCounts.set(id, (garageBookingCounts.get(id) || 0) + 1);
  }

  for (const service of services) {
    const id = service.garageId || service.garageOwnerUserId;
    if (id) activeGarageIds.add(String(id));
  }

  const garageNameById = new Map();
  for (const garage of garages) {
    garageNameById.set(String(garage._id), garage.name || 'Garage');
    if (garage.ownerUserId) garageNameById.set(String(garage.ownerUserId), garage.name || 'Garage');
  }

  const topGarages = [...garageBookingCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([garageId, bookingCount]) => ({
      garageId,
      name: garageNameById.get(garageId) || 'Garage',
      bookingCount
    }));

  return {
    generatedAt: new Date(),
    periodDays,
    cutoff,
    users: {
      total: totalUsers,
      new: newUsers
    },
    bookings: {
      created: bookingsCreated,
      completed: bookingsCompleted,
      conversionRate: percent(bookingsCompleted, bookingsCreated)
    },
    payments: {
      attempts: paymentAttempts,
      successful: paymentSuccess,
      failed: paymentFailed,
      successRate: percent(paymentSuccess, paymentAttempts)
    },
    ai: {
      vehicleDoctorUses: diagnoses,
      copilotMessages,
      totalUses: diagnoses + copilotMessages
    },
    reliability: {
      errors
    },
    garages: {
      totalActive: totalActiveGarages,
      activeInPeriod: activeGarageIds.size,
      activityRate: percent(activeGarageIds.size, totalActiveGarages),
      topGarages
    }
  };
}

module.exports = {
  normalizeDays,
  percent,
  getPilotAnalytics
};
