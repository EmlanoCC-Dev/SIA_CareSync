/**
 * Notification Event Handler
 * ──────────────────────────
 * Module 7: Notification Module
 *
 * Listens for appointment/queue events and triggers notifications.
 */

const emitter = require('../emitter');
const EVENTS = require('../events');
const notificationService = require('../../services/notification.service');

function registerAllHandlers() {
  // ── Appointment Booked ─────────────────────────────────
  emitter.on(EVENTS.APPOINTMENT_BOOKED, async (data) => {
    console.log(`📨  [Notification] Appointment booked: ${data.appointment._id}`);
    if (data.appointment.patient) {
      await notificationService.sendNotification({
        userId: data.appointment.patient,
        type: 'BOOKING_SUBMITTED',
        message: `Your appointment request for ${data.appointment.date ? new Date(data.appointment.date).toDateString() : ''} (${data.appointment.timeSlot || ''}) is pending staff review.`,
      });
    }
  });

  // ── Appointment Approved (Notify BOTH patient and doctor) ──
  emitter.on(EVENTS.APPOINTMENT_APPROVED, async (data) => {
    console.log(`📨  [Notification] Appointment approved: ${data.appointment._id}`);
    if (data.appointment.patient) {
      await notificationService.sendNotification({
        userId: data.appointment.patient,
        type: 'BOOKING_CONFIRMED',
        message: `Your appointment on ${data.appointment.date ? new Date(data.appointment.date).toDateString() : ''} (${data.appointment.timeSlot || ''}) has been confirmed!`,
      });
    }
    if (data.appointment.doctor) {
      await notificationService.sendNotification({
        userId: data.appointment.doctor,
        type: 'DOCTOR_APPOINTMENT_ASSIGNED',
        message: `New confirmed appointment scheduled for ${data.appointment.date ? new Date(data.appointment.date).toDateString() : ''} (${data.appointment.timeSlot || ''}).`,
      });
    }
  });

  // ── Appointment Declined (Notify patient) ───────────────
  emitter.on(EVENTS.APPOINTMENT_DECLINED, async (data) => {
    console.log(`📨  [Notification] Appointment declined: ${data.appointment._id}`);
    if (data.appointment.patient) {
      await notificationService.sendNotification({
        userId: data.appointment.patient,
        type: 'APPOINTMENT_DECLINED',
        message: `Your appointment request was declined. Reason: ${data.reason}`,
      });
    }
  });

  // ── Appointment Cancelled ──────────────────────────────
  emitter.on(EVENTS.APPOINTMENT_CANCELLED, async (data) => {
    console.log(`📨  [Notification] Appointment cancelled: ${data.appointment._id}`);
    if (data.appointment.patient) {
      await notificationService.sendNotification({
        userId: data.appointment.patient,
        type: 'CANCELLATION',
        message: `Your appointment has been cancelled. Reason: ${data.reason || 'Not specified'}`,
      });
    }
    if (data.appointment.doctor) {
      await notificationService.sendNotification({
        userId: data.appointment.doctor,
        type: 'DOCTOR_APPOINTMENT_CANCELLED',
        message: `Appointment scheduled for ${data.appointment.timeSlot || ''} was cancelled.`,
      });
    }
  });

  // ── Appointment Checked In ─────────────────────────────
  emitter.on(EVENTS.APPOINTMENT_CHECKED_IN, async (data) => {
    console.log(`📨  [Notification] Patient checked in: ${data.appointment._id}`);
    if (data.appointment.doctor) {
      await notificationService.sendNotification({
        userId: data.appointment.doctor,
        type: 'PATIENT_READY',
        message: `Patient has checked in and is ready for consultation (${data.appointment.timeSlot || ''}).`,
      });
    }
  });

  // ── Walk-in Slot Assigned ──────────────────────────────
  emitter.on(EVENTS.WALKIN_SLOT_ASSIGNED, async (data) => {
    console.log(`📨  [Notification] Walk-in assigned slot: Queue #${data.walkIn.queueNumber}`);
    if (data.slot && data.slot.doctor) {
      await notificationService.sendNotification({
        userId: data.slot.doctor,
        type: 'WALKIN_ASSIGNED',
        message: `Walk-in patient #${data.walkIn.queueNumber} (${data.walkIn.name}) assigned to slot ${data.slot.startTime}-${data.slot.endTime}.`,
      });
    }
  });

  console.log('🔔  Notification event handlers registered');
}

module.exports = { registerAllHandlers };
