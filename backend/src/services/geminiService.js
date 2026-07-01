const { GoogleGenerativeAI } = require('@google/generative-ai');
const { loadConfig } = require('../config');

const config = loadConfig();

let genAI = null;
if (config.geminiApiKey) {
  genAI = new GoogleGenerativeAI(config.geminiApiKey);
} else {
  console.warn('WARNING: GEMINI_API_KEY is not set. AI Features will fail.');
}

async function analyzeWithGemini({ systemInstruction, prompt, imageBase64 }) {
  if (!genAI) {
    throw new Error('Gemini API key is not configured.');
  }

  const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.0-flash-lite',
    systemInstruction: systemInstruction 
  });

  const contentParts = [{ text: prompt }];

  if (imageBase64) {
    const mimeType = imageBase64.split(';')[0].split(':')[1];
    const base64Data = imageBase64.split(',')[1];
    contentParts.push({
      inlineData: { data: base64Data, mimeType: mimeType }
    });
  }

  try {
    const result = await model.generateContent(contentParts);
    const responseText = result.response.text();
    
    let cleanText = responseText.trim();
    if (cleanText.startsWith('```json')) cleanText = cleanText.substring(7);
    if (cleanText.startsWith('```')) cleanText = cleanText.substring(3);
    if (cleanText.endsWith('```')) cleanText = cleanText.substring(0, cleanText.length - 3);

    try {
      return JSON.parse(cleanText.trim());
    } catch (e) {
      return cleanText;
    }
  } catch (error) {
    console.error('Error in geminiService:', error.message);
    // Re-throw with a user-friendly message
    if (error.status === 429) {
      throw new Error('AI quota exceeded. Please wait a moment and try again.');
    }
    throw new Error('Failed to analyze with AI.');
  }
}

// Keep the old function for backward compatibility with PRD-1 if needed
async function analyzeVehicleSymptoms(diagnosisInput) {
  const prompt = `
INPUT DATA:
Vehicle: ${diagnosisInput.vehicleDetails.brand} ${diagnosisInput.vehicleDetails.model} (${diagnosisInput.vehicleDetails.year})
Mileage: ${diagnosisInput.vehicleDetails.mileage || 'Unknown'} km
Vehicle IQ Score: ${diagnosisInput.vehicleIQ || 'Unknown'}/100

User Described Symptoms: "${diagnosisInput.symptoms}"
Selected Symptom Checkboxes: ${diagnosisInput.selectedSymptoms.join(', ') || 'None'}

Last Services:
${JSON.stringify(diagnosisInput.lastServices, null, 2)}

Provide a structured JSON response matching EXACTLY this format:
{
  "possibleCauses": [
    {
      "name": "Cause Name",
      "confidence": 85
    }
  ],
  "urgency": "Low|Medium|High",
  "estimatedRepairCost": "₹1500 - ₹2500",
  "recommendedAction": "Clear advice on what to do next",
  "preventiveTips": [
    "Tip 1",
    "Tip 2"
  ]
}
Return ONLY valid JSON.
`;

  return await analyzeWithGemini({
    systemInstruction: "You are an experienced automotive diagnostic assistant.",
    prompt
  });
}

module.exports = {
  analyzeVehicleSymptoms,
  analyzeWithGemini
};
