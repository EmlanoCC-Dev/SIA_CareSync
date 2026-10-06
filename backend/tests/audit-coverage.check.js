// Run: node backend/tests/audit-coverage.check.js
// Real routes/services/JWT/event handlers with isolated models; no MongoDB or patient files.
const assert = require('node:assert/strict');
process.env.NODE_ENV = 'production';
process.env.JWT_SECRET = 'isolated-audit-coverage-check-secret-for-tests';
const jwt = require('jsonwebtoken');
const User = require('../src/models/User');
const WalkIn = require('../src/models/WalkIn');
const Appointment = require('../src/models/Appointment');
const Slot = require('../src/models/Slot');
const SlotPlan = require('../src/models/SlotPlan');
const AuditLog = require('../src/models/AuditLog');
const emitter = require('../src/events/emitter');
const { registerAuditHandlers } = require('../src/events/handlers/auditLog.handler');
const slotService = require('../src/services/slot.service');
const app = require('../server');
const otpService = require('../src/services/otp.service');

const id = n => n.toString(16).padStart(24, '0');
const actor = (n, role) => ({ _id: id(n), id: id(n), role, firstName: 'Dummy', lastName: role, workingHours: [], consultationDuration: 15 });
const admin = actor(1, 'Admin'), doctor = actor(2, 'Doctor'), otherDoctor = actor(3, 'Doctor'), staff = actor(4, 'Staff'), patient = actor(5, 'Patient');
const users = new Map([admin, doctor, otherDoctor, staff, patient].map(user => [user.id, user]));
const appointment = { _id: id(20), patient: patient._id, doctor: doctor._id, status: 'Completed',
  consultationNotes: 'PRIVATE_NOTES', documents: [30, 31, 32].map(n => ({ _id: id(n), filename: `Test record ${n}.pdf`, type: 'lab_result', url: '/uploads/PRIVATE_PATH.pdf' })) };
const rows = [], slots = [], plans = new Map(), originals = [];
const stub = (model, method, fn) => { originals.push([model, method, model[method]]); model[method] = fn; };
const matches = (row, filter = {}) => Object.entries(filter).every(([key, value]) => String(row[key]) === String(value));
const query = value => ({ select() { return this; }, sort() { return this; }, skip(n) { value = value.slice(n); return this; }, limit(n) { value = value.slice(0, n); return this; },
  populate(key) { if (key === 'performedBy') value = value.map(row => ({ ...row, performedBy: users.get(String(row.performedBy)) || null })); return this; },
  then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } });
let server, checks = 0, failUser = false, failDelete = false, failBulk = false, failAudit = false;
async function main() {
  stub(User, 'findById', key => query(users.get(String(key)) || null));
  stub(User, 'findOne', filter => query([...users.values()].find(user => user.email === filter.email) || null));
  stub(User, 'find', filter => query([...users.values()].filter(user => user.role === filter.role)));
  stub(User, 'create', async data => {
    if (failUser) throw new Error('Injected account write failure');
    const user = { ...data, _id: id(100 + users.size), id: id(100 + users.size), toObject() { return { ...data, _id: this._id }; } };
    users.set(user._id, user);
    return user;
  });
  stub(Appointment, 'findById', key => query(String(key) === appointment._id ? { ...appointment, documents: appointment.documents.map(doc => ({ ...doc })) } : null));
  stub(Appointment, 'find', () => query([]));
  stub(Appointment, 'findOneAndUpdate', async (filter, update) => {
    if (failDelete) throw new Error('Injected attachment write failure');
    if (filter._id !== appointment._id || !appointment.documents.some(doc => doc._id === String(filter.documents.$elemMatch._id) && doc.url === filter.documents.$elemMatch.url)) return null;
    (appointment.archivedDocuments ||= []).push(update.$push.archivedDocuments);
    appointment.documents = appointment.documents.filter(doc => doc._id !== update.$pull.documents._id);
    return { ...appointment };
  });
  stub(Slot, 'find', filter => query(slots.filter(slot => matches(slot, filter))));
  stub(Slot, 'countDocuments', async filter => slots.filter(slot => matches(slot, filter)).length);
  stub(Slot, 'bulkWrite', async operations => {
    if (failBulk) throw new Error('Injected slot write failure');
    for (const { updateOne } of operations) if (!slots.some(slot => matches(slot, updateOne.filter))) {
      slots.push({ _id: id(200 + slots.length), ...updateOne.update.$setOnInsert });
    }
  });
  stub(SlotPlan, 'updateOne', async (filter, update) => { if (!plans.has(filter._id)) plans.set(filter._id, { _id: filter._id, ...update.$setOnInsert }); });
  stub(SlotPlan, 'findById', async key => plans.get(key));
  stub(SlotPlan, 'findOneAndUpdate', async (filter, update) => {
    const plan = plans.get(filter._id);
    if (plan.revision !== filter.revision) return null;
    plan.revision++; plan.slots.push(...update.$push.slots.$each); return plan;
  });
  stub(AuditLog, 'create', async data => {
    if (failAudit) throw new Error('Injected audit write failure');
    const row = { _id: id(300 + rows.length), timestamp: new Date(), ...data };
    rows.push(row); return row;
  });
  stub(AuditLog, 'find', filter => query(rows.filter(row => matches(row, filter))));
  stub(AuditLog, 'countDocuments', async filter => rows.filter(row => matches(row, filter)).length);
  registerAuditHandlers();
  server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function call(route, user, status = 200, method = 'GET', body) {
    const token = user && jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '5m' });
    const response = await fetch(base + route, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    assert.equal(response.status, status, `${method} ${route}: expected ${status}, got ${response.status}`); checks++;
    return response.json();
  }
  const accountData = { firstName: 'Test', lastName: 'Account', email: 'self@example.test', password: 'PRIVATE_PASSWORD', role: 'Admin', actorId: admin._id };
  await call('/users', null, 401, 'POST', accountData);
  await call('/users', staff, 403, 'POST', accountData);
  assert.equal(rows.length, 0);
  // OTP verification is covered in otp.check.js; isolate the user-creation audit here.
  stub(otpService, 'consumeOtp', async () => ({}));
  stub(WalkIn, 'updateMany', async () => ({ modifiedCount: 0 }));
  stub(WalkIn, 'find', () => query([]));
  const self = (await call('/users/register', null, 201, 'POST', accountData)).data;
  assert.equal(rows.at(-1).action, 'USER_CREATED');
  assert.equal(rows.at(-1).performedBy, self.user._id);
  assert.equal(rows.at(-1).changes.user.role, 'Patient');
  assert.equal(rows.at(-1).changes.creationMethod, 'Self-registration');
  await call('/users/register', null, 409, 'POST', accountData);
  await call('/users/register', null, 400, 'POST', { ...accountData, email: 'bad@example.test', password: 'x' });
  assert.equal(rows.length, 1);
  const created = (await call('/users', admin, 201, 'POST', { ...accountData, email: 'staff@example.test', role: 'Staff' })).data;
  assert.equal(rows.at(-1).performedBy, admin._id);
  assert.equal(rows.at(-1).targetId, created._id);
  assert.equal(rows.at(-1).changes.creationMethod, 'Admin creation');
  failUser = true;
  await call('/users', admin, 500, 'POST', { ...accountData, email: 'fail@example.test' });
  failUser = false;
  assert.equal(rows.length, 2);

  const remove = docId => `/appointments/${appointment._id}/documents/${docId}`;
  await call(remove(id(30)), otherDoctor, 403, 'DELETE');
  await call(remove(id(30)), patient, 403, 'DELETE');
  await call(remove('invalid'), doctor, 400, 'DELETE');
  await call(remove(id(99)), doctor, 404, 'DELETE');
  await call(remove(id(30)), doctor, 200, 'DELETE', { actorId: admin._id });
  assert.equal(rows.at(-1).action, 'DOCUMENT_DELETED');
  assert.equal(rows.at(-1).performedBy, doctor._id);
  assert.equal(rows.at(-1).targetId, appointment._id);
  assert.equal(rows.at(-1).changes.document.filename, 'Test record 30.pdf');
  assert.equal(rows.at(-1).changes.archived, true);
  assert.equal(appointment.archivedDocuments[0].filename, 'Test record 30.pdf');
  await call(remove(id(30)), doctor, 404, 'DELETE');
  const beforeRace = rows.length;
  const race = await Promise.all([0, 1].map(() => fetch(base + remove(id(31)), { method: 'DELETE', headers: { Authorization: `Bearer ${jwt.sign({ id: doctor._id }, process.env.JWT_SECRET)}` } })));
  checks += 2;
  assert.equal(race.filter(response => response.status === 200).length, 1);
  assert(race.every(response => [200, 404, 409].includes(response.status)));
  assert.equal(rows.length, beforeRace + 1, 'Competing deletion must produce one success audit');
  failDelete = true;
  await call(remove(id(32)), doctor, 500, 'DELETE');
  failDelete = false;
  assert.equal(rows.length, beforeRace + 1);

  const generation = { doctorId: doctor._id, date: '2099-01-01', startTime: '09:00', endTime: '09:30', duration: 15, actorId: admin._id };
  await call('/slots/generate', patient, 403, 'POST', generation);
  await call('/slots/generate', otherDoctor, 403, 'POST', generation);
  await call('/slots/generate', staff, 201, 'POST', generation);
  assert.equal(rows.at(-1).action, 'SLOTS_GENERATED');
  assert.equal(rows.at(-1).performedBy, staff._id);
  assert.equal(rows.at(-1).targetId, doctor._id);
  assert.deepEqual(rows.at(-1).changes.generation, { date: new Date('2099-01-01'), startTime: '09:00', endTime: '09:30', duration: 15, requestedSlots: 2, totalSlots: 2, source: 'Manual' });
  const repeat = (await call('/slots/generate', doctor, 201, 'POST', generation)).data;
  assert.equal(repeat.length, 2);
  assert.equal(rows.at(-1).performedBy, doctor._id);
  assert.equal(rows.at(-1).changes.generation.totalSlots, 2, 'Idempotent request must not claim extra slots');
  const beforeFailures = rows.length;
  await call('/slots/generate', staff, 400, 'POST', { ...generation, duration: -1 });
  failBulk = true;
  await call('/slots/generate', staff, 500, 'POST', { ...generation, date: '2099-01-02' });
  failBulk = false;
  assert.equal(rows.length, beforeFailures, 'Failed operations must not log successful generation');
  for (const [user, route] of [
    [patient, `/slots?doctorId=${doctor._id}&date=2099-01-03&status=Available`],
    [doctor, `/slots?doctorId=${doctor._id}&date=2099-01-04`],
    [staff, '/slots?date=2099-01-05'],
  ]) {
    const before = rows.length;
    await call(route, user);
    const generated = rows.slice(before);
    assert(generated.length > 0 && generated.every(row => row.performedBy === user._id && row.changes.generation.source === 'On-demand'));
  }
  await slotService.generateSlotsForDoctor(doctor._id, '2099-01-06', 15, '09:00', '09:15');
  assert.equal(rows.at(-1).performedBy, null);
  assert.equal(rows.at(-1).changes.generation.source, 'System');
  doctor.scheduleConfigured = true;
  const beforeOffDay = rows.length;
  await slotService.generateSlotsForDoctor(doctor._id, '2099-01-07');
  assert.equal(rows.length, beforeOffDay, 'Off-day early return must not claim generation');
  doctor.scheduleConfigured = false;

  const beforeClock = rows.length;
  await call('/system/time', admin, 200, 'POST', { time: '2098-01-01T08:00:00' });
  assert.equal(rows.length, beforeClock, 'Testing clock changes are excluded from audit coverage');
  for (const user of [null, patient, doctor, staff]) await call('/audit-logs', user, user ? 403 : 401);
  const listed = (await call('/audit-logs', admin)).data;
  assert.equal(listed.total, rows.length);
  assert.equal((await call('/audit-logs?action=DOCUMENT_DELETED', admin)).data.total, 2);
  const payload = JSON.stringify(rows);
  assert(!/PRIVATE_|password|token|\/uploads\//i.test(payload), 'New audit payloads must exclude credentials and clinical/file contents');
  assert(rows.every(row => row.timestamp instanceof Date && row.targetId));
  const previousError = console.error, errors = [];
  console.error = message => errors.push(message);
  failAudit = true;
  try {
    await call('/users', admin, 201, 'POST', { ...accountData, email: 'audit-failure@example.test', role: 'Staff' });
    assert.equal(errors.length, 1, 'Audit failures must be caught and logged');
    assert([...users.values()].some(user => user.email === 'audit-failure@example.test'));
  } finally { console.error = previousError; failAudit = false; }
  console.log(`Passed ${checks} audit HTTP checks: actor/target attribution, metadata privacy, failures, competing deletion, on-demand generation, read permissions and clock exclusion.`);
}
main().catch(err => { console.error(err); process.exitCode = 1; }).finally(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  for (const [model, method, original] of originals) model[method] = original;
  emitter.removeAllListeners();
});
