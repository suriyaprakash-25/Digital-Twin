/**
 * Composition root for the booking module (routes/bookings.js). Wires repositories, the capacity
 * guard and the notification channels into the booking service. Tests pass fakes instead.
 */
const { notifyUser: defaultNotifyUser } = require('../notifications');
const { createBookingService } = require('./bookingService');
const { createBookingNotifier } = require('./bookingNotifications');
const { createCapacityGuard } = require('./capacityGuard');

// Lazy: the email/SMS modules read provider config on load.
const defaultSendEmail = (...args) => require('../emailService').sendEmail(...args);
const defaultSendSms = (...args) => require('../smsService').sendSms(...args);

/**
 * @param {{ repos: ReturnType<import('../../repositories').createRepositories>, notifyUser?: Function,
 *           sendEmail?: Function, sendSms?: Function, now?: () => Date, capacity?: object, notifier?: object }} deps
 */
function createBookingServices({ repos, notifyUser = defaultNotifyUser, sendEmail = defaultSendEmail, sendSms = defaultSendSms, now, capacity, notifier }) {
  return {
    bookings: createBookingService({
      repos,
      now,
      capacity: capacity || createCapacityGuard({ repos, now }),
      notifier: notifier || createBookingNotifier({ repos, notifyUser, sendEmail, sendSms }),
    }),
  };
}

module.exports = { createBookingServices };
