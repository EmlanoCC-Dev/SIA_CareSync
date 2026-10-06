const fs = require('node:fs/promises');
const User = require('../models/User');
const { UPLOAD_ROOT } = require('../middleware/upload');
const { setCustomTime } = require('../config/systemTime');
const emitter = require('../events/emitter');

const records = ['Appointment', 'AppointmentComment', 'WalkIn', 'Slot', 'SlotPlan',
  'Notification', 'AuditLog', 'EmailOtp', 'AssignmentRecovery'].map(name => require(`../models/${name}`));
let resetting = false;
let activeRequests = 0;

// ponytail: reset lock covers one API process; use a shared maintenance lock before running multiple servers.
function guardDemoReset(req, res, next) {
  if (resetting) return res.status(503).json({ success: false, message: 'Demo data is being cleared. Please try again shortly.' });
  activeRequests++;
  let finished = false;
  const release = () => { if (!finished) { finished = true; activeRequests--; } };
  res.once('finish', release);
  res.once('close', release);
  next();
}

async function clearDemoData(adminId) {
  if (resetting || activeRequests > 1 || emitter.pending.size) {
    throw Object.assign(new Error('Clinic activity is still running. Pause other tabs and retry the reset in a moment.'), { statusCode: 409 });
  }
  resetting = true;
  try {
    const deleted = {};
    for (const model of records) {
      deleted[model.modelName] = (await model.deleteMany({})).deletedCount;
    }
    deleted.User = (await User.deleteMany({ role: { $nin: ['Doctor', 'Staff'] }, _id: { $ne: adminId } })).deletedCount;
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

module.exports = { guardDemoReset, clearDemoData };
