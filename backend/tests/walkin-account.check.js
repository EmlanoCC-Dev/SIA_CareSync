// Real HTTP/auth/services with isolated models and an OTP boundary double; no live data or email.
const assert = require('node:assert/strict');
process.env.NODE_ENV = 'production';
process.env.JWT_SECRET = 'isolated-walkin-account-check-secret';
const jwt = require('jsonwebtoken');
const User = require('../src/models/User');
const WalkIn = require('../src/models/WalkIn');
const Appointment = require('../src/models/Appointment');
const otp = require('../src/services/otp.service');
const { linkVerifiedPatient } = require('../src/services/walkInAccount.service');
const { setCustomTime } = require('../src/config/systemTime');
const app = require('../server');
const id = number => number.toString(16).padStart(24, '0');
const staff = { _id: id(1), id: id(1), role: 'Staff', status: 'Active' };
const owner = { _id: id(2), id: id(2), role: 'Patient', status: 'Active', email: 'existing@example.test', emailVerifiedAt: new Date() };
const unverified = { _id: id(3), id: id(3), role: 'Patient', status: 'Active', email: 'unverified@example.test', emailVerifiedAt: null };
const users = [staff, owner, unverified], entries = [], visits = [], originals = [];
let server, checks = 0, failLink = false;
const stub = (object, key, fn) => { originals.push([object, key, object[key]]); object[key] = fn; };
const matches = (row, filter) => row && Object.entries(filter).every(([key, value]) => {
  if (value?.$in) return value.$in.some(wanted => String(wanted) === String(row[key]));
  if (value && Object.hasOwn(value, '$ne')) return value.$ne === null ? row[key] != null : row[key] !== value.$ne;
  if (value?.$gte) return row[key] >= value.$gte && row[key] < (value.$lt || value.$lte);
  return value === null ? row[key] == null : String(row[key]) === String(value);
});
const query = value => ({ select() { return this; }, populate() { return this; }, sort() { return this; },
  then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } });
const addVisit = walkIn => {
  const visit = { _id: id(100 + visits.length), patient: null, walkIn: walkIn._id, status: 'Completed',
    date: new Date('2026-10-01'), consultationNotes: 'Retained assessment', notesRevision: 1,
    noteVersions: [], documents: [], archivedDocuments: [], statusHistory: [] };
  visits.push(visit); return visit;
};
async function main() {
  setCustomTime('2026-10-06T10:00:00');
  stub(User, 'findById', key => query(users.find(user => user._id === String(key)) || null));
  stub(User, 'findOne', filter => query(users.find(user => matches(user, filter)) || null));
  stub(User, 'create', async data => {
    const user = { ...data, _id: id(10 + users.length), role: data.role || 'Patient', status: 'Active', tokenVersion: 0 };
    user.id = user._id;
    user.toObject = () => { const { toObject, ...fields } = user; return fields; };
    users.push(user); return user;
  });
  stub(otp, 'consumeOtp', async (purpose, email, code) => {
    assert.equal(purpose, 'register');
    if (code !== '123456') throw Object.assign(new Error('Invalid verification code'), { statusCode: 400 });
  });
  stub(WalkIn, 'init', async () => {});
  stub(WalkIn, 'create', async data => {
    assert.equal(new WalkIn(data).validateSync(), undefined);
    const entry = { _id: id(30 + entries.length), ...data };
    entries.push(entry); return entry;
  });
  stub(WalkIn, 'findOne', filter => ({ sort: () => query(entries.filter(entry => matches(entry, filter)).at(-1) || null) }));
  for (const [model, rows] of [[WalkIn, entries], [Appointment, visits]]) {
    stub(model, 'find', filter => query(rows.filter(row => matches(row, filter))));
    stub(model, 'findById', key => query(rows.find(row => row._id === String(key)) || null));
    stub(model, 'updateMany', async (filter, update) => {
      if (model === Appointment && failLink) { failLink = false; throw new Error('Injected linking failure'); }
      let modifiedCount = 0;
      for (const row of rows.filter(row => matches(row, filter))) { Object.assign(row, update.$set); modifiedCount++; }
      return { modifiedCount };
    });
  }
  server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const call = async (path, actor, method = 'GET', body, expected = 200) => {
    const response = await fetch(base + path, { method,
      headers: { 'Content-Type': 'application/json', ...(actor ? { Authorization: `Bearer ${jwt.sign({ id: actor._id }, process.env.JWT_SECRET)}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    const result = await response.json();
    assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(result)}`);
    checks++; return result.data;
  };
  const add = async email => {
    const result = await call('/walkins', staff, 'POST', { name: 'Walk-In Patient', email }, 201);
    return entries.find(entry => entry._id === result._id);
  };
  await call('/walkins', staff, 'POST', { name: 'No email', contactNumber: '09170000000' }, 400);
  for (const email of ['bad-address', { $ne: null }, 'x'.repeat(255), 'x@example.test,other@example.test']) {
    await call('/walkins', staff, 'POST', { name: 'Invalid', email }, 400);
  }
  await call('/walkins', staff, 'POST', { name: '   ', email: 'valid@example.test' }, 400);
  const first = await add('  New.Patient@Example.Test  '), second = await add('new.patient@example.test');
  assert.equal(first.email, 'new.patient@example.test');
  assert.equal(first.patient, null, 'Queue entry must not create or require an account');
  assert.equal(users.length, 3);
  const firstVisit = addVisit(first), secondVisit = addVisit(second);
  const different = await add('different@example.test'), differentVisit = addVisit(different);
  const legacy = { _id: id(90), name: 'Legacy', contactNumber: '09170000000', status: 'Completed', patient: null };
  entries.push(legacy); const legacyVisit = addVisit(legacy);
  assert.equal(WalkIn.hydrate({ ...legacy, queueNumber: 90 }).validateSync(), undefined, 'Legacy phone-only documents remain valid');
  const account = { firstName: 'New', lastName: 'Patient', email: 'NEW.PATIENT@example.test', password: 'test-password' };
  await call('/users/register', null, 'POST', { ...account, otp: '000000' }, 400);
  assert.equal(firstVisit.patient, null, 'Failed email verification must not grant record access');
  const registered = await call('/users/register', null, 'POST', { ...account, otp: '123456' }, 201);
  const patient = users.find(user => user._id === registered.user._id);
  assert(patient.emailVerifiedAt);
  for (const visit of [firstVisit, secondVisit]) {
    assert.equal(visit.patient, patient._id);
    assert.equal(visit.consultationNotes, 'Retained assessment');
  }
  assert.equal(first.patient, patient._id);
  assert.equal(second.patient, patient._id);
  assert.equal(differentVisit.patient, null);
  assert.equal(legacyVisit.patient, null);
  assert.equal((await call('/appointments', patient)).length, 2);
  await call(`/appointments/${firstVisit._id}`, patient);
  await call(`/appointments/${firstVisit._id}/versions`, patient);
  await call(`/appointments/${firstVisit._id}`, owner, 'GET', undefined, 403);
  await call(`/appointments/${firstVisit._id}/versions`, owner, 'GET', undefined, 403);
  await call('/walkins', patient, 'GET', undefined, 403);
  await call(`/appointments/${differentVisit._id}`, patient, 'GET', undefined, 403);
  assert.equal((await add('EXISTING@example.test')).patient, owner._id, 'Existing verified patient links immediately');
  const unverifiedEntry = await add('unverified@example.test'), unverifiedVisit = addVisit(unverifiedEntry);
  await linkVerifiedPatient(unverified);
  assert.equal(unverifiedVisit.patient, null);
  await linkVerifiedPatient({ ...unverified, role: 'Doctor', emailVerifiedAt: new Date() });
  await linkVerifiedPatient({ ...unverified, status: 'Deactivated', emailVerifiedAt: new Date() });
  assert.equal(unverifiedEntry.patient, null);
  const conflict = await add('new.patient@example.test');
  conflict.patient = owner._id;
  const conflictingVisit = addVisit(conflict); conflictingVisit.patient = owner._id;
  await linkVerifiedPatient(patient);
  assert.equal(conflict.patient, owner._id, 'Do not replace existing queue ownership');
  assert.equal(conflictingVisit.patient, owner._id, 'Do not replace existing visit ownership');
  const ownedEntry = await add('new.patient@example.test'), ownedVisit = addVisit(ownedEntry);
  ownedVisit.patient = owner._id;
  await linkVerifiedPatient(patient);
  assert.equal(ownedVisit.patient, owner._id, 'Even a matching queue entry cannot overwrite an appointment owner');
  // Signup can run between a queue claim and appointment creation. Repeated portal reads repair it.
  const raced = await add('new.patient@example.test');
  await linkVerifiedPatient(patient);
  const lateVisit = addVisit(raced);
  await call('/appointments', patient);
  assert.equal(lateVisit.patient, patient._id);
  const retryEntry = await add('retry@example.test'), retryVisit = addVisit(retryEntry);
  failLink = true;
  const retryAccount = await call('/users/register', null, 'POST', { ...account, email: 'retry@example.test', otp: '123456' }, 201);
  const retryPatient = users.find(user => user._id === retryAccount.user._id);
  assert.equal(retryEntry.patient, retryPatient._id);
  assert.equal(retryVisit.patient, null);
  await call('/appointments', retryPatient);
  assert.equal(retryVisit.patient, retryPatient._id, 'Partial linking must be retryable');
  await linkVerifiedPatient(retryPatient);
  assert.equal((await call('/appointments', retryPatient)).length, 1, 'Retries must not duplicate visits');
  const publicBoard = JSON.stringify(await call('/walkins/now-serving', null));
  assert(!publicBoard.includes('@') && !publicBoard.includes('Walk-In Patient') && !publicBoard.includes('09170000000'));
  console.log(`Passed ${checks} HTTP checks plus optional-account, verified ownership, history, privacy, retry and race checks.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  for (const [object, key, value] of originals.reverse()) object[key] = value;
  setCustomTime(null);
});
