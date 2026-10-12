// Isolated routes, tool process, database records, and Google responses. No live data is touched.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { PassThrough } = require('node:stream');
const { EventEmitter } = require('node:events');
const childProcess = require('node:child_process');
process.env.JWT_SECRET = 'isolated-database-backup-secret-at-least-32';
process.env.BACKUP_ENABLED = 'true';
process.env.UPLOAD_STORAGE = 'gridfs';
process.env.DRIVE_REFRESH_TOKEN = 'private-drive-refresh';
process.env.GMAIL_CLIENT_ID = 'fake-client';
process.env.GMAIL_CLIENT_SECRET = 'private-client-secret';
process.env.SMTP_USER = 'clinic@example.test';
process.env.BACKUP_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
process.env.BACKUP_SCHEDULER_TOKEN = 'private-scheduler-secret-with-at-least-32';
process.env.MONGODUMP_PATH = process.execPath;
process.env.MONGO_URI = 'mongodb://fake:private-db-password@localhost/backup_fixture';
const env = require('../src/config/env');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Backup = require('../src/models/DatabaseBackup');
const BackupSchedule = require('../src/models/BackupSchedule');
const User = require('../src/models/User');
const emitter = require('../src/events/emitter');
const { setCustomTime } = require('../src/config/systemTime');
const { decryptArchive, encryptionKey } = require('../src/utils/backupArchive');
const originals = [];
const stub = (object, key, value) => { originals.push([object, key, object[key]]); object[key] = value; };
const id = number => number.toString(16).padStart(24, '0');
const rows = [];
let savedTime;
const archiveBytes = require('node:zlib').gzipSync(Buffer.from('BSON fixture, indexes, medicalFiles.files, medicalFiles.chunks, retained history'));
let exportCount = 0, holdExport = false, finishExport, exportStarted, uploaded, badAccount = false, badScope = false, corruptUpload = false, badExport = false;
let uploadTarget = 'https://www.googleapis.com/upload/drive/v3/files?upload_id=fixture';
let latestDirectory, server, directory;
const originalFetch = global.fetch, NativeDate = Date;
let realNow = '2026-10-12T09:00:00Z'; // 5 PM Manila: scheduled backups must not start yet.

function query(values) {
  return { sort() { return this; }, limit(count) { values = values.slice(0, count); return this; }, select() { return this; },
    lean: async () => structuredClone(values) };
}
const matches = (row, filter) => Object.entries(filter).every(([key, value]) => String(row[key]) === String(value));
function update(row, changes) {
  Object.assign(row, changes.$set || {});
  for (const key of Object.keys(changes.$unset || {})) delete row[key];
}
async function waitFor(condition) {
  for (let attempt = 0; attempt < 300; attempt++) {
    if (await condition()) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error('Isolated backup did not settle');
}

async function main() {
  const indexes = Backup.schema.indexes();
  assert(indexes.some(([keys, options]) => keys.active === 1 && options.unique && options.partialFilterExpression.active === true));
  assert(indexes.some(([keys, options]) => keys.scheduleDate === 1 && options.unique));
  assert.throws(() => encryptionKey('wrong-key'));
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'caresync-backup-check-'));
  stub(mongoose.connection, 'name', 'backup_fixture');
  stub(User, 'findById', async key => ({ _id: String(key), role: String(key) === id(1) ? 'Admin' : 'Patient', status: 'Active' }));
  stub(Backup, 'find', () => query([...rows].reverse()));
  stub(Backup, 'findOne', filter => { const result = query([]); result.lean = async () => structuredClone(rows.find(row => matches(row, filter)) || null); return result; });
  stub(BackupSchedule, 'findById', key => { assert.equal(key, 'database-backup'); return { lean: async () => savedTime ? { time: savedTime } : null }; });
  stub(BackupSchedule, 'findByIdAndUpdate', async (key, changes, options) => {
    assert.equal(key, 'database-backup'); assert(options.upsert && options.runValidators);
    savedTime = changes.$set.time;
  });
  stub(Backup, 'create', async fields => {
    if (rows.some(row => row.active || (fields.scheduleDate && row.scheduleDate === fields.scheduleDate))) throw Object.assign(new Error('duplicate'), { code: 11000 });
    const row = { ...fields, _id: id(rows.length + 10), active: true, status: 'queued', createdAt: new Date() };
    rows.push(row);
    return structuredClone(row);
  });
  stub(Backup, 'updateOne', async (filter, changes) => { update(rows.find(row => matches(row, filter)), changes); });
  stub(Backup, 'updateMany', async (filter, changes) => { rows.filter(row => matches(row, filter)).forEach(row => update(row, changes)); });
  stub(childProcess, 'spawn', (executable, args, options) => {
    exportCount++;
    assert.equal(executable, process.execPath);
    assert.equal(options.shell, false);
    assert(args.includes('--archive') && args.includes('--gzip'));
    assert.equal(args[args.indexOf('--db') + 1], 'backup_fixture');
    assert(!args.some(value => value.includes('private-db-password') || value === '--collection'));
    const configPath = args[args.indexOf('--config') + 1];
    latestDirectory = path.dirname(configPath);
    const child = new EventEmitter();
    child.stdout = new PassThrough(); child.stderr = new PassThrough();
    let finished = false;
    child.kill = () => { if (!finished) { finished = true; child.stdout.destroy(); child.emit('close', 1); } };
    finishExport = async () => {
      assert.deepEqual(JSON.parse(await fs.readFile(configPath, 'utf8')), { uri: env.MONGO_URI });
      finished = true;
      child.stdout.end(archiveBytes);
      child.emit('close', badExport ? 1 : 0);
    };
    setImmediate(() => { exportStarted?.(); if (!holdExport) finishExport().catch(error => child.emit('error', error)); });
    return child;
  });
  global.fetch = async (url, options = {}) => {
    url = String(url);
    if (!url.startsWith('https://')) return originalFetch(url, options);
    assert(['oauth2.googleapis.com', 'www.googleapis.com'].includes(new URL(url).hostname), 'Credentials must never go to a foreign host');
    if (url === 'https://oauth2.googleapis.com/token') {
      assert.equal(options.body.get('refresh_token'), env.DRIVE_REFRESH_TOKEN);
      return Response.json({ access_token: 'fake-access', scope: badScope ? 'https://www.googleapis.com/auth/gmail.send' : 'https://www.googleapis.com/auth/drive.file' });
    }
    assert.equal(options.headers.Authorization, 'Bearer fake-access');
    if (url.includes('/about?')) return Response.json({ user: { emailAddress: badAccount ? 'wrong@example.test' : env.SMTP_USER } });
    if (url.includes('/drive/v3/files?') && !url.includes('/upload/') && options.method !== 'POST') return Response.json({ files: [] });
    if (url.includes('/drive/v3/files?') && !url.includes('/upload/')) {
      const folder = JSON.parse(options.body);
      assert.equal(folder.mimeType, 'application/vnd.google-apps.folder');
      assert(!folder.permissions, 'Backup folders must not be publicly shared');
      return Response.json({ id: 'private-folder' });
    }
    if (options.method === 'POST' && url.includes('/upload/')) {
      assert.deepEqual(JSON.parse(options.body).parents, ['private-folder']);
      return new Response('', { status: 200, headers: { location: uploadTarget } });
    }
    assert.equal(options.method, 'PUT');
    const chunks = [];
    for await (const chunk of options.body) chunks.push(chunk);
    uploaded = Buffer.concat(chunks);
    assert(!uploaded.includes(Buffer.from('medicalFiles.chunks')), 'The uploaded archive must be encrypted');
    return Response.json({ id: 'verified-drive-file', size: String(uploaded.length),
      md5Checksum: corruptUpload ? 'incorrect' : crypto.createHash('md5').update(uploaded).digest('hex') });
  };
  const app = require('../server');
  const service = require('../src/services/databaseBackup.service');
  const maintenance = require('../src/services/demoReset.service');
  const disconnected = new EventEmitter();
  disconnected.end = () => {};
  maintenance.guardDemoReset({ method: 'POST', path: '/appointments' }, disconnected, () => {});
  disconnected.emit('close');
  let captured = false;
  const drain = maintenance.withDatabaseSnapshot(async () => { captured = true; });
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(captured, false, 'A disconnected request may still be writing and must drain');
  disconnected.end();
  await drain;
  assert.equal(captured, true);
  let finishHandler;
  const pendingHandler = new Promise(resolve => { finishHandler = resolve; });
  emitter.pending.add(pendingHandler);
  captured = false;
  const eventDrain = maintenance.withDatabaseSnapshot(async () => { captured = true; });
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(captured, false, 'Tracked event writes must drain before export');
  emitter.pending.delete(pendingHandler); finishHandler(); await eventDrain;
  Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });
  global.Date = class extends NativeDate { constructor(...args) { super(...(args.length ? args : [realNow])); } static now() { return new NativeDate(realNow).getTime(); } };
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const call = async (route, method = 'GET', role = 'Admin', scheduler = false, body) => originalFetch(`${base}${route}`, {
    method, headers: { ...(scheduler ? { 'X-Backup-Token': env.BACKUP_SCHEDULER_TOKEN } : role ? { Authorization: `Bearer ${jwt.sign({ id: role === 'Admin' ? id(1) : id(2) }, env.JWT_SECRET)}` } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  assert.equal((await call('/system/backups', 'GET', null)).status, 401);
  assert.equal((await call('/system/backups', 'GET', 'Patient')).status, 403);
  assert.equal((await call('/system/backups', 'POST', 'Patient')).status, 403);
  assert.equal((await call('/backup-jobs', 'POST')).status, 401);
  assert.equal((await call('/backup-jobs')).status, 401);
  assert.equal((await call('/system/backups/schedule', 'PATCH', null, false, { time: '19:30' })).status, 401);
  assert.equal((await call('/system/backups/schedule', 'PATCH', 'Patient', false, { time: '19:30' })).status, 403);
  assert.equal((await (await call('/system/backups')).json()).data.schedule.time, '18:00', 'Existing installations keep the default schedule');
  for (const time of ['24:00', '18:60', '6:00', '18:00:00', '', 1800, ['18:00'], { hour: 18 }]) {
    assert.equal((await call('/system/backups/schedule', 'PATCH', 'Admin', false, { time })).status, 400);
  }
  assert.equal(savedTime, undefined, 'Invalid updates must preserve the schedule');
  const changed = await call('/system/backups/schedule', 'PATCH', 'Admin', false, { time: '19:30' });
  assert.equal(changed.status, 200);
  assert.equal((await changed.json()).data.timezone, 'Asia/Manila');
  assert.equal((await (await call('/system/backups')).json()).data.schedule.time, '19:30');
  realNow = '2026-10-12T11:29:00Z';
  assert.equal((await (await call('/backup-jobs', 'GET', null, true)).json()).data.due, false);
  realNow = '2026-10-12T11:30:00Z';
  assert.equal((await (await call('/backup-jobs', 'GET', null, true)).json()).data.due, true, 'A saved time applies without restarting the API');
  await call('/system/backups/schedule', 'PATCH', 'Admin', false, { time: '00:00' });
  realNow = '2026-10-11T16:00:00Z';
  assert.equal((await (await call('/backup-jobs', 'GET', null, true)).json()).data.due, true, 'Midnight uses the Manila calendar day');
  await call('/system/backups/schedule', 'PATCH', 'Admin', false, { time: '18:00' });
  realNow = '2026-10-12T09:00:00Z';
  setCustomTime('2099-01-01T23:00:00');
  assert.equal((await call('/backup-jobs', 'POST', null, true)).status, 409, 'Simulation must not trigger the real daily job early');
  holdExport = true;
  const started = new Promise(resolve => { exportStarted = resolve; });
  const manual = await call('/system/backups', 'POST');
  assert.equal(manual.status, 202);
  await started;
  assert.equal((await call('/system/time', 'GET', null)).status, 503, 'Clinic activity must pause while capturing');
  assert.equal((await call('/system/backups')).status, 200, 'Authorized progress reads remain available');
  assert.equal((await call('/system/backups', 'POST')).status, 503, 'A capture cannot overlap another request');
  assert.equal(exportCount, 1);
  await finishExport(); holdExport = false;
  await waitFor(() => ['completed', 'failed'].includes(rows[0].status));
  assert.equal(rows[0].status, 'completed', rows[0].message);
  await waitFor(async () => { try { await fs.access(latestDirectory); return false; } catch { return true; } });
  assert.equal((await call('/system/time', 'GET', null)).status, 200, 'Clinic access must resume');
  assert.equal(rows[0].driveFileId, 'verified-drive-file');
  assert.equal(rows[0].sha256, crypto.createHash('sha256').update(uploaded).digest('hex'));
  const encrypted = path.join(directory, 'verified.csbackup'), restored = path.join(directory, 'restored.gz');
  await fs.writeFile(encrypted, uploaded);
  await decryptArchive(encrypted, restored, env.BACKUP_ENCRYPTION_KEY);
  assert.deepEqual(await fs.readFile(restored), archiveBytes, 'Encryption round trip must retain the dump bytes');
  await assert.rejects(decryptArchive(encrypted, restored, env.BACKUP_ENCRYPTION_KEY), { code: 'EEXIST' });
  await assert.rejects(decryptArchive(encrypted, path.join(directory, 'wrong-key.gz'), crypto.randomBytes(32).toString('base64')));
  uploaded[23] ^= 1; await fs.writeFile(encrypted, uploaded);
  await assert.rejects(decryptArchive(encrypted, path.join(directory, 'modified.gz'), env.BACKUP_ENCRYPTION_KEY));
  assert.deepEqual((await fs.readdir(directory)).sort(), ['restored.gz', 'verified.csbackup']);

  async function failedBackup(condition, reset) {
    condition();
    const before = rows.length;
    assert.equal((await call('/system/backups', 'POST')).status, 202);
    await waitFor(() => rows[before]?.status === 'failed');
    assert.equal(rows[before].active, false);
    assert(!JSON.stringify(rows[before]).includes('private-db-password'));
    reset();
    await waitFor(async () => { try { await fs.access(latestDirectory); return false; } catch { return true; } });
    assert.equal((await call('/system/time', 'GET', null)).status, 200, 'Failures must release maintenance');
  }
  await failedBackup(() => { badAccount = true; }, () => { badAccount = false; });
  await failedBackup(() => { badScope = true; }, () => { badScope = false; });
  await failedBackup(() => { badExport = true; }, () => { badExport = false; });
  await failedBackup(() => { corruptUpload = true; }, () => { corruptUpload = false; });
  await failedBackup(() => { uploadTarget = 'https://foreign.example/upload'; }, () => { uploadTarget = 'https://www.googleapis.com/upload/drive/v3/files?upload_id=fixture'; });

  realNow = '2026-10-12T10:00:00Z';
  const daily = await call('/backup-jobs', 'POST', null, true);
  assert.equal(daily.status, 202);
  const dailyId = (await daily.json()).data._id;
  await waitFor(() => rows.at(-1).status === 'completed');
  const count = rows.length;
  assert.equal((await (await call('/backup-jobs', 'GET', null, true)).json()).data.due, false, 'A completed daily backup must suppress later scheduler checks');
  await call('/system/backups/schedule', 'PATCH', 'Admin', false, { time: '17:30' });
  assert.equal((await (await call('/backup-jobs', 'GET', null, true)).json()).data.due, false, 'Changing the time must not create a second automatic backup today');
  assert.equal((await (await call('/backup-jobs', 'POST', null, true)).json()).data._id, dailyId);
  assert.equal(rows.length, count, 'Repeated cron requests must not duplicate a completed daily backup');
  assert.equal((await call(`/backup-jobs/${dailyId}`, 'GET', null, true)).status, 200);
  assert.equal((await call(`/backup-jobs/${rows[0]._id}`, 'GET', null, true)).status, 404, 'The job key must not read manual backup runs');
  const privateView = await (await call('/system/backups')).json();
  for (const secret of [env.DRIVE_REFRESH_TOKEN, env.BACKUP_ENCRYPTION_KEY, env.BACKUP_SCHEDULER_TOKEN, 'private-db-password']) assert(!JSON.stringify(privateView).includes(secret));
  env.BACKUP_ENABLED = false;
  assert.equal((await call('/system/backups', 'POST')).status, 503);
  assert.equal((await (await call('/system/backups')).json()).data.configured, false);
  env.BACKUP_ENABLED = true;
  rows.push({ _id: id(99), active: true, status: 'uploading', scheduleDate: '2026-10-13' });
  await service.recoverInterruptedBackups();
  assert.equal(rows.at(-1).status, 'failed');
  assert.equal(rows.at(-1).scheduleDate, undefined);
  realNow = '2026-10-13T09:30:00Z';
  assert.equal((await (await call('/backup-jobs', 'GET', null, true)).json()).data.due, true, 'The saved time is used for the next Manila day');
  assert.equal(emitter.pending.size, 0);
  console.log('Passed backup authorization, real-time scheduling, maintenance, encrypted dump/restore bytes, tamper rejection, Drive account/scope/upload checks, secret protection, cleanup, and interrupted-job recovery. No live database or Google account used.');
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  global.fetch = originalFetch; global.Date = NativeDate; setCustomTime(null);
  for (const [object, key, original] of originals.reverse()) object[key] = original;
  delete mongoose.connection.readyState;
  if (directory) { for (const filename of await fs.readdir(directory)) await fs.unlink(path.join(directory, filename)); await fs.rmdir(directory); }
});
