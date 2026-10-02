/**
 * Walk-In Service
 * ───────────────
 * Walk-in Queue Module
 * Layer:    Business Logic
 *
 * Manages the walk-in holding list: adding patients, assigning
 * queue numbers, auto-assigning freed slots, and providing
 * data for the public "Now Serving" display.
 */

const WalkIn = require('../models/WalkIn');
const Appointment = require('../models/Appointment');
const Slot = require('../models/Slot');
const emitter = require('../events/emitter');
const EVENTS = require('../events/events');
const { getNow, isClinicOpen } = require('../config/systemTime');
const { isDateTimePassed, parseDateOnly, formatDateKey } = require('../utils/timeHelper');
const { recordId } = require('../middleware/auth');
const mongoose = require('mongoose');
const recovery = require('./assignmentRecovery.service');

/**
 * Get the next sequential queue number for today.
 * Resets daily — queue numbers start at 1 each day.
 */
async function _getNextQueueNumber(now) {
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const lastWalkIn = await WalkIn.findOne({
    createdAt: { $gte: todayStart, $lte: todayEnd },
  }).sort({ queueNumber: -1 });

  return lastWalkIn ? lastWalkIn.queueNumber + 1 : 1;
}

/**
 * Add a walk-in patient to the holding list.
 * Staff enters name + contact number; system assigns queue number.
 * Enforces clinic operating hours (8:30 AM - 5:00 PM).
 *
 * @param {Object} params
 * @param {string} params.name
 * @param {string} params.contactNumber
 * @param {boolean} [params.overrideHours=false]
 * @returns {Object} WalkIn document
 */
async function addToHoldingList({ name, contactNumber, overrideHours = false, actorId }) {
  const now = getNow();
  if (!overrideHours && !isClinicOpen(now)) {
    const err = new Error(
      'Walk-in registration is currently closed. Operating hours are from 8:30 AM to 5:00 PM.'
    );
    err.statusCode = 400;
    throw err;
  }

  await WalkIn.init(); // Do not accept registrations before the unique index exists.
  const queueDay = formatDateKey(now);
  let queueNumber = await _getNextQueueNumber(now);
  let walkIn;
  // ponytail: unique-index retries suit clinic traffic; use an atomic daily counter if registration contention becomes heavy.
  for (;;) {
    try {
      walkIn = await WalkIn.create({ name, contactNumber, queueNumber, queueDay, status: 'Waiting', createdAt: now });
      break;
    } catch (err) {
      if (err.code !== 11000 || !err.keyPattern?.queueDay || !err.keyPattern?.queueNumber) throw err;
      queueNumber++; // Another process won this ticket; the unique index arbitrates the next attempt.
    }
  }

  // ★ Event-Driven: emit walk-in added
  emitter.emit(EVENTS.WALKIN_ADDED, {
    walkIn,
    performedBy: actorId,
    targetModel: 'WalkIn',
  });

  console.log(`🎫  Walk-in #${queueNumber} added: ${name}`);
  return walkIn;
}

/**
 * Get the holding list — walk-ins with status 'Waiting' for the selected day,
 * sorted by queue number (first come, first served).
 */
async function getHoldingList(filters = {}) {
  return getTodayWalkIns({ ...filters, status: 'Waiting' });
}

/**
 * Get walk-ins for a selected day (default: clinic today), optionally by status.
 */
async function getTodayWalkIns({ status, date } = {}) {
  if (status !== undefined && !WalkIn.WALKIN_STATUSES.includes(status)) {
    throw Object.assign(new Error('Invalid walk-in status filter'), { statusCode: 400 });
  }
  if (date !== undefined) parseDateOnly(date);
  const todayStart = date === undefined ? new Date(getNow()) : new Date(`${date}T00:00:00`);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);
  const filters = { createdAt: { $gte: todayStart, $lt: todayEnd } };
  if (status !== undefined) filters.status = status;
  return WalkIn.find(filters)
    .sort({ queueNumber: 1 })
    .populate({ path: 'assignedSlot', populate: { path: 'doctor', select: 'firstName lastName' } })
    .populate('appointment');
}

/** Update a queue entry and its linked appointment/slot using conditional writes. */
async function updateStatus(walkInId, status, actor) {
  const fail = (message, statusCode) => Object.assign(new Error(message), { statusCode });
  if (!mongoose.isObjectIdOrHexString(walkInId)) throw fail('Invalid walk-in ID', 400);
  const from = {
    'Checked In': ['Slot Assigned'], 'In Progress': ['Checked In'],
    Completed: ['In Progress'], Left: ['Waiting', 'Slot Assigned', 'Checked In'],
  };
  if (typeof status !== 'string' || !Object.hasOwn(from, status)) throw fail('Invalid walk-in status', 400);
  if (!actor || !['Staff', 'Admin', 'Doctor'].includes(actor.role) ||
      (actor.role === 'Doctor' && !['In Progress', 'Completed'].includes(status))) {
    throw fail('You do not have permission to perform this queue action', 403);
  }
  const walkIn = await WalkIn.findById(walkInId);
  if (!walkIn) throw fail('Walk-in not found', 404);
  const appointment = walkIn.appointment ? await Appointment.findById(walkIn.appointment) : null;
  const slot = walkIn.assignedSlot ? await Slot.findById(walkIn.assignedSlot) : null;
  if (actor.role === 'Doctor' && (!appointment || recordId(appointment.doctor) !== recordId(actor._id || actor.id))) {
    throw fail('This walk-in is not assigned to you', 403);
  }
  if (!from[status].includes(walkIn.status)) throw fail(`Cannot change ${walkIn.status} to ${status}`, 409);
  const linked = walkIn.status !== 'Waiting';
  // Keep previously checked-in walk-ins with Confirmed appointments usable after upgrade.
  const expectedAppointment = walkIn.status === 'In Progress' ? 'In Progress'
    : walkIn.status === 'Checked In' && appointment?.status === 'Checked In' ? 'Checked In' : 'Confirmed';
  const expectedSlot = walkIn.status === 'In Progress' ? 'In Progress' : 'Reserved-Confirmed';
  if (linked && (!appointment || !slot || recordId(appointment.walkIn) !== recordId(walkIn._id) ||
      recordId(appointment.slot) !== recordId(slot._id) || recordId(slot.appointment) !== recordId(appointment._id) ||
      recordId(appointment.doctor) !== recordId(slot.doctor) ||
      appointment.status !== expectedAppointment || slot.status !== expectedSlot)) {
    throw fail('Walk-in, appointment, and slot are inconsistent; refresh before retrying', 409);
  }
  if (!linked && (walkIn.appointment || walkIn.assignedSlot)) throw fail('Walk-in assignment is incomplete', 409);
  const claim = { _id: walkInId, status: walkIn.status, appointment: walkIn.appointment || null, assignedSlot: walkIn.assignedSlot || null };
  if (!await WalkIn.findOneAndUpdate(claim, { $set: { status } }, { new: true })) {
    throw fail('Walk-in changed; refresh before retrying', 409);
  }
  const appointmentStatus = status === 'Left' ? 'Cancelled' : status;
  const slotStatus = status === 'Left' ? 'Available' : status;
  const history = { status: appointmentStatus, changedBy: actor._id || actor.id, changedAt: new Date(), remarks: `Walk-in queue: ${status}` };
  let changedAppointment, changedSlot;
  try {
    if (linked) {
      changedAppointment = await Appointment.findOneAndUpdate(
        { _id: appointment._id, status: expectedAppointment, walkIn: walkIn._id, slot: slot._id, doctor: appointment.doctor },
        { $set: { status: appointmentStatus }, $push: { statusHistory: history } }, { new: true }
      );
      if (!changedAppointment) throw fail('Appointment changed; refresh before retrying', 409);
      if (status !== 'Checked In') {
        changedSlot = await Slot.findOneAndUpdate(
          { _id: slot._id, status: expectedSlot, appointment: appointment._id },
          { $set: { status: slotStatus, appointment: status === 'Left' ? null : appointment._id } }, { new: true }
        );
        if (!changedSlot) throw fail('Slot changed; refresh before retrying', 409);
      }
    }
  } catch (err) {
    // ponytail: compensating writes support standalone MongoDB; use transactions if outage recovery must be atomic.
    const recovery = await Promise.allSettled([
      ...(changedAppointment ? [Appointment.updateOne(
        { _id: appointment._id, status: appointmentStatus, statusHistory: { $elemMatch: history } },
        { $set: { status: expectedAppointment }, $pull: { statusHistory: history } }
      )] : []),
      WalkIn.updateOne({ ...claim, status }, { $set: { status: walkIn.status } }),
    ]);
    if (recovery.some(result => result.status === 'rejected')) {
      throw fail('Queue update and recovery failed; ask clinic staff to reconcile these records', 500);
    }
    throw err;
  }
  const data = { walkIn: { ...walkIn.toObject(), status }, appointment: changedAppointment, performedBy: actor._id || actor.id, targetModel: 'WalkIn', targetId: walkIn._id, previousStatus: walkIn.status, status };
  emitter.emit(EVENTS.WALKIN_STATUS_UPDATED, data);
  if (linked) {
    const event = status === 'Left' ? EVENTS.APPOINTMENT_CANCELLED : status === 'Completed' ? EVENTS.APPOINTMENT_COMPLETED
      : status === 'Checked In' ? EVENTS.APPOINTMENT_CHECKED_IN : EVENTS.APPOINTMENT_STARTED;
    emitter.emit(event, { appointment: changedAppointment, performedBy: data.performedBy, targetModel: 'Appointment', previousStatus: expectedAppointment, reason: status === 'Left' ? 'Walk-in patient left' : undefined });
    if (status === 'Left') emitter.emit(EVENTS.SLOT_FREED, { slot: changedSlot, previousStatus: expectedSlot, reason: 'Walk-in patient left', performedBy: data.performedBy, targetModel: 'Slot' });
  }
  return getById(walkInId);
}

/**
 * Assign the next freed slot to the oldest waiting walk-in.
 * Called by the slotFreed event handler.
 *
 * Creates an Appointment linking the walk-in to the slot.
 *
 * @param {Object} slot - The freed Slot document
 * @returns {Object|null} Updated WalkIn, or null if nobody is waiting
 */
async function assignSlotToNextWalkIn(slot) {
  const now = getNow();
  if (!isClinicOpen(now) || new Date(slot.date).toISOString().slice(0, 10) !== formatDateKey(now) ||
      isDateTimePassed(slot.date, slot.startTime, 'start')) return null;
  const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1);
  for (;;) {
    const freshSlot = await Slot.findById(slot._id);
    if (!freshSlot || freshSlot.status !== 'Available' || freshSlot.appointment) return null;
    const next = await WalkIn.findOne({ status: 'Waiting', assignedSlot: null, appointment: null,
      createdAt: { $gte: dayStart, $lt: dayEnd } }).sort({ queueNumber: 1, createdAt: 1, _id: 1 });
    if (!next) return null;
    try { return await assignSlotToWalkIn(next._id, freshSlot._id, null, true); }
    catch (err) { if (err.statusCode !== 409) throw err; } // Retry the next eligible entry after a competing claim.
  }
}

/**
 * Manually assign a selected available slot to a selected waiting walk-in.
 * Claims both records conditionally so concurrent requests cannot assign either twice.
 */
async function assignSlotToWalkIn(walkInId, slotId, changedBy, automatic = false) {
  const slot = await Slot.findById(slotId);
  if (!slot) {
    const err = new Error('Selected slot not found');
    err.statusCode = 404;
    throw err;
  }
  if (isDateTimePassed(slot.date, slot.startTime, 'start')) {
    const err = new Error('Cannot assign a time slot that has already passed');
    err.statusCode = 400;
    throw err;
  }
  if (slot.date.toISOString().slice(0, 10) !== formatDateKey(getNow())) {
    throw Object.assign(new Error('Walk-ins can only be assigned to today\'s slots'), { statusCode: 400 });
  }
  const todayStart = new Date(getNow()); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart); todayEnd.setDate(todayEnd.getDate() + 1);
  const appointmentId = new mongoose.Types.ObjectId();
  const operation = await recovery.begin({ kind: 'walkin', walkIn: walkInId, slot: slotId, appointment: appointmentId });
  let walkIn, claimedSlot, appointment;
  try {
    walkIn = await WalkIn.findOneAndUpdate(
      { _id: walkInId, status: 'Waiting', assignedSlot: null, appointment: null, createdAt: { $gte: todayStart, $lt: todayEnd } },
      { $set: { status: 'Slot Assigned', assignedSlot: slotId, appointment: appointmentId } }, { new: true }
    );
  if (!walkIn) {
    const exists = await WalkIn.exists({ _id: walkInId });
    const err = new Error(exists ? 'Walk-in patient has already been assigned' : 'Walk-in patient not found');
    err.statusCode = exists ? 409 : 404;
    throw err;
  }

    claimedSlot = await Slot.findOneAndUpdate(
    { _id: slotId, status: 'Available', appointment: null },
    { $set: { status: 'Reserved-Confirmed', appointment: appointmentId, reservationOperation: operation._id } },
    { new: true }
  );
  if (!claimedSlot) {
    const err = new Error('Selected slot is no longer available');
    err.statusCode = 409;
    throw err;
  }

    appointment = await Appointment.create({
      _id: appointmentId,
      walkIn: walkIn._id,
      doctor: claimedSlot.doctor,
      slot: claimedSlot._id,
      date: claimedSlot.date,
      timeSlot: `${claimedSlot.startTime}-${claimedSlot.endTime}`,
      reason: 'Walk-in consultation',
      status: 'Confirmed',
      statusHistory: [{
        status: 'Confirmed',
        changedBy: changedBy || slot.doctor,
        remarks: `${automatic ? 'Automatically' : 'Manually'} assigned from walk-in queue (Queue #${walkIn.queueNumber})`,
      }],
    });

  } catch (err) {
    await recovery.onFailure(operation, err);
  }
  await recovery.finish(operation);
  const assignedWalkIn = await getById(walkIn._id);
  emitter.emit(EVENTS.WALKIN_SLOT_ASSIGNED, {
    walkIn: assignedWalkIn,
    slot: claimedSlot,
    appointment,
    performedBy: changedBy,
    automatic,
    targetModel: 'WalkIn',
  });
  return assignedWalkIn;
}

/**
 * Get "Now Serving" data for the public display.
 * Returns the current in-progress entry and the next N waiting entries.
 *
 * @param {number} [upcomingCount=5] - How many upcoming entries to show
 */
async function getNowServing(upcomingCount = 5) {
  const now = getNow();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const [currentlyServing, upcoming, scheduled] = await Promise.all([
    // Currently being served (In Progress)
    WalkIn.find({
      status: 'In Progress',
      createdAt: { $gte: todayStart, $lte: todayEnd },
    })
      .sort({ queueNumber: 1 }),

    // Next in line (Waiting or Slot Assigned)
    WalkIn.find({
      status: { $in: ['Waiting', 'Slot Assigned', 'Checked In'] },
      createdAt: { $gte: todayStart, $lte: todayEnd },
    })
      .sort({ queueNumber: 1 })
      .populate('assignedSlot', 'startTime'),
    Appointment.find({ walkIn: null, date: parseDateOnly(formatDateKey(now)),
      status: { $in: ['Checked In', 'In Progress'] }, queueNumber: { $ne: null } })
      .select('queueNumber status checkedInAt timeSlot'),
  ]);

  const scheduledEntries = scheduled.map(entry => ({ queueNumber: `A-${entry.queueNumber}`, status: entry.status,
    time: entry.timeSlot?.slice(0, 5) || '23:59', arrived: +new Date(entry.checkedInAt) || 0 }));
  const serving = [...currentlyServing.map(entry => ({ queueNumber: entry.queueNumber, status: entry.status })),
    ...scheduledEntries.filter(entry => entry.status === 'In Progress').map(({ queueNumber, status }) => ({ queueNumber, status }))];
  const waiting = [...upcoming.map(entry => ({ queueNumber: entry.queueNumber, status: entry.status,
    time: entry.assignedSlot?.startTime || '23:59', arrived: +new Date(entry.createdAt) || 0 })),
    ...scheduledEntries.filter(entry => entry.status === 'Checked In')]
    .sort((a, b) => a.time.localeCompare(b.time) || a.arrived - b.arrived || String(a.queueNumber).localeCompare(String(b.queueNumber)))
    .slice(0, upcomingCount).map(({ queueNumber, status }) => ({ queueNumber, status }));

  return {
    nowServing: serving[0] || null,
    serving,
    upcoming: waiting,
    updatedAt: now.toISOString(),
    isOpen: isClinicOpen(now),
  };
}

/**
 * Get a single walk-in by ID.
 */
async function getById(walkInId) {
  const walkIn = await WalkIn.findById(walkInId)
    .populate('assignedSlot')
    .populate('appointment');
  if (!walkIn) {
    const err = new Error('Walk-in not found');
    err.statusCode = 404;
    throw err;
  }
  return walkIn;
}

module.exports = {
  addToHoldingList,
  getHoldingList,
  getTodayWalkIns,
  updateStatus,
  assignSlotToNextWalkIn,
  assignSlotToWalkIn,
  getNowServing,
  getById,
};
