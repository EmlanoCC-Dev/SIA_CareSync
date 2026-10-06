// Run: node backend/tests/demo-reset.check.js
// Real routes/auth, isolated models and filesystem doubles; no live data is deleted.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
process.env.JWT_SECRET = 'isolated-demo-reset-check-secret';
const jwt = require('jsonwebtoken');
const User = require('../src/models/User');
const emitter = require('../src/events/emitter');
const { UPLOAD_ROOT } = require('../src/middleware/upload');
const { setCustomTime, getOperatingStatus } = require('../src/config/systemTime');
const app = require('../server');
const names = ['Appointment', 'AppointmentComment', 'WalkIn', 'Slot', 'SlotPlan',
  'Notification', 'AuditLog', 'EmailOtp', 'AssignmentRecovery'];
const rows = new Map(names.map(name => [name, [{ _id: name }]]));
const id = n => n.toString(16).padStart(24, '0');
const accounts = ['Admin', 'Doctor', 'Staff', 'Patient', 'Admin', 'Doctor', 'Staff'].map((role, i) => ({
  _id: id(i + 1), role, status: i === 5 ? 'Deactivated' : 'Active', password: `hash-${i}`,
  workingHours: [{ day: 1, start: '09:00', end: '17:00' }], consultationDuration: 15,
}));
const preserved = accounts.filter(row => ['Doctor', 'Staff'].includes(row.role) || row._id === id(1));
const snapshot = structuredClone(preserved);
const originals = [];
const stub = (object, key, value) => { originals.push([object, key, object[key]]); object[key] = value; };
let users = [...accounts], fileDeletes = 0, failModel, failFiles, holdDelete, onDelete, holdLookup, onLookup;
let server;

async function main() {
  stub(User, 'findById', async key => {
    if (holdLookup && String(key) === id(2)) { onLookup(); await holdLookup; }
    return users.find(row => row._id === String(key));
  });
  stub(User, 'deleteMany', async filter => {
    assert.deepEqual(filter.role.$nin, ['Doctor', 'Staff']);
    assert.equal(String(filter._id.$ne), id(1));
    const before = users.length;
    users = users.filter(row => filter.role.$nin.includes(row.role) || row._id === String(filter._id.$ne));
    return { deletedCount: before - users.length };
  });
  for (const name of names) {
    stub(require(`../src/models/${name}`), 'deleteMany', async filter => {
      assert.deepEqual(filter, {});
      if (holdDelete) { onDelete(); await holdDelete; }
      if (failModel === name) throw new Error('Simulated storage failure');
      const deletedCount = rows.get(name).length;
      rows.set(name, []);
      return { deletedCount };
    });
  }
  stub(fs, 'rm', async (target, options) => {
    assert.equal(path.resolve(target), path.resolve(__dirname, '../uploads'));
    assert.equal(target, UPLOAD_ROOT);
    assert.deepEqual(options, { recursive: true, force: true });
    if (failFiles) throw new Error('Simulated file permission failure');
    fileDeletes++;
  });
  stub(fs, 'mkdir', async (target, options) => {
    assert.equal(target, UPLOAD_ROOT);
    assert.deepEqual(options, { recursive: true });
  });
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function call(role, confirmation, status) {
    const actor = accounts.find(row => row.role === role);
    const response = await fetch(`${base}/system/demo-reset`, {
      method: 'POST', headers: { 'Content-Type': 'application/json',
        ...(actor ? { Authorization: `Bearer ${jwt.sign({ id: actor._id }, process.env.JWT_SECRET)}` } : {}) },
      body: JSON.stringify({ confirmation }),
    });
    assert.equal(response.status, status, `${role || 'anonymous'} reset`);
    return response.json();
  }
  for (const [role, status] of [[null, 401], ['Doctor', 403], ['Staff', 403], ['Patient', 403]]) {
    await call(role, 'CLEAR DEMO DATA', status);
  }
  for (const confirmation of [undefined, '', true, ['CLEAR DEMO DATA'], 'clear demo data']) {
    await call('Admin', confirmation, 400);
  }
  assert.equal(fileDeletes, 0);
  assert.equal(users.length, accounts.length);
  assert(names.every(name => rows.get(name).length === 1));

  let finishLookup;
  holdLookup = new Promise(resolve => { finishLookup = resolve; });
  const lookingUp = new Promise(resolve => { onLookup = resolve; });
  const busyRequest = fetch(`${base}/not-a-route`, { headers: {
    Authorization: `Bearer ${jwt.sign({ id: id(2) }, process.env.JWT_SECRET)}`,
  } });
  await lookingUp;
  await call('Admin', 'CLEAR DEMO DATA', 409);
  finishLookup();
  holdLookup = null;
  assert.equal((await busyRequest).status, 404);

  let finishEvent;
  emitter.onAsync('demo-reset-test', () => new Promise(resolve => { finishEvent = resolve; }));
  emitter.emit('demo-reset-test');
  await call('Admin', 'CLEAR DEMO DATA', 409);
  finishEvent();
  await Promise.all([...emitter.pending]);
  emitter.removeAllListeners('demo-reset-test');

  // An interrupted reset must report failure and unlock, so retry can finish.
  failModel = 'WalkIn';
  await call('Admin', 'CLEAR DEMO DATA', 500);
  assert.equal(fileDeletes, 0);
  assert.equal(users.length, accounts.length);
  failModel = null;

  let finishDelete;
  holdDelete = new Promise(resolve => { finishDelete = resolve; });
  const deleting = new Promise(resolve => { onDelete = resolve; });
  setCustomTime('2099-01-01T09:00:00');
  const reset = call('Admin', 'CLEAR DEMO DATA', 200);
  await deleting;
  assert.equal((await fetch(`${base}/system/time`)).status, 503, 'Other API requests must be blocked during deletion');
  await call('Admin', 'CLEAR DEMO DATA', 503);
  finishDelete();
  holdDelete = null;
  const result = await reset;
  assert.equal(result.success, true);
  assert.equal(result.data.deleted.User, 2);
  assert.deepEqual(users, snapshot, 'Preserved account fields must remain unchanged');
  assert(names.every(name => rows.get(name).length === 0));
  assert.equal(fileDeletes, 1);
  assert.equal(getOperatingStatus().isCustom, false);
  await call('Patient', 'CLEAR DEMO DATA', 401);
  failFiles = true;
  await call('Admin', 'CLEAR DEMO DATA', 500);
  assert.deepEqual(users, snapshot);
  failFiles = false;
  const repeated = await call('Admin', 'CLEAR DEMO DATA', 200);
  assert(Object.values(repeated.data.deleted).every(count => count === 0));
  console.log('Demo reset passed: role/confirmation guards, account preservation, all records/files, background activity, maintenance lock, failure retry, and repeated reset.');
}

main().catch(err => { console.error(err); process.exitCode = 1; }).finally(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  for (const [object, key, original] of originals.reverse()) object[key] = original;
  setCustomTime(null);
});
