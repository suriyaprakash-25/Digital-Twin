const { DateTime } = require('luxon');

function parseAnyDate(dateStr) {
  if (!dateStr) return null;

  const fromIso = DateTime.fromISO(String(dateStr), { zone: 'utc' });
  if (fromIso.isValid) return fromIso;

  const fromJs = DateTime.fromJSDate(new Date(String(dateStr)), { zone: 'utc' });
  if (fromJs.isValid) return fromJs;

  return null;
}

function isPastDateOnly(dateTime, now = DateTime.utc()) {
  if (!dateTime) return false;
  const d = dateTime.startOf('day');
  const n = now.startOf('day');
  return d < n;
}

module.exports = { parseAnyDate, isPastDateOnly };
