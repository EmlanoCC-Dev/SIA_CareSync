const AssignmentRecovery = require('../models/AssignmentRecovery');
const Appointment = require('../models/Appointment');
const Slot = require('../models/Slot');
const WalkIn = require('../models/WalkIn');
const { recordId } = require('../middleware/auth');

async function finish(operation) {
  await AssignmentRecovery.updateOne({ _id: operation._id, state: 'pending' }, { $set: { state: 'done' } });
}

// Call during the failing request, or offline with all clinic writers stopped.
// Never release a reservation owned by a different appointment.
async function recover(operation) {
  const [appointment, slot, walkIn] = await Promise.all([
    Appointment.findById(operation.appointment), Slot.findById(operation.slot),
    operation.walkIn ? WalkIn.findById(operation.walkIn) : null,
  ]);
  const sameAppointment = appointment && recordId(appointment.slot) === recordId(operation.slot) &&
    (!operation.walkIn || recordId(appointment.walkIn) === recordId(operation.walkIn));
  if (sameAppointment && (
    ['Completed', 'Cancelled', 'Declined', 'No-show'].includes(appointment.status) ||
    (recordId(slot?.appointment) === recordId(operation.appointment) &&
      (!operation.walkIn || recordId(walkIn?.appointment) === recordId(operation.appointment)))
  )) {
    await finish(operation);
    return; // A response/write acknowledgement failed after the assignment committed.
  }
  if (sameAppointment || (operation.kind !== 'flex' && appointment)) {
    throw new Error('Assignment records require manual reconciliation; recovery will not delete a patient record');
  }
  const results = await Promise.allSettled([
    Slot.updateOne({ _id: operation.slot, appointment: operation.appointment, reservationOperation: operation._id,
      status: { $in: ['Reserved-Tentative', 'Reserved-Confirmed'] } },
      { $set: { status: 'Available', appointment: null, reservationOperation: null } }),
    ...(operation.walkIn ? [WalkIn.updateOne({ _id: operation.walkIn, appointment: operation.appointment,
      assignedSlot: operation.slot, status: 'Slot Assigned' },
      { $set: { status: 'Waiting', appointment: null, assignedSlot: null } })] : []),
  ]);
  if (results.some(result => result.status === 'rejected')) throw new Error('Assignment recovery is still pending');
  const [remainingSlot, remainingWalkIn] = await Promise.all([
    Slot.findById(operation.slot), operation.walkIn ? WalkIn.findById(operation.walkIn) : null,
  ]);
  if ((recordId(remainingSlot?.appointment) === recordId(operation.appointment) && recordId(remainingSlot?.reservationOperation) === recordId(operation._id)) ||
      (operation.walkIn && recordId(remainingWalkIn?.appointment) === recordId(operation.appointment))) {
    throw new Error('Assignment recovery is still pending');
  }
  await finish(operation);
}

async function onFailure(operation, originalError) {
  try { await recover(operation); }
  catch {
    throw Object.assign(new Error(`Assignment recovery pending (${operation._id}); clinic staff must reconcile before retrying`), { statusCode: 503 });
  }
  throw originalError;
}

module.exports = { begin: values => AssignmentRecovery.create(values), finish, recover, onFailure };
