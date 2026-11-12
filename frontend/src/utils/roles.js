// Role normalisation. MUST stay in sync with normalizeRole in
// backend/src/middleware/auth.js (the backend is the source of truth).

export const ROLES = Object.freeze({
  USER: 'USER',
  GARAGE: 'GARAGE',
  ADMIN: 'ADMIN',
});

const ROLE_ALIASES = {
  garage: ROLES.GARAGE,
  service_center: ROLES.GARAGE,
  servicecenter: ROLES.GARAGE,
  'service centre': ROLES.GARAGE,
  'service center': ROLES.GARAGE,
  vehicle_owner: ROLES.USER,
  'vehicle owner': ROLES.USER,
  user: ROLES.USER,
  customer: ROLES.USER,
  owner: ROLES.USER,
  admin: ROLES.ADMIN,
  administrator: ROLES.ADMIN,
};

/** Maps any known alias to USER | GARAGE | ADMIN; unknown values pass through (like the backend). */
export function normalizeRole(role) {
  const key = String(role || '').trim().toLowerCase();
  if (Object.prototype.hasOwnProperty.call(ROLE_ALIASES, key)) return ROLE_ALIASES[key];
  return String(role || ROLES.USER);
}

/** Public sign-up can only ever yield USER or GARAGE (mirrors normalizePublicRole). */
export function normalizePublicRole(role) {
  return normalizeRole(role) === ROLES.GARAGE ? ROLES.GARAGE : ROLES.USER;
}

export function hasRole(role, allowedRoles) {
  if (!allowedRoles || allowedRoles.length === 0) return true;
  const normalized = normalizeRole(role);
  return allowedRoles.some((allowed) => normalizeRole(allowed) === normalized);
}

/** Landing route after login for each role. */
export function homePathForRole(role) {
  const normalized = normalizeRole(role);
  if (normalized === ROLES.ADMIN) return '/admin';
  if (normalized === ROLES.GARAGE) return '/garage-dashboard';
  return '/user-dashboard';
}
