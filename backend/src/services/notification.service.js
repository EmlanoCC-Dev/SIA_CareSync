/**
 * Notification Service
 * ────────────────────
 * Module 7: Notification Module
 * Layer:    Business Logic
 *
 * Stub implementation — logs notifications to console.
 * Replace with actual push notification (FCM), SMS (Twilio),
 * or email (SendGrid) integration when ready.
 */

/**
 * Send a notification to a user.
 * @param {Object} params
 * @param {string} params.userId  - Target user's ObjectId
 * @param {string} params.type    - Notification type (BOOKING_CONFIRMED, CANCELLATION, etc.)
 * @param {string} params.message - Human-readable message
 */
async function sendNotification({ userId, type, message }) {
  // TODO: Replace with real notification delivery
  //  - Push notification via Firebase Cloud Messaging (Flutter app)
  //  - Email via SendGrid / Nodemailer
  //  - SMS via Twilio
  console.log(`\n──── NOTIFICATION ────────────────────────────`);
  console.log(`  To:      ${userId}`);
  console.log(`  Type:    ${type}`);
  console.log(`  Message: ${message}`);
  console.log(`──────────────────────────────────────────────\n`);
}

module.exports = { sendNotification };
