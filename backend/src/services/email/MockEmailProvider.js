const EmailProvider = require('./EmailProvider');

/**
 * Mock Email Provider for testing, staging, and local environments
 */
class MockEmailProvider extends EmailProvider {
  constructor() {
    super('MockEmailProvider');
    this.sentEmails = [];
  }

  /**
   * Records email in memory without sending externally
   */
  async sendMail({ to, subject, text, html }) {
    const messageId = `mock_mail_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const emailRecord = {
      messageId,
      to,
      subject,
      text,
      html,
      sentAt: new Date()
    };

    this.sentEmails.push(emailRecord);

    if (process.env.NODE_ENV !== 'test') {
      console.log(`📨 [MockEmailProvider] Email recorded to ${to} | Subject: "${subject}" | ID: ${messageId}`);
    }

    return {
      success: true,
      messageId,
      provider: this.name
    };
  }

  getSentEmails() {
    return [...this.sentEmails];
  }

  clearSentEmails() {
    this.sentEmails = [];
  }

  async verify() {
    return true;
  }
}

module.exports = MockEmailProvider;
