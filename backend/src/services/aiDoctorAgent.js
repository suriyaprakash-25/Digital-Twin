const { db } = require('../db');
const { ObjectId } = require('mongodb');
const { analyzeWithGroq } = require('./groqService');

async function handleDiagnosisRequest(userId, message, activeVehicleId, imageBase64) {
  let vehicleContext = 'No specific vehicle selected.';
  
  if (activeVehicleId) {
    try {
      const vehicle = await db.collection('vehicles').findOne({ _id: new ObjectId(activeVehicleId) });
      if (vehicle) {
        const services = await db.collection('serviceHistory').find({ vehicleId: new ObjectId(activeVehicleId) }).sort({ date: -1 }).limit(3).toArray();
        vehicleContext = `
Vehicle: ${vehicle.make} ${vehicle.model} (${vehicle.year})
Mileage: ${vehicle.currentMileage || 'Unknown'} km
Last Services: ${JSON.stringify(services)}
`;
      }
    } catch (e) { console.error('Error fetching vehicle for diagnosis:', e); }
  }

  const prompt = `
Analyze the following user complaint and vehicle context. Provide a professional vehicle diagnosis.
${vehicleContext}

User Complaint: "${message || 'See attached image/description.'}"

Respond EXACTLY with a JSON object in this structure (no markdown, just raw JSON):
{
  "possibleCauses": [
    { "title": "Cause 1", "description": "Details about this cause", "confidence": 90 }
  ],
  "urgency": "High",
  "estimatedRepairCost": "₹1500 - ₹2500",
  "recommendedAction": "Take immediate action steps",
  "preventiveTips": ["Tip 1", "Tip 2"]
}
`;

  try {
    const aiResponse = await analyzeWithGroq({
      systemInstruction: 'You are an AI Vehicle Doctor and automotive expert. Return ONLY valid JSON as requested. No extra text.',
      prompt: prompt
    });

    if (typeof aiResponse === 'object' && aiResponse.possibleCauses) {
      return {
        text: "I've analyzed your vehicle's symptoms. Here is my diagnosis.",
        type: 'diagnosis_card',
        payload: aiResponse
      };
    } else {
      return {
        text: typeof aiResponse === 'string' ? aiResponse : "Based on what you've shared, please describe the symptoms in more detail so I can provide a better diagnosis.",
        type: 'text'
      };
    }
  } catch (err) {
    console.error("Doctor Agent Error:", err);
    return {
      text: "I'm having trouble diagnosing that right now. Please try again.",
      type: 'text'
    };
  }
}

module.exports = { handleDiagnosisRequest };
