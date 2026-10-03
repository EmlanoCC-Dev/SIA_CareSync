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
const AppointmentComment = require('../models/AppointmentComment');
const WalkIn = require('../models/WalkIn');
const Slot = require('../models/Slot');
const slotService = require('./slot.service');
const emitter = require('../events/emitter');
const EVENTS = require('../events/events');
const { isDateTimePassed, parseDateOnly, formatDateKey } = require('../utils/timeHelper');
const { assertAppointmentAccess, recordId } = require('../middleware/auth');
const { getNow } = require('../config/systemTime');
const recovery = require('./assignmentRecovery.service');
const mongoose = require('mongoose');

/**
 * Automatically update missed / passed appointments to 'No-show'.
 * Transitions any Pending or Confirmed appointments whose scheduled time has passed.
 */
async function autoMarkNoShows() {
  try {
    const pendingOrConfirmed = await Appointment.find({
      status: { $in: ['Pending', 'Needs correction', 'Confirmed', 'No-show'] },
    }).populate('slot').populate('walkIn');

    const now = getNow();
    const updated = [];

    for (const app of pendingOrConfirmed) {
      // Arrival is separate from starting the consultation in the walk-in queue.
      if (app.status === 'Checked In' || app.walkIn?.status === 'Checked In') continue;
      const slotTime = app.slot ? `${app.slot.startTime}-${app.slot.endTime}` : app.timeSlot;
      const slotDate = app.slot ? app.slot.date : app.date;

      // Check if appointment end time has passed
      if (isDateTimePassed(slotDate, slotTime, 'end')) {
        const previousStatus = app.status;
        if (previousStatus !== 'No-show') {
          const claimed = await Appointment.findOneAndUpdate(
            { _id: app._id, status: previousStatus },
            { $set: { status: 'No-show' }, $push: { statusHistory: {
              status: 'No-show', changedBy: app.doctor || app.patient, changedAt: now,
              remarks: 'Automatically marked No-show (appointment time passed)',
            } } }, { new: true }
          );
          if (!claimed) continue; // A competing consultation/status action won.
          app.status = 'No-show';
          app.statusHistory = claimed.statusHistory;
          emitter.emit(EVENTS.APPOINTMENT_NO_SHOW, {
            appointment: app, previousStatus, autoMarked: true, targetModel: 'Appointment',
          });
          updated.push(app._id);
        }

        // Also repair a previous run interrupted after the appointment write.
        if (app.slot && String(app.slot.appointment) === String(app._id) &&
            ['Reserved-Tentative', 'Reserved-Confirmed'].includes(app.slot.status)) {
          await slotService.freeSlot(app.slot._id, 'Appointment automatically marked No-show', app._id, 'No-show');
        }

        if (app.walkIn && !['Left', 'Completed', 'In Progress'].includes(app.walkIn.status)) {
          await WalkIn.findOneAndUpdate({ _id: app.walkIn._id || app.walkIn,
            status: { $in: ['Waiting', 'Slot Assigned'] } }, { $set: { status: 'Left' } });
        }

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

  const appointmentId = new mongoose.Types.ObjectId();
  const operation = slotId ? await recovery.begin({ kind: 'booking', appointment: appointmentId, slot: slotId }) : null;
  let appointment;
  try {
    if (slotId) await slotService.reserveSlot(slotId, appointmentId, operation._id);
    appointment = await Appointment.create({
    _id: appointmentId,
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

  } catch (err) {
    if (operation) await recovery.onFailure(operation, err);
    throw err;
  }
  if (operation) await recovery.finish(operation);

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

  const approved = await Appointment.findOneAndUpdate(
    { ...bookingMatch(appointment), status: 'Pending' },
    { $set: { status: 'Confirmed' }, $push: { statusHistory: {
      status: 'Confirmed', changedBy: staffId, changedAt: getNow(), remarks: 'Approved by staff',
    } } }, { new: true, runValidators: true }
  );
  if (!approved) throw Object.assign(new Error('This request changed. Refresh before approving.'), { statusCode: 409 });
  try {
    await slotService.confirmSlot(approved.slot, approved._id);
  } catch (err) {
    // A database acknowledgement failure may follow a committed slot confirmation.
    // Only undo an approval when the reservation was explicitly rejected.
    if (![400, 404, 409].includes(err.statusCode)) throw err;
    await Appointment.findOneAndUpdate({ ...bookingMatch(approved), status: 'Confirmed' },
      { $set: { status: 'Pending' }, $pop: { statusHistory: 1 } }, { new: true });
    throw err;
  }

  // ★ Event-Driven: emit approval event (notifies BOTH patient and doctor)
  emitter.emit(EVENTS.APPOINTMENT_APPROVED, {
    appointment: approved,
    performedBy: staffId,
    targetModel: 'Appointment',
  });

  return approved;
}

/**
 * Decline an appointment (Staff or Doctor action while Pending).
 * Transitions status: Pending → Declined, frees slot, emits slot.freed
 */
async function decline(appointmentId, userId, reason) {
  if (typeof reason !== 'string' || !reason.trim()) {
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

  const declined = await Appointment.findOneAndUpdate(
    { ...bookingMatch(appointment), status: 'Pending' },
    { $set: { status: 'Declined', declineReason: reason.trim() }, $push: { statusHistory: {
      status: 'Declined', changedBy: userId, changedAt: getNow(), remarks: reason.trim(),
    } } }, { new: true, runValidators: true }
  );
  if (!declined) throw Object.assign(new Error('This request changed. Refresh before declining.'), { statusCode: 409 });

  // Free linked slot
  if (appointment.slot) {
    await slotService.freeSlot(appointment.slot, `Declined: ${reason}`, appointment._id);
  }

  // ★ Event-Driven: emit decline event
  emitter.emit(EVENTS.APPOINTMENT_DECLINED, {
    appointment: declined,
    performedBy: userId,
    reason,
    targetModel: 'Appointment',
  });

  return declined;
}

// Include the revision so a Pending -> correction -> Pending cycle invalidates stale reviews.
// Legacy records have no revision until their first correction.
function bookingMatch(appointment) {
  return { _id: appointment._id, slot: appointment.slot || null, doctor: appointment.doctor || null,
    date: appointment.date, reason: appointment.reason,
    bookingRevision: appointment.bookingRevision || { $in: [null, 0] } };
}

async function reviseBooking(appointmentId, actor, data, resubmitting) {
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) throw Object.assign(new Error('Appointment not found'), { statusCode: 404 });
  assertAppointmentAccess(appointment, actor);
  if (!(resubmitting ? actor.role === 'Patient' : ['Staff', 'Admin'].includes(actor.role))) {
    throw Object.assign(new Error('You cannot perform this booking action'), { statusCode: 403 });
  }
  if (appointment.walkIn || !appointment.patient) {
    throw Object.assign(new Error('Corrections are available for patient bookings only'), { statusCode: 409 });
  }
  const allowedFields = resubmitting ? ['reason', 'bookingRevision'] : ['explanation', 'bookingRevision'];
  if (Object.keys(data).some(field => !allowedFields.includes(field))) {
    throw Object.assign(new Error('Only the booking reason can be corrected; doctor, date, slot and clinical records are fixed'), { statusCode: 400 });
  }
  const text = resubmitting ? data.reason : data.explanation;
  if (typeof text !== 'string' || !text.trim() || text.trim().length > 2000) {
    throw Object.assign(new Error(`${resubmitting ? 'Reason for visit' : 'Correction explanation'} must contain 1 to 2000 characters`), { statusCode: 400 });
  }
  const previousStatus = resubmitting ? 'Needs correction' : 'Pending';
  if (!Number.isSafeInteger(data.bookingRevision) || data.bookingRevision < 0) {
    throw Object.assign(new Error('A valid booking revision is required'), { statusCode: 400 });
  }
  if (appointment.status !== previousStatus || data.bookingRevision !== (appointment.bookingRevision || 0)) {
    throw Object.assign(new Error('This request changed. Refresh its history before continuing.'), { statusCode: 409 });
  }
  if (resubmitting && text.trim() === appointment.reason) {
    throw Object.assign(new Error('Update the reason for visit before resubmitting'), { statusCode: 400 });
  }
  if (isDateTimePassed(appointment.date, appointment.timeSlot, 'start')) {
    throw Object.assign(new Error('This appointment time has passed. Cancel it or contact the clinic to book a new visit.'), { statusCode: 409 });
  }
  if (appointment.slot) {
    const slot = await Slot.findById(appointment.slot);
    if (!slot || slot.status !== 'Reserved-Tentative' || recordId(slot.appointment) !== recordId(appointment) ||
        recordId(slot.doctor) !== recordId(appointment.doctor) ||
        new Date(slot.date).toISOString().slice(0, 10) !== new Date(appointment.date).toISOString().slice(0, 10) ||
        appointment.timeSlot !== `${slot.startTime}-${slot.endTime}` || isDateTimePassed(slot.date, slot.startTime, 'start')) {
      throw Object.assign(new Error('The original reservation is no longer valid. Contact the clinic.'), { statusCode: 409 });
    }
  }
  const changedAt = getNow();
  const changedBy = actor._id || actor.id;
  const revision = data.bookingRevision + 1;
  const status = resubmitting ? 'Pending' : 'Needs correction';
  const action = resubmitting ? 'Resubmitted' : 'Correction requested';
  const reason = resubmitting ? text.trim() : appointment.reason;
  const updated = await Appointment.findOneAndUpdate(
    { ...bookingMatch(appointment), patient: appointment.patient, status: previousStatus, walkIn: null },
    { $set: { status, reason, bookingRevision: revision }, $push: {
      bookingHistory: { revision, action, previousReason: appointment.reason, reason,
        explanation: resubmitting ? '' : text.trim(), changedBy, changedAt,
        actorName: [actor.firstName, actor.lastName].filter(Boolean).join(' ') || actor.role, actorRole: actor.role },
      statusHistory: { status, changedBy, changedAt, remarks: action },
    } }, { new: true, runValidators: true }
  );
  if (!updated) throw Object.assign(new Error('This request changed. Refresh its history before continuing.'), { statusCode: 409 });
  emitter.emit(resubmitting ? EVENTS.APPOINTMENT_RESUBMITTED : EVENTS.REVISION_REQUESTED, {
    appointment: { _id: updated._id, patient: updated.patient, doctor: updated.doctor, date: updated.date, timeSlot: updated.timeSlot },
    performedBy: changedBy, bookingRevision: revision, fromStatus: previousStatus, toStatus: status,
    changedFields: resubmitting ? ['reason', 'status'] : ['status'],
  });
  return updated;
}

const requestCorrection = (id, actor, data) => reviseBooking(id, actor, data, false);
const resubmit = (id, actor, data) => reviseBooking(id, actor, data, true);

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
  const cancelled = await Appointment.findOneAndUpdate(
    { _id: appointmentId, status: previousStatus },
    { $set: { status: 'Cancelled', declineReason: reason || 'Cancelled by user' },
      $push: { statusHistory: { status: 'Cancelled', changedBy: userId, changedAt: getNow(), remarks: reason || 'Cancelled' } } }, { new: true }
  );
  if (!cancelled) throw Object.assign(new Error('Appointment changed; refresh before cancelling'), { statusCode: 409 });
  appointment.status = cancelled.status;
  appointment.statusHistory = cancelled.statusHistory;
  appointment.declineReason = cancelled.declineReason;

  // Free linked slot
  if (appointment.slot) {
    await slotService.freeSlot(appointment.slot, `Cancelled: ${reason || 'User cancelled'}`, appointment._id);
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

  if (appointment.walkIn) {
    const walkIn = await WalkIn.findById(appointment.walkIn);
    if (walkIn?.status === 'Checked In') throw Object.assign(new Error('This patient has already arrived'), { statusCode: 409 });
  }
  const marked = await Appointment.findOneAndUpdate(
    { _id: appointmentId, status: 'Confirmed' },
    { $set: { status: 'No-show' }, $push: { statusHistory: {
      status: 'No-show', changedBy: userId, changedAt: getNow(), remarks: reason || 'Patient did not check in',
    } } }, { new: true }
  );
  if (!marked) throw Object.assign(new Error('Appointment changed; refresh before marking no-show'), { statusCode: 409 });
  appointment.status = marked.status;
  appointment.statusHistory = marked.statusHistory;

  // Free linked slot
  if (appointment.slot) {
    const slot = await slotService.getById(appointment.slot);
    await slotService.freeSlot(slot._id, 'Patient marked No-show', appointment._id,
      isDateTimePassed(slot.date, slot.endTime, 'end') ? 'No-show' : 'Available');
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
 * Confirmed → Checked In; keep the slot reserved until consultation starts.
 */
async function checkIn(appointmentId, actor) {
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) {
    const err = new Error('Appointment not found');
    err.statusCode = 404;
    throw err;
  }
  if (appointment.status !== 'Confirmed') {
    const err = new Error(`Cannot check in for appointment with status "${appointment.status}"`);
    err.statusCode = 409;
    throw err;
  }
  if (appointment.walkIn) {
    await require('./walkIn.service').updateStatus(recordId(appointment.walkIn), 'Checked In', actor);
    return Appointment.findById(appointmentId);
  }
  assertAppointmentAccess(appointment, actor);
  const now = getNow(), queueDay = formatDateKey(now);
  if (new Date(appointment.date).toISOString().slice(0, 10) !== queueDay) {
    throw Object.assign(new Error('Check-in is only available on the appointment day'), { statusCode: 400 });
  }
  const slot = appointment.slot ? await Slot.findById(appointment.slot) : null;
  if (!slot || slot.status !== 'Reserved-Confirmed' || recordId(slot.appointment) !== recordId(appointment._id) ||
      recordId(slot.doctor) !== recordId(appointment.doctor)) {
    throw Object.assign(new Error('The appointment does not have a matching confirmed reservation'), { statusCode: 409 });
  }
  if (isDateTimePassed(slot.date, slot.endTime, 'end')) {
    throw Object.assign(new Error('The appointment time has passed; check its no-show status'), { statusCode: 400 });
  }
  await Appointment.init();
  const last = await Appointment.findOne({ queueDay }).sort({ queueNumber: -1 });
  let queueNumber = (last?.queueNumber || 0) + 1, arrived;
  // ponytail: unique-index retries suit clinic traffic; use an atomic daily counter if check-in contention becomes heavy.
  for (;;) {
    try {
      arrived = await Appointment.findOneAndUpdate(
        { _id: appointmentId, status: 'Confirmed', slot: appointment.slot, doctor: appointment.doctor, date: appointment.date },
        { $set: { status: 'Checked In', checkedInAt: now, queueDay, queueNumber },
          $push: { statusHistory: { status: 'Checked In', changedBy: actor._id || actor.id, changedAt: now,
            remarks: `Patient arrived and is waiting — queue #A-${queueNumber}` } } },
        { new: true, runValidators: true }
      );
      if (!arrived) throw Object.assign(new Error('Appointment changed; refresh before retrying'), { statusCode: 409 });
      break;
    } catch (err) {
      if (err.code !== 11000 || !err.keyPattern?.queueDay || !err.keyPattern?.queueNumber) throw err;
      queueNumber++;
    }
  }
  emitter.emit(EVENTS.APPOINTMENT_CHECKED_IN, { appointment: arrived, performedBy: actor._id || actor.id, targetModel: 'Appointment' });
  return arrived;
}

async function startConsultation(appointmentId, actor) {
  return updateConsultation(appointmentId, actor, 'In Progress');
}

async function updateConsultation(appointmentId, actor, status) {
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) throw Object.assign(new Error('Appointment not found'), { statusCode: 404 });
  assertAppointmentAccess(appointment, actor);
  if (appointment.walkIn) {
    await require('./walkIn.service').updateStatus(recordId(appointment.walkIn), status, actor);
    return Appointment.findById(appointmentId);
  }
  const previousStatus = status === 'In Progress' ? 'Checked In' : 'In Progress';
  if (appointment.status !== previousStatus) {
    throw Object.assign(new Error(`Cannot ${status === 'In Progress' ? 'start consultation before check-in' : 'complete a consultation that has not started'}`), { statusCode: 409 });
  }
  if (status === 'In Progress' && new Date(appointment.date).toISOString().slice(0, 10) !== formatDateKey(getNow())) {
    throw Object.assign(new Error('Start consultation on the appointment day'), { statusCode: 400 });
  }
  const history = { status, changedBy: actor._id || actor.id, changedAt: getNow(),
    remarks: status === 'In Progress' ? 'Doctor started consultation' : 'Consultation completed' };
  const changed = await Appointment.findOneAndUpdate(
    { _id: appointmentId, status: previousStatus, slot: appointment.slot, doctor: appointment.doctor },
    { $set: { status }, $push: { statusHistory: history } }, { new: true, runValidators: true }
  );
  if (!changed) throw Object.assign(new Error('Appointment changed; refresh before retrying'), { statusCode: 409 });
  try {
    const slot = await Slot.findOneAndUpdate(
      { _id: appointment.slot, appointment: appointment._id, doctor: appointment.doctor,
        status: status === 'In Progress' ? 'Reserved-Confirmed' : 'In Progress' },
      { $set: { status } }, { new: true }
    );
    if (!slot) throw Object.assign(new Error('Slot changed; refresh before retrying'), { statusCode: 409 });
  } catch (err) {
    // ponytail: compensating writes support standalone MongoDB; use transactions for atomic outage recovery.
    try {
      const restored = await Appointment.updateOne(
        { _id: appointmentId, status, statusHistory: { $elemMatch: history } },
        { $set: { status: previousStatus }, $pull: { statusHistory: history } }
      );
      if (!restored.modifiedCount) throw new Error('Appointment changed during recovery');
    } catch {
      throw Object.assign(new Error('Consultation update and recovery failed; ask clinic staff to reconcile the records'), { statusCode: 500 });
    }
    throw err;
  }
  emitter.emit(status === 'In Progress' ? EVENTS.APPOINTMENT_STARTED : EVENTS.APPOINTMENT_COMPLETED,
    { appointment: changed, performedBy: actor._id || actor.id, targetModel: 'Appointment' });
  return changed;
}

/**
 * Upload consultation notes and documents (Doctor action).
 */
async function uploadDocuments(appointmentId, actor, { consultationNotes, documents, notesRevision }) {
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) {
    const err = new Error('Appointment not found');
    err.statusCode = 404;
    throw err;
  }
  assertClinicalAccess(appointment, actor);

  if (consultationNotes !== undefined && typeof consultationNotes !== 'string') {
    throw Object.assign(new Error('Consultation notes must be text'), { statusCode: 400 });
  }
  // File references must come from the upload endpoint, never a caller-supplied URL.
  if (documents !== undefined && (!Array.isArray(documents) || documents.length !== appointment.documents.length ||
      documents.some(doc => !doc || !appointment.documents.some(saved => String(saved._id) === String(doc._id) &&
        saved.url === doc.url && saved.filename === doc.filename && saved.type === doc.type)))) {
    throw Object.assign(new Error('Use the file upload/delete endpoints to change documents'), { statusCode: 400 });
  }
  if (notesRevision !== undefined && (!Number.isSafeInteger(notesRevision) || notesRevision < 0)) {
    throw Object.assign(new Error('Invalid notes revision'), { statusCode: 400 });
  }
  if (consultationNotes === undefined || consultationNotes.trim() === (appointment.consultationNotes || '')) return appointment;
  const revision = appointment.notesRevision || 0;
  if (notesRevision !== undefined && notesRevision !== revision) {
    throw Object.assign(new Error('Notes were changed by another user. Close and reopen the record before saving.'), { statusCode: 409 });
  }
  const previous = noteHistory(appointment);
  const version = previous.length ? previous[previous.length - 1].version + 1 : 1;
  const snapshot = { version, notes: consultationNotes.trim(), savedAt: new Date(), savedBy: actor._id || actor.id,
    authorName: actorName(actor), authorRole: actor.role };
  // ponytail: embedded history gives one atomic write; move to a transaction-backed collection if records approach MongoDB's 16 MB limit.
  const updated = await Appointment.findOneAndUpdate(
    { _id: appointmentId, consultationNotes: appointment.consultationNotes ?? null,
      notesRevision: revision ? revision : { $in: [0, null] } },
    { $set: { consultationNotes: snapshot.notes, notesRevision: version },
      $push: { noteVersions: { $each: [...(!(appointment.noteVersions || []).length ? previous : []), snapshot] } } },
    { new: true, runValidators: true }
  );
  if (!updated) throw Object.assign(new Error('Notes changed while saving. Close and reopen the record.'), { statusCode: 409 });
  emitRecordChange(updated, actor, { operation: 'Notes updated', notesVersion: version });
  return updated;
}

/**
 * Attach a newly uploaded physical file to an appointment.
 */
async function attachFile(appointmentId, actor, { filename, url, type }, docId, expectedVersion) {
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) {
    const err = new Error('Appointment not found');
    err.statusCode = 404;
    throw err;
  }
  assertClinicalAccess(appointment, actor);
  if (typeof filename !== 'string' || !filename.trim() || typeof url !== 'string' || !url.startsWith('/uploads/') ||
      (type !== undefined && typeof type !== 'string')) {
    throw Object.assign(new Error('Invalid uploaded document metadata'), { statusCode: 400 });
  }
  const current = docId ? findCurrentDocument(appointment, docId, expectedVersion) : null;
  const newDoc = { _id: current?._id || new mongoose.Types.ObjectId(), filename: filename.trim(), url,
    type: type || current?.type || 'general', uploadedAt: new Date(), uploadedBy: actor._id || actor.id,
    uploaderName: actorName(actor), uploaderRole: actor.role, version: current ? (current.version || 1) + 1 : 1,
    versions: current ? [...(current.versions || []), documentSnapshot(current)] : [] };
  const updated = await Appointment.findOneAndUpdate(
    current ? { _id: appointmentId, documents: { $elemMatch: { _id: current._id, url: current.url } } } : { _id: appointmentId },
    current ? { $set: { 'documents.$': newDoc } } : { $push: { documents: newDoc } },
    { new: true, runValidators: true }
  );
  if (!updated) throw Object.assign(new Error('Document changed or was archived. Reopen the record before uploading.'), { statusCode: 409 });
  emitRecordChange(updated, actor, { operation: current ? 'Document replaced' : 'Document uploaded',
    document: { _id: newDoc._id, filename: newDoc.filename, type: newDoc.type, version: newDoc.version } });
  return { appointment: updated, document: updated.documents.find(doc => recordId(doc) === recordId(newDoc)) };
}

/**
 * Remove an attached document from an appointment.
 */
async function removeDocument(appointmentId, docId, actor, expectedVersion) {
  if (!mongoose.isObjectIdOrHexString(docId)) {
    throw Object.assign(new Error('Invalid document ID'), { statusCode: 400 });
  }
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) {
    const err = new Error('Appointment not found');
    err.statusCode = 404;
    throw err;
  }

  assertClinicalAccess(appointment, actor);
  const document = findCurrentDocument(appointment, docId, expectedVersion);
  const archived = { ...(document.toObject ? document.toObject() : document),
    archivedAt: new Date(), archivedBy: actor._id || actor.id, archivedByName: actorName(actor) };
  // Archive and remove the current attachment together; the files remain available in version history.
  const updated = await Appointment.findOneAndUpdate(
    { _id: appointmentId, documents: { $elemMatch: { _id: document._id, url: document.url } } },
    { $pull: { documents: { _id: docId } }, $push: { archivedDocuments: archived } }, { new: true, runValidators: true }
  );
  if (!updated) throw Object.assign(new Error('Document was already removed; refresh the appointment'), { statusCode: 409 });
  emitter.emit(EVENTS.DOCUMENT_DELETED, {
    performedBy: actor._id || actor.id, targetModel: 'Appointment', targetId: updated._id, archived: true,
    document: { _id: document._id, filename: document.filename, type: document.type },
  });
  return updated;
}

const actorName = actor => [actor.firstName, actor.lastName].filter(Boolean).join(' ') || actor.role;
function assertClinicalAccess(appointment, actor) {
  assertAppointmentAccess(appointment, actor);
  if (!['Doctor', 'Staff', 'Admin'].includes(actor.role)) throw Object.assign(new Error('Only clinic users can change the consultation record'), { statusCode: 403 });
}
function noteHistory(appointment) {
  if (appointment.noteVersions?.length) return appointment.noteVersions;
  return appointment.consultationNotes ? [{ version: 1, notes: appointment.consultationNotes,
    savedAt: null, savedBy: null, authorName: null, authorRole: null }] : [];
}
function documentSnapshot(document) {
  return { version: document.version || 1, filename: document.filename, url: document.url, type: document.type,
    uploadedAt: document.uploadedAt || null, uploadedBy: document.uploadedBy || null,
    uploaderName: document.uploaderName || null, uploaderRole: document.uploaderRole || null };
}
function findCurrentDocument(appointment, docId, expectedVersion) {
  if (!mongoose.isObjectIdOrHexString(docId)) throw Object.assign(new Error('Invalid document ID'), { statusCode: 400 });
  const document = appointment.documents.find(doc => recordId(doc) === String(docId));
  if (!document) throw Object.assign(new Error('Document not found'), { statusCode: 404 });
  if (expectedVersion !== undefined && (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1)) {
    throw Object.assign(new Error('Invalid document version'), { statusCode: 400 });
  }
  if (expectedVersion !== undefined && expectedVersion !== (document.version || 1)) {
    throw Object.assign(new Error('Document was changed. Close and reopen the record.'), { statusCode: 409 });
  }
  return document;
}
function emitRecordChange(appointment, actor, metadata) {
  emitter.emit(EVENTS.DOCUMENT_UPLOADED, { appointment: { _id: appointment._id }, performedBy: actor._id || actor.id,
    targetModel: 'Appointment', ...metadata });
}
async function getVersions(appointmentId, actor) {
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) throw Object.assign(new Error('Appointment not found'), { statusCode: 404 });
  assertAppointmentAccess(appointment, actor);
  return { notes: noteHistory(appointment), notesRevision: appointment.notesRevision || 0,
    documents: [...appointment.documents.map(doc => ({ doc, archived: false })),
      ...(appointment.archivedDocuments || []).map(doc => ({ doc, archived: true }))].map(({ doc, archived }) => ({
        _id: doc._id, filename: doc.filename, archived, archivedAt: doc.archivedAt || null,
        archivedByName: doc.archivedByName || null, version: doc.version || 1,
        versions: [...(doc.versions || []), documentSnapshot(doc)],
      })) };
}
async function getDocumentVersion(appointmentId, docId, version, actor) {
  if (!mongoose.isObjectIdOrHexString(docId) || !/^[1-9]\d*$/.test(version) || !Number.isSafeInteger(Number(version))) {
    throw Object.assign(new Error('Invalid document ID or version'), { statusCode: 400 });
  }
  const history = await getVersions(appointmentId, actor);
  const document = history.documents.find(doc => recordId(doc) === String(docId));
  const snapshot = document?.versions.find(entry => entry.version === Number(version));
  if (!snapshot) throw Object.assign(new Error('Document version not found'), { statusCode: 404 });
  return snapshot;
}

/**
 * Complete appointment (Doctor/Staff action).
 * In Progress → Completed, slot → Completed
 */
async function complete(appointmentId, actor) {
  return updateConsultation(appointmentId, actor, 'Completed');
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
    .select('-noteVersions -archivedDocuments -documents.versions')
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
    .select('-noteVersions -archivedDocuments -documents.versions')
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
    .select('-noteVersions -archivedDocuments -documents.versions')
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
  const operation = await recovery.begin({ kind: 'flex', appointment: appointment._id, slot: slotId });
  let reserved;
  let assigned;
  try {
    reserved = await slotService.reserveSlot(slotId, appointment._id, operation._id);
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
    await recovery.onFailure(operation, err);
  }
  await recovery.finish(operation);
  emitter.emit(EVENTS.APPOINTMENT_ASSIGNED, { appointment: assigned, performedBy: staffId, targetModel: 'Appointment' });
  return assigned;
}

async function listComments(appointmentId, actor) {
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) throw Object.assign(new Error('Appointment not found'), { statusCode: 404 });
  assertAppointmentAccess(appointment, actor);
  // ponytail: read each appointment thread together; paginate if long threads affect load.
  return AppointmentComment.find({ appointment: appointmentId }).sort({ createdAt: 1, _id: 1 }).lean();
}

async function addComment(appointmentId, actor, message) {
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) throw Object.assign(new Error('Appointment not found'), { statusCode: 404 });
  assertAppointmentAccess(appointment, actor);
  if (typeof message !== 'string' || !message.trim() || message.trim().length > 2000) {
    throw Object.assign(new Error('Comment must contain 1 to 2000 characters'), { statusCode: 400 });
  }
  const comment = await AppointmentComment.create({
    appointment: appointmentId, author: actor._id || actor.id,
    authorName: [actor.firstName, actor.lastName].filter(Boolean).join(' ') || actor.role,
    authorRole: actor.role, message: message.trim(),
  });
  emitter.emit(EVENTS.COMMENT_ADDED, {
    appointment: { _id: appointment._id, patient: appointment.patient, doctor: appointment.doctor },
    performedBy: actor._id || actor.id, commentId: comment._id,
  });
  return comment;
}

module.exports = {
  requestCorrection,
  resubmit,
  getVersions,
  getDocumentVersion,
  listComments,
  addComment,
  assignSlot,
  create,
  approve,
  decline,
  cancel,
  noShow,
  checkIn,
  startConsultation,
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
