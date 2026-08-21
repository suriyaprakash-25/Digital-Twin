const { sanitizeForLogging } = require('../security/sanitizeLog');

const LOG_LEVELS = {
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
  SECURITY: 'SECURITY',
  FINANCIAL: 'FINANCIAL',
  AUDIT: 'AUDIT'
};

function formatLogEntry(level, message, meta = {}) {
  const cleanMeta = sanitizeForLogging(meta);
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    requestId: meta.requestId || meta.req?.requestId || null,
    actorId: meta.actorId || meta.req?.user?.id || null,
    actorRole: meta.actorRole || meta.req?.user?.role || null,
    action: meta.action || null,
    resourceId: meta.resourceId || null,
    ...cleanMeta
  };
}

const logger = {
  info: (message, meta) => {
    const entry = formatLogEntry(LOG_LEVELS.INFO, message, meta);
    console.log(JSON.stringify(entry));
    return entry;
  },
  warn: (message, meta) => {
    const entry = formatLogEntry(LOG_LEVELS.WARN, message, meta);
    console.warn(JSON.stringify(entry));
    return entry;
  },
  error: (message, meta) => {
    const entry = formatLogEntry(LOG_LEVELS.ERROR, message, meta);
    console.error(JSON.stringify(entry));
    return entry;
  },
  security: (message, meta) => {
    const entry = formatLogEntry(LOG_LEVELS.SECURITY, message, meta);
    console.warn(`[SECURITY ALERT] ${JSON.stringify(entry)}`);
    return entry;
  },
  financial: (message, meta) => {
    const entry = formatLogEntry(LOG_LEVELS.FINANCIAL, message, meta);
    console.log(`[FINANCIAL MUTATION] ${JSON.stringify(entry)}`);
    return entry;
  },
  audit: (message, meta) => {
    const entry = formatLogEntry(LOG_LEVELS.AUDIT, message, meta);
    console.log(`[AUDIT] ${JSON.stringify(entry)}`);
    return entry;
  }
};

module.exports = {
  LOG_LEVELS,
  logger
};
