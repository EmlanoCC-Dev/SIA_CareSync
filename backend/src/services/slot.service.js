/**
 * Slot Service
 * ────────────
 * Appointment Lifecycle — Slot Management
 * Layer:    Business Logic
 *
 * Handles slot generation from doctor working hours,
 * reservation, confirmation, freeing, and lifecycle transitions.
 * Emits SLOT_FREED when a slot becomes available again.
 */

const Slot = require('../models/Slot');
const User = require('../models/User');
const emitter = require('../events/emitter');
const EVENTS = require('../events/events');
const { isDateTimePassed } = require('../utils/timeHelper');

/**
 * Parse a time string "HH:MM" into total minutes since midnight.
 */
function _parseTime(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Format total minutes since midnight back to "HH:MM".
 */
function _formatTime(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Normalize a Date to midnight UTC for consistent date-only comparisons.
 */
function _normalizeDate(date) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Generate slots for a specific doctor on a specific date.
 * Idempotent — skips slots that already exist in the DB.
 *
 * @param {string} doctorId
 * @param {Date|string} date
 * @param {number} [customDuration]
 * @param {string} [customStart]
 * @param {string} [customEnd]
 * @returns {Array} Created (or existing) Slot documents
 */
async function generateSlotsForDoctor(doctorId, date, customDuration = null, customStart = null, customEnd = null) {
  const doctor = await User.findById(doctorId);
  if (!doctor || doctor.role !== 'Doctor') {
    const err = new Error('Doctor not found');
    err.statusCode = 404;
    throw err;
  }

  const normalizedDate = _normalizeDate(date);
  const dayOfWeek = normalizedDate.getUTCDay(); // 0 = Sun, 1 = Mon …

  let startMinutes;
  let endMinutes;
  const duration = customDuration || doctor.consultationDuration || 15;

  if (customStart && customEnd) {
    startMinutes = _parseTime(customStart);
    endMinutes = _parseTime(customEnd);
  } else {
    // Find the working hours block for this day of the week
    const schedule = (doctor.workingHours || []).find((wh) => wh.day === dayOfWeek);
    if (schedule) {
      startMinutes = _parseTime(schedule.start);
      endMinutes = _parseTime(schedule.end);
    } else {
      // Default working hours (09:00 to 17:00) if no custom schedule is set
      startMinutes = _parseTime('09:00');
      endMinutes = _parseTime('17:00');
    }
  }

  // Build slot boundaries
  const slotDefs = [];
  for (let t = startMinutes; t + duration <= endMinutes; t += duration) {
    slotDefs.push({
      startTime: _formatTime(t),
      endTime: _formatTime(t + duration),
    });
  }

  if (slotDefs.length > 0) {
    // Bulk upsert: only create slots that don't already exist
    const ops = slotDefs.map((s) => ({
      updateOne: {
        filter: { doctor: doctorId, date: normalizedDate, startTime: s.startTime },
        update: {
          $setOnInsert: {
            doctor: doctorId,
            date: normalizedDate,
            startTime: s.startTime,
            endTime: s.endTime,
            status: 'Available',
            appointment: null,
          },
        },
        upsert: true,
      },
    }));

    await Slot.bulkWrite(ops);
  }

  // Return all slots for this doctor+date
  return Slot.find({ doctor: doctorId, date: normalizedDate })
    .populate('doctor', 'firstName lastName email contactNumber')
    .sort({ startTime: 1 });
}

/**
 * Get available slots for a doctor on a date.
 * Auto-generates slots if none exist yet (on-demand generation).
 */
async function getAvailableSlots(doctorId, date) {
  const normalizedDate = _normalizeDate(date);

  // Check if slots exist for this doctor+date
  const existingCount = await Slot.countDocuments({
    doctor: doctorId,
    date: normalizedDate,
  });

  // Generate on-demand if none exist
  if (existingCount === 0) {
    await generateSlotsForDoctor(doctorId, date);
  }

  const slots = await Slot.find({
    doctor: doctorId,
    date: normalizedDate,
    status: 'Available',
  })
    .populate('doctor', 'firstName lastName email contactNumber')
    .sort({ startTime: 1 });

  // Filter out any slots whose start time has already passed
  return slots.filter((slot) => !isDateTimePassed(slot.date, slot.startTime, 'start'));
}

/**
 * Get all slots for a doctor on a date (any status).
 */
async function getAllSlots(doctorId, date) {
  const normalizedDate = _normalizeDate(date);

  const existingCount = await Slot.countDocuments({
    doctor: doctorId,
    date: normalizedDate,
  });

  if (existingCount === 0) {
    await generateSlotsForDoctor(doctorId, date);
  }

  return Slot.find({
    doctor: doctorId,
    date: normalizedDate,
  })
    .populate('doctor', 'firstName lastName email contactNumber')
    .sort({ startTime: 1 });
}

/**
 * Get all slots for all doctors on a date (or filtered by status).
 * Auto-generates default slots for any doctors missing slots on that date.
 */
async function getAllSlotsForDate(date, status = null) {
  const normalizedDate = _normalizeDate(date);
  const doctors = await User.find({ role: 'Doctor' });

  // Auto-generate for each doctor if none exist yet
  for (const doc of doctors) {
    const existingCount = await Slot.countDocuments({
      doctor: doc._id,
      date: normalizedDate,
    });
    if (existingCount === 0) {
      await generateSlotsForDoctor(doc._id, date);
    }
  }

  const query = { date: normalizedDate };
  if (status) {
    query.status = status;
  }

  const slots = await Slot.find(query)
    .populate('doctor', 'firstName lastName email contactNumber')
    .sort({ startTime: 1 });

  if (status === 'Available') {
    return slots.filter((slot) => !isDateTimePassed(slot.date, slot.startTime, 'start'));
  }

  return slots;
}

/**
 * Get a single slot by ID.
 */
async function getById(slotId) {
  const slot = await Slot.findById(slotId)
    .populate('doctor', 'firstName lastName')
    .populate('appointment');
  if (!slot) {
    const err = new Error('Slot not found');
    err.statusCode = 404;
    throw err;
  }
  return slot;
}

/**
 * Reserve a slot (tentative).
 * Available → Reserved-Tentative
 */
async function reserveSlot(slotId, appointmentId) {
  const slot = await Slot.findById(slotId);
  if (!slot) {
    const err = new Error('Slot not found');
    err.statusCode = 404;
    throw err;
  }
  if (slot.status !== 'Available') {
    const err = new Error(`Slot is not available (current status: "${slot.status}")`);
    err.statusCode = 409;
    throw err;
  }
  if (isDateTimePassed(slot.date, slot.startTime, 'start')) {
    const err = new Error('Cannot reserve a time slot that has already passed');
    err.statusCode = 400;
    throw err;
  }

  const reserved = await Slot.findOneAndUpdate(
    { _id: slotId, status: 'Available', appointment: null },
    { $set: { status: 'Reserved-Tentative', appointment: appointmentId } },
    { new: true }
  );
  if (!reserved) {
    const err = new Error('This slot has already been taken');
    err.statusCode = 409;
    throw err;
  }
  return reserved;
}

/**
 * Confirm a reserved slot.
 * Reserved-Tentative → Reserved-Confirmed
 */
async function confirmSlot(slotId) {
  const slot = await Slot.findById(slotId);
  if (!slot) {
    const err = new Error('Slot not found');
    err.statusCode = 404;
    throw err;
  }
  if (slot.status !== 'Reserved-Tentative') {
    const err = new Error(`Cannot confirm slot with status "${slot.status}"`);
    err.statusCode = 400;
    throw err;
  }

  slot.status = 'Reserved-Confirmed';
  await slot.save();
  return slot;
}

/**
 * Free a slot — returns it to Available.
 * Clears the appointment reference and emits SLOT_FREED.
 */
async function freeSlot(slotId, reason) {
  const slot = await Slot.findById(slotId);
  if (!slot) {
    const err = new Error('Slot not found');
    err.statusCode = 404;
    throw err;
  }

  const previousStatus = slot.status;
  if (['Completed'].includes(previousStatus)) {
    const err = new Error(`Cannot free a slot with status "${previousStatus}"`);
    err.statusCode = 400;
    throw err;
  }

  slot.status = 'Available';
  slot.appointment = null;
  await slot.save();

  // ★ Event-Driven: emit slot freed — triggers walk-in auto-assignment
  emitter.emit(EVENTS.SLOT_FREED, {
    slot,
    previousStatus,
    reason: reason || 'Slot freed',
    targetModel: 'Slot',
  });

  return slot;
}

/**
 * Start a slot (check-in).
 * Reserved-Confirmed → In Progress
 */
async function startSlot(slotId) {
  const slot = await Slot.findById(slotId);
  if (!slot) {
    const err = new Error('Slot not found');
    err.statusCode = 404;
    throw err;
  }
  if (slot.status !== 'Reserved-Confirmed') {
    const err = new Error(`Cannot start slot with status "${slot.status}"`);
    err.statusCode = 400;
    throw err;
  }

  slot.status = 'In Progress';
  await slot.save();
  return slot;
}

/**
 * Complete a slot.
 * In Progress → Completed
 */
async function completeSlot(slotId) {
  const slot = await Slot.findById(slotId);
  if (!slot) {
    const err = new Error('Slot not found');
    err.statusCode = 404;
    throw err;
  }
  if (slot.status !== 'In Progress') {
    const err = new Error(`Cannot complete slot with status "${slot.status}"`);
    err.statusCode = 400;
    throw err;
  }

  slot.status = 'Completed';
  await slot.save();
  return slot;
}

module.exports = {
  generateSlotsForDoctor,
  getAvailableSlots,
  getAllSlots,
  getAllSlotsForDate,
  getById,
  reserveSlot,
  confirmSlot,
  freeSlot,
  startSlot,
  completeSlot,
};
