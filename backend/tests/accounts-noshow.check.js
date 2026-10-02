// Run: node backend/tests/accounts-noshow.check.js (isolated models, no MongoDB).
const assert = require('node:assert/strict');
process.env.NODE_ENV = 'production';
process.env.JWT_SECRET = 'isolated-accounts-noshow-check-secret-for-tests';
const jwt = require('jsonwebtoken');
const User = require('../src/models/User');
const Appointment = require('../src/models/Appointment');
const Slot = require('../src/models/Slot');
const WalkIn = require('../src/models/WalkIn');
const usersService = require('../src/services/user.service');
const appointmentsService = require('../src/services/appointment.service');
const slotsService = require('../src/services/slot.service');
const emitter = require('../src/events/emitter');
const EVENTS = require('../src/events/events');
const { setCustomTime } = require('../src/config/systemTime');
const app = require('../server');
const id = n => n.toString(16).padStart(24, '0');
const admin = { _id: id(1), role: 'Admin', firstName: 'Clinic', lastName: 'Admin' };
const patient = { _id: id(2), role: 'Patient', email: 'patient@example.test', firstName: 'Test', lastName: 'Patient',
  comparePassword: async password => password === 'correct', toObject() { return { ...this, password: 'hash' }; } };
const doctor = { _id: id(3), role: 'Doctor' };
const users = new Map([admin, patient, doctor].map(user => [user._id, user]));
const originals = [], events = [], rows = [];
let server, failRelease = false, loseClaim = false;
const stub = (model, method, fn) => { originals.push([model, method, model[method]]); model[method] = fn; };
const query = data => ({ populate() { return this; }, select() { return this; }, then(resolve, reject) { return Promise.resolve(data).then(resolve, reject); } });
const listener = data => events.push(data);
const slot = { _id: id(10), doctor: doctor._id, date: new Date('2026-10-03'), startTime: '09:00', endTime: '09:15', status: 'Reserved-Confirmed', appointment: id(20) };
const visit = { _id: id(20), doctor: doctor._id, patient: patient._id, date: slot.date, slot,
  status: 'Confirmed', statusHistory: [], walkIn: { _id: id(30), status: 'Slot Assigned' } };
async function main() {
  stub(User, 'findById', key => query(users.get(String(key)) || null));
  stub(User, 'findOne', () => query(patient));
  stub(User, 'find', filter => query([...users.values()].filter(user => user.role === filter.role && user.status !== 'Deactivated')));
  stub(User, 'findByIdAndUpdate', async (key, update) => {
    if (update.$set.email === 'duplicate@example.test') throw Object.assign(new Error('duplicate'), { code: 11000 });
    const user = users.get(key); Object.assign(user, update.$set); return user;
  });
  stub(Appointment, 'exists', async () => true);
  stub(Appointment, 'findById', () => query(visit));
  stub(Appointment, 'find', () => query(rows));
  stub(Appointment, 'findOneAndUpdate', async (filter, update) => {
    if (loseClaim || filter.status !== visit.status) return null;
    Object.assign(visit, update.$set); visit.statusHistory.push(update.$push.statusHistory); return visit;
  });
  stub(Slot, 'findById', () => query(slot));
  stub(Slot, 'findOneAndUpdate', async (filter, update) => {
    if (failRelease) { failRelease = false; throw new Error('Injected release outage'); }
    assert.equal(filter.appointment, slot.appointment); Object.assign(slot, update.$set); return slot;
  });
  stub(WalkIn, 'findOneAndUpdate', async (filter, update) => {
    assert(filter.status.$in.includes(visit.walkIn.status)); Object.assign(visit.walkIn, update.$set);
  });
  emitter.on(EVENTS.USER_UPDATED, listener);
  server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  async function call(path, actor, status, data, method = 'PATCH') {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json',
      ...(actor && { Authorization: `Bearer ${jwt.sign({ id: actor._id }, process.env.JWT_SECRET)}` }) },
      ...(data !== undefined && { body: JSON.stringify(data) }) });
    const body = await response.json(); assert.equal(response.status, status, body.message); return body;
  }
  await call(`/api/users/${patient._id}`, patient, 403, { role: 'Admin' });
  await call('/api/users/bad-id', admin, 400, { role: 'Staff' });
  await call(`/api/users/${patient._id}`, admin, 400, { role: 'Unknown' });
  await call(`/api/users/${patient._id}`, admin, 400, { status: 'Deleted' });
  await call(`/api/users/${patient._id}`, admin, 400, { email: {} });
  await call(`/api/users/${patient._id}`, admin, 400, { firstName: ' ' });
  await call(`/api/users/${patient._id}`, admin, 409, { email: 'duplicate@example.test' });
  await call(`/api/users/${admin._id}`, admin, 400, { status: 'Deactivated' });
  await call(`/api/users/${admin._id}`, admin, 400, { role: 'Staff' });
  await call(`/api/users/${doctor._id}`, admin, 409, { role: 'Staff' });
  await call(`/api/users/${id(99)}`, admin, 404, { firstName: 'Missing' });
  await call(`/api/users/${patient._id}`, admin, 200, { firstName: 'Updated', email: 'NEW@EXAMPLE.TEST', role: 'Staff', password: 'ignored' });
  assert.equal(patient.email, 'new@example.test'); assert.equal(patient.password, undefined);
  assert.equal(events.at(-1).performedBy, admin._id); assert.equal(events.at(-1).changes.password, undefined);
  await call(`/api/users/${patient._id}`, admin, 200, { status: 'Deactivated' });
  assert(users.has(patient._id)); assert.equal(patient.status, 'Deactivated');
  await call('/api/users/me', patient, 401, undefined, 'GET');
  await call('/api/users/login', null, 403, { email: patient.email, password: 'correct' }, 'POST');
  await call(`/api/users/${patient._id}`, admin, 200, { status: 'Active', role: 'Patient' });
  const loggedIn = await usersService.login(patient.email, 'correct'); assert(loggedIn.token); assert.equal(loggedIn.user.password, undefined);
  await call(`/api/users/${doctor._id}`, admin, 200, { status: 'Deactivated' });
  assert.deepEqual(await usersService.getDoctors(admin), []);
  setCustomTime('2026-10-03T08:00:00'); slot.status = 'Available'; slot.appointment = null;
  await assert.rejects(slotsService.reserveSlot(slot._id, visit._id), err => err.statusCode === 409);
  assert.deepEqual(await slotsService.getAvailableSlots(doctor._id, '2026-10-03'), []);
  doctor.status = 'Active'; slot.status = 'Reserved-Confirmed'; slot.appointment = visit._id;
  rows.push(visit); assert.deepEqual(await appointmentsService.autoMarkNoShows(), []); assert.equal(visit.status, 'Confirmed');
  setCustomTime('2026-10-03T10:00:00'); visit.walkIn.status = 'Checked In';
  assert.deepEqual(await appointmentsService.autoMarkNoShows(), []); assert.equal(visit.status, 'Confirmed');
  visit.walkIn.status = 'Slot Assigned'; loseClaim = true;
  assert.deepEqual(await appointmentsService.autoMarkNoShows(), []); assert.equal(slot.status, 'Reserved-Confirmed');
  loseClaim = false;
  assert.deepEqual(await appointmentsService.autoMarkNoShows(), [visit._id]);
  assert.equal(visit.status, 'No-show'); assert.equal(slot.status, 'No-show'); assert.equal(slot.appointment, null);
  assert.equal(visit.walkIn.status, 'Left'); assert.equal(visit.statusHistory.length, 1);
  await appointmentsService.autoMarkNoShows(); assert.equal(visit.statusHistory.length, 1);
  // A failed release must be repaired on the next pass without a second status-history entry.
  visit.status = 'Confirmed'; visit.statusHistory = []; visit.walkIn.status = 'Slot Assigned';
  slot.status = 'Reserved-Confirmed'; slot.appointment = visit._id; failRelease = true;
  const logError = console.error; console.error = () => {};
  try { await appointmentsService.autoMarkNoShows(); } finally { console.error = logError; }
  assert.equal(visit.status, 'No-show'); assert.equal(slot.status, 'Reserved-Confirmed');
  await appointmentsService.autoMarkNoShows(); assert.equal(slot.status, 'No-show'); assert.equal(slot.appointment, null);
  assert.equal(visit.statusHistory.length, 1);
  // Never release a slot now owned by another appointment.
  slot.status = 'Reserved-Confirmed'; slot.appointment = id(88);
  await appointmentsService.autoMarkNoShows(); assert.equal(slot.appointment, id(88));
  visit.status = 'Confirmed'; visit.walkIn = null; visit.slot = slot._id; visit.save = async () => {};
  slot.status = 'Reserved-Confirmed'; slot.appointment = visit._id;
  await appointmentsService.noShow(visit._id, admin._id);
  assert.equal(slot.status, 'No-show'); assert.equal(slot.appointment, null);
  visit.status = 'Confirmed'; slot.status = 'Reserved-Confirmed'; slot.appointment = visit._id;
  slot.startTime = '11:00'; slot.endTime = '11:15';
  await appointmentsService.noShow(visit._id, admin._id);
  assert.equal(slot.status, 'Available'); assert.equal(slot.appointment, null);
  console.log('Passed account-edit/role/status HTTP checks, deactivated login/session/booking checks, and no-show expiry/conflict/retry checks.');
}
main().catch(err => { console.error(err); process.exitCode = 1; }).finally(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  for (const [model, method, original] of originals.reverse()) model[method] = original;
  emitter.off(EVENTS.USER_UPDATED, listener); setCustomTime(null);
});
