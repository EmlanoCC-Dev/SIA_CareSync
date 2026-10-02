const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  authorName: { type: String, required: true },
  authorRole: { type: String, enum: ['Patient', 'Doctor', 'Staff', 'Admin'], required: true },
  message: { type: String, required: true, trim: true, maxlength: 2000 },
}, { timestamps: true });
schema.index({ appointment: 1, createdAt: 1, _id: 1 });

module.exports = mongoose.model('AppointmentComment', schema);
