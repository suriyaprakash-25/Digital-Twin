const fs = require('fs');
const path = require('path');

const adminDir = path.join(__dirname, '..', 'frontend', 'src', 'pages', 'admin');
const files = fs.readdirSync(adminDir).filter(f => f.endsWith('.jsx'));

console.log('🔍 Checking all API calls in frontend/src/pages/admin/...\n');

const inventory = JSON.parse(fs.readFileSync(path.join(__dirname, 'api_audit_inventory.json'), 'utf-8'));
const backendEndpoints = inventory.backendEndpoints;

const results = [];

files.forEach(file => {
  const content = fs.readFileSync(path.join(adminDir, file), 'utf-8');
  const regex = /(?:axios\.(get|post|put|patch|delete)|fetch)\(\s*[`'"]([^`'"]+)[`'"]/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const method = match[1] ? match[1].toUpperCase() : 'GET';
    const rawUrl = match[2];
    
    // Normalize url
    let pathOnly = rawUrl;
    if (pathOnly.includes('${API_BASE_URL}')) {
      pathOnly = pathOnly.replace('${API_BASE_URL}', '');
    }
    if (pathOnly.includes('${import.meta.env.VITE_API_URL || \'http://localhost:5000\'}')) {
      pathOnly = pathOnly.replace('${import.meta.env.VITE_API_URL || \'http://localhost:5000\'}', '');
    }
    pathOnly = pathOnly.replace(/\?.*$/, '');

    // Check if path has /api prefix
    let hasApiPrefix = pathOnly.startsWith('/api') || pathOnly.startsWith('api');
    
    let normalized = pathOnly.replace(/\$\{[^}]+\}/g, ':param').replace(/\/$/, '');
    if (!normalized.startsWith('/')) normalized = '/' + normalized;

    // Match against backend
    const exactMatch = backendEndpoints.find(be => {
      const beNorm = be.path.replace(/:[a-zA-Z0-9_]+/g, ':param');
      return (beNorm === normalized || beNorm === `/api${normalized}`) && (be.method === method || method === 'GET');
    });

    results.push({
      file,
      method,
      rawUrl,
      pathOnly,
      normalized,
      hasApiPrefix,
      matched: !!exactMatch,
      backendMatch: exactMatch ? `${exactMatch.method} ${exactMatch.path}` : 'NOT_FOUND'
    });
  }
});

console.log(`Total Admin API Calls Inspected: ${results.length}`);
const missingApiPrefix = results.filter(r => !r.hasApiPrefix);
const notMatched = results.filter(r => !r.matched);

console.log(`Missing /api prefix: ${missingApiPrefix.length}`);
console.log(`Unmatched backend routes: ${notMatched.length}\n`);

if (missingApiPrefix.length > 0) {
  console.log('⚠️ Files missing /api prefix:');
  missingApiPrefix.forEach(m => console.log(`  - [${m.file}] ${m.method} ${m.rawUrl}`));
}

if (notMatched.length > 0) {
  console.log('\n❌ Unmatched routes:');
  notMatched.forEach(m => console.log(`  - [${m.file}] ${m.method} ${m.rawUrl} (Normalized: ${m.normalized})`));
}
