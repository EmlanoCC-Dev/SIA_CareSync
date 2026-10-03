// Run: node backend/tests/comments.check.js — real routes/services/events, isolated models; no MongoDB.
const assert = require('node:assert/strict');
process.env.NODE_ENV = 'production';
process.env.EMAIL_ENABLED = 'false'; // Isolated checks never send real email.
process.env.JWT_SECRET = 'isolated-comments-check-secret-for-tests';
const jwt = require('jsonwebtoken');
const User = require('../src/models/User');
const Appointment = require('../src/models/Appointment');
const Comment = require('../src/models/AppointmentComment');
const Notification = require('../src/models/Notification');
const AuditLog = require('../src/models/AuditLog');
const emitter = require('../src/events/emitter');
const EVENTS = require('../src/events/events');
const { registerAllHandlers } = require('../src/events/handlers/notification.handler');
const { registerAuditHandlers } = require('../src/events/handlers/auditLog.handler');
const app = require('../server');
const id = n => n.toString(16).padStart(24, '0');
const users = ['Patient', 'Patient', 'Doctor', 'Doctor', 'Staff', 'Admin', 'Staff'].map((role, i) => ({
  _id: id(i + 1), role, firstName: `User${i + 1}`, lastName: 'Test', status: i === 6 ? 'Deactivated' : 'Active',
}));
const [patient, otherPatient, doctor, otherDoctor, staff, admin, inactive] = users;
const visit = { _id: id(20), patient: patient._id, doctor: doctor._id, status: 'Pending',
  reason: 'PRIVATE_REASON', consultationNotes: 'PRIVATE_NOTES', documents: [], statusHistory: [] };
const walkIn = { ...visit, _id: id(21), patient: null, walkIn: id(30) };
const flexible = { ...visit, _id: id(22), doctor: null };
const visits = [visit, walkIn, flexible], rows = [], notifications = [], audits = [], events = [], originals = [];
let server, checks = 0, failSave = false, failNotification = false;
const stub = (model, method, fn) => { originals.push([model, method, model[method]]); model[method] = fn; };
function query(value) {
  return { select() { return this; }, lean() { return this; }, sort(order) {
    assert.deepEqual(order, { createdAt: 1, _id: 1 });
    value = [...value].sort((a, b) => a.createdAt - b.createdAt || a._id.localeCompare(b._id));
    return this;
  }, then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } };
}
async function main() {
  stub(User, 'findById', key => query(users.find(user => user._id === String(key)) || null));
  stub(User, 'find', filter => {
    assert.deepEqual(filter, { role: { $in: ['Staff', 'Admin'] }, status: { $ne: 'Deactivated' } });
    return query(users.filter(user => ['Staff', 'Admin'].includes(user.role) && user.status !== 'Deactivated'));
  });
  stub(Appointment, 'findById', key => query(visits.find(row => row._id === String(key)) || null));
  stub(Comment, 'create', async data => {
    if (failSave) throw new Error('Injected comment save failure');
    const validation = new Comment(data).validateSync();
    assert.equal(validation, undefined);
    const row = { _id: id(100 + rows.length), ...data, createdAt: new Date(), updatedAt: new Date() };
    rows.push(row);
    return row;
  });
  stub(Comment, 'find', filter => query(rows.filter(row => row.appointment === filter.appointment)));
  stub(Notification, 'create', async data => {
    if (failNotification) throw new Error('Injected notification failure');
    notifications.push(data); return data;
  });
  stub(AuditLog, 'create', async data => { audits.push(data); return data; });
  registerAllHandlers();
  registerAuditHandlers();
  emitter.on(EVENTS.COMMENT_ADDED, data => events.push(data));
  server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  const base = `http://127.0.0.1:${server.address().port}/api/appointments`;
  async function call(user, status = 200, method = 'GET', body, appointmentId = visit._id, suffix = '/comments') {
    const token = user && jwt.sign({ id: user._id }, process.env.JWT_SECRET);
    const response = await fetch(`${base}/${appointmentId}${suffix}`, {
      method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
      ...(body !== undefined && method !== 'GET' ? { body: JSON.stringify(body) } : {}),
    });
    assert.equal(response.status, status, `${user?.role || 'public'} ${method} ${appointmentId}${suffix}: expected ${status}`);
    if ([200, 201].includes(status)) assert.equal(response.headers.get('cache-control'), 'no-store');
    await new Promise(resolve => setImmediate(resolve));
    checks++;
    return response.json();
  }
  for (const method of ['GET', 'POST']) {
    await call(null, 401, method, { message: 'Denied' });
    for (const user of [otherPatient, otherDoctor]) await call(user, 403, method, { message: 'Denied' });
    await call(inactive, 401, method, { message: 'Denied' });
    await call(patient, 400, method, { message: 'Denied' }, 'invalid');
    await call(patient, 404, method, { message: 'Denied' }, id(999));
  }
  for (const message of [undefined, null, 0, {}, [], '', ' \n\t ', 'a'.repeat(2001)]) {
    await call(patient, 400, 'POST', { message });
  }
  assert.equal(rows.length, 0);
  assert.equal(events.length, 0);
  const before = structuredClone(visit);
  const first = (await call(staff, 201, 'POST', { message: '  Please clarify your request.\nThank you.  ',
    author: otherPatient._id, authorRole: 'Admin', authorName: 'Forged', appointment: walkIn._id, createdAt: '1900-01-01' })).data;
  assert.equal(first.message, 'Please clarify your request.\nThank you.');
  assert.equal(first.author, staff._id);
  assert.equal(first.authorRole, 'Staff');
  assert.equal(first.authorName, 'User5 Test');
  assert.equal(first.appointment, visit._id);
  assert.deepEqual(visit, before, 'Comments must not change status, notes, files, or history');
  assert.deepEqual(notifications.map(row => row.user).sort(), [patient, doctor, admin].map(user => user._id).sort());
  assert.equal(audits[0].action, 'COMMENT_ADDED');
  assert.equal(audits[0].performedBy, staff._id);
  assert.equal(audits[0].targetId, visit._id);
  assert.equal(audits[0].changes.commentId, first._id);
  assert(!JSON.stringify(audits).includes(first.message), 'Audit only needs comment identity, not its text');
  notifications.length = 0;
  const reply = (await call(patient, 201, 'POST', { message: '<script>PRIVATE_REPLY</script>' })).data;
  assert.equal(reply.message, '<script>PRIVATE_REPLY</script>', 'Plain text is preserved for safe React rendering');
  assert.deepEqual(notifications.map(row => row.user).sort(), [doctor, staff, admin].map(user => user._id).sort());
  assert(notifications.every(row => !row.message.includes('PRIVATE') && !row.message.includes('clarify')));
  for (const user of [patient, doctor, staff, admin]) {
    assert.deepEqual((await call(user)).data.map(row => row._id), [first._id, reply._id]);
  }
  const clinician = (await call(doctor, 201, 'POST', { message: 'Doctor remark' })).data;
  doctor.role = 'Staff'; doctor.firstName = 'Changed';
  assert.equal((await call(patient)).data.find(row => row._id === clinician._id).authorRole, 'Doctor');
  assert.equal((await call(patient)).data.find(row => row._id === clinician._id).authorName, 'User3 Test');
  doctor.role = 'Doctor'; doctor.firstName = 'User3';
  for (const status of ['Confirmed', 'Checked In', 'In Progress', 'Completed', 'Cancelled', 'Declined', 'No-show']) {
    visit.status = status;
    await call(patient, 201, 'POST', { message: `${status} discussion` });
    assert.equal(visit.status, status);
  }
  await call(admin, 201, 'POST', { message: 'x'.repeat(2000) });
  await Promise.all([call(patient, 201, 'POST', { message: 'Concurrent reply 1' }), call(staff, 201, 'POST', { message: 'Concurrent reply 2' })]);
  assert.equal(rows.filter(row => row.message.startsWith('Concurrent')).length, 2);
  await call(staff, 201, 'POST', { message: 'Walk-in review' }, walkIn._id);
  await call(doctor, 200, 'GET', undefined, walkIn._id);
  await call(patient, 403, 'GET', undefined, walkIn._id);
  assert.equal((await call(patient)).data.some(row => row.message === 'Walk-in review'), false);
  await call(patient, 201, 'POST', { message: 'Flexible request question' }, flexible._id);
  await call(doctor, 403, 'GET', undefined, flexible._id);
  await call(patient, 404, 'PATCH', { message: 'Changed' }, visit._id, `/comments/${first._id}`);
  await call(staff, 404, 'DELETE', undefined, visit._id, `/comments/${first._id}`);
  const count = rows.length, eventCount = events.length;
  failSave = true;
  await call(patient, 500, 'POST', { message: 'Not saved' });
  failSave = false;
  assert.equal(rows.length, count);
  assert.equal(events.length, eventCount);
  const originalError = console.error, errors = [];
  console.error = (...parts) => errors.push(parts.join(' '));
  try {
    failNotification = true;
    await call(patient, 201, 'POST', { message: 'Saved despite notification outage' });
    assert.equal(rows.length, count + 1);
    assert(errors.some(message => message.includes('notification failure')));
  } finally { failNotification = false; console.error = originalError; }
  visit.doctor = otherDoctor._id;
  await call(doctor, 403, 'GET');
  await call(doctor, 403, 'POST', { message: 'Former doctor denied' });
  await call(otherDoctor, 200, 'GET');
  console.log(`Passed ${checks} comment HTTP checks, author attribution, private notifications, audit events, and failure checks.`);
}
main().catch(err => { console.error(err); process.exitCode = 1; }).finally(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  for (const [model, method, original] of originals) model[method] = original;
  emitter.removeAllListeners();
});
