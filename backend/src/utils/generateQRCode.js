const QRCode = require('qrcode');

/**
 * Generates a PNG Data URL (Base64) representing the given text.
 * @param {string} text The URL or content to generate QR for.
 * @returns {Promise<string>} Base64 Data URL.
 */
const generateQRCode = async (text) => {
  try {
    return await QRCode.toDataURL(text, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 300,
      color: {
        dark: '#0f172a',  // Slate-900 (matches theme)
        light: '#ffffff'
      }
    });
  } catch (err) {
    console.error('Error generating QR code:', err);
    throw err;
  }
};

module.exports = generateQRCode;
