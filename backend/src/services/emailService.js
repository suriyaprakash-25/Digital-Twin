const { loadConfig } = require('../config');
const MockEmailProvider = require('./email/MockEmailProvider');
const ProductionEmailProvider = require('./email/ProductionEmailProvider');
const templates = require('./email/templates');

const config = loadConfig();

let currentProvider = null;

function getEmailProvider() {
  if (currentProvider) return currentProvider;

  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProd = nodeEnv === 'production';

  if (isProd && config.smtp?.host && config.smtp?.user && config.smtp.user !== 'your-email@gmail.com') {
    currentProvider = new ProductionEmailProvider(config.smtp);
  } else {
    currentProvider = new MockEmailProvider();
  }

  return currentProvider;
}

function setEmailProvider(providerInstance) {
  currentProvider = providerInstance;
}

/**
 * Sends an OTP email to the specified address.
 */
async function sendOtpEmail(toEmail, otp) {
  const provider = getEmailProvider();
  const subject = 'Password Reset Request';
  const text = `Digital Twin\n\nPassword Reset Request\n\nHello,\n\nWe received a request to reset your password.\n\nYour OTP is:\n\n${otp}\n\nThis OTP is valid for 10 minutes.\n\nIf you did not request this, please ignore this email.\n\nDriveportz Team`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <h2 style="color: #0d9488; margin-bottom: 0;">DrivePortz</h2>
      <h3 style="margin-top: 5px; color: #475569;">Password Reset Request</h3>
      <p>Hello,</p>
      <p>We received a request to reset your password.</p>
      <p>Your OTP is:</p>
      <div style="font-size: 24px; font-weight: bold; letter-spacing: 4px; padding: 15px; background: #f8fafc; border: 1px solid #e2e8f0; display: inline-block; margin: 10px 0;">
        ${otp}
      </div>
      <p>This OTP is valid for 10 minutes.</p>
      <p>If you did not request this, please ignore this email.</p>
      <p>Driveportz Team</p>
    </div>
  `;

  return await provider.sendMail({ to: toEmail, subject, text, html });
}

/**
 * Generic email sender
 */
async function sendEmail({ to, subject, text, html }) {
  const provider = getEmailProvider();
  return await provider.sendMail({ to, subject, text, html });
}

/**
 * High-level financial email dispatcher using pre-built templates
 */
async function sendFinancialEmail({ to, templateName, data }) {
  const templateFn = templates[templateName];
  if (!templateFn) {
    throw new Error(`Unknown financial email template: ${templateName}`);
  }

  const { subject, html, text } = templateFn(data);
  return await sendEmail({ to, subject, text, html });
}

module.exports = {
  getEmailProvider,
  setEmailProvider,
  sendOtpEmail,
  sendEmail,
  sendFinancialEmail,
  templates
};
