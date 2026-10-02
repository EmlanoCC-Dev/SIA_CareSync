// Run: node backend/tests/notifications.check.js
// Real HTTP routes/auth and event handlers, isolated models; no live patient data.
const assert = require('node:assert/strict');
process.env.NODE_ENV = 'production';
process.env.JWT_SECRET = 'isolated-notifications-check-secret-for-tests';
const jwt = require('jsonwebtoken');
const User = require('../src/models/User');
const Notification = require('../src/models/Notification');
const emitter = require('../src/events/emitter');
const EVENTS = require('../src/events/events');
const { registerAllHandlers } = require('../src/events/handlers/notification.handler');
const app = require('../server');

const id = n => n.toString(16).padStart(24, '0');
const users = ['Patient', 'Patient', 'Doctor', 'Doctor', 'Staff', 'Admin'].map((role, index) => ({ _id: id(index + 1), role }));
const [patient, otherPatient, doctor, otherDoctor, staff, admin] = users;
const rows = [];
const originals = [];
const stub = (model, method, fn) => { originals.push([model, method, model[method]]); model[method] = fn; };
const matches = (item, filter) => Object.entries(filter).every(([key, value]) => String(item[key]) === String(value));
function query(values) {
  return { select() { return this; }, lean() { return this; },
    sort() { values = [...values].sort((a, b) => b.createdAt - a.createdAt || b._id.localeCompare(a._id)); return this; },
    skip(n) { values = values.slice(n); return this; }, limit(n) { values = values.slice(0, n); return this; },
    then(resolve, reject) { return Promise.resolve(values).then(resolve, reject); } };
}
let server, checks = 0, failUser = null, failReviewers = false;
async function main() {
  stub(User, 'findById', key => query(users.find(user => user._id === String(key)) || null));
  stub(User, 'find', filter => {
    assert.deepEqual(filter, { role: { $in: ['Staff', 'Admin'] } });
    if (failReviewers) throw new Error('Injected reviewer lookup failure');
    return query([staff, admin]);
  });
  stub(Notification, 'create', async data => {
    if (data.user === failUser) throw new Error('Injected notification write failure');
    const item = { _id: id(100 + rows.length), ...data, readAt: null, createdAt: new Date() };
    rows.push(item);
    return item;
  });
  stub(Notification, 'find', filter => query(rows.filter(item => matches(item, filter))));
  stub(Notification, 'countDocuments', async filter => rows.filter(item => matches(item, filter)).length);
  stub(Notification, 'findOneAndUpdate', async (filter, update) => {
    const item = rows.find(item => matches(item, filter));
    if (item) item.readAt ??= update[0].$set.readAt.$ifNull[1];
    return item || null;
  });
  stub(Notification, 'updateMany', async (filter, update) => {
    const matching = rows.filter(item => matches(item, filter));
    matching.forEach(item => Object.assign(item, update.$set));
    return { modifiedCount: matching.length };
  });
  registerAllHandlers();
  const emit = (event, data) => Promise.all(emitter.listeners(event).map(handler => handler(data)));
  const appointment = { _id: id(50), patient: patient._id, doctor: { _id: doctor._id }, date: new Date('2026-10-02'), timeSlot: '10:00–10:15', reason: 'PRIVATE_MEDICAL_REASON' };
  await emit(EVENTS.APPOINTMENT_BOOKED, { appointment });
  assert.deepEqual(rows.map(row => row.user).sort(), [patient, doctor, staff, admin].map(user => user._id).sort());
  assert(rows.every(row => row.appointment === appointment._id && !row.message.includes(appointment.reason)));
  assert(rows.some(row => row.user === doctor._id && row.message.includes('pending clinic approval')));
  assert(!rows.some(row => [otherPatient._id, otherDoctor._id].includes(row.user)));
  const flexible = { ...appointment, doctor: null };
  await emit(EVENTS.APPOINTMENT_BOOKED, { appointment: flexible });
  assert.equal(rows.length, 7, 'Flexible request alerts patient and reviewers, not an unassigned doctor');
  await emit(EVENTS.APPOINTMENT_ASSIGNED, { appointment });
  await emit(EVENTS.APPOINTMENT_APPROVED, { appointment });
  await emit(EVENTS.APPOINTMENT_DECLINED, { appointment, reason: 'PRIVATE_DECLINE_REASON' });
  await emit(EVENTS.APPOINTMENT_CANCELLED, { appointment, reason: 'PRIVATE_CANCEL_REASON' });
  await emit(EVENTS.APPOINTMENT_NO_SHOW, { appointment });
  await emit(EVENTS.APPOINTMENT_CHECKED_IN, { appointment });
  await emit(EVENTS.APPOINTMENT_COMPLETED, { appointment });
  const walkIn = { queueNumber: 8, name: 'PRIVATE_WALKIN_NAME' };
  await emit(EVENTS.WALKIN_SLOT_ASSIGNED, { appointment: { ...appointment, patient: null }, walkIn, slot: { doctor: doctor._id, startTime: '10:00', endTime: '10:15' } });
  await emit(EVENTS.WALKIN_STATUS_UPDATED, { appointment, walkIn, status: 'Checked In' });
  const before = rows.length;
  await emit(EVENTS.WALKIN_STATUS_UPDATED, { appointment, walkIn, status: 'Completed' });
  assert.equal(rows.length, before, 'Generic status handler must not duplicate completion events');
  assert(rows.some(row => row.type === 'PATIENT_ARRIVED' && row.user === doctor._id));
  assert(rows.some(row => row.type === 'APPOINTMENT_COMPLETED' && row.user === patient._id));
  assert(rows.every(row => !row.message.includes('PRIVATE_')));

  const logged = [];
  const previousError = console.error;
  console.error = message => logged.push(message);
  try {
    failUser = patient._id;
    await emit(EVENTS.APPOINTMENT_APPROVED, { appointment });
    assert.equal(rows.at(-1).user, doctor._id, 'Failed patient save must not suppress doctor delivery');
    failUser = null;
    failReviewers = true;
    const oldLength = rows.length;
    await emit(EVENTS.APPOINTMENT_BOOKED, { appointment });
    assert.equal(rows.length, oldLength + 2, 'Reviewer lookup failure must not suppress patient/doctor delivery');
    assert.equal(logged.length, 2, 'Persistence failures must be handled and recorded');
  } finally { console.error = previousError; failUser = null; failReviewers = false; }

  // Add more than one page to catch slicing/count and mark-all scope mistakes.
  for (let n = 0; n < 25; n++) await Notification.create({ user: otherPatient._id, type: 'TEST', title: 'Test', message: 'Test' });
  server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  const base = `http://127.0.0.1:${server.address().port}/api/notifications`;
  async function call(path, user, status = 200, method = 'GET', body) {
    const token = user && jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '5m', algorithm: 'HS256' });
    const response = await fetch(base + path, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    assert.equal(response.status, status, `${method} ${path}: expected ${status}, got ${response.status}`);
    if (status === 200) assert.equal(response.headers.get('cache-control'), 'no-store');
    checks++;
    return response.json();
  }
  await call('', null, 401);
  await call('/read-all', null, 401, 'PATCH');
  await call(`/${rows[0]._id}/read`, null, 401, 'PATCH');
  for (const user of users) {
    const { data } = await call('', user);
    assert(data.items.every(item => item.user === user._id));
    assert.equal(data.unreadCount, rows.filter(row => row.user === user._id && !row.readAt).length);
  }
  const page1 = (await call('', otherPatient)).data;
  const page2 = (await call('?page=2', otherPatient)).data;
  assert.equal(page1.items.length, 20);
  assert.equal(page2.items.length, 5);
  assert.equal(page2.total, 25);
  assert(!page1.items.some(item => page2.items.some(other => other._id === item._id)));
  for (const params of ['?page=0', '?page=-1', '?page=1.5', '?page=10000', '?unread=yes', `?user=${patient._id}`, '?unread[$ne]=null', '?page=1&page=2']) await call(params, patient, 400);
  await call('/invalid/read', patient, 400, 'PATCH');
  await call(`/${rows[0]._id}/read`, otherPatient, 404, 'PATCH');
  await call(`/${rows[0]._id}/read`, admin, 404, 'PATCH');
  await call(`/${id(9999)}/read`, patient, 404, 'PATCH');
  await call(`/${rows[0]._id}/read`, patient, 200, 'PATCH', { user: otherPatient._id });
  const readAt = rows[0].readAt;
  await call(`/${rows[0]._id}/read`, patient, 200, 'PATCH');
  assert.equal(rows[0].readAt, readAt, 'Repeated reads preserve the first timestamp');
  const unreadItems = (await call('?unread=true', patient)).data;
  assert(unreadItems.items.every(item => !item.readAt));
  const patientUnread = unreadItems.unreadCount;
  const readAll = await call('/read-all', patient, 200, 'PATCH', { user: otherPatient._id });
  assert.equal(readAll.data.modifiedCount, patientUnread);
  assert.equal((await call('', patient)).data.unreadCount, 0);
  assert.equal((await call('?unread=true', patient)).data.items.length, 0);
  assert.equal((await call('', otherPatient)).data.unreadCount, 25, 'Mark all must not change another inbox');
  assert.equal((await call('/read-all', patient, 200, 'PATCH')).data.modifiedCount, 0);
  await call('', patient, 404, 'POST');
  console.log(`Passed notification event routing, privacy/failure checks and ${checks} owner-scoped HTTP checks.`);
}
main().catch(err => { console.error(err); process.exitCode = 1; }).finally(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  for (const [model, method, original] of originals) model[method] = original;
  emitter.removeAllListeners();
});
