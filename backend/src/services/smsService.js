const axios = require('axios');
const { sendEmail } = require('./emailService');

/**
 * Sends an SMS to a phone number.
 * Defaults to free carrier Email-to-SMS or mock console logging.
 * Uses Twilio if configured in environment variables.
 * 
 * @param {string} toPhone - Recipient phone number (e.g. +1234567890)
 * @param {string} message - SMS message body
 */
async function sendSms(toPhone, message) {
  if (!toPhone) {
    console.warn('SMS Warning: No recipient phone number provided.');
    return false;
  }

  const cleanPhone = String(toPhone).replace(/\D/g, '');

  // 1. Check for Twilio Credentials
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (accountSid && authToken && fromNumber) {
    try {
      const authHeader = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
      const params = new URLSearchParams();
      params.append('To', toPhone);
      params.append('From', fromNumber);
      params.append('Body', message);

      const response = await axios.post(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        params.toString(),
        {
          headers: {
            'Authorization': `Basic ${authHeader}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      console.log(`Twilio SMS dispatched successfully. SID: ${response.data.sid}`);
      return true;
    } catch (err) {
      console.error('Twilio SMS sending failed:', err.response ? err.response.data : err.message);
      // Fall through to other options
    }
  }

  // 2. Carrier Email-to-SMS Gateway (Free Option)
  // If a DEFAULT_CARRIER_DOMAIN is set, we send it via Nodemailer to cleanPhone@domain
  const carrierDomain = process.env.DEFAULT_CARRIER_DOMAIN;
  if (carrierDomain && cleanPhone.length >= 10) {
    const emailToSmsAddress = `${cleanPhone.slice(-10)}@${carrierDomain}`;
    try {
      await sendEmail({
        to: emailToSmsAddress,
        subject: '', // SMS gateways typically ignore the subject line
        text: message
      });
      console.log(`Carrier Email-to-SMS sent successfully to: ${emailToSmsAddress}`);
      return true;
    } catch (err) {
      console.error('Carrier Email-to-SMS dispatch failed:', err.message);
    }
  }

  // 3. Fallback / Local Development (Zero Cost Mock Console Log)
  console.log('\n=============================================');
  console.log('MOCK SMS DISPATCHED (Zero Cost Mode)');
  console.log(`Recipient Phone: ${toPhone} (Clean: ${cleanPhone})`);
  console.log(`Message: "${message}"`);
  console.log('To send live SMS, set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,');
  console.log('and TWILIO_PHONE_NUMBER in backend/.env, or set');
  console.log('DEFAULT_CARRIER_DOMAIN to use carrier email-to-sms.');
  console.log('=============================================\n');
  return true;
}

module.exports = {
  sendSms
};
