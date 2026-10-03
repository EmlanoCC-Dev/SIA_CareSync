const Notification = require('../models/Notification');
const { recordId } = require('../middleware/auth');
const User = require('../models/User');
const env = require('../config/env');
const { sendEmail } = require('./email.service');
const PATIENT_EMAIL_TYPES = new Set(['BOOKING_CONFIRMED', 'APPOINTMENT_DECLINED', 'CANCELLATION', 'APPOINTMENT_NO_SHOW']);

async function sendNotification({ userId, appointment, type, title, message }) {
  if (!userId) return;
  const eligible = env.EMAIL_ENABLED && PATIENT_EMAIL_TYPES.has(type);
  // Save the inbox entry first. SMTP failures must not remove it or fail the clinical action.
  const notification = await Notification.create({
    user: recordId(userId), appointment: appointment ? recordId(appointment) : null, type, title, message,
    emailDelivery: { status: eligible ? 'pending' : env.EMAIL_ENABLED ? 'skipped' : 'disabled', errorCode: env.EMAIL_ENABLED && !eligible ? 'IN_APP_ONLY' : null },
  });
  if (!eligible) return notification;

  const delivery = { status: 'pending', attemptedAt: new Date(), sentAt: null, messageId: null, errorCode: null };
  try {
    const user = await User.findById(recordId(userId)).select('email status role').lean();
    if (!user || user.status === 'Deactivated' || !/^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(user.email || '')) {
      delivery.status = 'skipped';
      delivery.errorCode = !user ? 'USER_MISSING' : user.status === 'Deactivated' ? 'ACCOUNT_DEACTIVATED' : 'INVALID_EMAIL';
    } else if (user.role !== 'Patient' || !PATIENT_EMAIL_TYPES.has(type)) {
      delivery.status = 'skipped';
      delivery.errorCode = 'IN_APP_ONLY';
    } else {
      delivery.messageId = await sendEmail({ to: user.email, title, message: `${message}\n\nSign in to CareSync to view your appointment and updates.` });
      delivery.status = 'sent';
      delivery.sentAt = new Date();
    }
  } catch (err) {
    delivery.status = 'failed';
    // Only store a bounded code; SMTP messages may contain addresses or credentials.
    delivery.errorCode = /^[A-Z_]{1,40}$/.test(err.code || '') ? err.code : 'EMAIL_FAILED';
    console.error(`[Email] Notification ${notification._id} failed (${delivery.errorCode})`);
  }
  try {
    // ponytail: single attempt, no automatic replay; add a durable outbox if guaranteed delivery is required.
    await Notification.updateOne({ _id: notification._id }, { $set: { emailDelivery: delivery } });
    notification.emailDelivery = delivery;
  } catch {
    // Never retry SMTP after a delivery-log failure; the provider may already have accepted it.
    console.error(`[Email] Could not record delivery status for notification ${notification._id}`);
  }
  return notification;
}

module.exports = { sendNotification };
