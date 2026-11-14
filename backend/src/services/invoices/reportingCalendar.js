/** Pure business-calendar helpers (REPORTING timezone) for revenue KPIs and daily trends. */
const { REPORTING, DEFAULTS } = require('./constants');

const keyFormat = new Intl.DateTimeFormat('en-CA', { timeZone: REPORTING.TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

/** 'YYYY-MM-DD' of `date` in the reporting timezone (same key MongoDB's $dateToString produces). */
function dayKey(date) {
  return keyFormat.format(date);
}

function startOfBusinessDay(date) {
  return new Date(`${dayKey(date)}T00:00:00${REPORTING.UTC_OFFSET}`);
}

function startOfBusinessMonth(date) {
  return new Date(`${dayKey(date).slice(0, 8)}01T00:00:00${REPORTING.UTC_OFFSET}`);
}

function dayLabel(date) {
  return date.toLocaleDateString(DEFAULTS.LOCALE, { day: 'numeric', month: 'short', timeZone: REPORTING.TIMEZONE });
}

/** Midnight `days` business days before today's midnight. */
function businessDaysAgo(now, days) {
  return new Date(startOfBusinessDay(now).getTime() - days * REPORTING.DAY_MS);
}

module.exports = { dayKey, startOfBusinessDay, startOfBusinessMonth, dayLabel, businessDaysAgo };
