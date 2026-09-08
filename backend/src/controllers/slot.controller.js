/**
 * Slot Controller
 * ───────────────
 * Appointment Lifecycle — Slot Presentation Layer
 */

const slotService = require('../services/slot.service');

/**
 * GET /api/slots
 * Query available or all slots for a doctor & date.
 * Query params: doctorId (required), date (required), status ('Available' or all)
 */
async function getSlots(req, res, next) {
  try {
    const { doctorId, date, status } = req.query;
    if (!doctorId || !date) {
      return res.status(400).json({
        success: false,
        message: 'Both doctorId and date query parameters are required',
      });
    }

    let slots;
    if (status && status !== 'Available') {
      slots = await slotService.getAllSlots(doctorId, date);
    } else {
      slots = await slotService.getAvailableSlots(doctorId, date);
    }

    res.json({ success: true, data: slots });
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
    const { doctorId, date } = req.body;
    if (!doctorId || !date) {
      return res.status(400).json({
        success: false,
        message: 'Both doctorId and date are required',
      });
    }
    const slots = await slotService.generateSlotsForDoctor(doctorId, date);
    res.status(201).json({ success: true, count: slots.length, data: slots });
  } catch (err) {
    next(err);
  }
}

module.exports = { getSlots, getById, generate };
