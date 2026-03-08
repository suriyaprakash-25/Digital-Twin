const jwt = require('jsonwebtoken');
const { loadConfig } = require('../config');

const config = loadConfig();

function normalizeRole(role) {
  const r = String(role || '').trim().toLowerCase();

  if (r === 'garage' || r === 'service_center' || r === 'servicecenter' || r === 'service centre' || r === 'service center') {
    return 'GARAGE';
  }

  if (r === 'vehicle_owner' || r === 'vehicle owner' || r === 'user' || r === 'customer' || r === 'owner') {
    return 'USER';
  }

  return String(role || 'USER');
}

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const parts = authHeader.split(' ');
  const token = parts.length === 2 && parts[0] === 'Bearer' ? parts[1] : null;

  if (!token) {
    return res.status(401).json({ msg: 'Missing or invalid token' });
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.user = {
      id: payload.sub,
      role: normalizeRole(payload.role)
    };
    return next();
  } catch (e) {
    return res.status(401).json({ msg: 'Missing or invalid token' });
  }
}

function requireRole(allowedRoles) {
  const allowed = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  const normalizedAllowed = allowed.map(normalizeRole);

  return function roleMiddleware(req, res, next) {
    const role = normalizeRole(req.user && req.user.role);
    if (!normalizedAllowed.includes(role)) {
      return res.status(403).json({ msg: 'Forbidden' });
    }
    return next();
  };
}

module.exports = { requireAuth, requireRole, normalizeRole };
