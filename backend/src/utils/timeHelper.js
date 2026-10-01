/**
 * Time Helper Utilities
 * ─────────────────────
 * Robust time parsing, normalization, and past-time checks
 * supporting system time simulation (getNow()).
 */

const { getNow } = require('../config/systemTime');

/**
 * Parse time string to total minutes since midnight (0 - 1439).
 * Supports:
 *   "09:00"
 *   "09:15"
 *   "09:00 - 09:15"
 *   "09:00-09:15"
 *   "08:30 - 09:00 AM"
 *   "01:30 - 02:00 PM"
 *   "01:30 PM"
 * 
 * @param {string} timeStr
 * @param {'start'|'end'} [preference='end'] - If a range is provided, which boundary to return
 * @returns {number|null} Minutes since midnight
 */
function parseTimeToMinutes(timeStr, preference = 'end') {
  if (!timeStr || typeof timeStr !== 'string') return null;

  let targetStr = timeStr.trim();

  // If it's a range like "09:00 - 09:15" or "09:00-09:15"
  if (targetStr.includes('-')) {
    const parts = targetStr.split('-');
    const part = preference === 'start' ? parts[0].trim() : parts[1].trim();
    
    // If the meridian (AM/PM) is only at the end of the second part, pass it to first part if needed
    const meridianMatch = targetStr.match(/(AM|PM)/i);
    const meridian = meridianMatch ? meridianMatch[1].toUpperCase() : null;

    targetStr = part;
    if (meridian && !part.match(/(AM|PM)/i)) {
      targetStr = `${part} ${meridian}`;
    }
  }

  const match = targetStr.match(/(\d{1,2}):(\d{2})(?:\s*(AM|PM))?/i);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const meridian = match[3] ? match[3].toUpperCase() : null;

  if (meridian === 'PM' && hours < 12) {
    hours += 12;
  } else if (meridian === 'AM' && hours === 12) {
    hours = 0;
  }

  return hours * 60 + minutes;
}

/**
 * Extract YYYY-MM-DD string from Date object or ISO string.
 * @param {Date|string} dateVal
 * @returns {string} "YYYY-MM-DD"
 */
function formatDateKey(dateVal) {
  if (!dateVal) return '';
  if (typeof dateVal === 'string') {
    if (dateVal.includes('T')) return dateVal.split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateVal)) return dateVal;
  }
  const d = new Date(dateVal);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Check if a date + time has already passed relative to system getNow().
 * 
 * @param {Date|string} dateVal - Appointment or slot date
 * @param {string} timeStr - Time window or slot time
 * @param {'start'|'end'} [boundary='end'] - Compare against slot start or end
 * @returns {boolean} True if passed
 */
function isDateTimePassed(dateVal, timeStr, boundary = 'end') {
  if (!dateVal) return false;

  const now = getNow();
  const targetDateKey = formatDateKey(dateVal);
  const nowDateKey = formatDateKey(now);

  if (!targetDateKey) return false;

  // Past date
  if (targetDateKey < nowDateKey) {
    return true;
  }
  // Future date
  if (targetDateKey > nowDateKey) {
    return false;
  }

  // Same day: check minutes
  if (!timeStr) return false;

  const targetMinutes = parseTimeToMinutes(timeStr, boundary);
  if (targetMinutes === null) return false;

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return nowMinutes >= targetMinutes;
}

function parseDateOnly(value) {
  const date = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00.000Z`) : new Date(NaN);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw Object.assign(new Error('A valid date in YYYY-MM-DD format is required'), { statusCode: 400 });
  }
  return date;
}

function validateTimeWindow(start, end, duration) {
  const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!Number.isInteger(duration) || duration < 5 || duration > 120 ||
      typeof start !== 'string' || typeof end !== 'string' ||
      !timePattern.test(start) || !timePattern.test(end) ||
      parseTimeToMinutes(end) - parseTimeToMinutes(start) < duration) {
    throw Object.assign(new Error('Use valid start/end times and a whole duration of 5–120 minutes that fits the working hours'), { statusCode: 400 });
  }
}

module.exports = {
  parseDateOnly,
  validateTimeWindow,
  parseTimeToMinutes,
  formatDateKey,
  isDateTimePassed,
};
