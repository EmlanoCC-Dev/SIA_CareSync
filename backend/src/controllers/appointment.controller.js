/**
 * Appointment Controller
 * ──────────────────────
 * Module 2: Appointment Module
 * Layer:    Presentation
 *
 * Thin HTTP layer — parses request, delegates to service,
 * formats response. No business logic here.
 */

const appointmentService = require('../services/appointment.service');

/**
 * POST /api/appointments
 * Book a new appointment (patient).
 */
async function create(req, res, next) {
  try {
    const { doctorId, date, timeSlot, reason } = req.body;
    const appointment = await appointmentService.create({
      patientId: req.user.id,
      doctorId,
      date,
      timeSlot,
      reason,
    });
    res.status(201).json({ success: true, data: appointment });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/appointments/:id/approve
 * Approve a pending appointment (staff/admin).
 */
async function approve(req, res, next) {
  try {
    const appointment = await appointmentService.approve(req.params.id, req.user.id);
    res.json({ success: true, data: appointment });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/appointments/:id/cancel
 * Cancel an appointment (any authorized user).
 */
async function cancel(req, res, next) {
  try {
    const { reason } = req.body;
    const appointment = await appointmentService.cancel(req.params.id, req.user.id, reason);
    res.json({ success: true, data: appointment });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/appointments/:id/complete
 * Mark an appointment as completed (doctor/staff).
 */
async function complete(req, res, next) {
  try {
    const appointment = await appointmentService.complete(req.params.id, req.user.id);
    res.json({ success: true, data: appointment });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/appointments/:id
 * Get a single appointment by ID.
 */
async function getById(req, res, next) {
  try {
    const appointment = await appointmentService.getById(req.params.id);
    res.json({ success: true, data: appointment });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/appointments
 * List appointments — patients see their own; staff/admin see all.
 */
async function list(req, res, next) {
  try {
    let appointments;
    if (req.user.role === 'Patient') {
      appointments = await appointmentService.listByPatient(req.user.id);
    } else {
      appointments = await appointmentService.listAll({
        status: req.query.status,
        date: req.query.date,
      });
    }
    res.json({ success: true, data: appointments });
  } catch (err) {
    next(err);
  }
}

module.exports = { create, approve, cancel, complete, getById, list };
