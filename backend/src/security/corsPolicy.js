const DEFAULT_PRODUCTION_ORIGINS = [
  'https://www.driveportz.com',
  'https://driveportz.com'
];

const DEFAULT_DEVELOPMENT_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000'
];

function normalizeOrigin(origin) {
  if (!origin || typeof origin !== 'string') return null;

  try {
    const parsed = new URL(origin.trim());
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

function parseExtraOrigins(value) {
  if (!value || typeof value !== 'string') return [];

  return value
    .split(',')
    .map((origin) => normalizeOrigin(origin))
    .filter(Boolean);
}

function getAllowedOrigins({ nodeEnv = 'development', frontendUrl, extraOrigins } = {}) {
  const origins = new Set(DEFAULT_PRODUCTION_ORIGINS);

  const normalizedFrontend = normalizeOrigin(frontendUrl);
  if (normalizedFrontend) origins.add(normalizedFrontend);

  for (const origin of parseExtraOrigins(extraOrigins)) {
    origins.add(origin);
  }

  if (String(nodeEnv).toLowerCase() !== 'production') {
    for (const origin of DEFAULT_DEVELOPMENT_ORIGINS) {
      origins.add(origin);
    }
  }

  return origins;
}

function createCorsPolicy(options = {}) {
  const allowedOrigins = getAllowedOrigins(options);

  return {
    allowedOrigins,
    isAllowed(origin) {
      // Requests without an Origin header are typically server-to-server, curl,
      // native clients, health checks, or same-origin requests.
      if (!origin) return true;

      const normalized = normalizeOrigin(origin);
      return Boolean(normalized && allowedOrigins.has(normalized));
    }
  };
}

module.exports = {
  DEFAULT_PRODUCTION_ORIGINS,
  DEFAULT_DEVELOPMENT_ORIGINS,
  normalizeOrigin,
  parseExtraOrigins,
  getAllowedOrigins,
  createCorsPolicy
};
