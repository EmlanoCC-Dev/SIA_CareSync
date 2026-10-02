const mongoose = require('mongoose');

// One durable, atomically extended list of non-overlapping windows per doctor/day.
const schema = new mongoose.Schema({
  _id: String,
  doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true },
  revision: { type: Number, default: 0 },
  slots: [{ _id: false, startTime: String, endTime: String }],
}, { timestamps: true });
module.exports = mongoose.model('SlotPlan', schema);
