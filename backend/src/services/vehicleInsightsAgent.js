const { db } = require('../db');
const { ObjectId } = require('mongodb');
const { analyzeWithGroq } = require('./groqService');

async function handleInsightsRequest(userId, message, activeVehicleId) {
  let vehicleContext = 'No specific vehicle selected.';
  
  if (activeVehicleId) {
    try {
      const vehicle = await db.collection('vehicles').findOne({ _id: new ObjectId(activeVehicleId) });
      if (vehicle) {
        const services = await db.collection('serviceHistory').find({ vehicleId: new ObjectId(activeVehicleId) }).toArray();
        const totalCost = services.reduce((acc, s) => acc + (Number(s.cost) || 0), 0);
        vehicleContext = `
Vehicle: ${vehicle.make} ${vehicle.model} (${vehicle.year})
Vehicle IQ: ${vehicle.vehicleIQ || 'N/A'}/100
Total Lifetime Service Cost: ₹${totalCost}
Total Services Logged: ${services.length}
`;
      }
    } catch (e) { console.error('Error fetching vehicle for insights:', e); }
  }

  const prompt = `
Analyze the following vehicle context and provide 3 actionable, data-driven insights.
${vehicleContext}

User Query: "${message}"

Respond EXACTLY with a JSON object (no markdown, just raw JSON):
{
  "insights": [
    { "title": "Maintenance Cost", "description": "You have spent ₹5000 this year on maintenance.", "trend": "up" }
  ],
  "iqSummary": "Your Vehicle IQ is stable."
}
`;

  try {
    const aiResponse = await analyzeWithGroq({
      systemInstruction: 'You are an AI Vehicle Data Analyst. Return ONLY valid JSON.',
      prompt: prompt
    });

    if (typeof aiResponse === 'object' && aiResponse.insights) {
      return {
        text: "Here are some AI-powered insights about your vehicle.",
        type: 'insight_card',
        payload: aiResponse
      };
    } else {
      return { text: "I couldn't generate insights right now. Please try again.", type: 'text' };
    }
  } catch (err) {
    console.error("Insights Agent Error:", err);
    return { text: "Failed to generate insights. Please try again.", type: 'text' };
  }
}

module.exports = { handleInsightsRequest };
