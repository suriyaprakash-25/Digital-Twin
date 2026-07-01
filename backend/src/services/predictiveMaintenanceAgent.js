const { db } = require('../db');
const { ObjectId } = require('mongodb');
const { analyzeWithGroq } = require('./groqService');

async function handlePredictiveRequest(userId, message, activeVehicleId) {
  let vehicleContext = 'No specific vehicle selected.';
  
  if (activeVehicleId) {
    try {
      const vehicle = await db.collection('vehicles').findOne({ _id: new ObjectId(activeVehicleId) });
      if (vehicle) {
        const services = await db.collection('serviceHistory').find({ vehicleId: new ObjectId(activeVehicleId) }).sort({ date: -1 }).toArray();
        vehicleContext = `
Vehicle: ${vehicle.make} ${vehicle.model} (${vehicle.year})
Mileage: ${vehicle.currentMileage || 0} km
Past Services: ${JSON.stringify(services.slice(0, 5))}
`;
      }
    } catch (e) { console.error('Error fetching vehicle for predictive:', e); }
  }

  const prompt = `
Analyze the following vehicle context and predict upcoming maintenance needs based on standard automotive maintenance schedules (oil change every 5k-10k km, tires every 40k km, etc).
${vehicleContext}

User Query: "${message}"

Respond EXACTLY with a JSON object (no markdown, just raw JSON):
{
  "predictions": [
    { "component": "Engine Oil", "estimatedTime": "1800 km", "urgency": "Medium", "reason": "Last changed at 45,000 km." }
  ],
  "summary": "Overall maintenance outlook."
}
`;

  try {
    const aiResponse = await analyzeWithGroq({
      systemInstruction: 'You are an AI Predictive Maintenance Expert. Return ONLY valid JSON.',
      prompt: prompt
    });

    if (typeof aiResponse === 'object' && aiResponse.predictions) {
      return {
        text: "Here is your predictive maintenance schedule.",
        type: 'prediction_card',
        payload: aiResponse
      };
    } else {
      return { text: "I couldn't predict maintenance accurately. Can you update your current mileage?", type: 'text' };
    }
  } catch (err) {
    console.error("Predictive Agent Error:", err);
    return { text: "Failed to generate predictions. Please try again.", type: 'text' };
  }
}

module.exports = { handlePredictiveRequest };
