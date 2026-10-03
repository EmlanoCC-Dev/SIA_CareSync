// Run: node backend/tests/concurrency.check.js [--live]
// Default: real services with isolated model doubles. --live: a disposable MongoDB database, never the application database.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { once } = require('node:events');
process.env.JWT_SECRET ||= 'isolated-concurrency-check-secret-for-tests';
const mongoose = require('mongoose');
const env = require('../src/config/env');
const User = require('../src/models/User');
const WalkIn = require('../src/models/WalkIn');
const Slot = require('../src/models/Slot');
const Appointment = require('../src/models/Appointment');
const SlotPlan = require('../src/models/SlotPlan');
const AssignmentRecovery = require('../src/models/AssignmentRecovery');
const walkIns = require('../src/services/walkIn.service');
const slots = require('../src/services/slot.service');
const appointments = require('../src/services/appointment.service');
const recovery = require('../src/services/assignmentRecovery.service');
const { setCustomTime } = require('../src/config/systemTime');
const { parseDateOnly } = require('../src/utils/timeHelper');
const emitter = require('../src/events/emitter');
const EVENTS = require('../src/events/events');
const live = process.argv.includes('--live');
// Keep the unique test name below the configured cluster's reported 38-byte limit.
const database = `cs_test_${randomUUID().replaceAll('-', '').slice(0, 24)}`;
const originals = [];
let appFailure, slotFailure, finishFailure, bulkFailure, liveConnected = false;
const models = [User, WalkIn, Slot, Appointment, SlotPlan, AssignmentRecovery];
const stores = new Map(models.map(model => [model, new Map()]));
const clone = value => value instanceof Date ? new Date(value) : value?._bsontype === 'ObjectId' ? value.toHexString() :
  Array.isArray(value) ? value.map(clone) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)])) : value;
const doc = value => {
  if (!value) return null;
  const copy = clone(value);
  Object.defineProperty(copy, 'toObject', { value: () => clone(copy) });
  return copy;
};
const matches = (row, filter) => row && Object.entries(filter).every(([key, value]) => {
  if (value?.$in) return value.$in.includes(row[key]);
  if (value?.$gte) return row[key] >= value.$gte && (value.$lt ? row[key] < value.$lt : row[key] <= value.$lte);
  return value === null ? row[key] == null : String(row[key]) === String(value);
});
const query = value => ({ populate() { return this; }, sort(order) {
  if (Array.isArray(value)) value.sort((a, b) => {
    for (const [key, direction] of Object.entries(order)) { if (a[key] < b[key]) return -direction; if (a[key] > b[key]) return direction; }
    return 0;
  });
  else if (value?.sort) value = value.sort(order);
  return this;
}, then(resolve, reject) { return Promise.resolve(typeof value === 'function' ? value() : value).then(resolve, reject); } });
const stub = (model, method, fn) => { originals.push([model, method, model[method]]); model[method] = fn; };
const apply = (row, update) => {
  Object.assign(row, clone(update.$set || {}));
  for (const [key, amount] of Object.entries(update.$inc || {})) row[key] += amount;
  for (const [key, value] of Object.entries(update.$push || {})) row[key].push(...clone(value.$each || [value]));
};
function installDoubles() {
  for (const [model, records] of stores) {
    stub(model, 'init', async () => {});
    stub(model, 'findById', key => query(doc(records.get(String(key)))));
    stub(model, 'find', filter => query([...records.values()].filter(row => matches(row, filter || {})).map(doc)));
    stub(model, 'findOne', filter => {
      let candidates = [...records.values()].filter(row => matches(row, filter));
      return { sort(order) { candidates.sort((a, b) => {
        for (const [key, direction] of Object.entries(order)) { if (a[key] < b[key]) return -direction; if (a[key] > b[key]) return direction; }
        return 0;
      }); return query(doc(candidates[0])); }, then(resolve, reject) { return query(doc(candidates[0])).then(resolve, reject); } };
    });
    stub(model, 'exists', async filter => [...records.values()].some(row => matches(row, filter)));
    stub(model, 'create', async values => {
      if (model === Appointment && appFailure === 'before') throw new Error('Injected appointment write failure');
      if (model === WalkIn && [...records.values()].some(row => row.queueDay === values.queueDay && row.queueNumber === values.queueNumber)) {
        throw Object.assign(new Error('Duplicate ticket'), { code: 11000, keyPattern: { queueDay: 1, queueNumber: 1 } });
      }
      const row = clone({ _id: new mongoose.Types.ObjectId(), state: model === AssignmentRecovery ? 'pending' : undefined, ...values });
      records.set(String(row._id), row);
      if (model === Appointment && appFailure === 'after') throw new Error('Injected acknowledgement failure');
      return doc(row);
    });
    stub(model, 'findOneAndUpdate', async (filter, update) => {
      const row = records.get(String(filter._id));
      if (!matches(row, filter)) return null;
      apply(row, update);
      return doc(row);
    });
    stub(model, 'updateOne', async (filter, update, options = {}) => {
      if (model === Slot && slotFailure) throw new Error('Injected rollback write failure');
      if (model === AssignmentRecovery && finishFailure) throw new Error('Injected journal acknowledgement failure');
      let row = records.get(String(filter._id));
      if (!row && options.upsert) { row = clone({ _id: filter._id, ...update.$setOnInsert }); records.set(String(row._id), row); }
      if (!matches(row, filter)) return { modifiedCount: 0 };
      apply(row, update);
      return { modifiedCount: 1 };
    });
  }
  stub(Slot, 'bulkWrite', async operations => {
    for (const { updateOne } of operations) {
      const records = stores.get(Slot);
      if (![...records.values()].some(row => matches(row, updateOne.filter))) {
        const row = clone({ _id: new mongoose.Types.ObjectId(), ...updateOne.update.$setOnInsert });
        records.set(String(row._id), row);
      }
      if (bulkFailure) { bulkFailure = false; throw new Error('Injected partial bulk-write failure'); }
    }
  });
}
const makeSlot = (doctor, startTime, date = '2026-10-02') => Slot.create({ doctor: doctor._id, date: parseDateOnly(date),
  startTime, endTime: `${startTime.slice(0, 2)}:45`, status: 'Available', appointment: null });
const reject = code => err => err.statusCode === code;
async function main() {
  if (live) {
    await mongoose.connect(process.env.TEST_MONGO_URI || env.MONGO_URI, { dbName: database, serverSelectionTimeoutMS:5000, connectTimeoutMS:5000 });
    liveConnected = true;
    assert.equal(mongoose.connection.name, database);
    await Promise.all(models.map(model => model.init()));
  } else installDoubles();
  setCustomTime('2026-10-02T09:00:00');
  const doctor = await User.create({ firstName: 'Test', lastName: 'Doctor', email: `${randomUUID()}@example.test`, password: 'test-password',
    role: 'Doctor', consultationDuration: 30, workingHours: [], scheduleConfigured: true });
  const patient = await User.create({ firstName: 'Test', lastName: 'Patient', email: `${randomUUID()}@example.test`, password: 'test-password', role: 'Patient' });
  const tickets = await Promise.all(Array.from({ length: 20 }, (_, i) => walkIns.addToHoldingList({ name: `Dummy ${i}`, contactNumber:'09170000000', actorId:doctor._id })));
  assert.equal(new Set(tickets.map(row => row.queueNumber)).size, 20);
  assert(tickets.every(row => row.queueDay === '2026-10-02'));
  // Same patient competing for different slots, then different patients competing for one slot.
  const a = await makeSlot(doctor, '10:00'), b = await makeSlot(doctor, '11:00');
  const samePatient = await Promise.allSettled([walkIns.assignSlotToWalkIn(tickets[0]._id, a._id, doctor._id), walkIns.assignSlotToWalkIn(tickets[0]._id, b._id, doctor._id)]);
  assert.equal(samePatient.filter(row => row.status === 'fulfilled').length, 1);
  const c = await makeSlot(doctor, '12:00');
  const sameSlot = await Promise.allSettled([walkIns.assignSlotToWalkIn(tickets[1]._id, c._id, doctor._id), walkIns.assignSlotToWalkIn(tickets[2]._id, c._id, doctor._id)]);
  assert.equal(sameSlot.filter(row => row.status === 'fulfilled').length, 1);
  assert.equal((await Appointment.find({ slot:c._id })).length, 1);
  // Automatic assignment ignores yesterday's patient and preserves manual assignment guards.
  setCustomTime('2026-10-01T09:00:00');
  const old = await walkIns.addToHoldingList({ name:'Yesterday', contactNumber:'09170000000' });
  assert.equal(old.queueNumber, 1);
  setCustomTime('2026-10-02T09:00:00');
  const d = await makeSlot(doctor, '13:00'), e = await makeSlot(doctor, '14:00');
  const automatic = await Promise.all([walkIns.assignSlotToNextWalkIn(d), walkIns.assignSlotToNextWalkIn(e)]);
  assert(automatic.every(Boolean));
  assert.notEqual(String(automatic[0]._id), String(automatic[1]._id));
  assert.equal((await WalkIn.findById(old._id)).status, 'Waiting');
  const future = await makeSlot(doctor, '10:00', '2026-10-03');
  assert.equal(await walkIns.assignSlotToNextWalkIn(future), null);
  // Competing patient bookings: one record, one owner, no losing orphan appointment.
  const f = await makeSlot(doctor, '15:00');
  const booking = { patientId:patient._id, slotId:f._id, reason:'Test concurrent reservation' };
  const bookings = await Promise.allSettled([appointments.create(booking), appointments.create(booking)]);
  assert.equal(bookings.filter(row => row.status === 'fulfilled').length, 1);
  assert.equal((await Appointment.find({ slot:f._id })).length, 1);
  await assert.rejects(slots.freeSlot(f._id, 'Stale cancellation', new mongoose.Types.ObjectId()), reject(409));
  assert.equal((await Slot.findById(f._id)).status, 'Reserved-Tentative');
  // Identical flexible-assignment requests share the target appointment, but must not share claim ownership.
  const flexible = await appointments.create({ patientId:patient._id, date:'2026-10-02', reason:'Flexible request' });
  const flexibleSlot = await makeSlot(doctor, '15:30');
  const flexResults = await Promise.allSettled([
    appointments.assignSlot(flexible._id, flexibleSlot._id, doctor._id),
    appointments.assignSlot(flexible._id, flexibleSlot._id, doctor._id),
  ]);
  assert.equal(flexResults.filter(row => row.status === 'fulfilled').length, 1);
  assert.equal(String((await Slot.findById(flexibleSlot._id)).appointment), String(flexible._id));
  assert.equal(String((await Appointment.findById(flexible._id)).slot), String(flexibleSlot._id));
  const flexibleNext = await appointments.create({ patientId:patient._id, date:'2026-10-03', reason:'Competing different slots' });
  const nextOne = await makeSlot(doctor, '13:00', '2026-10-03'), nextTwo = await makeSlot(doctor, '14:00', '2026-10-03');
  const differentFlex = await Promise.allSettled([
    appointments.assignSlot(flexibleNext._id, nextOne._id, doctor._id),
    appointments.assignSlot(flexibleNext._id, nextTwo._id, doctor._id),
  ]);
  assert.equal(differentFlex.filter(row => row.status === 'fulfilled').length, 1);
  const nextSlots = await Slot.find({ date:parseDateOnly('2026-10-03'), appointment:flexibleNext._id });
  assert.equal(nextSlots.length, 1);
  const blockingSlot = await makeSlot(doctor, '11:30');
  const blockingRace = await Promise.allSettled([
    appointments.create({ ...booking, slotId:blockingSlot._id }),
    slots.updateStatus(blockingSlot._id, 'Cancelled', doctor),
  ]);
  assert.equal(blockingRace.filter(row => row.status === 'fulfilled').length, 1);
  const blockingResult = await Slot.findById(blockingSlot._id);
  assert(['Cancelled', 'Reserved-Tentative'].includes(blockingResult.status));
  assert.equal((await Appointment.find({ slot:blockingSlot._id })).length, blockingResult.status === 'Cancelled' ? 0 : 1);
  // Revision compare-and-set prevents overlapping plans across concurrent generators.
  const generation = await Promise.allSettled([
    slots.generateSlotsForDoctor(doctor._id, '2026-10-04', 30, '09:00', '10:00'),
    slots.generateSlotsForDoctor(doctor._id, '2026-10-04', 30, '09:15', '10:15'),
  ]);
  assert.equal(generation.filter(row => row.status === 'fulfilled').length, 1);
  assert.equal(generation.find(row => row.status === 'rejected').reason.statusCode, 409);
  const identical = await Promise.all(Array.from({ length:5 }, () => slots.generateSlotsForDoctor(doctor._id, '2026-10-05', 30, '09:00', '10:00')));
  assert(identical.every(rows => rows.length === 2));
  require('../src/events/handlers/slotFreed.handler').registerSlotFreedHandler();
  const eventSlot = await makeSlot(doctor, '10:30');
  const assignedEvent = once(emitter, EVENTS.WALKIN_SLOT_ASSIGNED, { signal:AbortSignal.timeout(5000) });
  await slots.freeSlot(eventSlot._id, 'Integration check');
  const [event] = await assignedEvent;
  assert.equal(String(event.slot._id), String(eventSlot._id));
  assert.equal((await Slot.findById(eventSlot._id)).status, 'Reserved-Confirmed');
  if (!live) {
    const g = await makeSlot(doctor, '16:00');
    appFailure = 'before';
    await assert.rejects(appointments.create({ ...booking, slotId:g._id }));
    assert.equal((await Slot.findById(g._id)).status, 'Available');
    slotFailure = true;
    await assert.rejects(walkIns.assignSlotToWalkIn(tickets[10]._id, g._id, doctor._id), reject(503));
    const pending = (await AssignmentRecovery.find({ state:'pending' }))[0];
    assert(pending, 'Outage must leave a durable recovery record');
    appFailure = null; slotFailure = false;
    await recovery.recover(pending);
    assert.equal((await WalkIn.findById(tickets[10]._id)).status, 'Waiting');
    assert.equal((await Slot.findById(g._id)).appointment, null);
    // Recovery detects a committed operation after an acknowledgement is lost.
    appFailure = 'after';
    await assert.rejects(appointments.create({ ...booking, slotId:g._id }));
    assert.equal((await Slot.findById(g._id)).status, 'Reserved-Tentative');
    assert.equal((await Appointment.find({ slot:g._id })).length, 1);
    appFailure = null;
    finishFailure = true;
    const h = await makeSlot(doctor, '16:30');
    await assert.rejects(appointments.create({ ...booking, slotId:h._id }));
    finishFailure = false;
    for (const operation of await AssignmentRecovery.find({ state:'pending' })) await recovery.recover(operation);
    assert.equal((await Slot.findById(h._id)).status, 'Reserved-Tentative');
    // A stale intent never releases a reservation belonging to a newer appointment.
    const stale = await AssignmentRecovery.create({ kind:'booking', slot:h._id, appointment:new mongoose.Types.ObjectId() });
    await recovery.recover(stale);
    assert.equal((await Slot.findById(h._id)).status, 'Reserved-Tentative');
    bulkFailure = true;
    await assert.rejects(slots.generateSlotsForDoctor(doctor._id, '2026-10-06', 30, '09:00', '10:00'));
    const restored = await slots.generateSlotsForDoctor(doctor._id, '2026-10-06', 30, '09:00', '10:00');
    assert.equal(restored.length, 2);
    await slots.updateStatus(restored[0]._id, 'Cancelled', doctor);
    const repeated = await slots.generateSlotsForDoctor(doctor._id, '2026-10-06', 30, '09:00', '10:00');
    assert.equal(repeated.filter(row => row.status === 'Cancelled').length, 1, 'Recovery must preserve blocked/booked rows');
  }
  assert.equal((await AssignmentRecovery.find({ state:'pending' })).length, 0);
  console.log(`Passed ${live ? 'LIVE MongoDB' : 'isolated'} concurrency checks: unique tickets, competing assignments/bookings, scoped automation, non-overlapping generation${live ? '' : ', injected failures and durable recovery'}.`);
}
main().catch(err => { console.error(live && !liveConnected ? 'Live MongoDB verification unavailable: database connection failed' : err); process.exitCode=1; }).finally(async () => {
  for (const [model, method, original] of originals.reverse()) model[method]=original;
  setCustomTime(null);
  emitter.removeAllListeners();
  if (liveConnected) {
    assert(/^cs_test_[a-f\d]{24}$/.test(database) && mongoose.connection.name === database);
    await mongoose.connection.dropDatabase();
  }
  await mongoose.disconnect();
});
