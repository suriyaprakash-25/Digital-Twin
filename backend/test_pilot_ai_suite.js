process.env.NODE_ENV = 'test';
process.env.JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || 'pilot-ai-test-secret-key-at-least-32-characters';
process.env.EMAIL_PROVIDER = 'mock';

const assert = require('assert');
const { analyzeVehicleSymptoms } = require('./src/services/groqService');
const { parseSelectedSymptoms } = require('./src/controllers/vehicleDoctorController');
const { processMessage } = require('./src/controllers/assistantController');

async function testStructuredDiagnosis() {
  const fakeAnalyzer = async () => ({
    summary: 'Brake squeal requires inspection.',
    urgency: 'MEDIUM',
    possibleCauses: [{ title: 'Brake pad wear', description: 'Possible wear', confidence: 80 }],
    recommendedActions: ['Inspect brake pads'],
    estimatedRepairCost: 'Inspection required',
    safetyNote: 'Stop driving if braking performance changes.'
  });

  const result = await analyzeVehicleSymptoms({
    vehicleDetails: { brand: 'Honda', model: 'City', manufacturingYear: 2022 },
    symptoms: 'Squealing while braking',
    selectedSymptoms: ['brake noise'],
    lastServices: []
  }, fakeAnalyzer);

  assert.strictEqual(result.urgency, 'MEDIUM');
  assert.strictEqual(result.possibleCauses.length, 1);
}

async function testProviderFailure() {
  const result = await analyzeVehicleSymptoms(
    { vehicleDetails: { brand: 'Tata', model: 'Nexon' }, symptoms: 'warning light' },
    async () => { throw new Error('simulated provider outage'); }
  );

  assert.strictEqual(result.unavailable, true);
  assert.strictEqual(result.urgency, 'UNKNOWN');
  assert.match(result.providerError, /simulated provider outage/);
  assert.match(result.safetyNote, /Do not delay urgent safety action/);
}

function testInputValidation() {
  assert.strictEqual(parseSelectedSymptoms('{not-json'), null);
  assert.deepStrictEqual(parseSelectedSymptoms('[]'), []);
  assert.deepStrictEqual(parseSelectedSymptoms(['noise']), ['noise']);
}

async function testCopilotEmptyInput() {
  const req = { body: {}, user: { id: '507f1f77bcf86cd799439011', role: 'USER' } };
  let statusCode = null;
  let payload = null;
  const res = {
    status(code) { statusCode = code; return this; },
    json(body) { payload = body; return this; }
  };

  await processMessage(req, res);
  assert.strictEqual(statusCode, 400);
  assert.strictEqual(payload.success, false);
  assert.match(payload.error, /Message or image is required/);
}

async function main() {
  await testStructuredDiagnosis();
  await testProviderFailure();
  testInputValidation();
  await testCopilotEmptyInput();

  console.log('✅ Pilot AI suite passed: structured diagnosis, provider outage, invalid input and empty CoPilot input.');
}

main().catch((err) => {
  console.error('❌ Pilot AI suite failed:', err);
  process.exit(1);
});
