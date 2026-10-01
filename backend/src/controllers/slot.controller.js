/**
 * Slot Controller
 * ───────────────
 * Appointment Lifecycle — Slot Presentation Layer
 */

const slotService = require('../services/slot.service');
const { getNow } = require('../config/systemTime');
const { formatDateKey, isDateTimePassed } = require('../utils/timeHelper');

/**
 * GET /api/slots
 * Query available or all slots for a doctor & date, or across all doctors.
 * Query params: doctorId (optional), date (optional, defaults to today), status ('Available' or all)
 */
async function getSlots(req, res, next) {
  try {
    const doctorId = req.query.doctorId || req.query.doctor;
    const { date, status } = req.query;
    const resolvedDate = date || formatDateKey(getNow());

    let slots;
    if (doctorId) {
      if (status && status === 'Available') {
        slots = await slotService.getAvailableSlots(doctorId, resolvedDate);
      } else {
        slots = await slotService.getAllSlots(doctorId, resolvedDate);
      }
    } else {
      slots = await slotService.getAllSlotsForDate(resolvedDate, status || null);
    }

    slots = slots.filter(slot => !isDateTimePassed(slot.date, slot.startTime, 'start') && (!status || slot.status === status));
    res.json({ success: true, date: resolvedDate, count: slots.length, data: slots });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/slots/:id
 */
async function getById(req, res, next) {
  try {
    const slot = await slotService.getById(req.params.id);
    res.json({ success: true, data: slot });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/slots/generate
 * Force slot generation for a doctor and date.
 */
async function generate(req, res, next) {
  try {
    const { doctorId, doctor, date, startTime, endTime, duration } = req.body;
    const targetDoctorId = doctorId || doctor;
    const resolvedDate = date || formatDateKey(getNow());

    if (!targetDoctorId) {
      return res.status(400).json({
        success: false,
        message: 'Doctor ID is required to generate slots',
      });
    }
    if (req.user.role === 'Doctor' && String(targetDoctorId) !== String(req.user._id || req.user.id)) {
      return res.status(403).json({ success: false, message: 'You can only generate your own slots' });
    }
    const slots = await slotService.generateSlotsForDoctor(
      targetDoctorId,
      resolvedDate,
      duration === undefined ? null : Number(duration),
      startTime || null,
      endTime || null
    );
    res.status(201).json({ success: true, count: slots.length, data: slots });
  } catch (err) {
    next(err);
  }
}

async function updateStatus(req, res, next) {
  try {
    const slot = await slotService.updateStatus(req.params.id, req.body.status, req.user);
    res.json({ success: true, data: slot });
  } catch (err) { next(err); }
}

module.exports = { getSlots, getById, generate, updateStatus };
