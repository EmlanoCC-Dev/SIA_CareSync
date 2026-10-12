const mongoose = require('mongoose');
module.exports = mongoose.model('BackupSchedule', new mongoose.Schema({
  _id: { type: String, default: 'database-backup' },
  time: { type: String, required: true, default: '18:00', match: /^([01]\d|2[0-3]):[0-5]\d$/ },
}, { timestamps: true }));
