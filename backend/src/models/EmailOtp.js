const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  _id: { type: String }, // Purpose plus normalized email; one active challenge per purpose/address.
  codeHash: { type: String, default: null, select: false },
  ready: { type: Boolean, default: false },
  attempts: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
  consumedAt: { type: Date, default: null },
  lastSentAt: { type: Date, required: true },
  windowStart: { type: Date, required: true },
  sendCount: { type: Number, default: 0 },
  purgeAt: { type: Date, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  tokenVersion: { type: Number, default: 0 },
});
schema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });
module.exports = mongoose.model('EmailOtp', schema);
