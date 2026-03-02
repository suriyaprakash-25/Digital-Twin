const jwt = require('jsonwebtoken');
const { loadConfig } = require('../config');

const config = loadConfig();

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
      role: payload.role
    };
    return next();
  } catch (e) {
    return res.status(401).json({ msg: 'Missing or invalid token' });
  }
}

module.exports = { requireAuth };
