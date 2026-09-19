const frontendUrl = String(process.env.FRONTEND_URL || 'https://www.driveportz.com').replace(/\/$/, '');
const backendUrl = String(process.env.BACKEND_URL || 'https://driveportz.onrender.com').replace(/\/$/, '');

const failures = [];
const results = [];

async function fetchWithTimeout(url, options = {}, timeoutMs = 90000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal, redirect: 'follow' });
  } finally {
    clearTimeout(timeout);
  }
}

async function check(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail });
    console.log(`✅ ${name}: ${detail}`);
  } catch (error) {
    failures.push({ name, message: error?.message || String(error) });
    console.error(`❌ ${name}: ${error?.message || error}`);
  }
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

await check('Vercel root', async () => {
  const response = await fetchWithTimeout(frontendUrl);
  expect(response.ok, `HTTP ${response.status}`);
  expect((response.headers.get('content-type') || '').includes('text/html'), 'Expected HTML response');
  expect((response.headers.get('x-content-type-options') || '').toLowerCase() === 'nosniff', 'Missing X-Content-Type-Options=nosniff');
  expect((response.headers.get('x-frame-options') || '').toUpperCase() === 'DENY', 'Missing X-Frame-Options=DENY');
  return `HTTP ${response.status}`;
});

await check('Vercel SPA deep link', async () => {
  const response = await fetchWithTimeout(`${frontendUrl}/login`);
  const text = await response.text();
  expect(response.ok, `HTTP ${response.status}`);
  expect((response.headers.get('content-type') || '').includes('text/html'), 'Expected HTML response');
  expect(/<html|<!doctype html/i.test(text), 'Deep link did not return the SPA shell');
  return `HTTP ${response.status}`;
});

await check('Render liveness', async () => {
  const response = await fetchWithTimeout(`${backendUrl}/api/health/live`);
  const body = await response.json().catch(() => ({}));
  expect(response.status === 200, `HTTP ${response.status}`);
  expect(body.status === 'UP', `Expected status UP, received ${JSON.stringify(body)}`);
  return 'UP';
});

await check('Render readiness', async () => {
  const response = await fetchWithTimeout(`${backendUrl}/api/health/ready`);
  const body = await response.json().catch(() => ({}));
  expect(response.status === 200, `HTTP ${response.status}`);
  expect(body.status === 'READY', `Expected status READY, received ${JSON.stringify(body)}`);
  expect(body.database?.connected === true && body.database?.pingOk === true, 'MongoDB readiness is not healthy');
  return 'READY + MongoDB ping OK';
});

await check('Production CORS preflight', async () => {
  const response = await fetchWithTimeout(`${backendUrl}/api/health/live`, {
    method: 'OPTIONS',
    headers: {
      Origin: frontendUrl,
      'Access-Control-Request-Method': 'GET',
      'Access-Control-Request-Headers': 'authorization,content-type'
    }
  });
  expect(response.status >= 200 && response.status < 300, `HTTP ${response.status}`);
  const allowedOrigin = response.headers.get('access-control-allow-origin');
  expect(allowedOrigin === frontendUrl, `Expected Access-Control-Allow-Origin ${frontendUrl}, received ${allowedOrigin || 'none'}`);
  return `allowed origin ${allowedOrigin}`;
});

console.log('\nDrivePortz production deployment smoke summary');
console.log(`Frontend: ${frontendUrl}`);
console.log(`Backend:  ${backendUrl}`);
console.log(`Passed:   ${results.length}`);
console.log(`Failed:   ${failures.length}`);

if (failures.length) {
  process.exit(1);
}
