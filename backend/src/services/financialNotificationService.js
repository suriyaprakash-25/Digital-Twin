const { ObjectId } = require('mongodb');
const { getDb } = require('../db');
const { notifyUser } = require('./notifications');
const { sendFinancialEmail, sendEmail } = require('./emailService');
const { sendSms } = require('./smsService');
const { maskValue } = require('../security/sanitizeLog');

const FINANCIAL_NOTIFICATION_EVENTS = {
  PAYMENT_SUCCESS: 'PAYMENT_SUCCESS',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  INVOICE_FINALIZED: 'INVOICE_FINALIZED',
  REFUND_REQUESTED: 'REFUND_REQUESTED',
  REFUND_COMPLETED: 'REFUND_COMPLETED',
  REFUND_FAILED: 'REFUND_FAILED',
  DISPUTE_CREATED: 'DISPUTE_CREATED',
  DISPUTE_UPDATED: 'DISPUTE_UPDATED',
  DISPUTE_RESOLVED: 'DISPUTE_RESOLVED',
  SETTLEMENT_REQUESTED: 'SETTLEMENT_REQUESTED',
  SETTLEMENT_APPROVED: 'SETTLEMENT_APPROVED',
  SETTLEMENT_REJECTED: 'SETTLEMENT_REJECTED',
  SETTLEMENT_PROCESSING: 'SETTLEMENT_PROCESSING',
  SETTLEMENT_SETTLED: 'SETTLEMENT_SETTLED',
  SETTLEMENT_FAILED: 'SETTLEMENT_FAILED',
  SETTLEMENT_RETRY: 'SETTLEMENT_RETRY',
  SETTLEMENT_HOLD: 'SETTLEMENT_HOLD',
  RISK_ALERT: 'RISK_ALERT',
  FINANCIAL_ALERT: 'FINANCIAL_ALERT',
  TAX_DOCUMENT_AVAILABLE: 'TAX_DOCUMENT_AVAILABLE',
  CREDIT_NOTE_CREATED: 'CREDIT_NOTE_CREATED'
};

const CRITICAL_EVENTS = [
  FINANCIAL_NOTIFICATION_EVENTS.PAYMENT_FAILED,
  FINANCIAL_NOTIFICATION_EVENTS.SETTLEMENT_FAILED,
  FINANCIAL_NOTIFICATION_EVENTS.SETTLEMENT_HOLD,
  FINANCIAL_NOTIFICATION_EVENTS.RISK_ALERT,
  FINANCIAL_NOTIFICATION_EVENTS.FINANCIAL_ALERT
];

/**
 * Ensures indexes for notification_preferences and notifications
 */
async function ensureFinancialNotificationIndexes(dbInstance) {
  const db = dbInstance || getDb();
  if (!db) return;

  try {
    const preferences = db.collection('notification_preferences');
    await preferences.createIndex({ recipientId: 1, recipientType: 1 }, { unique: true });

    const notifications = db.collection('notifications');
    await notifications.createIndex({ userId: 1, createdAt: -1 });
    await notifications.createIndex({ type: 1, createdAt: -1 });
  } catch (err) {
    console.warn('Notification indexes notice:', err.message);
  }
}

/**
 * Gets or initializes user/garage notification preferences
 */
async function getNotificationPreferences(recipientId, recipientType = 'USER', dbInstance) {
  const db = dbInstance || getDb();
  if (!db) return null;

  const preferences = db.collection('notification_preferences');
  let pref = await preferences.findOne({ recipientId: String(recipientId), recipientType });

  if (!pref) {
    pref = {
      recipientId: String(recipientId),
      recipientType,
      inAppEnabled: true,
      emailEnabled: true,
      smsEnabled: false,
      eventPreferences: {},
      criticalAlwaysOn: true,
      updatedAt: new Date()
    };
    await preferences.insertOne(pref);
  }

  return pref;
}

/**
 * Updates user/garage notification preferences
 */
async function updateNotificationPreferences(recipientId, { inAppEnabled, emailEnabled, smsEnabled, eventPreferences }, recipientType = 'USER', dbInstance) {
  const db = dbInstance || getDb();
  if (!db) return null;

  const preferences = db.collection('notification_preferences');
  const updateData = {
    criticalAlwaysOn: true, // Non-negotiable for critical alerts
    updatedAt: new Date()
  };

  if (typeof inAppEnabled === 'boolean') updateData.inAppEnabled = inAppEnabled;
  if (typeof emailEnabled === 'boolean') updateData.emailEnabled = emailEnabled;
  if (typeof smsEnabled === 'boolean') updateData.smsEnabled = smsEnabled;
  if (eventPreferences && typeof eventPreferences === 'object') updateData.eventPreferences = eventPreferences;

  await preferences.updateOne(
    { recipientId: String(recipientId), recipientType },
    { $set: updateData },
    { upsert: true }
  );

  return await getNotificationPreferences(recipientId, recipientType, db);
}

/**
 * Dispatches a financial notification across eligible channels
 */
async function dispatchFinancialNotification({
  recipientId,
  recipientType = 'USER',
  recipientEmail = null,
  recipientPhone = null,
  recipientName = 'User',
  event,
  title,
  body,
  data = {},
  emailTemplate = null,
  emailData = null,
  dbInstance
}) {
  const db = dbInstance || getDb();
  const isCritical = CRITICAL_EVENTS.includes(event);
  const prefs = await getNotificationPreferences(recipientId, recipientType, db);

  const results = {
    inApp: false,
    email: false,
    sms: false
  };

  // 1. In-App Notification (Always enabled for critical, or if inAppEnabled !== false)
  if (isCritical || (prefs && prefs.inAppEnabled !== false)) {
    try {
      await notifyUser(recipientId, {
        title,
        body,
        data: {
          ...data,
          type: event,
          isCritical
        }
      });
      results.inApp = true;
    } catch (err) {
      console.warn('Error sending in-app notification:', err.message);
    }
  }

  // 2. Email Notification
  if (recipientEmail && (isCritical || (prefs && prefs.emailEnabled !== false))) {
    try {
      if (emailTemplate) {
        await sendFinancialEmail({
          to: recipientEmail,
          templateName: emailTemplate,
          data: emailData || { customerName: recipientName, ...data }
        });
      } else {
        await sendEmail({
          to: recipientEmail,
          subject: title,
          text: `${title}\n\n${body}`,
          html: `<div style="font-family: Arial, sans-serif; padding: 20px;"><h3>${title}</h3><p>${body}</p></div>`
        });
      }
      results.email = true;
    } catch (err) {
      console.warn('Error sending financial email:', err.message);
    }
  }

  // 3. SMS Notification (Only if enabled and phone provided)
  if (recipientPhone && (prefs && prefs.smsEnabled === true)) {
    try {
      await sendSms({
        to: recipientPhone,
        message: `[DrivePortz] ${title}: ${body}`
      });
      results.sms = true;
    } catch (err) {
      console.warn('Error sending financial SMS:', err.message);
    }
  }

  return {
    success: true,
    event,
    dispatchedChannels: results
  };
}

module.exports = {
  FINANCIAL_NOTIFICATION_EVENTS,
  CRITICAL_EVENTS,
  ensureFinancialNotificationIndexes,
  getNotificationPreferences,
  updateNotificationPreferences,
  dispatchFinancialNotification
};
