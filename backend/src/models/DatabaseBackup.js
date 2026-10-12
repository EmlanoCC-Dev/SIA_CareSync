const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  trigger: { type: String, enum: ['manual', 'scheduled'], required: true },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['queued', 'capturing', 'uploading', 'completed', 'failed'], default: 'queued' },
  active: { type: Boolean, default: true },
  scheduleDate: String,
  filename: String,
  database: String,
  finishedAt: Date,
  size: Number,
  sha256: String,
  driveFileId: String,
  message: String,
}, { timestamps: true });
schema.index({ active: 1 }, { unique: true, partialFilterExpression: { active: true } });
schema.index({ scheduleDate: 1 }, { unique: true, partialFilterExpression: { scheduleDate: { $type: 'string' } } });
schema.index({ createdAt: -1 });
module.exports = mongoose.model('DatabaseBackup', schema);
