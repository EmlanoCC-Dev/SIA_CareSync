const mongoose = require('mongoose');
const Appointment = require('../models/Appointment');
const { parseDateOnly } = require('../utils/timeHelper');

async function getReport({ from, to, doctorId }, actor) {
  if (!['Staff', 'Admin', 'Doctor'].includes(actor.role)) {
    throw Object.assign(new Error('Reports are available to clinic staff and doctors only'), { statusCode: 403 });
  }
  const start = parseDateOnly(from);
  const end = parseDateOnly(to);
  if (start > end) throw Object.assign(new Error('Start date must be on or before end date'), { statusCode: 400 });
  end.setUTCDate(end.getUTCDate() + 1);
  const match = { date: { $gte: start, $lt: end } };
  const targetDoctor = actor.role === 'Doctor' ? String(actor._id || actor.id) : doctorId;
  if (targetDoctor) {
    if (!mongoose.isObjectIdOrHexString(targetDoctor)) throw Object.assign(new Error('Invalid doctor ID'), { statusCode: 400 });
    match.doctor = new mongoose.Types.ObjectId(targetDoctor);
  }
  const [result] = await Appointment.aggregate([
    { $match: match },
    { $facet: {
      statuses: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
      daily: [
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: 'UTC' } },
          total: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] } } } },
        { $sort: { _id: 1 } },
      ],
      doctors: [
        { $group: { _id: '$doctor', total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] } } } },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'doctor' } },
        { $project: { total: 1, completed: 1, firstName: { $arrayElemAt: ['$doctor.firstName', 0] },
          lastName: { $arrayElemAt: ['$doctor.lastName', 0] } } },
        { $sort: { lastName: 1, firstName: 1 } },
      ],
    } },
  ]);
  const statuses = Object.fromEntries(Appointment.APPOINTMENT_STATUSES.map(status => [status, 0]));
  for (const entry of result.statuses) statuses[entry._id] = entry.count;
  return { from, to, statuses, total: Object.values(statuses).reduce((sum, count) => sum + count, 0),
    daily: result.daily, doctors: result.doctors, scope: actor.role === 'Doctor' ? 'My consultations' : 'Clinic appointments' };
}

module.exports = { getReport };
