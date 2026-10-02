const mongoose = require('mongoose');

// Written before reservations so interrupted work can be reconciled after restart.
const schema = new mongoose.Schema({
  kind: { type: String, enum: ['booking', 'walkin', 'flex'], required: true },
  appointment: { type: mongoose.Schema.Types.ObjectId, required: true },
  slot: { type: mongoose.Schema.Types.ObjectId, required: true },
  walkIn: mongoose.Schema.Types.ObjectId,
  state: { type: String, enum: ['pending', 'done'], default: 'pending' },
}, { timestamps: true });
schema.index({ state: 1, createdAt: 1 });
module.exports = mongoose.model('AssignmentRecovery', schema);
