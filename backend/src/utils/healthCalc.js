const { DateTime } = require('luxon');

/**
 * Calculates a vehicle's health score based on Phase 5 rules.
 * 
 * Rules:
 * 1. Insurance Valid = +20 (if insuranceExpiry exists and is >= today)
 * 2. Regular Services = +30 (if vehicle has 2 or more service records)
 * 3. Verified Records = +20 (if at least one service record is verified)
 * 4. Recent Service = +10 (if the latest service date is within the last 180 days)
 * 5. No Major Repairs = +20 (if there are no services with Accidental Repair category or major flags)
 * 
 * Total score: 100
 * 
 * Conditions:
 * - Excellent: >= 85
 * - Good: 70-84
 * - Average: 50-69
 * - Poor: < 50
 * 
 * @param {object} vehicle The vehicle document.
 * @param {Array} services The vehicle's service records.
 * @returns {object} { healthScore, conditionLevel, breakdown }
 */
function calculateHealthScore(vehicle, services) {
  let score = 0;
  const now = DateTime.utc().startOf('day');

  // 1. Insurance Valid = +20
  let isInsuranceValid = false;
  if (vehicle && vehicle.insuranceExpiry) {
    // Parse expiry date using Luxon
    const expDate = DateTime.fromISO(vehicle.insuranceExpiry).startOf('day');
    if (expDate.isValid && expDate >= now) {
      isInsuranceValid = true;
    }
  }
  if (isInsuranceValid) {
    score += 20;
  }

  // 2. Regular Services = +30
  const hasRegularServices = Array.isArray(services) && services.length >= 2;
  if (hasRegularServices) {
    score += 30;
  } else if (Array.isArray(services) && services.length === 1) {
    score += 15; // Grace score for single service
  }

  // 3. Verified Records = +20
  const hasVerifiedRecords = Array.isArray(services) && services.some(s => s.verifiedService === true);
  if (hasVerifiedRecords) {
    score += 20;
  }

  // 4. Recent Service = +10
  let isRecentService = false;
  if (Array.isArray(services) && services.length > 0) {
    const sorted = [...services].sort((a, b) => String(b.serviceDate || '').localeCompare(String(a.serviceDate || '')));
    const latestDateStr = sorted[0].serviceDate;
    if (latestDateStr) {
      const latestDate = DateTime.fromISO(latestDateStr).startOf('day');
      if (latestDate.isValid && now.diff(latestDate, 'days').days <= 180) {
        isRecentService = true;
      }
    }
  }
  if (isRecentService) {
    score += 10;
  }

  // 5. No Major Repairs = +20
  let hasMajorRepairs = false;
  if (Array.isArray(services)) {
    hasMajorRepairs = services.some(s => {
      const category = String(s.serviceCategory || '').toLowerCase();
      const type = String(s.serviceType || '').toLowerCase();
      const notes = String(s.mechanicNotes || '').toLowerCase();

      return (
        category === 'accidental repair' ||
        category.includes('accident') ||
        category.includes('crash') ||
        type.includes('accident') ||
        type.includes('crash') ||
        notes.includes('accident') ||
        notes.includes('crash') ||
        notes.includes('major repair') ||
        category.includes('major')
      );
    });
  }
  if (!hasMajorRepairs) {
    score += 20;
  }

  // Final score cap
  score = Math.max(0, Math.min(100, score));

  // Determine condition label
  let conditionLevel = 'Excellent';
  if (score < 50) conditionLevel = 'Poor';
  else if (score < 70) conditionLevel = 'Average';
  else if (score < 85) conditionLevel = 'Good';

  return {
    healthScore: score,
    conditionLevel,
    breakdown: {
      insuranceValid: isInsuranceValid,
      regularServices: hasRegularServices,
      verifiedRecords: hasVerifiedRecords,
      recentService: isRecentService,
      noMajorRepairs: !hasMajorRepairs
    }
  };
}

module.exports = calculateHealthScore;
