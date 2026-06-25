const { GoogleGenerativeAI } = require('@google/generative-ai');
const { loadConfig } = require('./backend/src/config');

async function listModels() {
  const config = loadConfig();
  const genAI = new GoogleGenerativeAI(config.geminiApiKey);
  
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${config.geminiApiKey}`);
    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error listing models:', err);
  }
}

listModels();
