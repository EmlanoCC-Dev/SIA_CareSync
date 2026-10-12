const fs = require('node:fs/promises');
const User = require('../models/User');
const { UPLOAD_ROOT } = require('../middleware/upload');
const { setCustomTime } = require('../config/systemTime');
const emitter = require('../events/emitter');
const env = require('../config/env');
const { clearStoredFiles } = require('./fileStorage.service');
const mongoose = require('mongoose');

const records = ['Appointment', 'AppointmentComment', 'WalkIn', 'Slot', 'SlotPlan',
  'Notification', 'AuditLog', 'EmailOtp', 'AssignmentRecovery'].map(name => require(`../models/${name}`));
let resetting = false;
let snapshotting = false;
let activeRequests = 0;

// ponytail: reset lock covers one API process; use a shared maintenance lock before running multiple servers.
function guardDemoReset(req, res, next) {
  if (resetting) return res.status(503).json({ success: false, message: 'Demo data is being cleared. Please try again shortly.' });
  // Backup progress reads remain available while clinic writers are paused.
  if (req.method === 'GET' && (/^\/system\/backups\/?$/.test(req.path) || /^\/backup-jobs(?:\/[a-f\d]{24})?\/?$/i.test(req.path))) return next();
  if (snapshotting) return res.status(503).json({ success: false, message: 'A database backup is capturing clinic data. Please try again shortly.' });
  activeRequests++;
  let finished = false;
  const release = () => { if (!finished) { finished = true; activeRequests--; } };
  // A disconnected client can leave its controller writing; wait for its response attempt.
  const end = res.end;
  res.end = function (...args) { try { return end.apply(this, args); } finally { release(); } };
  res.once('finish', release);
  res.once('close', () => { if (res.writableFinished) release(); });
  next();
}

async function clearDemoData(adminId) {
  if (resetting || snapshotting || activeRequests > 1 || emitter.pending.size) {
    throw Object.assign(new Error('Clinic activity is still running. Pause other tabs and retry the reset in a moment.'), { statusCode: 409 });
  }
  resetting = true;
  try {
    const deleted = {};
    for (const model of records) {
      deleted[model.modelName] = (await model.deleteMany({})).deletedCount;
    }
    deleted.User = (await User.deleteMany({ role: { $nin: ['Doctor', 'Staff'] }, _id: { $ne: adminId } })).deletedCount;
    if (env.UPLOAD_STORAGE === 'gridfs' || mongoose.connection.db) await clearStoredFiles();
    // Fixed application-owned directory, never a path supplied by the caller.
    await fs.rm(UPLOAD_ROOT, { recursive: true, force: true });
    await fs.mkdir(UPLOAD_ROOT, { recursive: true });
    setCustomTime(null);
    return { deleted };
  } catch (err) {
    console.error('[Demo reset] Reset interrupted:', err.message);
    throw Object.assign(new Error('Demo reset was interrupted; some data may have been cleared. Retry to finish clearing the remaining data.'), { statusCode: 500 });
  } finally {
    resetting = false;
  }
}

async function withDatabaseSnapshot(capture) {
  if (resetting || snapshotting) throw Object.assign(new Error('Clinic maintenance is already running. Retry the backup shortly.'), { statusCode: 409 });
  snapshotting = true;
  try {
    const deadline = Date.now() + 30000;
    while (activeRequests || emitter.pending.size) {
      if (Date.now() >= deadline) throw new Error('Clinic activity did not settle. Retry the backup when other activity has finished.');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return await capture();
  } finally { snapshotting = false; }
}

module.exports = { guardDemoReset, clearDemoData, withDatabaseSnapshot };
