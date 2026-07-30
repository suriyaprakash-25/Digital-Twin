const luxon = require('luxon'); // luxon is installed in the project

const DAYS_MAP = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const DEFAULT_HOURS = DAYS_MAP.reduce((acc, day) => ({
  ...acc,
  [day]: { isOpen: true, openTime: '09:00', closeTime: '19:00' }
}), {});

/**
 * Calculates the current real-time availability status of a garage.
 * @param {Object} garage The garage document from the database
 * @returns {String} 'AVAILABLE' | 'BUSY' | 'CLOSED'
 */
const calculateCurrentStatus = (garage) => {
  const mode = garage.availabilityMode || 'AUTO';
  
  if (mode === 'MANUAL') {
    return garage.manualStatus || 'CLOSED';
  }

  // AUTO Mode: Use configured business hours or fallback to default 09:00-19:00 open hours
  const hoursConfig = (garage.businessHours && Object.keys(garage.businessHours).length > 0)
    ? garage.businessHours
    : DEFAULT_HOURS;

  let now;
  try {
    now = luxon.DateTime.now().setZone('Asia/Kolkata');
  } catch {
    now = luxon.DateTime.now();
  }

  const currentDayName = DAYS_MAP[now.weekday === 7 ? 0 : now.weekday]; 
  const todayHours = hoursConfig[currentDayName];
  
  if (!todayHours || !todayHours.isOpen || !todayHours.openTime || !todayHours.closeTime) {
    return 'CLOSED';
  }

  // Parse open/close times (assuming HH:mm format, e.g., "09:00", "19:00")
  const [openH, openM] = String(todayHours.openTime).split(':').map(Number);
  const [closeH, closeM] = String(todayHours.closeTime).split(':').map(Number);

  const openDateTime = now.set({ hour: openH, minute: openM, second: 0, millisecond: 0 });
  const closeDateTime = now.set({ hour: closeH, minute: closeM, second: 0, millisecond: 0 });

  if (now >= openDateTime && now <= closeDateTime) {
    return 'AVAILABLE';
  }

  return 'CLOSED';
};

const getCurrentTimeString = () => {
  try {
    return luxon.DateTime.now().setZone('Asia/Kolkata').toFormat('EEE, dd LLL yyyy, hh:mm a (Z)');
  } catch {
    return new Date().toLocaleString();
  }
};

module.exports = {
  calculateCurrentStatus,
  getCurrentTimeString
};
