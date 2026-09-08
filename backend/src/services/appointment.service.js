/**
 * Appointment Service
 * ───────────────────
 * Module 2: Appointment Module
 * Module 4: Version Tracking (statusHistory pushes)
 * Layer:    Business Logic
 *
 * Core business logic for booking, approval, decline, cancellation,
 * check-in, document upload, and completion.
 * Emits events on every state transition.
 */

const Appointment = require('../models/Appointment');
const WalkIn = require('../models/WalkIn');
const slotService = require('./slot.service');
const emitter = require('../events/emitter');
const EVENTS = require('../events/events');

/**
 * Book a new appointment (patient action).
 */
async function create({ patientId, doctorId, date, timeSlot, slotId, reason }) {
  let resolvedDoctorId = doctorId || null;
  let resolvedDate = date;
  let resolvedTimeSlot = timeSlot;

  // If slotId is provided, validate & reserve slot
  if (slotId) {
    const slot = await slotService.getById(slotId);
    if (!slot) {
      const err = new Error('Selected slot not found');
      err.statusCode = 404;
      throw err;
    }
    resolvedDoctorId = slot.doctor._id || slot.doctor;
    resolvedDate = slot.date;
    resolvedTimeSlot = `${slot.startTime}-${slot.endTime}`;
  }

  const appointment = await Appointment.create({
    patient: patientId,
    doctor: resolvedDoctorId,
    slot: slotId || null,
    date: resolvedDate,
    timeSlot: resolvedTimeSlot,
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

  // Reserve slot if linked
  if (slotId) {
    await slotService.reserveSlot(slotId, appointment._id);
  }

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
 * Transitions status: Pending → Confirmed, slot: Reserved (confirmed)
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

  // If linked to a slot, transition slot to Reserved-Confirmed
  if (appointment.slot) {
    await slotService.confirmSlot(appointment.slot);
  }

  // ★ Event-Driven: emit approval event (notifies BOTH patient and doctor)
  emitter.emit(EVENTS.APPOINTMENT_APPROVED, {
    appointment,
    performedBy: staffId,
    targetModel: 'Appointment',
  });

  return appointment;
}

/**
 * Decline an appointment (Staff or Doctor action while Pending).
 * Transitions status: Pending → Declined, frees slot, emits slot.freed
 */
async function decline(appointmentId, userId, reason) {
  if (!reason || !reason.trim()) {
    const err = new Error('Reason is required when declining an appointment');
    err.statusCode = 400;
    throw err;
  }

  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) {
    const err = new Error('Appointment not found');
    err.statusCode = 404;
    throw err;
  }
  if (appointment.status !== 'Pending') {
    const err = new Error(`Cannot decline an appointment with status "${appointment.status}"`);
    err.statusCode = 400;
    throw err;
  }

  appointment.status = 'Declined';
  appointment.declineReason = reason;
  appointment.statusHistory.push({
    status: 'Declined',
    changedBy: userId,
    remarks: reason,
  });
  await appointment.save();

  // Free linked slot
  if (appointment.slot) {
    await slotService.freeSlot(appointment.slot, `Declined: ${reason}`);
  }

  // ★ Event-Driven: emit decline event
  emitter.emit(EVENTS.APPOINTMENT_DECLINED, {
    appointment,
    performedBy: userId,
    reason,
    targetModel: 'Appointment',
  });

  return appointment;
}

/**
 * Cancel an appointment (Patient or Doctor action).
 * Emits slot.freed.
 */
async function cancel(appointmentId, userId, reason) {
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) {
    const err = new Error('Appointment not found');
    err.statusCode = 404;
    throw err;
  }
  if (['Completed', 'Cancelled', 'Declined', 'No-show'].includes(appointment.status)) {
    const err = new Error(`Cannot cancel an appointment with status "${appointment.status}"`);
    err.statusCode = 400;
    throw err;
  }

  const previousStatus = appointment.status;
  appointment.status = 'Cancelled';
  appointment.declineReason = reason || 'Cancelled by user';
  appointment.statusHistory.push({
    status: 'Cancelled',
    changedBy: userId,
    remarks: reason || 'Cancelled',
  });
  await appointment.save();

  // Free linked slot
  if (appointment.slot) {
    await slotService.freeSlot(appointment.slot, `Cancelled: ${reason || 'User cancelled'}`);
  }

  // If this was a walk-in, update walkIn status
  if (appointment.walkIn) {
    await WalkIn.findByIdAndUpdate(appointment.walkIn, { status: 'Left' });
  }

  // ★ Event-Driven: emit cancellation event
  emitter.emit(EVENTS.APPOINTMENT_CANCELLED, {
    appointment,
    previousStatus,
    performedBy: userId,
    reason: reason || 'Cancelled',
    targetModel: 'Appointment',
  });

  return appointment;
}

/**
 * Mark appointment as No-show (staff action).
 * Confirmed → No-show, emits slot.freed
 */
async function noShow(appointmentId, userId, reason) {
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) {
    const err = new Error('Appointment not found');
    err.statusCode = 404;
    throw err;
  }
  if (appointment.status !== 'Confirmed') {
    const err = new Error(`Cannot mark as No-show for appointment with status "${appointment.status}"`);
    err.statusCode = 400;
    throw err;
  }

  appointment.status = 'No-show';
  appointment.statusHistory.push({
    status: 'No-show',
    changedBy: userId,
    remarks: reason || 'Patient did not check in',
  });
  await appointment.save();

  // Free linked slot
  if (appointment.slot) {
    await slotService.freeSlot(appointment.slot, 'Patient marked No-show');
  }

  if (appointment.walkIn) {
    await WalkIn.findByIdAndUpdate(appointment.walkIn, { status: 'Left' });
  }

  emitter.emit(EVENTS.APPOINTMENT_NO_SHOW, {
    appointment,
    performedBy: userId,
    targetModel: 'Appointment',
  });

  return appointment;
}

/**
 * Check in patient on appointment day.
 * Confirmed → In Progress, slot → In Progress
 */
async function checkIn(appointmentId, userId) {
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) {
    const err = new Error('Appointment not found');
    err.statusCode = 404;
    throw err;
  }
  if (appointment.status !== 'Confirmed') {
    const err = new Error(`Cannot check in for appointment with status "${appointment.status}"`);
    err.statusCode = 400;
    throw err;
  }

  appointment.status = 'In Progress';
  appointment.statusHistory.push({
    status: 'In Progress',
    changedBy: userId,
    remarks: 'Patient checked in - consultation in progress',
  });
  await appointment.save();

  if (appointment.slot) {
    await slotService.startSlot(appointment.slot);
  }

  if (appointment.walkIn) {
    await WalkIn.findByIdAndUpdate(appointment.walkIn, { status: 'In Progress' });
  }

  emitter.emit(EVENTS.APPOINTMENT_CHECKED_IN, {
    appointment,
    performedBy: userId,
    targetModel: 'Appointment',
  });

  return appointment;
}

/**
 * Upload consultation notes and documents (Doctor action).
 */
async function uploadDocuments(appointmentId, userId, { consultationNotes, documents }) {
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) {
    const err = new Error('Appointment not found');
    err.statusCode = 404;
    throw err;
  }

  if (consultationNotes !== undefined) {
    appointment.consultationNotes = consultationNotes;
  }

  if (documents && Array.isArray(documents)) {
    for (const doc of documents) {
      appointment.documents.push({
        filename: doc.filename,
        url: doc.url || '#',
        type: doc.type || 'consultation_notes',
        uploadedAt: new Date(),
      });
    }
  }

  await appointment.save();

  emitter.emit(EVENTS.DOCUMENT_UPLOADED, {
    appointment,
    performedBy: userId,
    targetModel: 'Appointment',
  });

  return appointment;
}

/**
 * Complete appointment (Doctor/Staff action).
 * In Progress → Completed, slot → Completed
 */
async function complete(appointmentId, userId) {
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) {
    const err = new Error('Appointment not found');
    err.statusCode = 404;
    throw err;
  }
  if (appointment.status !== 'In Progress' && appointment.status !== 'Confirmed') {
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

  if (appointment.slot) {
    try {
      await slotService.completeSlot(appointment.slot);
    } catch (e) {
      // ignore if slot status was already updated
    }
  }

  if (appointment.walkIn) {
    await WalkIn.findByIdAndUpdate(appointment.walkIn, { status: 'Completed' });
  }

  emitter.emit(EVENTS.APPOINTMENT_COMPLETED, {
    appointment,
    performedBy: userId,
    targetModel: 'Appointment',
  });

  return appointment;
}

/**
 * Get a single appointment by ID.
 */
async function getById(appointmentId) {
  const appointment = await Appointment.findById(appointmentId)
    .populate('patient', 'firstName lastName email contactNumber')
    .populate('doctor', 'firstName lastName email contactNumber consultationDuration')
    .populate('slot')
    .populate('walkIn');

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
    .sort({ date: -1, createdAt: -1 })
    .populate('doctor', 'firstName lastName')
    .populate('slot');
}

/**
 * List appointments for a specific doctor.
 */
async function listByDoctor(doctorId) {
  return Appointment.find({ doctor: doctorId })
    .sort({ date: -1, createdAt: -1 })
    .populate('patient', 'firstName lastName email contactNumber')
    .populate('walkIn')
    .populate('slot');
}

/**
 * List all appointments (staff/admin view), with optional status filter.
 */
async function listAll(filters = {}) {
  const query = {};
  if (filters.status) query.status = filters.status;
  if (filters.date) query.date = { $gte: new Date(filters.date) };

  return Appointment.find(query)
    .sort({ date: -1, createdAt: -1 })
    .populate('patient', 'firstName lastName email contactNumber')
    .populate('doctor', 'firstName lastName')
    .populate('walkIn')
    .populate('slot');
}

module.exports = {
  create,
  approve,
  decline,
  cancel,
  noShow,
  checkIn,
  uploadDocuments,
  complete,
  getById,
  listByPatient,
  listByDoctor,
  listAll,
};
