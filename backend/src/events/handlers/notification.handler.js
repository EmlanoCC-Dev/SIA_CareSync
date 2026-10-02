const emitter = require('../emitter');
const EVENTS = require('../events');
const User = require('../../models/User');
const { sendNotification } = require('../../services/notification.service');

function registerAllHandlers() {
  function listen(event, handler) {
    emitter.on(event, async data => {
      try { await handler(data); }
      catch (err) {
        // ponytail: process-local events; add a durable outbox if guaranteed delivery is required.
        console.error(`[Notification] Could not save ${event}: ${err.message}`);
      }
    });
  }
  const visit = app => `${new Date(app.date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}${app.timeSlot ? `, ${app.timeSlot}` : ''}`;
  const notify = (app, userId, type, title, message) => sendNotification({ userId, appointment: app._id, type, title, message });
  async function deliver(jobs) {
    // One recipient failure must not suppress the other recipients.
    const results = await Promise.allSettled(jobs);
    for (const result of results) if (result.status === 'rejected') console.error(`[Notification] Could not save update: ${result.reason.message}`);
  }

  listen(EVENTS.APPOINTMENT_BOOKED, async ({ appointment: app }) => {
    // Attach rejection handlers immediately, including while the reviewer lookup runs.
    const patientAndDoctor = deliver([
      notify(app, app.patient, 'BOOKING_SUBMITTED', 'Appointment request received', `Your request for ${visit(app)} is pending clinic review.`),
      notify(app, app.doctor, 'DOCTOR_REQUEST_ASSIGNED', 'Appointment request assigned', `A request for ${visit(app)} is assigned to you, pending clinic approval.`),
    ]);
    try {
      const reviewers = await User.find({ role: { $in: ['Staff', 'Admin'] } }).select('_id');
      await deliver(reviewers.map(user => notify(app, user._id, 'BOOKING_REVIEW', 'New appointment request', `A patient requested ${visit(app)}. Review it in Appointments.`)));
    } finally { await patientAndDoctor; }
  });
  listen(EVENTS.APPOINTMENT_ASSIGNED, ({ appointment: app }) => deliver([
    notify(app, app.doctor, 'DOCTOR_REQUEST_ASSIGNED', 'Appointment request assigned', `A request for ${visit(app)} is assigned to you, pending clinic approval.`),
    notify(app, app.patient, 'DOCTOR_ASSIGNED', 'Doctor and time assigned', `The clinic assigned a doctor and time for ${visit(app)}. Your request is still pending approval.`),
  ]));
  listen(EVENTS.APPOINTMENT_APPROVED, ({ appointment: app }) => deliver([
    notify(app, app.patient, 'BOOKING_CONFIRMED', 'Appointment confirmed', `Your appointment for ${visit(app)} has been confirmed.`),
    notify(app, app.doctor, 'DOCTOR_APPOINTMENT_ASSIGNED', 'Confirmed appointment', `An appointment for ${visit(app)} has been confirmed on your schedule.`),
  ]));
  listen(EVENTS.APPOINTMENT_DECLINED, ({ appointment: app }) =>
    notify(app, app.patient, 'APPOINTMENT_DECLINED', 'Appointment request declined', `Your request for ${visit(app)} was declined. Open its history for details.`));
  listen(EVENTS.APPOINTMENT_CANCELLED, ({ appointment: app }) => deliver([
    notify(app, app.patient, 'CANCELLATION', 'Appointment cancelled', `Your appointment for ${visit(app)} was cancelled. Open its history for details.`),
    notify(app, app.doctor, 'DOCTOR_APPOINTMENT_CANCELLED', 'Appointment cancelled', `The appointment for ${visit(app)} was cancelled.`),
  ]));
  listen(EVENTS.APPOINTMENT_NO_SHOW, ({ appointment: app }) => deliver([
    notify(app, app.patient, 'APPOINTMENT_NO_SHOW', 'Appointment marked no-show', `Your appointment for ${visit(app)} was marked no-show. Contact the clinic if this needs correction.`),
    notify(app, app.doctor, 'DOCTOR_APPOINTMENT_NO_SHOW', 'Appointment marked no-show', `The appointment for ${visit(app)} was marked no-show.`),
  ]));
  listen(EVENTS.APPOINTMENT_CHECKED_IN, ({ appointment: app }) =>
    notify(app, app.doctor, 'PATIENT_READY', 'Consultation started', `The appointment for ${visit(app)} is now in progress.`));
  listen(EVENTS.APPOINTMENT_COMPLETED, ({ appointment: app }) =>
    notify(app, app.patient, 'APPOINTMENT_COMPLETED', 'Consultation completed', `Your consultation for ${visit(app)} is complete. View your appointment for the consultation record.`));
  listen(EVENTS.WALKIN_SLOT_ASSIGNED, ({ appointment: app, slot, walkIn }) =>
    notify(app, slot.doctor, 'WALKIN_ASSIGNED', 'Walk-in assigned', `Queue #${walkIn.queueNumber} was assigned to your ${slot.startTime}–${slot.endTime} slot.`));
  listen(EVENTS.WALKIN_STATUS_UPDATED, ({ appointment: app, walkIn, status }) => {
    if (status === 'Checked In' && app) return notify(app, app.doctor, 'PATIENT_ARRIVED', 'Patient arrived', `Queue #${walkIn.queueNumber} has checked in and is waiting for consultation.`);
  });
}

module.exports = { registerAllHandlers };
