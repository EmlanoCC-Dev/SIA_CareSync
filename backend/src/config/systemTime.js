/**
 * System Time & Clinic Operating Hours Manager
 * ───────────────────────────────────────────
 * Provides centralized time management and clinic operating hour checks.
 * Supports custom system time overrides for testing and demos.
 *
 * Clinic Operating Hours: 08:30 AM to 05:00 PM (17:00)
 */

let customTime = null; // null = use actual real-world server time

/**
 * Get current system time (either simulated or actual).
 * @returns {Date}
 */
function getNow() {
  if (customTime) {
    return new Date(customTime);
  }
  return new Date();
}

/**
 * Set a simulated system date & time for testing.
 * @param {string|null} timeStr - ISO string or null to reset
 */
function setCustomTime(timeStr) {
  if (!timeStr) {
    customTime = null;
  } else {
    customTime = new Date(timeStr);
  }
  return getNow();
}

/**
 * Check if the clinic walk-in queue is currently open.
 * Operating hours: 8:30 AM (510 min) to 5:00 PM (1020 min)
 * @param {Date} [dateObj]
 * @returns {boolean}
 */
function isClinicOpen(dateObj = getNow()) {
  const hours = dateObj.getHours();
  const minutes = dateObj.getMinutes();
  const totalMinutes = hours * 60 + minutes;

  const OPEN_MINUTES = 8 * 60 + 30; // 08:30 AM
  const CLOSE_MINUTES = 17 * 60;    // 05:00 PM (17:00)

  return totalMinutes >= OPEN_MINUTES && totalMinutes <= CLOSE_MINUTES;
}

/**
 * Get full operating status payload.
 */
function getOperatingStatus() {
  const now = getNow();
  return {
    openTime: '08:30',
    closeTime: '17:00',
    isOpen: isClinicOpen(now),
    currentTime: now.toISOString(),
    isCustom: customTime !== null,
  };
}

module.exports = {
  getNow,
  setCustomTime,
  isClinicOpen,
  getOperatingStatus,
};
