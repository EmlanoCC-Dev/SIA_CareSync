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

/**
 * Get the next sequential queue number for today.
 * Resets daily — queue numbers start at 1 each day.
 */
async function _getNextQueueNumber() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const lastWalkIn = await WalkIn.findOne({
    createdAt: { $gte: todayStart, $lte: todayEnd },
  }).sort({ queueNumber: -1 });

  return lastWalkIn ? lastWalkIn.queueNumber + 1 : 1;
}

/**
 * Add a walk-in patient to the holding list.
 * Staff enters name + contact number; system assigns queue number.
 *
 * @param {Object} params
 * @param {string} params.name
 * @param {string} params.contactNumber
 * @returns {Object} WalkIn document
 */
async function addToHoldingList({ name, contactNumber }) {
  const queueNumber = await _getNextQueueNumber();

  const walkIn = await WalkIn.create({
    name,
    contactNumber,
    queueNumber,
    status: 'Waiting',
  });

  // ★ Event-Driven: emit walk-in added
  emitter.emit(EVENTS.WALKIN_ADDED, {
    walkIn,
    targetModel: 'WalkIn',
  });

  console.log(`🎫  Walk-in #${queueNumber} added: ${name}`);
  return walkIn;
}

/**
 * Get the holding list — all walk-ins with status 'Waiting',
 * sorted by queue number (first come, first served).
 */
async function getHoldingList() {
  return WalkIn.find({ status: 'Waiting' }).sort({ queueNumber: 1 });
}

/**
 * Get all walk-ins for today (any status), for staff management.
 */
async function getTodayWalkIns() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  return WalkIn.find({ createdAt: { $gte: todayStart } })
    .sort({ queueNumber: 1 })
    .populate('assignedSlot')
    .populate('appointment');
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
  // Find the oldest waiting walk-in
  const nextWalkIn = await WalkIn.findOne({ status: 'Waiting' }).sort({ queueNumber: 1 });

  if (!nextWalkIn) {
    console.log('📋  No walk-ins waiting — slot remains available');
    return null;
  }

  // Double-check the slot is genuinely Available
  const freshSlot = await Slot.findById(slot._id);
  if (!freshSlot || freshSlot.status !== 'Available') {
    console.log('⚠️  Slot is no longer available — skipping walk-in assignment');
    return null;
  }

  // Create an appointment for the walk-in
  const appointment = await Appointment.create({
    walkIn: nextWalkIn._id,
    doctor: freshSlot.doctor,
    slot: freshSlot._id,
    date: freshSlot.date,
    timeSlot: `${freshSlot.startTime}-${freshSlot.endTime}`,
    reason: 'Walk-in consultation',
    status: 'Confirmed', // Walk-in slots are auto-confirmed
    statusHistory: [
      {
        status: 'Confirmed',
        changedBy: freshSlot.doctor, // system-assigned via doctor's slot
        remarks: `Auto-assigned from walk-in queue (Queue #${nextWalkIn.queueNumber})`,
      },
    ],
  });

  // Update the slot
  freshSlot.status = 'Reserved-Confirmed';
  freshSlot.appointment = appointment._id;
  await freshSlot.save();

  // Update the walk-in
  nextWalkIn.status = 'Slot Assigned';
  nextWalkIn.assignedSlot = freshSlot._id;
  nextWalkIn.appointment = appointment._id;
  await nextWalkIn.save();

  // ★ Event-Driven: emit walk-in slot assigned
  emitter.emit(EVENTS.WALKIN_SLOT_ASSIGNED, {
    walkIn: nextWalkIn,
    slot: freshSlot,
    appointment,
    targetModel: 'WalkIn',
  });

  console.log(
    `🎫  Walk-in #${nextWalkIn.queueNumber} (${nextWalkIn.name}) assigned to slot ${freshSlot.startTime}-${freshSlot.endTime}`
  );

  return nextWalkIn;
}

/**
 * Get "Now Serving" data for the public display.
 * Returns the current in-progress entry and the next N waiting entries.
 *
 * @param {number} [upcomingCount=5] - How many upcoming entries to show
 */
async function getNowServing(upcomingCount = 5) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [currentlyServing, upcoming] = await Promise.all([
    // Currently being served (In Progress)
    WalkIn.find({
      status: 'In Progress',
      createdAt: { $gte: todayStart },
    })
      .sort({ queueNumber: 1 })
      .limit(1),

    // Next in line (Waiting or Slot Assigned)
    WalkIn.find({
      status: { $in: ['Waiting', 'Slot Assigned', 'Checked In'] },
      createdAt: { $gte: todayStart },
    })
      .sort({ queueNumber: 1 })
      .limit(upcomingCount),
  ]);

  return {
    nowServing: currentlyServing[0] || null,
    upcoming,
    updatedAt: new Date().toISOString(),
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
  assignSlotToNextWalkIn,
  getNowServing,
  getById,
};
