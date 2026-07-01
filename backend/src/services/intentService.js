const intentMap = {
  vehicle: [
    'my vehicle', 'my vehicles', 'my car', 'my bike', 'passport', 'insurance', 'service history',
    'vehicle summary', 'fleet', 'registered', 'my fleet', 'show my', 'list my',
    'service record', 'maintenance history', 'repair history'
  ],
  marketplace: ['garage', 'garages', 'mechanic', 'repair shop', 'service center'],
  emergency: ['emergency', 'breakdown', 'flat tyre', 'accident', 'tow', 'help me'],
  diagnosis: [
    'diagnose', 'symptom', 'symptoms', 'issue', 'noise', 'vibrate', 'vibration',
    'leak', 'smoke', 'problem', 'warning light', 'dashboard light', 'engine light',
    'overheating', 'brake', 'squeaking', 'knocking', 'drains', 'mileage dropped'
  ],
  insights: ['insight', 'insights', 'analytics', 'cost trend', 'vehicle iq', 'iq score'],
  predictive: [
    'predict', 'predictive', 'upcoming maintenance', 'future maintenance',
    'when is my next', 'due for', 'next service', 'next oil change'
  ],
  reminder: ['remind', 'reminder', 'reminders', 'due soon', 'expiry', 'expiring', 'renewal']
};

const detectIntent = (message, imageBase64) => {
  if (imageBase64 && (!message || message.trim() === '')) {
    // An image uploaded without much text usually implies a diagnosis request
    return 'diagnosis';
  }

  if (!message) return 'knowledge';

  const lowerMessage = message.toLowerCase();

  for (const [intent, keywords] of Object.entries(intentMap)) {
    if (keywords.some(keyword => lowerMessage.includes(keyword))) {
      return intent;
    }
  }

  return 'knowledge'; // Default intent
};

module.exports = {
  detectIntent
};
