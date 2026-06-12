const { requireAuth } = require('./auth');

/**
 * Convenience middleware: requireAuth + ensure user.role === 'ADMIN'.
 * Use on any route that should only be accessible to platform administrators.
 */
function requireAdmin(req, res, next) {
  requireAuth(req, res, (err) => {
    if (err) return; // requireAuth already sent a response
    if (res.headersSent) return;

    if (!req.user || req.user.role !== 'ADMIN') {
      return res.status(403).json({ msg: 'Admin access required' });
    }
    return next();
  });
}

module.exports = { requireAdmin };
