/**
 * Appointment Service
 * ───────────────────
 * Module 2: Appointment Module
 * Module 4: Version Tracking (statusHistory pushes)
 * Layer:    Business Logic
 *
 * Core business logic for booking, approval, cancellation.
 * Emits events on every state transition — handlers in the
 * events/ layer react (notifications, audit log, etc.).
 */

const Appointment = require('../models/Appointment');
const emitter = require('../events/emitter');
const EVENTS = require('../events/events');

/**
 * Book a new appointment (patient action).
 */
async function create({ patientId, doctorId, date, timeSlot, reason }) {
  const appointment = await Appointment.create({
    patient: patientId,
    doctor: doctorId || null,
    date,
    timeSlot,
    reason,
    status: 'Pending',
    statusHistory: [
      {
        status: 'Pending',
        changedBy: patientId,
        remarks: 'Appointment booked by patient',
      },
    ],
  });

  // ★ Event-Driven: emit booking event
  emitter.emit(EVENTS.APPOINTMENT_BOOKED, {
    appointment,
    performedBy: patientId,
    targetModel: 'Appointment',
  });

  return appointment;
}

/**
 * Approve an appointment (staff/admin action).
 * Transitions status: Pending → Confirmed
 */
async function approve(appointmentId, staffId) {
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) {
    const err = new Error('Appointment not found');
    err.statusCode = 404;
    throw err;
  }
  if (appointment.status !== 'Pending') {
    const err = new Error(`Cannot approve an appointment with status "${appointment.status}"`);
    err.statusCode = 400;
    throw err;
  }

  appointment.status = 'Confirmed';
  appointment.statusHistory.push({
    status: 'Confirmed',
    changedBy: staffId,
    remarks: 'Approved by staff',
  });
  await appointment.save();

  // ★ Event-Driven: emit approval event
  emitter.emit(EVENTS.APPOINTMENT_APPROVED, {
    appointment,
    performedBy: staffId,
    targetModel: 'Appointment',
  });

  return appointment;
}

/**
 * Cancel an appointment (any authorized user).
 * Can be cancelled from any non-terminal status.
 */
async function cancel(appointmentId, userId, reason) {
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) {
    const err = new Error('Appointment not found');
    err.statusCode = 404;
    throw err;
  }
  if (['Completed', 'Cancelled'].includes(appointment.status)) {
    const err = new Error(`Cannot cancel an appointment with status "${appointment.status}"`);
    err.statusCode = 400;
    throw err;
  }

  appointment.status = 'Cancelled';
  appointment.statusHistory.push({
    status: 'Cancelled',
    changedBy: userId,
    remarks: reason || 'Cancelled',
  });
  await appointment.save();

  // ★ Event-Driven: emit cancellation event
  emitter.emit(EVENTS.APPOINTMENT_CANCELLED, {
    appointment,
    performedBy: userId,
    targetModel: 'Appointment',
  });

  return appointment;
}

/**
 * Mark appointment as completed (doctor/staff action).
 */
async function complete(appointmentId, userId) {
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) {
    const err = new Error('Appointment not found');
    err.statusCode = 404;
    throw err;
  }
  if (appointment.status !== 'Confirmed') {
    const err = new Error(`Cannot complete an appointment with status "${appointment.status}"`);
    err.statusCode = 400;
    throw err;
  }

  appointment.status = 'Completed';
  appointment.statusHistory.push({
    status: 'Completed',
    changedBy: userId,
    remarks: 'Appointment completed',
  });
  await appointment.save();

  emitter.emit(EVENTS.APPOINTMENT_COMPLETED, {
    appointment,
    performedBy: userId,
    targetModel: 'Appointment',
  });

  return appointment;
}

/**
 * Get a single appointment by ID (populated with patient & doctor names).
 */
async function getById(appointmentId) {
  const appointment = await Appointment.findById(appointmentId)
    .populate('patient', 'firstName lastName email')
    .populate('doctor', 'firstName lastName email');

  if (!appointment) {
    const err = new Error('Appointment not found');
    err.statusCode = 404;
    throw err;
  }
  return appointment;
}

/**
 * List appointments for a specific patient.
 */
async function listByPatient(patientId) {
  return Appointment.find({ patient: patientId })
    .sort({ date: -1 })
    .populate('doctor', 'firstName lastName');
}

/**
 * List all appointments (staff/admin view), with optional status filter.
 */
async function listAll(filters = {}) {
  const query = {};
  if (filters.status) query.status = filters.status;
  if (filters.date) query.date = { $gte: new Date(filters.date) };

  return Appointment.find(query)
    .sort({ date: -1 })
    .populate('patient', 'firstName lastName email')
    .populate('doctor', 'firstName lastName');
}

module.exports = {
  create,
  approve,
  cancel,
  complete,
  getById,
  listByPatient,
  listAll,
};
