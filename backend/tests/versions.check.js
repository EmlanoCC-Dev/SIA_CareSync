// Run: node backend/tests/versions.check.js — real routes/uploads/downloads, isolated models; no MongoDB.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
process.env.NODE_ENV = 'production';
process.env.UPLOAD_STORAGE = 'local';
process.env.JWT_SECRET = 'isolated-version-history-check-secret-for-tests';
const jwt = require('jsonwebtoken');
const User = require('../src/models/User');
const Appointment = require('../src/models/Appointment');
const AuditLog = require('../src/models/AuditLog');
const emitter = require('../src/events/emitter');
const { registerAuditHandlers } = require('../src/events/handlers/auditLog.handler');
const { UPLOAD_ROOT } = require('../src/middleware/upload');
const app = require('../server');
const id = n => n.toString(16).padStart(24, '0');
const users = ['Patient', 'Patient', 'Doctor', 'Doctor', 'Staff', 'Admin'].map((role, i) => ({
  _id: id(i + 1), role, firstName: `User${i + 1}`, lastName: 'Test',
}));
const [patient, otherPatient, doctor, otherDoctor, staff, admin] = users;
const tag = `version-check-${randomUUID()}`;
const legacyFile = path.join(UPLOAD_ROOT, `${tag}-legacy.txt`);
const fixture = n => ({ _id: id(n), patient: patient._id, doctor: doctor._id, date: '2099-01-01', status: 'Completed',
  reason: 'PRIVATE_REASON', documents: [], statusHistory: [], noteVersions: [], archivedDocuments: [] });
const record = fixture(20), blank = fixture(21);
record.consultationNotes = 'PRIVATE_LEGACY_NOTES';
record.documents.push({ _id: id(30), filename: 'Legacy result.txt', type: 'general', url: `/uploads/${path.basename(legacyFile)}`, uploadedAt: '2026-10-01T00:00:00Z' });
const records = [record, blank], audits = [], originals = [], files = new Set([legacyFile]);
let server, checks = 0, failWrite = false, race = null;
const copy = value => JSON.parse(JSON.stringify(value));
const stub = (model, method, fn) => { originals.push([model, method, model[method]]); model[method] = fn; };
function query(value) {
  return { select() { return this; }, populate(field) {
    if (value && !Array.isArray(value) && field === 'patient') value.patient = users.find(user => user._id === value.patient) || value.patient;
    return this;
  }, then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } };
}
function matches(row, filter) {
  return Object.entries(filter).every(([key, value]) => {
    if (value?.$in) return value.$in.includes(row[key] ?? null);
    if (value?.$elemMatch) return row[key].some(entry => matches(entry, value.$elemMatch));
    return value == null ? row[key] == null : String(row[key]) === String(value);
  });
}
async function main() {
  await fs.mkdir(UPLOAD_ROOT, { recursive: true });
  await fs.writeFile(legacyFile, 'Original legacy file', { flag: 'wx' });
  stub(User, 'findById', key => query(users.find(user => user._id === String(key)) || null));
  stub(Appointment, 'findById', key => query(copy(records.find(row => row._id === String(key)) || null)));
  stub(Appointment, 'find', () => query([]));
  stub(Appointment, 'exists', filter => {
    const urls = filter.$or.map(condition => Object.values(condition)[0]);
    const referenced = records.some(row => [...(row.documents || []), ...(row.archivedDocuments || [])]
      .some(document => [document, ...(document.versions || [])].some(version => urls.includes(version.url))));
    return query(referenced ? { _id: record._id } : null);
  });
  stub(Appointment, 'findOneAndUpdate', async (filter, update, options) => {
    if (failWrite) throw new Error('Injected record write failure');
    if (race) { const hook = race; race = null; hook(); }
    const row = records.find(row => row._id === String(filter._id));
    if (!row || !matches(row, filter)) return null;
    assert.equal(options.runValidators, true);
    const next = copy(row);
    for (const [key, value] of Object.entries(update.$set || {})) {
      if (key === 'documents.$') next.documents[next.documents.findIndex(doc => doc._id === String(filter.documents.$elemMatch._id))] = copy(value);
      else next[key] = copy(value);
    }
    for (const [key, value] of Object.entries(update.$push || {})) {
      (next[key] ||= []).push(...copy(value.$each || [value]));
    }
    if (update.$pull?.documents) next.documents = next.documents.filter(doc => doc._id !== String(update.$pull.documents._id));
    assert.equal(new Appointment(next).validateSync(), undefined, 'Updated record must satisfy the real schema');
    Object.assign(row, next);
    return copy(row);
  });
  stub(AuditLog, 'create', async data => { audits.push(copy(data)); return data; });
  registerAuditHandlers();
  server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  const base = `http://127.0.0.1:${server.address().port}/api/appointments`;
  async function call(suffix, user = doctor, status = 200, method = 'GET', body, key = record._id) {
    const token = user && jwt.sign({ id: user._id }, process.env.JWT_SECRET);
    const response = await fetch(`${base}/${key}${suffix}`, { method,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }) },
      ...(body !== undefined ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}),
    });
    assert.equal(response.status, status, `${user?.role || 'public'} ${method} ${suffix}: expected ${status}, got ${response.status}`);
    checks++;
    if (suffix.endsWith('/download') && status === 200) {
      assert.equal(response.headers.get('cache-control'), 'private, no-store');
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
      return response.text();
    }
    return response.json();
  }
  const upload = (content, version, name = `${tag}.txt`) => {
    const data = new FormData();
    data.append('type', 'general'); data.append('title', 'Result.txt');
    if (version !== undefined) data.append('version', version);
    data.append('file', new Blob([content]), name);
    return data;
  };
  for (const [method, suffix, body] of [['GET', '/versions'], ['PATCH', '/documents', { consultationNotes: 'Denied' }],
    ['POST', `/documents/${id(30)}/replace`, upload('Denied', 1)], ['GET', `/documents/${id(30)}/versions/1/download`]]) {
    await call(suffix, null, 401, method, body);
    for (const user of [otherPatient, otherDoctor]) await call(suffix, user, 403, method, body);
  }
  await call('/documents', patient, 403, 'PATCH', { consultationNotes: 'Denied' });
  await call(`/documents/${id(30)}/replace`, patient, 403, 'POST', upload('Denied', 1));
  for (const user of [patient, doctor, staff, admin]) {
    const history = (await call('/versions', user)).data;
    assert.equal(history.notes[0].notes, 'PRIVATE_LEGACY_NOTES');
    assert.equal(history.notes[0].authorName, null);
    assert.equal(history.notes[0].savedAt, null, 'Do not invent legacy note authors/times');
    assert.equal(history.documents[0].versions[0].uploaderName, null);
  }
  await call('/documents', doctor, 200, 'PATCH', { consultationNotes: 'PRIVATE_LEGACY_NOTES', notesRevision: 0 });
  assert.equal(record.noteVersions.length, 0, 'Unchanged legacy notes create no extra revision');
  await call('/documents', doctor, 200, 'PATCH', { consultationNotes: '  PRIVATE_UPDATED_NOTES  ', notesRevision: 0, savedBy: admin._id });
  assert.equal(record.noteVersions.length, 2);
  assert.equal(record.notesRevision, 2);
  assert.equal(record.noteVersions[1].savedBy, doctor._id);
  assert.equal(record.noteVersions[1].authorRole, 'Doctor');
  assert.equal(record.noteVersions[1].notes, 'PRIVATE_UPDATED_NOTES');
  await call('/documents', doctor, 200, 'PATCH', { consultationNotes: 'PRIVATE_UPDATED_NOTES', notesRevision: 2 });
  assert.equal(record.noteVersions.length, 2);
  await call('/documents', staff, 409, 'PATCH', { consultationNotes: 'Stale draft', notesRevision: 0 });
  for (const body of [{ consultationNotes: {} }, { consultationNotes: 'x', notesRevision: -1 }, { consultationNotes: 'x', notesRevision: '2' },
    { documents: [{ ...record.documents[0], url: '/uploads/forged.txt' }] }]) await call('/documents', doctor, 400, 'PATCH', body);
  await call('/documents', staff, 200, 'PATCH', { consultationNotes: '', notesRevision: 2 });
  assert.equal(record.noteVersions[2].notes, '');
  assert.equal(record.noteVersions[1].notes, 'PRIVATE_UPDATED_NOTES');
  await call('/documents', doctor, 200, 'PATCH', { consultationNotes: 'First note', notesRevision: 0 }, blank._id);
  assert.equal(blank.noteVersions.length, 1);
  const beforeFailure = copy(record), auditCount = audits.length;
  failWrite = true;
  await call('/documents', doctor, 500, 'PATCH', { consultationNotes: 'Failed save', notesRevision: 3 });
  failWrite = false;
  assert.deepEqual(record, beforeFailure);
  assert.equal(audits.length, auditCount);
  race = () => { record.consultationNotes = 'Other writer'; record.notesRevision = 4;
    record.noteVersions.push({ version: 4, notes: 'Other writer', authorName: 'Other writer', authorRole: 'Staff' }); };
  await call('/documents', doctor, 409, 'PATCH', { consultationNotes: 'Concurrent stale save', notesRevision: 3 });
  assert.equal(record.consultationNotes, 'Other writer');
  assert.equal(record.noteVersions.length, 4);
  const originalNow = Date.now, sameTick = Date.now();
  let file1, file2;
  Date.now = () => sameTick;
  try {
    file1 = (await call('/upload', doctor, 201, 'POST', upload('First file'))).data;
    file2 = (await call('/upload', staff, 201, 'POST', upload('Separate file'))).data;
  } finally { Date.now = originalNow; }
  assert.notEqual(file1._id, file2._id, 'New upload is a separate document');
  assert.notEqual(file1.url, file2.url, 'Each physical file has a unique name');
  assert.equal(file1.version, 1);
  assert.equal(file1.uploadedBy, doctor._id);
  const beforeArchiveRace = record.documents.find(doc => doc._id === file2._id).url;
  race = () => { record.documents.find(doc => doc._id === file2._id).url = '/uploads/competing-replacement.txt'; };
  await call(`/documents/${file2._id}`, staff, 409, 'DELETE', { version: 1 });
  assert(!record.archivedDocuments.some(doc => doc._id === file2._id), 'Stale archive must not remove a competing replacement');
  record.documents.find(doc => doc._id === file2._id).url = beforeArchiveRace;
  const replaced = (await call(`/documents/${file1._id}/replace`, staff, 201, 'POST', upload('Second file', 1))).data;
  assert.equal(replaced._id, file1._id);
  assert.equal(replaced.version, 2);
  assert.equal(replaced.versions[0].url, file1.url);
  assert.equal(replaced.versions[0].uploaderRole, 'Doctor');
  assert.equal(replaced.uploadedBy, staff._id);
  assert.equal(await call(`/documents/${file1._id}/versions/1/download`, patient), 'First file');
  assert.equal(await call(`/documents/${file1._id}/download`, patient), 'Second file');
  await call(`/documents/${file1._id}/replace`, doctor, 409, 'POST', upload('Stale replacement', 1));
  await call(`/documents/${file1._id}/replace`, doctor, 400, 'POST', upload('Bad version', 'bad'));
  // Fields before the file let Multer validate metadata before creating the file.
  const invalidCategory = new FormData();
  invalidCategory.append('type', 'general'); invalidCategory.append('type', 'radiology');
  invalidCategory.append('file', new Blob(['Invalid category']), `${tag}.txt`);
  await call(`/documents/${file1._id}/replace`, doctor, 400, 'POST', invalidCategory);
  await call(`/documents/${file1._id}/replace`, doctor, 400, 'POST', upload('Bad extension', 2, `${tag}.exe`));
  const beforeReplaceFailure = copy(record);
  failWrite = true;
  await call(`/documents/${file1._id}/replace`, doctor, 500, 'POST', upload('Failed replace', 2));
  failWrite = false;
  assert.deepEqual(record, beforeReplaceFailure);
  await call(`/documents/${file1._id}`, doctor, 409, 'DELETE', { version: 1 });
  await call(`/documents/${file1._id}`, admin, 200, 'DELETE', { version: 2 });
  const archive = record.archivedDocuments.find(doc => doc._id === file1._id);
  assert.equal(archive.archivedBy, admin._id);
  assert.equal(archive.versions.length, 1);
  assert(!record.documents.some(doc => doc._id === file1._id));
  assert.equal(await call(`/documents/${file1._id}/versions/1/download`, patient), 'First file');
  assert.equal(await call(`/documents/${file1._id}/versions/2/download`, patient), 'Second file');
  await call(`/documents/${file1._id}/download`, patient, 404);
  await call(`/documents/${file1._id}/replace`, doctor, 404, 'POST', upload('Cannot replace archive', 2));
  await call(`/documents/${file1._id}/versions/1`, doctor, 404, 'DELETE');
  await call(`/documents/${file1._id}/versions/1`, doctor, 404, 'PATCH', { filename: 'Changed' });
  await call(`/documents/${file1._id}/versions/0/download`, patient, 400);
  await call(`/documents/${file1._id}/versions/1.5/download`, patient, 400);
  await call(`/documents/${file1._id}/versions/999/download`, patient, 404);
  await call(`/documents/${id(999)}/versions/1/download`, patient, 404);
  const legacyReplacement = (await call(`/documents/${id(30)}/replace`, doctor, 201, 'POST', upload('New legacy file', 1))).data;
  assert.equal(legacyReplacement.versions[0].filename, 'Legacy result.txt');
  assert.equal(await call(`/documents/${id(30)}/versions/1/download`, patient), 'Original legacy file');
  const oldUrl = record.documents.find(doc => doc._id === id(30)).versions[0].url;
  record.documents.find(doc => doc._id === id(30)).versions[0].url = '/uploads/../server.js';
  await call(`/documents/${id(30)}/versions/1/download`, patient, 403);
  record.documents.find(doc => doc._id === id(30)).versions[0].url = oldUrl;
  await call('/documents', doctor, 200, 'PATCH', { consultationNotes: 'A later note', notesRevision: 4 });
  assert(!JSON.stringify(audits).includes('PRIVATE_'), 'Version audit metadata must omit notes and file URLs');
  assert.equal(record.status, 'Completed');
  assert.equal(record.statusHistory.length, 0);
  const history = (await call('/versions', patient)).data;
  assert(history.documents.some(doc => doc._id === file1._id && doc.archived));
  assert(history.notes.some(entry => entry.notes === 'PRIVATE_LEGACY_NOTES'));
  console.log(`Passed ${checks} version-history HTTP checks: baselines, unchanged notes, authors, conflicts/failures, replacement/archive and protected original-file downloads.`);
}
main().catch(err => { console.error(err); process.exitCode = 1; }).finally(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  const directory = path.join(UPLOAD_ROOT, `patient_${patient._id}_user1_test`, 'general');
  try { for (const name of await fs.readdir(directory)) if (name.includes(tag)) files.add(path.join(directory, name)); }
  catch (err) { if (err.code !== 'ENOENT') throw err; }
  for (const file of files) {
    assert(path.resolve(file).startsWith(path.resolve(UPLOAD_ROOT) + path.sep) && path.basename(file).includes(tag));
    await fs.unlink(file).catch(err => { if (err.code !== 'ENOENT') throw err; });
  }
  for (const [model, method, original] of originals) model[method] = original;
  emitter.removeAllListeners();
});
