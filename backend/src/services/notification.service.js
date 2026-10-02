const Notification = require('../models/Notification');
const { recordId } = require('../middleware/auth');

async function sendNotification({ userId, appointment, type, title, message }) {
  if (!userId) return;
  return Notification.create({ user: recordId(userId), appointment: appointment ? recordId(appointment) : null, type, title, message });
}

module.exports = { sendNotification };
