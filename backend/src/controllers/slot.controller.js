/**
 * Slot Controller
 * ───────────────
 * Appointment Lifecycle — Slot Presentation Layer
 */

const slotService = require('../services/slot.service');
const { getNow } = require('../config/systemTime');
const { formatDateKey, isDateTimePassed } = require('../utils/timeHelper');
const { recordId } = require('../middleware/auth');

function visibleSlot(slot, user) {
  if (['Staff', 'Admin'].includes(user.role)) return slot;
  return { _id: slot._id, doctor: { _id: slot.doctor?._id || slot.doctor,
    firstName: slot.doctor?.firstName, lastName: slot.doctor?.lastName },
    date: slot.date, startTime: slot.startTime, endTime: slot.endTime, status: slot.status };
}

/**
 * GET /api/slots
 * Query available or all slots for a doctor & date, or across all doctors.
 * Query params: doctorId (optional), date (optional, defaults to today), status ('Available' or all)
 */
async function getSlots(req, res, next) {
  try {
    let doctorId = req.query.doctorId || req.query.doctor;
    if (req.user.role === 'Doctor') {
      const ownId = recordId(req.user._id || req.user.id);
      if (doctorId && doctorId !== ownId) throw Object.assign(new Error('You can only view your own slots'), { statusCode: 403 });
      doctorId = ownId;
    }
    const { date, status } = req.query;
    const resolvedDate = date || formatDateKey(getNow());

    let slots;
    if (doctorId) {
      if (status && status === 'Available') {
        slots = await slotService.getAvailableSlots(doctorId, resolvedDate, req.user._id || req.user.id);
      } else {
        slots = await slotService.getAllSlots(doctorId, resolvedDate, req.user._id || req.user.id);
      }
    } else {
      slots = await slotService.getAllSlotsForDate(resolvedDate, status || null, req.user._id || req.user.id);
    }

    slots = slots.filter(slot => !isDateTimePassed(slot.date, slot.startTime, 'start') && (!status || slot.status === status));
    res.json({ success: true, date: resolvedDate, count: slots.length, data: slots.map(slot => visibleSlot(slot, req.user)) });
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
    if (req.user.role === 'Doctor' && recordId(slot.doctor) !== recordId(req.user._id || req.user.id)) {
      throw Object.assign(new Error('You can only view your own slots'), { statusCode: 403 });
    }
    res.json({ success: true, data: visibleSlot(slot, req.user) });
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
      endTime || null,
      { actorId: req.user._id || req.user.id, source: 'Manual' }
    );
    res.status(201).json({ success: true, count: slots.length, data: slots.map(slot => visibleSlot(slot, req.user)) });
  } catch (err) {
    next(err);
  }
}

async function updateStatus(req, res, next) {
  try {
    const slot = await slotService.updateStatus(req.params.id, req.body.status, req.user);
    res.json({ success: true, data: visibleSlot(slot, req.user) });
  } catch (err) { next(err); }
}

module.exports = { getSlots, getById, generate, updateStatus };
