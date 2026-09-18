const { loadConfig } = require('../src/config');
const { connectToMongo } = require('../src/db');
const { sendOtpEmail, getEmailProvider } = require('../src/services/emailService');
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

  const emailResult = await sendOtpEmail(email, process.env.PILOT_NOTIFICATION_TEST_OTP || '654321');

  const notificationScenarios = [
    {
      title: 'Booking Accepted',
      body: 'Pilot notification check: your garage booking was accepted.',
      data: { type: 'BOOKING_ACCEPTED' }
    },
    {
      title: 'Service Completed',
      body: 'Pilot notification check: your vehicle service is complete.',
      data: { type: 'SERVICE_COMPLETED' }
    },
    {
      title: 'Payment Received',
      body: 'Pilot notification check: your payment was recorded successfully.',
      data: { type: 'PAYMENT_SUCCESS' }
    }
  ];

  const notificationResults = [];
  for (const scenario of notificationScenarios) {
    notificationResults.push(await notifyUser(userId, {
      ...scenario,
      data: { ...scenario.data, pilotVerification: 'true', timestamp: new Date().toISOString() }
    }));
  }

  console.log(JSON.stringify({
    otpEmail: {
      success: Boolean(emailResult?.success),
      provider: emailResult?.provider || null,
      messageId: emailResult?.messageId || null
    },
    notifications: notificationResults.map((result, index) => ({
      type: notificationScenarios[index].data.type,
      stored: Boolean(result?.stored),
      pushed: Boolean(result?.pushed),
      pushReason: result?.reason || null
    }))
  }, null, 2));
}

main().catch((err) => {
  console.error('Pilot notification verification failed:', err.message || err);
  process.exit(1);
});
