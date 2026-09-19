const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');

function read(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
}

function readJson(relPath) {
  return JSON.parse(read(relPath));
}

function main() {
  const renderYaml = read('render.yaml');
  const vercel = readJson('frontend/vercel.json');
  const frontendPkg = readJson('frontend/package.json');
  const backendPkg = readJson('backend/package.json');
  const frontendConfig = read('frontend/src/utils/config.js');
  const paymentButton = read('frontend/src/components/payment/PaymentButton.jsx');
  const paymentCenter = read('frontend/src/pages/PaymentCenter.jsx');

  assert(renderYaml.includes('healthCheckPath: /api/health/ready'), 'Render must use the readiness probe');
  assert(renderYaml.includes('autoDeployTrigger: checksPass'), 'Render must deploy only after checks pass');
  assert(!renderYaml.includes('autoDeploy: true'), 'Legacy unconditional Render autoDeploy must not be enabled');

  assert.strictEqual(vercel.framework, 'vite');
  assert.strictEqual(vercel.installCommand, 'npm ci');
  assert.strictEqual(vercel.buildCommand, 'npm run build:production');
  assert.strictEqual(vercel.outputDirectory, 'dist');
  assert.strictEqual(vercel.git?.deploymentEnabled?.main, true);
  assert.strictEqual(vercel.git?.deploymentEnabled?.staging, true);
  assert.strictEqual(vercel.git?.deploymentEnabled?.['*'], false);
  assert(
    Array.isArray(vercel.rewrites) &&
      vercel.rewrites.some((rule) => rule.source === '/(.*)' && rule.destination === '/index.html'),
    'Vercel must keep SPA deep links working'
  );

  assert.strictEqual(frontendPkg.engines?.node, '22.x');
  assert.strictEqual(backendPkg.engines?.node, '22.x');
  assert.strictEqual(frontendPkg.scripts?.['build:production'], 'node scripts/validate-production-env.mjs && vite build');

  assert(frontendConfig.includes('import.meta.env.VITE_API_URL'), 'Frontend must use VITE_API_URL');
  assert(!frontendConfig.includes('VITE_API_BASE_URL'), 'Legacy VITE_API_BASE_URL must not be used at runtime');
  assert(frontendConfig.includes('VITE_API_URL is required in production'), 'Frontend must fail closed without production API URL');

  for (const source of [paymentButton, paymentCenter]) {
    assert(!source.includes('VITE_RAZORPAY_KEY_ID'), 'Frontend must not own Razorpay checkout configuration');
    assert(!/rzp_test_[A-Za-z0-9]+/.test(source), 'Frontend must not contain a hardcoded Razorpay key fallback');
  }

  console.log('✅ Deployment standardization suite passed: Render, Vercel, Node runtime, API env and payment checkout contracts are aligned.');
}

try {
  main();
} catch (error) {
  console.error('❌ Deployment standardization suite failed:', error);
  process.exit(1);
}
