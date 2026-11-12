/**
 * Booking notifications (push + garage-owner email/SMS). Every channel is best-effort: a failed
 * notification is logged and never fails or rolls back the booking write that triggered it.
 *
 * All user-controlled text (names, notes, issue details) is HTML-escaped before it goes into the
 * email body; previously it was interpolated raw, so a customer could inject markup into the
 * garage owner's inbox.
 */
const { DEFAULT_NAMES, NOTIFICATION_TYPES } = require('./constants');

const HTML_ESCAPES = Object.freeze({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' });
const escapeHtml = (value) => String(value === undefined || value === null ? '' : value).replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);

const warn = (label) => (err) => console.warn(`${label}:`, err && err.message ? err.message : err);

/** Plain-data view of a new booking used by every channel. */
function requestDetails({ booking, garage, vehicle, service, customer }) {
  return {
    bookingId: String(booking._id),
    garageName: garage.name,
    customerName: customer.name || DEFAULT_NAMES.OWNER,
    customerEmail: customer.email || 'N/A',
    customerPhone: customer.phone || 'N/A',
    vehicleLabel: `${vehicle.brand || ''} ${vehicle.model || ''} (${vehicle.vehicleNumber || 'N/A'})`.trim(),
    vehicleNumber: vehicle.vehicleNumber,
    serviceTitle: service.title,
    price: service.price,
    scheduledLabel: booking.scheduledFor ? booking.scheduledFor.toLocaleString() : 'As soon as possible',
    notes: booking.notes || 'None',
    issueDetails: booking.isCustomIssue ? service.issueDetails : null,
  };
}

function requestEmailText(d) {
  return `New booking request at ${d.garageName}!\n\n`
    + `Customer: ${d.customerName}\nEmail: ${d.customerEmail}\nPhone: ${d.customerPhone}\n`
    + `Vehicle: ${d.vehicleLabel}\nService: ${d.serviceTitle}\nScheduled: ${d.scheduledLabel}\nNotes: ${d.notes}\n\n`
    + 'Please log in to your dashboard to review this booking request.';
}

function requestEmailHtml(d, ownerName) {
  const row = (label, value) => `<tr><td style="padding: 6px 0; font-weight: bold; width: 35%;">${escapeHtml(label)}:</td><td style="padding: 6px 0;">${escapeHtml(value)}</td></tr>`;
  const issueRows = d.issueDetails
    ? row('Problem Description', d.issueDetails.description) + row('Problem Duration', d.issueDetails.duration) + row('Impact', d.issueDetails.urgency)
    : '';
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.6;">
      <h2 style="color: #0d9488; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">New Booking Request</h2>
      <p>Hello <strong>${escapeHtml(ownerName || DEFAULT_NAMES.GARAGE_OWNER)}</strong>,</p>
      <p>You have received a new booking request for your garage, <strong>${escapeHtml(d.garageName)}</strong>.</p>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 15px; margin: 15px 0;">
        <h3 style="margin-top: 0; color: #475569;">Request Details:</h3>
        <table style="width: 100%; border-collapse: collapse;">
          ${row('Customer', d.customerName)}${row('Phone', d.customerPhone)}${row('Email', d.customerEmail)}
          ${row('Vehicle', d.vehicleLabel)}${row('Service', d.serviceTitle)}${row('Price', `₹${d.price}`)}
          ${row('Scheduled For', d.scheduledLabel)}${row('Notes', d.notes)}${issueRows}
        </table>
      </div>
      <p>Please log in to your dashboard to review and accept/reject this request.</p>
      <p style="margin-top: 25px; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 10px;">This is an automated notification from DrivePortz.</p>
    </div>`;
}

/**
 * @param {{ repos: object, notifyUser: Function, sendEmail: Function, sendSms: Function,
 *           defer?: (fn: Function) => void }} deps
 */
function createBookingNotifier({ repos, notifyUser, sendEmail, sendSms, defer = setImmediate }) {
  async function notifyGarageOwner(garage, d) {
    await notifyUser(String(garage.ownerUserId), {
      title: 'New booking request',
      body: `${d.vehicleNumber || 'A vehicle'} requested: ${d.serviceTitle}`,
      data: { type: NOTIFICATION_TYPES.REQUEST, bookingId: d.bookingId },
    }).catch(warn('Booking push to garage owner failed'));

    const owner = await repos.users.findById(garage.ownerUserId, { projection: { name: 1, email: 1, phone: 1 } });
    if (!owner) return;
    if (owner.email) {
      await sendEmail({ to: owner.email, subject: `New Booking Request - ${d.garageName}`, text: requestEmailText(d), html: requestEmailHtml(d, owner.name) })
        .catch(warn('Booking email dispatch failed'));
    }
    if (owner.phone) {
      const sms = `New booking request at ${d.garageName}! Customer ${d.customerName} requested ${d.serviceTitle} for ${d.vehicleLabel} on ${d.scheduledLabel}. Log in to view.`;
      await sendSms(owner.phone, sms).catch(warn('Booking SMS dispatch failed'));
    }
  }

  /** Fire-and-forget: runs after the HTTP response, exactly like the original setImmediate block. */
  function bookingRequested({ booking, garage, vehicle, service, customer }) {
    const d = requestDetails({ booking, garage, vehicle, service, customer });
    defer(async () => {
      try {
        if (garage.ownerUserId) await notifyGarageOwner(garage, d).catch(warn('Garage owner notification failed'));
        await notifyUser(String(booking.userId), {
          title: 'Booking requested',
          body: `Your booking request for ${d.serviceTitle} at ${d.garageName} has been sent.`,
          data: { type: NOTIFICATION_TYPES.REQUEST, bookingId: d.bookingId },
        }).catch(warn('User booking notification failed'));
      } catch (err) {
        warn('Background booking notification error')(err);
      }
    });
  }

  /** Status change by the garage → the owner. */
  function statusChanged(booking, status, { title = 'Booking update', body } = {}) {
    if (!booking.userId) return Promise.resolve();
    const serviceTitle = booking.snapshots && booking.snapshots.service && booking.snapshots.service.title;
    const vehicleNumber = booking.snapshots && booking.snapshots.vehicle && booking.snapshots.vehicle.vehicleNumber;
    return notifyUser(String(booking.userId), {
      title,
      body: body || `${serviceTitle || 'Service'} for ${vehicleNumber || 'your vehicle'} is now ${status.replace('_', ' ')}`,
      data: { type: NOTIFICATION_TYPES.UPDATE, bookingId: String(booking._id), status },
    }).catch(warn('Booking status notification failed'));
  }

  /** Owner action (info provided / cancelled) → the garage owner. */
  async function notifyGarageOfOwnerAction(booking, status, { title, body }) {
    const garage = await repos.garages.findById(booking.garageId);
    if (!garage || !garage.ownerUserId) return;
    await notifyUser(String(garage.ownerUserId), {
      title,
      body,
      data: { type: NOTIFICATION_TYPES.UPDATE, bookingId: String(booking._id), status },
    }).catch(warn('Garage booking notification failed'));
  }

  return { bookingRequested, statusChanged, notifyGarageOfOwnerAction };
}

module.exports = { createBookingNotifier, escapeHtml, requestEmailHtml, requestDetails };
