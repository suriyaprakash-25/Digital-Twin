const Groq = require('groq-sdk');
const { loadConfig } = require('../config');

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

  const chatCompletion = await groqClient.chat.completions.create({
    messages: [
      { role: 'system', content: systemInstruction },
      { role: 'user', content: prompt }
    ],
    model: 'llama-3.3-70b-versatile',
    temperature: 0.7,
    max_tokens: 2048,
  });

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

module.exports = { analyzeWithGroq };
