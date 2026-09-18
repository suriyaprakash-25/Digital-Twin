const Groq = require('groq-sdk');
const { loadConfig } = require('../config');
const { withTimeout } = require('../utils/resilience');

const config = loadConfig();

let groqClient = null;
if (config.groqApiKey) {
  groqClient = new Groq({ apiKey: config.groqApiKey });
  console.log('✅ GROQ AI initialized successfully.');
} else {
  console.warn('WARNING: GROQ_API_KEY is not set. AI features will use fallback.');
}

/**
 * General purpose GROQ text generation.
 * Returns a parsed JSON object if the response is valid JSON, otherwise returns the raw string.
 */
async function analyzeWithGroq({ systemInstruction, prompt }) {
  if (!groqClient) {
    throw new Error('GROQ API key is not configured.');
  }

  const chatCompletion = await withTimeout(groqClient.chat.completions.create({
    messages: [
      { role: 'system', content: systemInstruction },
      { role: 'user', content: prompt }
    ],
    model: 'qwen/qwen3.8-27b',
    temperature: 0.7,
    max_tokens: 2048,
  }), Number(process.env.AI_PROVIDER_TIMEOUT_MS || 20000), 'Groq AI provider');

  const responseText = chatCompletion.choices[0]?.message?.content || '';

  // Clean up potential markdown fences
  let cleanText = responseText.trim();
  if (cleanText.startsWith('```json')) cleanText = cleanText.substring(7);
  if (cleanText.startsWith('```')) cleanText = cleanText.substring(3);
  if (cleanText.endsWith('```')) cleanText = cleanText.substring(0, cleanText.length - 3);

  try {
    return JSON.parse(cleanText.trim());
  } catch (e) {
    return cleanText;
  }
}

async function analyzeVehicleSymptoms(input = {}, analyzer = analyzeWithGroq) {
  const vehicle = input.vehicleDetails || {};
  const prompt = [
    'Analyze the following vehicle symptoms for a DrivePortz user.',
    'Return ONLY valid JSON with these fields:',
    '{"summary":"string","urgency":"LOW|MEDIUM|HIGH|EMERGENCY","possibleCauses":[{"title":"string","description":"string","confidence":0}],"recommendedActions":["string"],"estimatedRepairCost":"string","safetyNote":"string"}',
    '',
    `Vehicle: ${vehicle.brand || vehicle.make || 'Unknown'} ${vehicle.model || ''}`,
    `Year: ${vehicle.manufacturingYear || vehicle.year || 'Unknown'}`,
    `Odometer: ${vehicle.currentOdometerKm || vehicle.currentMileage || 'Unknown'} km`,
    `Vehicle health score: ${input.vehicleIQ ?? 'Unknown'}`,
    `Free-text symptoms: ${input.symptoms || 'None supplied'}`,
    `Selected symptoms: ${JSON.stringify(input.selectedSymptoms || [])}`,
    `Recent services: ${JSON.stringify(input.lastServices || [])}`
  ].join('\n');

  try {
    const response = await analyzer({
      systemInstruction: 'You are DrivePortz Vehicle Doctor. Provide cautious automotive guidance. Never claim certainty without inspection. If symptoms suggest immediate danger, recommend stopping the vehicle safely and seeking professional assistance. Return only the requested JSON.',
      prompt
    });

    if (response && typeof response === 'object') return response;

    return {
      summary: typeof response === 'string' && response.trim()
        ? response.trim()
        : 'Unable to produce a structured diagnosis.',
      urgency: 'MEDIUM',
      possibleCauses: [],
      recommendedActions: ['Arrange a qualified vehicle inspection if the symptom persists.'],
      estimatedRepairCost: 'Inspection required',
      safetyNote: 'Do not rely on AI guidance for safety-critical vehicle decisions.'
    };
  } catch (error) {
    return {
      unavailable: true,
      summary: 'Vehicle Doctor AI is temporarily unavailable.',
      urgency: 'UNKNOWN',
      possibleCauses: [],
      recommendedActions: ['Try again later or consult a qualified mechanic if the issue is urgent.'],
      estimatedRepairCost: 'Unavailable',
      safetyNote: 'Do not delay urgent safety action because the AI provider is unavailable.',
      providerError: error?.message || 'AI provider unavailable'
    };
  }
}

module.exports = { analyzeWithGroq, analyzeVehicleSymptoms };
