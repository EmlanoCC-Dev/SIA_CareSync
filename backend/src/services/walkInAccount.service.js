const WalkIn = require('../models/WalkIn');
const Appointment = require('../models/Appointment');
const { normalizeEmail } = require('./otp.service');

// Only a verified patient may claim visits. Existing ownership is never overwritten.
async function linkVerifiedPatient(user) {
  if (!user || user.role !== 'Patient' || !user.emailVerifiedAt || user.status === 'Deactivated') return;
  const email = normalizeEmail(user.email);
  await WalkIn.updateMany({ email, patient: null }, { $set: { patient: user._id } });
  const entries = await WalkIn.find({ patient: user._id }).select('_id');
  if (entries.length) {
    await Appointment.updateMany({ walkIn: { $in: entries.map(entry => entry._id) }, patient: null },
      { $set: { patient: user._id } });
  }
}

module.exports = { linkVerifiedPatient };
