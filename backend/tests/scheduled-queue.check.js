// Run: node backend/tests/scheduled-queue.check.js — real HTTP/services/events, isolated models, no MongoDB.
const assert = require('node:assert/strict');
process.env.NODE_ENV = 'production';
process.env.JWT_SECRET = 'isolated-scheduled-queue-check-secret-for-tests';
const jwt = require('jsonwebtoken');
const User = require('../src/models/User');
const Appointment = require('../src/models/Appointment');
const Slot = require('../src/models/Slot');
const WalkIn = require('../src/models/WalkIn');
const emitter = require('../src/events/emitter');
const EVENTS = require('../src/events/events');
const appointmentService = require('../src/services/appointment.service');
const { setCustomTime } = require('../src/config/systemTime');
const app = require('../server');
const id = n => n.toString(16).padStart(24, '0');
const actors = ['Staff', 'Admin', 'Doctor', 'Doctor', 'Patient'].map((role, i) => ({ _id: id(i + 1), id: id(i + 1), role }));
const [staff, admin, doctor, otherDoctor, patient] = actors;
const visits = new Map(), slots = new Map(), walkIns = new Map(), originals = [], events = [];
let server, checks = 0, slotFailure = false, rollbackFailure = false;
const clone = value => structuredClone(value);
const matches = (row, filter) => row && Object.entries(filter).every(([key, value]) => {
  if (value?.$in) return value.$in.includes(row[key]);
  if (value?.$ne !== undefined) return row[key] !== value.$ne;
  if (value?.$gte) return row[key] >= value.$gte && row[key] <= value.$lte;
  if (value?.$elemMatch) return row[key].some(item => matches(item, value.$elemMatch));
  return value == null ? row[key] == null : String(row[key]) === String(value);
});
function query(value) {
  return { select() { return this; }, populate(field) {
    if (Array.isArray(value) && field === 'slot') value = value.map(row => ({ ...row, slot: slots.get(row.slot) }));
    if (Array.isArray(value) && field === 'assignedSlot') value = value.map(row => ({ ...row, assignedSlot: slots.get(row.assignedSlot) }));
    return this;
  }, sort(order) {
    if (Array.isArray(value)) value.sort((a, b) => {
      for (const [key, direction] of Object.entries(order)) {
        if (a[key] !== b[key]) return (a[key] < b[key] ? -1 : 1) * direction;
      }
      return 0;
    });
    return this;
  }, then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } };
}
const stub = (model, method, fn) => { originals.push([model, method, model[method]]); model[method] = fn; };
const apply = (row, update) => {
  Object.assign(row, clone(update.$set || {}));
  if (update.$push) row.statusHistory.push(clone(update.$push.statusHistory));
  if (update.$pull) row.statusHistory = row.statusHistory.filter(item => !matches(item, update.$pull.statusHistory));
};
const listener = data => events.push(data);
function make(n, date = '2026-10-03', time = '10:00', status = 'Confirmed') {
  const visit = { _id: id(n), patient: patient._id, doctor: doctor._id, slot: id(n + 100), walkIn: null,
    date: new Date(date), timeSlot: `${time}-10:30`, status, statusHistory: [], queueNumber: null,
    reason: 'PRIVATE_REASON', consultationNotes: 'PRIVATE_NOTES' };
  visits.set(visit._id, visit);
  slots.set(visit.slot, { _id: visit.slot, doctor: doctor._id, appointment: visit._id, date: visit.date,
    startTime: time, endTime: '10:30', status: 'Reserved-Confirmed' });
  return visit;
}
async function main() {
  stub(User, 'findById', key => query(actors.find(actor => actor._id === key)));
  stub(Appointment, 'init', async () => {});
  stub(Appointment, 'findById', key => query(visits.has(String(key)) ? clone(visits.get(String(key))) : null));
  stub(Appointment, 'find', filter => query([...visits.values()].filter(row => matches(row, filter)).map(clone)));
  stub(Appointment, 'findOne', filter => {
    const last = [...visits.values()].filter(row => matches(row, filter)).sort((a, b) => b.queueNumber - a.queueNumber)[0];
    return query(last ? clone(last) : null);
  });
  stub(Appointment, 'findOneAndUpdate', async (filter, update) => {
    const row = visits.get(filter._id);
    if (!matches(row, filter)) return null;
    if (update.$set.queueNumber && [...visits.values()].some(other => other._id !== row._id &&
        other.queueDay === update.$set.queueDay && other.queueNumber === update.$set.queueNumber)) {
      throw Object.assign(new Error('Duplicate ticket'), { code: 11000, keyPattern: { queueDay: 1, queueNumber: 1 } });
    }
    apply(row, update); return clone(row);
  });
  stub(Appointment, 'updateOne', async (filter, update) => {
    if (rollbackFailure) throw new Error('Injected rollback outage');
    const row = visits.get(filter._id); if (!matches(row, filter)) return { modifiedCount: 0 };
    apply(row, update); return { modifiedCount: 1 };
  });
  stub(Slot, 'findById', key => query(slots.has(String(key)) ? clone(slots.get(String(key))) : null));
  stub(Slot, 'findOneAndUpdate', async (filter, update) => {
    if (slotFailure) throw new Error('Injected slot outage');
    const row = slots.get(filter._id); if (!matches(row, filter)) return null;
    apply(row, update); return clone(row);
  });
  stub(WalkIn, 'find', filter => query([...walkIns.values()].filter(row => matches(row, filter)).map(clone)));
  for (const event of [EVENTS.APPOINTMENT_CHECKED_IN, EVENTS.APPOINTMENT_STARTED, EVENTS.APPOINTMENT_COMPLETED]) emitter.on(event, listener);
  assert(Appointment.schema.indexes().some(([fields, options]) => fields.queueDay && fields.queueNumber && options.unique));
  server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  async function call(path, actor, expected, method = 'PATCH') {
    const response = await fetch(base + path, { method,
      headers: actor ? { Authorization: `Bearer ${jwt.sign({ id: actor._id }, process.env.JWT_SECRET)}` } : {} });
    const result = await response.json(); assert.equal(response.status, expected, result.message); checks++; return result;
  }
  const action = (visit, suffix, actor, expected = 200) => call(`/api/appointments/${visit._id}/${suffix}`, actor, expected);
  setCustomTime('2026-10-03T09:00:00');
  const visit = make(20);
  await action(visit, 'check-in', null, 401);
  await action(visit, 'check-in', patient, 403);
  await action(visit, 'check-in', otherDoctor, 403);
  await action(make(21, '2026-10-04'), 'check-in', staff, 400);
  await action(visit, 'start', doctor, 409);
  await action(visit, 'complete', doctor, 409);
  await action(visit, 'check-in', staff);
  assert.equal(visit.status, 'Checked In'); assert.equal(visit.queueNumber, 1);
  assert.equal(slots.get(visit.slot).status, 'Reserved-Confirmed');
  assert.equal(events.at(-1).appointment.status, 'Checked In');
  await action(visit, 'check-in', staff, 409);
  await action(visit, 'start', patient, 403);
  await action(visit, 'start', otherDoctor, 403);
  await action(visit, 'complete', staff, 409);
  // Different appointments racing for the same next ticket must get distinct numbers.
  const a = make(22), b = make(23), c = make(24);
  await Promise.all([action(a, 'check-in', staff), action(b, 'check-in', admin)]);
  assert.notEqual(a.queueNumber, b.queueNumber);
  const attempts = await Promise.all([200, 409].map(async () => {
    const response = await fetch(`${base}/api/appointments/${c._id}/check-in`, { method: 'PATCH', headers: {
      Authorization: `Bearer ${jwt.sign({ id: staff._id }, process.env.JWT_SECRET)}` } });
    return response.status;
  }));
  assert.deepEqual(attempts.sort(), [200, 409]); assert.equal(c.statusHistory.length, 1);
  assert.equal(new Set([visit, a, b, c].map(row => row.queueNumber)).size, 4);
  // Checked-in patients stay waiting even when the booked time has elapsed.
  setCustomTime('2026-10-03T11:00:00');
  const beforeNoShows = [...visits.values()].map(row => row.status);
  await appointmentService.autoMarkNoShows();
  assert.deepEqual([...visits.values()].map(row => row.status), beforeNoShows);
  await action(make(25), 'check-in', staff, 400);
  // A conflicting slot must restore arrival status/history and emit no start event.
  const slot = slots.get(visit.slot), oldEvents = events.length;
  slot.appointment = id(999); await action(visit, 'start', doctor, 409);
  assert.equal(visit.status, 'Checked In'); assert.equal(visit.statusHistory.length, 1); assert.equal(events.length, oldEvents);
  slot.appointment = visit._id; slotFailure = true;
  await action(visit, 'start', doctor, 500);
  assert.equal(visit.status, 'Checked In'); assert.equal(visit.statusHistory.length, 1);
  slotFailure = false; await action(visit, 'start', doctor);
  assert.equal(visit.status, 'In Progress'); assert.equal(slot.status, 'In Progress');
  await action(visit, 'start', doctor, 409);
  await action(visit, 'complete', patient, 403);
  // Public board: mixed patients, all serving tickets, no patient/doctor IDs or clinical data.
  walkIns.set(id(40), { _id: id(40), queueNumber: 1, status: 'In Progress', createdAt: new Date('2026-10-03T09:00:00'), name: 'PRIVATE_NAME' });
  walkIns.set(id(41), { _id: id(41), queueNumber: 2, status: 'Checked In', createdAt: new Date('2026-10-03T09:05:00'), assignedSlot: visit.slot, contactNumber: 'PRIVATE_PHONE' });
  walkIns.set(id(42), { _id: id(42), queueNumber: 3, status: 'Waiting', createdAt: new Date('2026-10-02T09:05:00') });
  // Linked walk-in appointment must not appear a second time as a scheduled visit.
  const linked = make(26, '2026-10-03', '10:00', 'In Progress'); linked.walkIn = id(40); linked.queueNumber = 99;
  const display = (await call('/api/walkins/now-serving', null, 200, 'GET')).data;
  assert.deepEqual(display.serving.map(row => row.queueNumber), [1, 'A-1']);
  assert(display.upcoming.some(row => row.queueNumber === `A-${a.queueNumber}`));
  assert(display.upcoming.some(row => row.queueNumber === 2));
  assert(!display.upcoming.some(row => row.queueNumber === 3));
  for (const entry of [...display.serving, ...display.upcoming]) assert.deepEqual(Object.keys(entry).sort(), ['queueNumber', 'status']);
  assert(!JSON.stringify(display).includes('PRIVATE'));
  await action(visit, 'complete', doctor);
  assert.equal(visit.status, 'Completed'); assert.equal(slot.status, 'Completed');
  assert.deepEqual(visit.statusHistory.map(row => row.status), ['Checked In', 'In Progress', 'Completed']);
  const completedBoard = (await call('/api/walkins/now-serving', null, 200, 'GET')).data;
  assert(!completedBoard.serving.some(row => row.queueNumber === 'A-1'));
  // Daily tickets reset; a checked-in previous-day visit cannot start today.
  setCustomTime('2026-10-04T09:00:00');
  await action(a, 'start', doctor, 400);
  const tomorrow = make(27, '2026-10-04'); await action(tomorrow, 'check-in', staff); assert.equal(tomorrow.queueNumber, 1);
  const freshBoard = (await call('/api/walkins/now-serving', null, 200, 'GET')).data;
  assert.deepEqual(freshBoard.upcoming, [{ queueNumber: 'A-1', status: 'Checked In' }]);
  rollbackFailure = true; slotFailure = true;
  const failed = await action(tomorrow, 'start', doctor, 500);
  assert.match(failed.message, /reconcile/);
  console.log(`Passed ${checks} scheduled-queue HTTP checks: arrival/start/completion, tickets/races, privacy, no-show exemption, rollover, ownership and rollback failures.`);
}
main().catch(err => { console.error(err); process.exitCode = 1; }).finally(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  for (const [model, method, original] of originals.reverse()) model[method] = original;
  for (const event of [EVENTS.APPOINTMENT_CHECKED_IN, EVENTS.APPOINTMENT_STARTED, EVENTS.APPOINTMENT_COMPLETED]) emitter.off(event, listener);
  setCustomTime(null);
});
