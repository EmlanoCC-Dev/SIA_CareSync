// Read-only checks: no account changes, database/index creation, or email sends.
// Run: node backend/scripts/verify-live-state.js
const mongoose = require('mongoose');
const env = require('../src/config/env');
const User = require('../src/models/User');
const EmailOtp = require('../src/models/EmailOtp');
const Notification = require('../src/models/Notification');
const AuditLog = require('../src/models/AuditLog');

async function main() {
  const deadline = setTimeout(() => {
    console.error('Read-only verification timed out. No records changed or email sent.');
    process.exit(1);
  }, 20000);
  deadline.unref();
  try {
    const response = await fetch(`http://127.0.0.1:${Number(env.PORT)}/health`, { signal: AbortSignal.timeout(5000) });
    const data = await response.json();
    console.log(`Local backend health: ${response.ok && data.status === 'ok' ? 'passed' : 'unexpected response'}`);
  } catch { console.log('Local backend health: not reachable on the configured port'); }
  console.log(`Email configuration: ${env.EMAIL_ENABLED ? 'enabled' : 'disabled'}`);
  try {
    await mongoose.connect(env.MONGO_URI, { autoIndex: false, autoCreate: false,
      serverSelectionTimeoutMS: 8000, connectTimeoutMS: 8000 });
    const [verifiedPatients, passwordChanges, otp, deliveries] = await Promise.all([
      User.countDocuments({ role: 'Patient', emailVerifiedAt: { $ne: null } }),
      AuditLog.countDocuments({ action: 'USER_UPDATED', 'changes.changes.passwordChanged': true }),
      EmailOtp.aggregate([{ $group: { _id: { $arrayElemAt: [{ $split: ['$_id', ':'] }, 0] },
        total: { $sum: 1 }, consumed: { $sum: { $cond: [{ $ne: ['$consumedAt', null] }, 1, 0] } } } }]),
      Notification.aggregate([{ $group: { _id: '$emailDelivery.status', total: { $sum: 1 },
        withSentTimestamp: { $sum: { $cond: [{ $ne: [{ $ifNull: ['$emailDelivery.sentAt', null] }, null] }, 1, 0] } } } }]),
    ]);
    console.log('MongoDB read-only connection/query verification: passed');
    console.log(JSON.stringify({ verifiedPatientAccounts: verifiedPatients, passwordChangeAuditRecords: passwordChanges,
      retainedOtpChallenges: otp.map(row => ({ purpose: row._id, total: row.total, consumed: row.consumed })),
      notificationDeliveryResults: deliveries.map(row => ({ status: row._id || 'legacy', total: row.total, withSentTimestamp: row.withSentTimestamp })) }, null, 2));
  } catch (err) {
    // Do not print connection strings, account addresses, OTPs or raw driver errors.
    console.error(`MongoDB verification unavailable (${err.name || 'DatabaseError'}). Connection details withheld.`);
    process.exitCode = 1;
  } finally { await mongoose.disconnect(); clearTimeout(deadline); }
}
main().catch(() => { console.error('Verification could not finish. Sensitive error details withheld.'); process.exitCode = 1; });
