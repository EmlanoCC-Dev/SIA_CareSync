// Run: node backend/tests/api-access.check.js
// Real app/routes/auth/controllers/services; isolated model doubles and one temporary file.
// Never connects to MongoDB or modifies real patient records.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
process.env.NODE_ENV = 'production';
process.env.JWT_SECRET = 'isolated-api-access-check-secret-for-tests';
const jwt = require('jsonwebtoken');
const User = require('../src/models/User');
const Appointment = require('../src/models/Appointment');
const Slot = require('../src/models/Slot');
const WalkIn = require('../src/models/WalkIn');
const { UPLOAD_ROOT } = require('../src/middleware/upload');
const { getOperatingStatus, setCustomTime } = require('../src/config/systemTime');
const app = require('../server');

const id = n => n.toString(16).padStart(24, '0');
const actor = (n, role) => ({ _id: id(n), id: id(n), role, workingHours: [], consultationDuration: 15 });
const patient = actor(1, 'Patient'), otherPatient = actor(2, 'Patient');
const doctor = actor(3, 'Doctor'), otherDoctor = actor(4, 'Doctor');
const staff = actor(5, 'Staff'), admin = actor(6, 'Admin');
const users = new Map([patient, otherPatient, doctor, otherDoctor, staff, admin].map(user => [user.id, user]));
const appointments = new Map();
const slotId = id(20), otherSlotId = id(21), appointmentId = id(30), otherAppointmentId = id(31), docId = id(40);
const fixtureName = `api-access-check-${randomUUID()}.txt`;
const fixturePath = path.join(UPLOAD_ROOT, fixtureName);
const originals = [];
const stub = (model, method, fn) => { originals.push([model, method, model[method]]); model[method] = fn; };
const query = value => ({ populate() { return this; }, sort() { return this; }, select() { return this; },
  limit() { return this; }, then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } });
const record = (key, owner, clinician) => ({ _id: key, patient: owner.id, doctor: clinician.id, slot: null,
  status: 'Confirmed', date: new Date('2099-01-01'), timeSlot: '10:00-10:30', statusHistory: [],
  consultationNotes: 'Original notes', documents: [{ _id: docId, filename: 'Test record.txt',
    url: `/uploads/${fixtureName}`, type: 'general' }], save: async () => {} });
let server, checks = 0, fixtureCreated = false;

async function main() {
  appointments.set(appointmentId, record(appointmentId, patient, doctor));
  appointments.set(otherAppointmentId, record(otherAppointmentId, otherPatient, otherDoctor));
  stub(User, 'findById', userId => query(users.get(String(userId)) || null));
  stub(User, 'findOne', () => query(null));
  let registeredRole;
  stub(User, 'create', async values => {
    registeredRole = values.role;
    return { _id: id(50), toObject: () => ({ _id: id(50), ...values }) };
  });
  stub(Appointment, 'findById', key => query(appointments.get(String(key)) || null));
  stub(Appointment, 'find', filters => query(filters.status ? [] : [...appointments.values()].filter(item =>
    (!filters.patient || item.patient === filters.patient) && (!filters.doctor || item.doctor === filters.doctor))));
  const slots = [
    { _id: slotId, doctor: { _id: doctor.id, firstName: 'Doctor', email: 'private@example.test', contactNumber: 'PRIVATE' },
      date: new Date('2099-01-01'), startTime: '10:00', endTime: '10:30', status: 'Reserved-Confirmed', appointment: appointments.get(appointmentId) },
    { _id: otherSlotId, doctor: { _id: otherDoctor.id }, date: new Date('2099-01-01'), startTime: '10:00', endTime: '10:30', status: 'Available', appointment: null },
  ];
  stub(Slot, 'findById', key => query(slots.find(slot => slot._id === key) || null));
  stub(Slot, 'find', filters => query(slots.filter(slot => !filters.doctor || String(slot.doctor._id) === String(filters.doctor))));
  stub(Slot, 'countDocuments', async () => 1);
  stub(User, 'find', () => query([doctor, otherDoctor]));
  const walkIns = [
    { _id: id(60), name: 'PRIVATE NAME', contactNumber: 'PRIVATE PHONE', queueNumber: 1, status: 'Slot Assigned', assignedSlot: { doctor: doctor.id }, appointment: { doctor: doctor.id } },
    { _id: id(61), name: 'OTHER PRIVATE NAME', contactNumber: 'OTHER PHONE', queueNumber: 2, status: 'Slot Assigned', assignedSlot: { doctor: otherDoctor.id }, appointment: { doctor: otherDoctor.id } },
    { _id: id(62), name: 'UNASSIGNED', contactNumber: 'PHONE', queueNumber: 3, status: 'Waiting', assignedSlot: null, appointment: null },
  ];
  stub(WalkIn, 'find', filters => query(filters.status === 'In Progress' ? [walkIns[0]] : walkIns));
  await fs.mkdir(UPLOAD_ROOT, { recursive: true });
  await fs.writeFile(fixturePath, 'dummy medical file', { flag: 'wx' });
  fixtureCreated = true;
  setCustomTime('2098-01-01T08:00:00');
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = (route, user, method = 'GET', body, token) => fetch(`${base}${route}`, {
    method, headers: { ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...((token || user) ? { Authorization: `Bearer ${token || jwt.sign({ id: user.id }, process.env.JWT_SECRET)}` } : {}) },
    ...(body !== undefined ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}),
  });
  const expect = async (route, user, status, method, body, token) => {
    const response = await call(route, user, method, body, token);
    assert.equal(response.status, status, `${method || 'GET'} ${route}: ${user?.role || 'public'} expected ${status}, got ${response.status}`);
    checks++;
    return response;
  };

  // Enumerate the real registered routes: every private route must reject missing login.
  const routers = [
    ['users', require('../src/routes/user.routes')], ['appointments', require('../src/routes/appointment.routes')],
    ['slots', require('../src/routes/slot.routes')], ['walkins', require('../src/routes/walkIn.routes')],
    ['reports', require('../src/routes/report.routes')], ['audit-logs', require('../src/routes/auditLog.routes')],
    ['system', require('../src/routes/system.routes')],
    ['notifications', require('../src/routes/notification.routes')],
  ];
  const publicRoutes = new Set(['POST /api/users/login', 'POST /api/users/register', 'GET /api/system/time', 'GET /api/walkins/now-serving']);
  let privateRoutes = 0;
  for (const [prefix, router] of routers) for (const layer of router.stack) {
    if (!layer.route) continue;
    const route = `/api/${prefix}${layer.route.path === '/' ? '' : layer.route.path}`
      .replace(':id', appointmentId).replace(':docId', docId);
    for (const method of Object.keys(layer.route.methods)) {
      if (publicRoutes.has(`${method.toUpperCase()} ${route}`)) continue;
      await expect(route, null, 401, method.toUpperCase());
      privateRoutes++;
    }
  }
  await expect('/api/not-yet-implemented', null, 401);
  await expect('/api/not-yet-implemented', patient, 404);
  await expect('/api/users/login', null, 401, 'DELETE');
  await expect('/api/users/me', null, 401, 'GET', undefined, 'invalid-token');
  for (const token of [
    jwt.sign({ id: patient.id }, process.env.JWT_SECRET, { expiresIn: -1 }),
    jwt.sign({ id: patient.id }, 'different-secret'),
    jwt.sign({ id: patient.id }, process.env.JWT_SECRET, { algorithm: 'HS384' }),
    jwt.sign({ id: 'invalid-id' }, process.env.JWT_SECRET),
    jwt.sign({ id: id(999) }, process.env.JWT_SECRET),
  ]) await expect('/api/users/me', null, 401, 'GET', undefined, token);
  await expect('/api/users/me', patient, 200);
  await expect('/api/users', null, 403, 'GET', undefined,
    jwt.sign({ id: patient.id, role: 'Admin' }, process.env.JWT_SECRET));

  const own = `/api/appointments/${appointmentId}`, other = `/api/appointments/${otherAppointmentId}`;
  assert.equal((await (await expect('/api/appointments', patient, 200)).json()).data.length, 1);
  await expect(own, patient, 200);
  await expect(own, doctor, 200);
  await expect(other, patient, 403);
  await expect(other, doctor, 403);
  await expect(own, otherDoctor, 403);
  await expect(own, staff, 200);
  await expect(other, admin, 200);
  await expect('/api/appointments/not-an-id', patient, 400);
  await expect(`/api/appointments/${id(999)}`, patient, 404);
  await expect(`${other}/cancel`, patient, 403, 'PATCH', {});
  for (const [method, suffix, body] of [
    ['PATCH', '/documents', { consultationNotes: 'Unauthorized' }],
    ['DELETE', `/documents/${docId}`], ['PATCH', '/complete'], ['PATCH', '/decline', { reason: 'Unauthorized' }],
    ['PATCH', '/check-in'], ['PATCH', '/cancel'],
  ]) await expect(`${other}${suffix}`, doctor, 403, method, body);
  assert.equal(appointments.get(otherAppointmentId).consultationNotes, 'Original notes');
  assert.equal(appointments.get(otherAppointmentId).status, 'Confirmed');
  await expect(`${own}/documents`, patient, 403, 'PATCH', { consultationNotes: 'Unauthorized' });
  await expect(`${own}/approve`, doctor, 403, 'PATCH');
  await expect(`${own}/documents`, doctor, 200, 'PATCH', { consultationNotes: 'Allowed notes' });
  assert.equal(appointments.get(appointmentId).consultationNotes, 'Allowed notes');
  await expect(`${own}/documents`, doctor, 400, 'PATCH', { documents: [{ ...appointments.get(appointmentId).documents[0], url: '/uploads/someone-elses-file.txt' }] });
  await expect(`${own}/documents`, doctor, 400, 'PATCH', { consultationNotes: { $set: 'bad' } });
  await expect(`${own}/check-in`, doctor, 200, 'PATCH');
  await expect(`${own}/cancel`, patient, 200, 'PATCH', { reason: 'Own appointment' });

  const beforeUploads = await fs.readdir(UPLOAD_ROOT);
  const upload = new FormData();
  upload.append('file', new Blob(['unauthorized']), 'unauthorized.txt');
  await expect(`${other}/upload`, doctor, 403, 'POST', upload);
  assert.deepEqual(await fs.readdir(UPLOAD_ROOT), beforeUploads, 'Unauthorized uploads must not create files');
  const download = `${own}/documents/${docId}/download`;
  const response = await expect(download, patient, 200);
  assert.equal(await response.text(), 'dummy medical file');
  assert.match(response.headers.get('content-disposition'), /^attachment;/);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  await expect(`${other}/documents/${docId}/download`, patient, 403);
  await expect(download, doctor, 200);
  await expect(download, staff, 200);
  await expect(download, admin, 200);
  await expect(`${own}/documents/${id(999)}/download`, patient, 404);
  await expect(`/uploads/${fixtureName}`, null, 404);
  await expect(`/uploads/${fixtureName}`, patient, 404);
  const document = appointments.get(appointmentId).documents[0], savedUrl = document.url;
  document.url = '/uploads/../server.js';
  await expect(download, patient, 403);
  document.url = '/uploads/missing-file.txt';
  await expect(download, patient, 404);
  document.url = savedUrl;

  await expect('/api/system/time', null, 200);
  await expect('/api/system/time', null, 200, 'HEAD');
  const clockBefore = getOperatingStatus().currentTime;
  for (const user of [patient, doctor, staff]) await expect('/api/system/time', user, 403, 'POST', { reset: true });
  for (const body of [{ time: 'invalid' }, { time: '2026-02-30T10:00:00' }, { time: '2026-10-01T25:00:00' },
    { reset: 'true' }, { reset: true, time: '2026-10-01T10:00:00' }, {}]) {
    await expect('/api/system/time', admin, 400, 'POST', body);
  }
  assert.equal(getOperatingStatus().currentTime, clockBefore, 'Denied/invalid requests must preserve the clock');
  await expect('/api/system/time', admin, 200, 'POST', { time: '2098-02-01T08:00:00' });
  await expect('/api/system/time', admin, 200, 'POST', { reset: true });

  const publicQueue = (await (await expect('/api/walkins/now-serving', null, 200)).json()).data;
  for (const entry of [publicQueue.nowServing, ...publicQueue.upcoming]) assert.deepEqual(Object.keys(entry).sort(), ['queueNumber', 'status']);
  const doctorQueue = (await (await expect('/api/walkins', doctor, 200)).json()).data;
  assert.equal(doctorQueue.length, 1);
  assert.equal(doctorQueue[0].assignedSlot.doctor, doctor.id);
  assert.equal((await (await expect('/api/walkins', staff, 200)).json()).data.length, 3);
  await expect('/api/walkins', patient, 403);
  await expect(`/api/walkins/${id(60)}/assign`, doctor, 403, 'POST', { slotId });
  const patientSlot = (await (await expect(`/api/slots/${slotId}`, patient, 200)).json()).data;
  assert.equal(patientSlot.appointment, undefined);
  assert.equal(patientSlot.doctor.email, undefined);
  assert.equal(patientSlot.doctor.contactNumber, undefined);
  const patientSlots = (await (await expect('/api/slots?date=2099-01-01', patient, 200)).json()).data;
  assert(patientSlots.every(slot => !slot.appointment && !slot.doctor.email));
  await expect(`/api/slots/${otherSlotId}`, doctor, 403);
  await expect(`/api/slots?doctorId=${otherDoctor.id}`, doctor, 403);
  const ownSlots = (await (await expect('/api/slots?date=2099-01-01', doctor, 200)).json()).data;
  assert(ownSlots.every(slot => slot.doctor._id === doctor.id));
  await expect('/api/slots/generate', doctor, 403, 'POST', { doctorId: otherDoctor.id });
  await expect(`/api/users/${otherDoctor.id}/schedule`, doctor, 403);
  await expect('/api/users', patient, 403);
  await expect('/api/users', staff, 403, 'POST', { role: 'Admin' });
  await expect('/api/audit-logs', staff, 403);
  await expect('/api/reports?from=2026-10-01&to=2026-10-31', patient, 403);
  await expect('/api/appointments?status[$ne]=Cancelled', patient, 400);
  await expect('/api/slots?date=2099-01-01&date=2099-01-02', patient, 400);
  await expect('/api/users/login', null, 400, 'POST', { email: { $ne: null }, password: 'anything' });
  await expect('/api/users/register', null, 201, 'POST', { firstName: 'Dummy', lastName: 'Patient',
    email: 'dummy@example.test', password: 'dummy-password', role: 'Admin' });
  assert.equal(registeredRole, 'Patient', 'Public registration must ignore caller-supplied privileged roles');
  console.log(`Passed ${checks} HTTP checks, including authentication on all ${privateRoutes} registered private routes, ownership/assignment, uploads/downloads, clock permissions, and response privacy.`);
}

main().catch(err => { console.error(err); process.exitCode = 1; }).finally(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  for (const [model, method, original] of originals.reverse()) model[method] = original;
  setCustomTime(null);
  if (fixtureCreated) await fs.unlink(fixturePath);
});
