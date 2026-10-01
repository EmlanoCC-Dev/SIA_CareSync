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
const Slot = require('../models/Slot');
const slotService = require('./slot.service');
const emitter = require('../events/emitter');
const EVENTS = require('../events/events');
const { isDateTimePassed, parseDateOnly } = require('../utils/timeHelper');
const { getNow } = require('../config/systemTime');

/**
 * Automatically update missed / passed appointments to 'No-show'.
 * Transitions any Pending or Confirmed appointments whose scheduled time has passed.
 */
async function autoMarkNoShows() {
  try {
    const pendingOrConfirmed = await Appointment.find({
      status: { $in: ['Pending', 'Confirmed'] },
    }).populate('slot');

    const now = getNow();
    const updated = [];

    for (const app of pendingOrConfirmed) {
      const slotTime = app.slot ? `${app.slot.startTime}-${app.slot.endTime}` : app.timeSlot;
      const slotDate = app.slot ? app.slot.date : app.date;

      // Check if appointment end time has passed
      if (isDateTimePassed(slotDate, slotTime, 'end')) {
        const previousStatus = app.status;
        app.status = 'No-show';
        app.statusHistory.push({
          status: 'No-show',
          changedBy: app.doctor || app.patient,
          changedAt: now,
          remarks: 'Automatically marked No-show (appointment time passed)',
        });

        await app.save();

        if (app.walkIn) {
          await WalkIn.findByIdAndUpdate(app.walkIn, { status: 'Left' });
        }

        emitter.emit(EVENTS.APPOINTMENT_NO_SHOW, {
          appointment: app,
          previousStatus,
          autoMarked: true,
          targetModel: 'Appointment',
        });

        updated.push(app._id);
      }
    }

    return updated;
  } catch (err) {
    console.error('Error running autoMarkNoShows:', err);
    return [];
  }
}

/**
 * Book a new appointment (patient action).
 */
async function create({ patientId, doctorId, date, timeSlot, slotId, reason }) {
  if (doctorId && !slotId) {
    throw Object.assign(new Error('Choose an available slot for the selected doctor, or request any available doctor'), { statusCode: 400 });
  }
  let resolvedDoctorId = doctorId || null;
  let resolvedDate = slotId ? date : parseDateOnly(date);
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

  // Validate that the requested date and time has not already passed
  if (isDateTimePassed(resolvedDate, resolvedTimeSlot, 'start')) {
    const err = new Error('Cannot book an appointment for a time slot that has already passed');
    err.statusCode = 400;
    throw err;
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
    try {
      await slotService.reserveSlot(slotId, appointment._id);
    } catch (err) {
      await Appointment.deleteOne({ _id: appointment._id });
      throw err;
    }
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

  if (!appointment.slot || !appointment.doctor) {
    throw Object.assign(new Error('Assign a doctor and time slot before approving this request'), { statusCode: 400 });
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
    appointment.documents = documents;
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
 * Attach a newly uploaded physical file to an appointment.
 */
async function attachFile(appointmentId, userId, { filename, url, type }) {
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) {
    const err = new Error('Appointment not found');
    err.statusCode = 404;
    throw err;
  }

  const newDoc = {
    filename,
    url,
    type: type || 'general',
    uploadedAt: new Date(),
  };

  appointment.documents.push(newDoc);
  await appointment.save();

  emitter.emit(EVENTS.DOCUMENT_UPLOADED, {
    appointment,
    performedBy: userId,
    targetModel: 'Appointment',
  });

  return {
    appointment,
    document: appointment.documents[appointment.documents.length - 1],
  };
}

/**
 * Remove an attached document from an appointment.
 */
async function removeDocument(appointmentId, docId) {
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) {
    const err = new Error('Appointment not found');
    err.statusCode = 404;
    throw err;
  }

  appointment.documents = appointment.documents.filter(
    (doc) => doc._id.toString() !== docId.toString()
  );

  await appointment.save();
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
  await autoMarkNoShows();

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
  await autoMarkNoShows();

  return Appointment.find({ patient: patientId })
    .sort({ date: -1, createdAt: -1 })
    .populate('doctor', 'firstName lastName')
    .populate('slot');
}

/**
 * List appointments for a specific doctor.
 */
async function listByDoctor(doctorId) {
  await autoMarkNoShows();

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
  await autoMarkNoShows();

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

async function assignSlot(appointmentId, slotId, staffId) {
  if (!slotId) throw Object.assign(new Error('A slot is required'), { statusCode: 400 });
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) throw Object.assign(new Error('Appointment not found'), { statusCode: 404 });
  if (appointment.status !== 'Pending' || appointment.slot || appointment.walkIn) {
    throw Object.assign(new Error('Only pending patient requests without a slot can be assigned'), { statusCode: 409 });
  }
  const slot = await slotService.getById(slotId);
  if (new Date(appointment.date).toISOString().slice(0, 10) !== new Date(slot.date).toISOString().slice(0, 10)) {
    throw Object.assign(new Error('Choose a slot on the requested appointment date'), { statusCode: 400 });
  }
  const reserved = await slotService.reserveSlot(slotId, appointment._id);
  let assigned;
  try {
    assigned = await Appointment.findOneAndUpdate(
      { _id: appointmentId, status: 'Pending', slot: null, walkIn: null, date: appointment.date },
      { $set: { slot: reserved._id, doctor: reserved.doctor, date: reserved.date,
        timeSlot: `${reserved.startTime}-${reserved.endTime}` },
        $push: { statusHistory: { status: 'Pending', changedBy: staffId, changedAt: getNow(),
          remarks: 'Doctor and consultation slot assigned by staff' } } },
      { new: true, runValidators: true }
    );
    if (!assigned) throw Object.assign(new Error('This request was changed or assigned already. Refresh and try again.'), { statusCode: 409 });
  } catch (err) {
    // ponytail: compensating rollback; use a MongoDB transaction if cross-record atomicity is required.
    await Slot.updateOne({ _id: slotId, appointment: appointment._id, status: 'Reserved-Tentative' },
      { $set: { status: 'Available', appointment: null } });
    throw err;
  }
  emitter.emit(EVENTS.APPOINTMENT_ASSIGNED, { appointment: assigned, performedBy: staffId, targetModel: 'Appointment' });
  return assigned;
}

module.exports = {
  assignSlot,
  create,
  approve,
  decline,
  cancel,
  noShow,
  checkIn,
  uploadDocuments,
  attachFile,
  removeDocument,
  complete,
  getById,
  listByPatient,
  listByDoctor,
  listAll,
  autoMarkNoShows,
};
