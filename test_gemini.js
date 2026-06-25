const path = require('path');
const { loadConfig } = require('./backend/src/config');
const geminiService = require('./backend/src/services/geminiService');

async function testGemini() {
  console.log('Testing Gemini API...');
  const input = {
    vehicleDetails: { brand: 'Toyota', model: 'Corolla', year: 2020 },
    vehicleIQ: 85,
    symptoms: 'Engine making a knocking sound',
    selectedSymptoms: ['Engine knocking'],
    lastServices: []
  };

  try {
    const result = await geminiService.analyzeVehicleSymptoms(input);
    console.log('Success:', result);
  } catch (error) {
    console.error('Error:', error);
  }
}

testGemini();
