const fs = require('fs');
const path = require('path');

const backendRoutesDir = path.join(__dirname, 'src', 'routes');
const frontendSrcDir = path.join(__dirname, '..', 'frontend', 'src');

console.log('🔍 Starting Comprehensive Frontend ↔ Backend API Contract Audit...\n');

// 1. Inventory Backend Routes from server.js mountings
const serverJs = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf-8');

const routeMounts = [
  { prefix: '/api/auth', file: 'auth.js' },
  { prefix: '/api/vehicles', file: 'vehicles.js' },
  { prefix: '/api/services', file: 'services.js' },
  { prefix: '/api/health', file: 'systemHealth.js' },
  { prefix: '/api/vehicle-health', file: 'health.js' },
  { prefix: '/api/reminders', file: 'reminders.js' },
  { prefix: '/api/resale', file: 'resale.js' },
  { prefix: '/api/garage', file: 'garage.js' },
  { prefix: '/api/garage/availability', file: 'garageAvailabilityRoutes.js' },
  { prefix: '/api/analytics', file: 'analytics.js' },
  { prefix: '/api/marketplace', file: 'marketplace.js' },
  { prefix: '/api/garages', file: 'garages.js' },
  { prefix: '/api/bookings', file: 'bookings.js' },
  { prefix: '/api/notifications', file: 'notifications.js' },
  { prefix: '/api/admin', file: 'admin.js' },
  { prefix: '/api/passport', file: 'passport.js' },
  { prefix: '/api/insurance', file: 'insurance.js' },
  { prefix: '/api/ownership', file: 'ownership.js' },
  { prefix: '/api/vehicle-doctor', file: 'vehicleDoctorRoutes.js' },
  { prefix: '/api/copilot', file: 'copilotRoutes.js' },
  { prefix: '/api/feedback', file: 'feedbackRoutes.js' },
  { prefix: '/api/admin/feedback', file: 'adminFeedbackRoutes.js' },
  { prefix: '/api/payments', file: 'payments.js' },
  { prefix: '/api/invoices', file: 'invoices.js' },
  { prefix: '/api/garage/invoices', file: 'invoices.js' },
  { prefix: '/api/garage', file: 'earnings.js' },
  { prefix: '/api/garage/earnings', file: 'earnings.js' },
  { prefix: '/api/admin/reconciliation', file: 'reconciliation.js' },
  { prefix: '/api/disputes', file: 'disputes.js' },
  { prefix: '/api/garage/disputes', file: 'disputes.js' },
  { prefix: '/api/admin/disputes', file: 'disputes.js' },
  { prefix: '/api/admin/risk', file: 'risk.js' },
  { prefix: '/api/garage/reports', file: 'reports.js' },
  { prefix: '/api/admin/reports', file: 'reports.js' },
  { prefix: '/api/admin/financial-operations', file: 'financialOperations.js' },
  { prefix: '/api/admin/settlements', file: 'financialOperations.js' },
  { prefix: '/api/admin/financial-audit', file: 'financialAudit.js' },
  { prefix: '/api/admin/treasury', file: 'treasury.js' },
  { prefix: '/api/garage/tax', file: 'tax.js' },
  { prefix: '/api/admin/tax', file: 'tax.js' },
  { prefix: '/api/admin/risk-cases', file: 'riskCases.js' },
  { prefix: '/api/admin/alerts', file: 'financialAlerts.js' },
  { prefix: '/api/admin/financial-integrity', file: 'financialIntegrity.js' }
];

const backendEndpoints = [];

routeMounts.forEach(mount => {
  const filePath = path.join(backendRoutesDir, mount.file);
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf-8');

  // Match router.get, router.post, router.put, router.delete, router.patch
  const routeRegex = /router\.(get|post|put|delete|patch)\(\s*(['"`])([^'"`]+)\2/g;
  let match;
  while ((match = routeRegex.exec(content)) !== null) {
    const method = match[1].toUpperCase();
    let subPath = match[3];
    if (subPath === '/') subPath = '';
    const fullPath = `${mount.prefix}${subPath}`.replace(/\/$/, '') || mount.prefix;
    
    backendEndpoints.push({
      method,
      path: fullPath,
      file: mount.file,
      prefix: mount.prefix
    });
  }
});

console.log(`📦 Total Backend Endpoints Inventoried: ${backendEndpoints.length}`);

// 2. Inventory Frontend API Calls
function scanDir(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      scanDir(fullPath, fileList);
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      fileList.push(fullPath);
    }
  });
  return fileList;
}

const frontendFiles = scanDir(frontendSrcDir);
const frontendCalls = [];

frontendFiles.forEach(file => {
  const relPath = path.relative(frontendSrcDir, file);
  const content = fs.readFileSync(file, 'utf-8');

  // Match axios.get, axios.post, axios.put, axios.delete, fetch, apiGet, apiPost
  const regexPatterns = [
    /axios\.(get|post|put|delete|patch)\(\s*[`'"]([^`'"]+)[`'"]/g,
    /fetch\(\s*[`'"]([^`'"]+)[`'"]/g,
    /api(Get|Post|Put|Delete|Patch)\(\s*[`'"]([^`'"]+)[`'"]/g
  ];

  regexPatterns.forEach(regex => {
    let m;
    while ((m = regex.exec(content)) !== null) {
      let method = 'GET';
      let rawUrl = m[2] || m[1];
      if (m[0].startsWith('axios.')) {
        method = m[1].toUpperCase();
        rawUrl = m[2];
      } else if (m[0].startsWith('api')) {
        method = m[1].toUpperCase();
        rawUrl = m[2];
      }
      
      // Clean up template literal placeholders
      const normalizedPath = rawUrl
        .replace(/\$\{[^}]+\}/g, ':param')
        .replace(/^https?:\/\/[^/]+/, '')
        .replace(/^\/api/, '/api');

      frontendCalls.push({
        file: relPath,
        method,
        rawUrl,
        normalizedPath
      });
    }
  });
});

console.log(`💻 Total Frontend API Invocations Found: ${frontendCalls.length}`);

// Write Inventory to JSON for programmatic matching
const report = {
  totalBackendEndpoints: backendEndpoints.length,
  backendEndpoints,
  totalFrontendCalls: frontendCalls.length,
  frontendCalls
};

fs.writeFileSync(path.join(__dirname, 'api_audit_inventory.json'), JSON.stringify(report, null, 2));
console.log('✅ Inventory saved to api_audit_inventory.json');
