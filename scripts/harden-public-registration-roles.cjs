const fs = require('fs');

function replaceOnce(text, oldValue, newValue, label) {
  const first = text.indexOf(oldValue);
  const last = text.lastIndexOf(oldValue);
  if (first < 0 || first !== last) {
    throw new Error(`${label}: expected exactly one match`);
  }
  return text.replace(oldValue, newValue);
}

const authPath = 'backend/src/routes/auth.js';
let auth = fs.readFileSync(authPath, 'utf8');
auth = replaceOnce(
  auth,
  "const { requireAuth, normalizeRole } = require('../middleware/auth');",
  "const { requireAuth, normalizeRole, normalizePublicRole } = require('../middleware/auth');",
  'auth middleware import'
);
auth = replaceOnce(
  auth,
  'const normalizedRole = normalizeRole(role);',
  'const normalizedRole = normalizePublicRole(role);',
  'password signup role'
);
auth = replaceOnce(
  auth,
  "const normalizedRole = normalizeRole(role || 'USER');",
  'const normalizedRole = normalizePublicRole(role);',
  'google signup role'
);
fs.writeFileSync(authPath, auth);

const testPath = 'backend/test_production_hardening_suite.js';
let tests = fs.readFileSync(testPath, 'utf8');
tests = replaceOnce(
  tests,
  "const { validateEnvironment } = require('./src/config/envValidator');",
  "const { validateEnvironment } = require('./src/config/envValidator');\nconst { normalizePublicRole } = require('./src/middleware/auth');",
  'hardening test import'
);

const marker = '\nconsole.log(`\\nProduction hardening suite: ${passed} passed, ${failed} failed.`);';
const insertion = `

test('public registration cannot self-assign ADMIN role', () => {
  assert.strictEqual(normalizePublicRole('admin'), 'USER');
  assert.strictEqual(normalizePublicRole('administrator'), 'USER');
});

test('public registration preserves supported customer-facing roles', () => {
  assert.strictEqual(normalizePublicRole('garage'), 'GARAGE');
  assert.strictEqual(normalizePublicRole('service_center'), 'GARAGE');
  assert.strictEqual(normalizePublicRole('user'), 'USER');
  assert.strictEqual(normalizePublicRole(undefined), 'USER');
});
`;
tests = replaceOnce(tests, marker, insertion + marker, 'hardening test footer');
fs.writeFileSync(testPath, tests);

console.log('Public registration role hardening transformation applied.');
