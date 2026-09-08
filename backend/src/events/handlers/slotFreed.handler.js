/**
 * Slot Freed Event Handler
 * ────────────────────────
 * Walk-in Queue Integration
 *
 * Listens for SLOT_FREED events (fired when any appointment is
 * declined, cancelled, or marked no-show). When a slot becomes
 * available, checks the walk-in holding list and auto-assigns
 * the freed slot to the next waiting walk-in.
 *
 * Also broadcasts the updated "Now Serving" data via Socket.io
 * so the public display refreshes in real time.
 */

const emitter = require('../emitter');
const EVENTS = require('../events');
const walkInService = require('../../services/walkIn.service');

// Socket.io instance — injected at registration time
let _io = null;

function registerSlotFreedHandler(io) {
  _io = io;

  emitter.on(EVENTS.SLOT_FREED, async (data) => {
    try {
      console.log(
        `🔓  [SlotFreed] Slot ${data.slot.startTime}-${data.slot.endTime} freed (${data.reason})`
      );

      // Attempt to assign the freed slot to the next waiting walk-in
      const assignedWalkIn = await walkInService.assignSlotToNextWalkIn(data.slot);

      // Broadcast updated "Now Serving" to all connected clients
      if (_io) {
        const nowServing = await walkInService.getNowServing();
        _io.emit('nowServing:update', nowServing);
      }

      if (assignedWalkIn) {
        console.log(
          `✅  [SlotFreed] Walk-in #${assignedWalkIn.queueNumber} auto-assigned to freed slot`
        );
      }
    } catch (err) {
      // Slot-freed handling should never crash the main flow
      console.error('⚠️  [SlotFreed] Error handling slot.freed:', err.message);
    }
  });

  // Also broadcast when a walk-in is added (so public display updates)
  emitter.on(EVENTS.WALKIN_ADDED, async () => {
    if (_io) {
      const nowServing = await walkInService.getNowServing();
      _io.emit('nowServing:update', nowServing);
    }
  });

  // Broadcast when a walk-in is assigned a slot
  emitter.on(EVENTS.WALKIN_SLOT_ASSIGNED, async () => {
    if (_io) {
      const nowServing = await walkInService.getNowServing();
      _io.emit('nowServing:update', nowServing);
    }
  });

  console.log('🔓  Slot-freed event handler registered');
}

module.exports = { registerSlotFreedHandler };
