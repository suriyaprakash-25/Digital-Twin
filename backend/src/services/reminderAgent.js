const { db } = require('../db');
const { ObjectId } = require('mongodb');
const { analyzeWithGroq } = require('./groqService');

async function handleReminderRequest(userId, message, activeVehicleId) {
  let vehicleContext = 'No specific vehicle selected.';
  
  if (activeVehicleId) {
    try {
      const vehicle = await db.collection('vehicles').findOne({ _id: new ObjectId(activeVehicleId) });
      if (vehicle) {
        const insurances = await db.collection('insurance').find({ vehicleId: new ObjectId(activeVehicleId) }).sort({ expiryDate: -1 }).limit(1).toArray();
        vehicleContext = `
Vehicle: ${vehicle.make} ${vehicle.model}
Current Insurance Expiry: ${insurances.length > 0 ? insurances[0].expiryDate : 'Unknown'}
Current Date: ${new Date().toISOString().split('T')[0]}
`;
      }
    } catch (e) { console.error('Error fetching vehicle for reminders:', e); }
  }

  const prompt = `
Analyze the following vehicle context and identify active reminders (e.g., insurance expiry, PUC renewal, service due).
${vehicleContext}

User Query: "${message}"

Respond EXACTLY with a JSON object (no markdown, just raw JSON):
{
  "reminders": [
    { "type": "Insurance Renewal", "dueDate": "2025-12-01", "daysLeft": 15, "priority": "High" }
  ]
}
`;

  try {
    const aiResponse = await analyzeWithGroq({
      systemInstruction: 'You are an AI Reminder Assistant for vehicle maintenance. Return ONLY valid JSON.',
      prompt: prompt
    });

    if (typeof aiResponse === 'object' && aiResponse.reminders) {
      return {
        text: "Here are your upcoming reminders.",
        type: 'reminder_card',
        payload: aiResponse
      };
    } else {
      return { text: "No immediate reminders found.", type: 'text' };
    }
  } catch (err) {
    console.error("Reminder Agent Error:", err);
    return { text: "Failed to fetch reminders. Please try again.", type: 'text' };
  }
}

module.exports = { handleReminderRequest };
