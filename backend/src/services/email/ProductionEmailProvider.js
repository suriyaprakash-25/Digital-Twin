const nodemailer = require('nodemailer');
const EmailProvider = require('./EmailProvider');

/**
 * Production SMTP / Nodemailer Email Provider
 */
class ProductionEmailProvider extends EmailProvider {
  constructor(smtpConfig = {}) {
    super('ProductionEmailProvider');
    this.fromEmail = smtpConfig.fromEmail || 'no-reply@driveportz.com';
    this.transporter = null;

    if (smtpConfig.host && smtpConfig.user && smtpConfig.pass && smtpConfig.user !== 'your-email@gmail.com') {
      this.transporter = nodemailer.createTransport({
        host: smtpConfig.host,
        port: Number(smtpConfig.port) || 587,
        secure: Number(smtpConfig.port) === 465,
        auth: {
          user: smtpConfig.user,
          pass: smtpConfig.pass
        },
        connectionTimeout: 5000,
        greetingTimeout: 5000,
        socketTimeout: 10000
      });
    }
  }

  async sendMail({ to, subject, text, html }) {
    if (!this.transporter) {
      console.warn('⚠️ [ProductionEmailProvider] SMTP credentials unconfigured. Falling back to log output.');
      return {
        success: true,
        messageId: `smtp_unconfigured_${Date.now()}`,
        provider: 'FallbackLogger'
      };
    }

    try {
      const info = await this.transporter.sendMail({
        from: this.fromEmail,
        to,
        subject,
        text,
        html
      });

      return {
        success: true,
        messageId: info.messageId,
        provider: this.name
      };
    } catch (error) {
      console.error('❌ [ProductionEmailProvider] Error dispatching mail:', error.message);
      throw new Error(`Email delivery failed: ${error.message}`);
    }
  }

  async verify() {
    if (!this.transporter) return false;
    try {
      await this.transporter.verify();
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = ProductionEmailProvider;
