const { loadConfig } = require('../src/config');
const { connectToMongo } = require('../src/db');
const { sendEmail, getEmailProvider } = require('../src/services/emailService');
const { notifyUser } = require('../src/services/notifications');

const EXECUTE = process.argv.includes('--execute');
const CONFIRMED = process.env.PILOT_NOTIFICATION_CONFIRM === 'SEND_TEST_NOTIFICATION';
const email = String(process.env.PILOT_NOTIFICATION_TEST_EMAIL || '').trim();
const userId = String(process.env.PILOT_NOTIFICATION_TEST_USER_ID || '').trim();

async function main() {
  const provider = getEmailProvider();
  const preview = {
    mode: EXECUTE ? 'EXECUTE' : 'DRY_RUN',
    emailProvider: provider?.name || provider?.constructor?.name || 'unknown',
    targetEmailConfigured: Boolean(email),
    targetUserConfigured: Boolean(userId),
    firebasePushWillBeAttempted: Boolean(userId)
  };
  console.log(JSON.stringify(preview, null, 2));

  if (!EXECUTE) {
    console.log('\nDRY RUN ONLY. Set PILOT_NOTIFICATION_TEST_EMAIL and PILOT_NOTIFICATION_TEST_USER_ID, then use --execute with PILOT_NOTIFICATION_CONFIRM=SEND_TEST_NOTIFICATION.');
    return;
  }

  if (!CONFIRMED) {
    throw new Error('Execution blocked. Set PILOT_NOTIFICATION_CONFIRM=SEND_TEST_NOTIFICATION.');
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('PILOT_NOTIFICATION_TEST_EMAIL must be a valid pilot recipient.');
  }
  if (!userId) {
    throw new Error('PILOT_NOTIFICATION_TEST_USER_ID is required.');
  }

  const config = loadConfig();
  await connectToMongo(config);

  const emailResult = await sendEmail({
    to: email,
    subject: 'DrivePortz Pilot Notification Verification',
    text: 'This is a controlled DrivePortz pilot notification verification message. No action is required.',
    html: '<p>This is a controlled <strong>DrivePortz pilot notification verification</strong> message. No action is required.</p>'
  });

  const notificationResult = await notifyUser(userId, {
    title: 'DrivePortz Pilot Test',
    body: 'Notification delivery verification completed.',
    data: {
      type: 'PILOT_NOTIFICATION_VERIFICATION',
      timestamp: new Date().toISOString()
    }
  });

  console.log(JSON.stringify({
    email: {
      success: Boolean(emailResult?.success),
      provider: emailResult?.provider || null,
      messageId: emailResult?.messageId || null
    },
    inApp: {
      stored: Boolean(notificationResult?.stored),
      pushed: Boolean(notificationResult?.pushed),
      pushReason: notificationResult?.reason || null
    }
  }, null, 2));
}

main().catch((err) => {
  console.error('Pilot notification verification failed:', err.message || err);
  process.exit(1);
});
