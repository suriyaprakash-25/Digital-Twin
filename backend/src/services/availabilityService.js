const luxon = require('luxon'); // luxon is installed in the project

const DAYS_MAP = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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

  // AUTO Mode: Calculate based on business hours
  if (!garage.businessHours) {
    return 'CLOSED'; // Default to closed if no hours configured
  }

  // Using Asia/Kolkata (IST) as the primary timezone for evaluation 
  // (adjust to target market timezone if needed)
  const now = luxon.DateTime.now().setZone('Asia/Kolkata');
  const currentDayName = DAYS_MAP[now.weekday === 7 ? 0 : now.weekday]; 
  
  const todayHours = garage.businessHours[currentDayName];
  
  if (!todayHours || !todayHours.isOpen || !todayHours.openTime || !todayHours.closeTime) {
    return 'CLOSED';
  }

  // Parse open/close times (assuming HH:mm format, e.g., "09:00", "19:00")
  const openTimeStr = todayHours.openTime;
  const closeTimeStr = todayHours.closeTime;

  const [openH, openM] = openTimeStr.split(':').map(Number);
  const [closeH, closeM] = closeTimeStr.split(':').map(Number);

  const openDateTime = now.set({ hour: openH, minute: openM, second: 0, millisecond: 0 });
  const closeDateTime = now.set({ hour: closeH, minute: closeM, second: 0, millisecond: 0 });

  if (now >= openDateTime && now <= closeDateTime) {
    return 'AVAILABLE';
  }

  return 'CLOSED';
};

module.exports = {
  calculateCurrentStatus
};
