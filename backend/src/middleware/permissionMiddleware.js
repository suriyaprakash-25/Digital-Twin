const ADMIN_ROLE = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  FINANCE_ADMIN: 'FINANCE_ADMIN',
  OPERATIONS_ADMIN: 'OPERATIONS_ADMIN',
  SUPPORT_ADMIN: 'SUPPORT_ADMIN',
  ADMIN: 'ADMIN' // Default admin alias
};

const PERMISSIONS = {
  SETTLEMENT_READ: 'settlement:read',
  SETTLEMENT_APPROVE: 'settlement:approve',
  SETTLEMENT_PROCESS: 'settlement:process',
  SETTLEMENT_REJECT: 'settlement:reject',
  SETTLEMENT_HOLD: 'settlement:hold',
  SETTLEMENT_RETRY: 'settlement:retry',
  REFUND_APPROVE: 'refund:approve',
  REFUND_EXECUTE: 'refund:execute',
  COMMISSION_MANAGE: 'commission:manage',
  FINANCIAL_REPORT_READ: 'financial_report:read',
  RISK_MANAGE: 'risk:manage',
  RECONCILIATION_RESOLVE: 'reconciliation:resolve'
};

const ROLE_PERMISSIONS_MAP = {
  [ADMIN_ROLE.SUPER_ADMIN]: Object.values(PERMISSIONS),
  [ADMIN_ROLE.ADMIN]: Object.values(PERMISSIONS),
  [ADMIN_ROLE.FINANCE_ADMIN]: [
    PERMISSIONS.SETTLEMENT_READ,
    PERMISSIONS.SETTLEMENT_APPROVE,
    PERMISSIONS.SETTLEMENT_PROCESS,
    PERMISSIONS.SETTLEMENT_REJECT,
    PERMISSIONS.SETTLEMENT_HOLD,
    PERMISSIONS.SETTLEMENT_RETRY,
    PERMISSIONS.REFUND_APPROVE,
    PERMISSIONS.REFUND_EXECUTE,
    PERMISSIONS.COMMISSION_MANAGE,
    PERMISSIONS.FINANCIAL_REPORT_READ,
    PERMISSIONS.RISK_MANAGE
  ],
  [ADMIN_ROLE.OPERATIONS_ADMIN]: [
    PERMISSIONS.SETTLEMENT_READ,
    PERMISSIONS.SETTLEMENT_HOLD,
    PERMISSIONS.FINANCIAL_REPORT_READ,
    PERMISSIONS.RISK_MANAGE,
    PERMISSIONS.RECONCILIATION_RESOLVE
  ],
  [ADMIN_ROLE.SUPPORT_ADMIN]: [
    PERMISSIONS.SETTLEMENT_READ,
    PERMISSIONS.FINANCIAL_REPORT_READ
  ]
};

/**
 * Checks if a role has the specified permission
 */
function hasPermission(role, permission) {
  const normalizedRole = String(role || '').toUpperCase().trim();
  const granted = ROLE_PERMISSIONS_MAP[normalizedRole] || [];
  return granted.includes(permission);
}

/**
 * Express middleware to enforce granular admin permissions
 */
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const userRole = req.user.role || (req.user.isAdmin ? 'ADMIN' : 'USER');
    const adminRole = req.user.adminRole || userRole;

    if (!hasPermission(adminRole, permission) && !hasPermission(userRole, permission)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Admin role '${adminRole}' lacks required permission '${permission}'`,
        requiredPermission: permission,
        adminRole
      });
    }

    next();
  };
}

module.exports = {
  ADMIN_ROLE,
  PERMISSIONS,
  hasPermission,
  requirePermission
};
