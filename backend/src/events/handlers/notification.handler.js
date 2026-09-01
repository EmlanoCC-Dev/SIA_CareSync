/**
 * Notification Event Handler
 * ──────────────────────────
 * Module 7: Notification Module
 *
 * Listens for appointment/queue events and triggers notifications.
 * Currently a stub that logs to console — will be replaced with
 * actual push notification / SMS / email service later.
 */

const emitter = require('../emitter');
const EVENTS = require('../events');
const notificationService = require('../../services/notification.service');

function registerAllHandlers() {
  // ── Appointment Booked ─────────────────────────────────
  emitter.on(EVENTS.APPOINTMENT_BOOKED, async (data) => {
    console.log(`📨  [Notification] Appointment booked: ${data.appointment._id}`);
    await notificationService.sendNotification({
      userId: data.appointment.patient,
      type: 'BOOKING_CONFIRMED',
      message: `Your appointment on ${data.appointment.date} has been submitted and is pending approval.`,
    });
  });

  // ── Appointment Approved ───────────────────────────────
  emitter.on(EVENTS.APPOINTMENT_APPROVED, async (data) => {
    console.log(`📨  [Notification] Appointment approved: ${data.appointment._id}`);
    await notificationService.sendNotification({
      userId: data.appointment.patient,
      type: 'BOOKING_CONFIRMED',
      message: `Your appointment on ${data.appointment.date} has been confirmed!`,
    });
  });

  // ── Appointment Cancelled ──────────────────────────────
  emitter.on(EVENTS.APPOINTMENT_CANCELLED, async (data) => {
    console.log(`📨  [Notification] Appointment cancelled: ${data.appointment._id}`);
    await notificationService.sendNotification({
      userId: data.appointment.patient,
      type: 'CANCELLATION',
      message: `Your appointment on ${data.appointment.date} has been cancelled.`,
    });
  });

  // ── Revision Requested ─────────────────────────────────
  emitter.on(EVENTS.REVISION_REQUESTED, async (data) => {
    console.log(`📨  [Notification] Revision requested: ${data.appointment._id}`);
    await notificationService.sendNotification({
      userId: data.appointment.patient,
      type: 'REVISION_NEEDED',
      message: `Your appointment requires revision. Reason: ${data.reason || 'See remarks.'}`,
    });
  });

  // ── Patient Turn Alert ─────────────────────────────────
  emitter.on(EVENTS.PATIENT_TURN_ALERT, async (data) => {
    console.log(`📨  [Notification] Patient turn alert: ${data.patientId}`);
    await notificationService.sendNotification({
      userId: data.patientId,
      type: 'YOUR_TURN',
      message: 'It\'s almost your turn! Please proceed to the reception.',
    });
  });

  console.log('🔔  Notification event handlers registered');
}

module.exports = { registerAllHandlers };
