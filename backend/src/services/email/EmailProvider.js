/**
 * Base Abstract Email Provider Interface
 */
class EmailProvider {
  constructor(name = 'AbstractEmailProvider') {
    this.name = name;
  }

  /**
   * Sends an email
   * @param {Object} options
   * @param {string} options.to
   * @param {string} options.subject
   * @param {string} options.text
   * @param {string} [options.html]
   * @returns {Promise<{ success: boolean, messageId: string }>}
   */
  async sendMail({ to, subject, text, html }) {
    throw new Error('sendMail must be implemented by concrete EmailProvider subclass');
  }

  /**
   * Health check for email provider
   * @returns {Promise<boolean>}
   */
  async verify() {
    return true;
  }
}

module.exports = EmailProvider;
