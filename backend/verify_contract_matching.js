const fs = require('fs');
const path = require('path');

const inventory = JSON.parse(fs.readFileSync(path.join(__dirname, 'api_audit_inventory.json'), 'utf-8'));
const backendEndpoints = inventory.backendEndpoints;
const frontendCalls = inventory.frontendCalls;

console.log('🔬 Analyzing Contract Matching Between 183 Frontend Calls & 201 Backend Endpoints...\n');

function normalizeRoutePattern(route) {
  return route
    .replace(/\?.*$/, '') // strip query params
    .replace(/\/$/, '')   // strip trailing slash
    .replace(/:[a-zA-Z0-9_]+/g, ':param') // standardize params
    .replace(/\$\{[^}]+\}/g, ':param');
}

const matched = [];
const mismatches = [];

frontendCalls.forEach(call => {
  let cleanUrl = call.rawUrl.replace(/\?.*$/, '').replace(/\/$/, '');
  
  // Extract path from full URL or template literal
  let pathOnly = cleanUrl;
  if (pathOnly.includes('/api/')) {
    pathOnly = '/api/' + pathOnly.split('/api/')[1];
  } else if (pathOnly.startsWith('/api')) {
    pathOnly = pathOnly;
  } else if (pathOnly.startsWith('/')) {
    pathOnly = '/api' + pathOnly;
  } else if (!pathOnly.startsWith('http')) {
    pathOnly = '/api/' + pathOnly;
  }

  const normalizedFrontend = normalizeRoutePattern(pathOnly);

  // Find matching backend route
  const found = backendEndpoints.find(be => {
    const normalizedBackend = normalizeRoutePattern(be.path);
    return normalizedFrontend === normalizedBackend && (call.method === be.method || call.method === 'FETCH');
  });

  if (found) {
    matched.push({
      file: call.file,
      method: call.method,
      frontendPath: pathOnly,
      backendPath: found.path,
      backendFile: found.file
    });
  } else {
    // Check if path matches with different method
    const methodMismatch = backendEndpoints.find(be => {
      const normalizedBackend = normalizeRoutePattern(be.path);
      return normalizedFrontend === normalizedBackend;
    });

    mismatches.push({
      file: call.file,
      method: call.method,
      rawUrl: call.rawUrl,
      frontendPath: pathOnly,
      normalized: normalizedFrontend,
      possibleBackendMatch: methodMismatch ? `${methodMismatch.method} ${methodMismatch.path}` : 'NOT_FOUND'
    });
  }
});

console.log(`=======================================================`);
console.log(`API CONTRACT MATCHING SUMMARY:`);
console.log(`=======================================================`);
console.log(`✅ Direct / Standard Matches: ${matched.length}`);
console.log(`⚠️ Potential Mismatches / Unmatched: ${mismatches.length}`);
console.log(`=======================================================\n`);

if (mismatches.length > 0) {
  console.log('📋 Detailed Mismatches List:');
  mismatches.forEach((m, idx) => {
    console.log(`${idx + 1}. [${m.file}] ${m.method} "${m.rawUrl}" -> Normalized: ${m.normalized} (Backend: ${m.possibleBackendMatch})`);
  });
}

fs.writeFileSync(
  path.join(__dirname, 'contract_matching_report.json'),
  JSON.stringify({ matchedCount: matched.length, mismatchCount: mismatches.length, matched, mismatches }, null, 2)
);
