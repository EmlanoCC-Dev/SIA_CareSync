const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null },
  type: { type: String, required: true, maxlength: 80 },
  title: { type: String, required: true, maxlength: 120 },
  message: { type: String, required: true, maxlength: 600 },
  readAt: { type: Date, default: null },
}, { timestamps: true });
notificationSchema.index({ user: 1, createdAt: -1, _id: -1 });
notificationSchema.index({ user: 1, readAt: 1 });
module.exports = mongoose.model('Notification', notificationSchema);
