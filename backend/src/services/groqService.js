const Groq = require('groq-sdk');
const { loadConfig } = require('../config');

const config = loadConfig();

let groq = null;
if (config.groqApiKey) {
  groq = new Groq({ apiKey: config.groqApiKey });
} else {
  console.warn('WARNING: GROQ_API_KEY is not set. AI Vehicle Doctor will fail.');
}

async function analyzeVehicleSymptoms(diagnosisInput) {
  if (!groq) {
    throw new Error('Groq API key is not configured.');
  }

  const prompt = `
You are an experienced automotive diagnostic assistant.
Analyze the following vehicle information, past services, user-described symptoms, and selected symptom checklists to provide a professional vehicle diagnosis.

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

Return ONLY valid JSON. Do not include markdown code blocks like \`\`\`json.
`;

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      model: 'llama3-8b-8192', // or any other fast groq model like 'mixtral-8x7b-32768'
      temperature: 0.5,
      response_format: { type: 'json_object' }
    });

    const responseText = chatCompletion.choices[0]?.message?.content || '';
    
    // Clean up potential markdown formatting just in case
    let cleanJson = responseText.trim();
    if (cleanJson.startsWith('\`\`\`json')) {
      cleanJson = cleanJson.substring(7);
    }
    if (cleanJson.startsWith('\`\`\`')) {
      cleanJson = cleanJson.substring(3);
    }
    if (cleanJson.endsWith('\`\`\`')) {
      cleanJson = cleanJson.substring(0, cleanJson.length - 3);
    }

    return JSON.parse(cleanJson.trim());
  } catch (error) {
    console.error('Error in groqService:', error);
    throw new Error('Failed to analyze symptoms with AI.');
  }
}

module.exports = {
  analyzeVehicleSymptoms
};
