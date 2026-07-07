const nodemailer = require('nodemailer');
const { loadConfig } = require('../config');

const config = loadConfig();

let transporter = null;

if (config.smtp.user && config.smtp.pass && config.smtp.user !== 'your-email@gmail.com') {
  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass,
    },
  });
} else {
  console.warn('WARNING: SMTP credentials are not properly set or using placeholders. OTP emails will be logged instead of sent.');
}

/**
 * Sends an OTP email to the specified address.
 * @param {string} toEmail - The recipient's email address
 * @param {string} otp - The 6-digit OTP
 */
async function sendOtpEmail(toEmail, otp) {
  const mailOptions = {
    from: config.smtp.fromEmail,
    to: toEmail,
    subject: 'Password Reset Request',
    text: `Digital Twin\n\nPassword Reset Request\n\nHello,\n\nWe received a request to reset your password.\n\nYour OTP is:\n\n${otp}\n\nThis OTP is valid for 10 minutes.\n\nIf you did not request this, please ignore this email.\n\nDigital Twin Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h2 style="color: #0d9488; margin-bottom: 0;">Digital Twin</h2>
        <h3 style="margin-top: 5px; color: #475569;">Password Reset Request</h3>
        <p>Hello,</p>
        <p>We received a request to reset your password.</p>
        <p>Your OTP is:</p>
        <div style="font-size: 24px; font-weight: bold; letter-spacing: 4px; padding: 15px; background: #f8fafc; border: 1px solid #e2e8f0; display: inline-block; margin: 10px 0;">
          ${otp}
        </div>
        <p>This OTP is valid for 10 minutes.</p>
        <p>If you did not request this, please ignore this email.</p>
        <p>Digital Twin Team</p>
      </div>
    `,
  };

  if (!transporter) {
    console.log('\n=============================================');
    console.log('MOCK EMAIL SENT (SMTP not configured)');
    console.log(`To: ${toEmail}`);
    console.log(`OTP: ${otp}`);
    console.log('=============================================\n');
    return true; // Pretend it succeeded
  }

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('OTP email sent: %s', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending OTP email:', error);
    throw new Error('Failed to send email');
  }
}

module.exports = {
  sendOtpEmail,
};
