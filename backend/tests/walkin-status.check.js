// Run: node backend/tests/walkin-status.check.js
// Real HTTP routes/auth/services; isolated model doubles, no live patient data.
const assert = require('node:assert/strict');
process.env.NODE_ENV = 'production';
process.env.JWT_SECRET = 'isolated-walkin-status-check-secret-for-tests';
const jwt = require('jsonwebtoken');
const User = require('../src/models/User');
const WalkIn = require('../src/models/WalkIn');
const Appointment = require('../src/models/Appointment');
const Slot = require('../src/models/Slot');
const emitter = require('../src/events/emitter');
const EVENTS = require('../src/events/events');
const { setCustomTime } = require('../src/config/systemTime');
const app = require('../server');
const id = n => n.toString(16).padStart(24, '0');
const staff = { _id: id(1), role: 'Staff' }, doctor = { _id: id(2), role: 'Doctor' };
const otherDoctor = { _id: id(3), role: 'Doctor' }, patient = { _id: id(4), role: 'Patient' };
const admin = { _id: id(5), role: 'Admin' };
const users = [staff, doctor, otherDoctor, patient, admin];
const rows = new Map(), appointments = new Map(), slots = new Map();
const originals = [], events = [];
let server, slotFailure, appointmentFailure, checks = 0;
const stub = (model, method, fn) => { originals.push([model, method, model[method]]); model[method] = fn; };
const matches = (row, filter) => row && Object.entries(filter).every(([key, value]) => {
  if (value?.$elemMatch) return row[key].some(item => matches(item, value.$elemMatch));
  if (value?.$in) return value.$in.includes(row[key]);
  if (value?.$gte) return row[key] >= value.$gte && (value.$lt ? row[key] < value.$lt : row[key] <= value.$lte);
  return value === null ? row[key] == null : String(row[key]) === String(value);
});
const doc = value => {
  if (!value) return null;
  const copy = structuredClone(value);
  Object.defineProperty(copy, 'toObject', { value: () => structuredClone(value) });
  return copy;
};
const query = value => ({ populate() { return this; }, select() { return this; }, sort() { return this; }, limit(count) { value = value.slice(0, count); return this; },
  then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } });
const apply = (row, update) => {
  Object.assign(row, update.$set);
  if (update.$push) row.statusHistory.push(structuredClone(update.$push.statusHistory));
  if (update.$pull) row.statusHistory = row.statusHistory.filter(item => !matches(item, update.$pull.statusHistory));
};
const make = (n = 10, status = 'Slot Assigned', clinician = doctor, date = '2026-10-02T09:00:00') => {
  const key = id(n), appId = id(n + 100), slotId = id(n + 200);
  const linked = status !== 'Waiting';
  rows.set(key, { _id: key, name: `Dummy ${n}`, queueNumber: n, status, createdAt: new Date(date),
    appointment: linked ? appId : null, assignedSlot: linked ? slotId : null });
  if (linked) {
    appointments.set(appId, { _id: appId, walkIn: key, slot: slotId, doctor: clinician._id,
      status: status === 'In Progress' ? 'In Progress' : 'Confirmed', statusHistory: [] });
    slots.set(slotId, { _id: slotId, doctor: clinician._id, appointment: appId,
      status: status === 'In Progress' ? 'In Progress' : 'Reserved-Confirmed' });
  }
  return key;
};
const statusListener = data => events.push(data);
async function main() {
  setCustomTime('2026-10-02T10:00:00');
  stub(User, 'findById', key => query(users.find(user => user._id === key)));
  stub(WalkIn, 'findById', key => query(doc(rows.get(String(key)))));
  stub(WalkIn, 'find', filter => query([...rows.values()].filter(row => matches(row, filter)).map(row => ({
    ...row, appointment: appointments.get(row.appointment) || null, assignedSlot: slots.get(row.assignedSlot) || null,
  }))));
  stub(Appointment, 'findById', key => query(doc(appointments.get(String(key)))));
  stub(Appointment, 'find', () => query([]));
  stub(Slot, 'findById', key => query(doc(slots.get(String(key)))));
  for (const [model, records] of [[WalkIn, rows], [Appointment, appointments], [Slot, slots]]) {
    stub(model, 'findOneAndUpdate', async (filter, update) => {
      if (model === Slot && slotFailure) {
        if (slotFailure === 'throw') throw new Error('Simulated slot write failure');
        return null;
      }
      if (model === Appointment && appointmentFailure) return null;
      const row = records.get(String(filter._id));
      if (!matches(row, filter)) return null;
      apply(row, update);
      return doc(row);
    });
    stub(model, 'updateOne', async (filter, update) => {
      const row = records.get(String(filter._id));
      if (!matches(row, filter)) return { modifiedCount: 0 };
      apply(row, update);
      return { modifiedCount: 1 };
    });
  }
  emitter.on(EVENTS.WALKIN_STATUS_UPDATED, statusListener);
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/walkins`;
  const call = async (suffix, actor, expected, body) => {
    const response = await fetch(base + suffix, {
      method: body === undefined ? 'GET' : 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(actor ? { Authorization: `Bearer ${jwt.sign({ id: actor._id }, process.env.JWT_SECRET)}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    assert.equal(response.status, expected, `${suffix}: expected ${expected}, got ${response.status}`);
    checks++;
    return response.json();
  };
  const transition = (key, status, actor, expected = 200) => call(`/${key}/status`, actor, expected, { status });
  const key = make();
  await transition(key, 'Checked In', null, 401);
  await transition(key, 'Checked In', patient, 403);
  await transition('bad-id', 'Checked In', staff, 400);
  await transition(id(999), 'Checked In', staff, 404);
  await transition(key, { $ne: 'Left' }, staff, 400);
  await transition(key, 'Waiting', staff, 400);
  await transition(key, 'Completed', staff, 409);
  await transition(key, 'Checked In', doctor, 403);
  await transition(key, 'Checked In', staff);
  assert.equal(rows.get(key).status, 'Checked In');
  assert.equal(appointments.get(id(110)).status, 'Checked In');
  assert.equal(slots.get(id(210)).status, 'Reserved-Confirmed');
  await transition(key, 'Checked In', staff, 409);
  await transition(key, 'In Progress', otherDoctor, 403);
  await transition(key, 'In Progress', doctor);
  assert.equal(appointments.get(id(110)).status, 'In Progress');
  assert.equal(slots.get(id(210)).status, 'In Progress');
  const display = (await call('/now-serving', null, 200)).data;
  assert.deepEqual(display.nowServing, { queueNumber: 10, status: 'In Progress' });
  await transition(key, 'Left', staff, 409);
  await transition(key, 'Completed', doctor);
  assert.equal(appointments.get(id(110)).status, 'Completed');
  assert.equal(slots.get(id(210)).status, 'Completed');
  await transition(key, 'Completed', doctor, 409);
  assert.deepEqual(events.map(event => event.status), ['Checked In', 'In Progress', 'Completed']);
  assert.equal(events[0].performedBy, staff._id);
  assert.equal(appointments.get(id(110)).statusHistory.at(-1).changedBy, doctor._id);
  await transition(make(11, 'Waiting'), 'Left', staff);
  const leaving = make(12, 'Checked In');
  await transition(leaving, 'Left', doctor, 403);
  await transition(leaving, 'Left', admin);
  assert.equal(appointments.get(id(112)).status, 'Cancelled');
  assert.equal(slots.get(id(212)).status, 'Available');
  assert.equal(slots.get(id(212)).appointment, null);
  const broken = make(13);
  slots.get(id(213)).appointment = id(999);
  await transition(broken, 'Checked In', staff, 409);
  assert.equal(rows.get(broken).status, 'Slot Assigned');
  const recovering = make(14, 'Checked In');
  const beforeEvents = events.length;
  for (const failure of ['conflict', 'throw']) {
    slotFailure = failure;
    await transition(recovering, 'In Progress', doctor, failure === 'throw' ? 500 : 409);
    assert.equal(rows.get(recovering).status, 'Checked In');
    assert.equal(appointments.get(id(114)).status, 'Confirmed');
    assert.equal(appointments.get(id(114)).statusHistory.length, 0);
    assert.equal(slots.get(id(214)).status, 'Reserved-Confirmed');
    assert.equal(events.length, beforeEvents, 'Failed updates must not emit success events');
  }
  slotFailure = null;
  appointmentFailure = true;
  await transition(recovering, 'In Progress', doctor, 409);
  assert.equal(rows.get(recovering).status, 'Checked In');
  appointmentFailure = false;
  // Two requests read the same state; only one may claim the transition.
  const competing = make(15);
  const results = await Promise.allSettled([transition(competing, 'Checked In', staff), transition(competing, 'Checked In', staff, 409)]);
  results.forEach(result => { if (result.status === 'rejected') throw result.reason; });
  assert.equal(appointments.get(id(115)).statusHistory.length, 1);
  make(16, 'Slot Assigned', otherDoctor);
  make(17, 'Waiting', doctor, '2026-10-01T23:59:59');
  make(18, 'Waiting', doctor, '2026-10-03T00:00:00');
  make(19, 'Waiting');
  const waiting = (await call('?status=Waiting', staff, 200)).data;
  assert(waiting.every(row => row.status === 'Waiting'));
  assert.deepEqual(waiting.map(row => row._id), [id(19)]);
  assert(!waiting.some(row => [id(17), id(18)].includes(row._id)));
  const yesterday = (await call('?status=Waiting&date=2026-10-01', staff, 200)).data;
  assert.deepEqual(yesterday.map(row => row._id), [id(17)]);
  const today = (await call('', staff, 200)).data;
  assert(today.some(row => row._id === key));
  assert(!today.some(row => [id(17), id(18)].includes(row._id)));
  const clinicianRows = (await call('?status=Checked%20In', doctor, 200)).data;
  assert(clinicianRows.length > 0);
  assert(clinicianRows.every(row => row.appointment.doctor === doctor._id));
  await call('?status=bad-status', staff, 400);
  await call('?date=2026-02-30', staff, 400);
  await call('?view=bad-view', staff, 400);
  await call('?view=holding&status=Completed', staff, 400);
  await call('?status=Waiting&status=Completed', staff, 400);
  const holding = (await call('?view=holding&date=2026-10-01', staff, 200)).data;
  assert.deepEqual(holding.map(row => row._id), [id(17)]);
  // Listing appointments must not mark an arrived walk-in as a no-show while waiting for the doctor.
  const appointmentService = require('../src/services/appointment.service');
  let noShowSaved = false;
  stub(Appointment, 'find', () => query([{ _id: id(900), status: 'Confirmed', date: new Date('2026-10-01'),
    timeSlot: '09:00-09:30', walkIn: { _id: id(901), status: 'Checked In' }, save: async () => { noShowSaved = true; } }]));
  assert.deepEqual(await appointmentService.autoMarkNoShows(), []);
  assert.equal(noShowSaved, false);
  console.log(`Passed ${checks} walk-in HTTP checks: lifecycle, permissions, linked records, conflicts/recovery, events, and date/status filters.`);
}
main().catch(err => { console.error(err); process.exitCode = 1; }).finally(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  emitter.off(EVENTS.WALKIN_STATUS_UPDATED, statusListener);
  for (const [model, method, original] of originals.reverse()) model[method] = original;
  setCustomTime(null);
});
