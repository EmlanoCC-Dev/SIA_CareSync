// Real upload/download routes and version services; an isolated GridFS double.
// No live database or medical files are read or changed.
const assert = require('node:assert/strict');
const { Writable, Readable } = require('node:stream');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
process.env.NODE_ENV = 'production';
process.env.JWT_SECRET = 'gridfs-isolated-test-secret-at-least-32';
process.env.EMAIL_ENABLED = 'false';
process.env.UPLOAD_STORAGE = 'gridfs';
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../src/models/User');
const Appointment = require('../src/models/Appointment');
const storage = require('../src/services/fileStorage.service');
const files = new Map(), cleared = [];
let reads = 0, failWrite = false, loseAcknowledgement = false;
const bucket = {
  openUploadStream(filename) {
    const id = new mongoose.Types.ObjectId(), chunks = [];
    const stream = new Writable({
      write(chunk, _encoding, callback) { if (failWrite) return callback(new Error('PRIVATE_WRITE_FAILURE')); chunks.push(Buffer.from(chunk)); callback(); },
      final(callback) {
        const data = Buffer.concat(chunks);
        stream.gridFSFile = { _id: id, filename, length: data.length };
        files.set(String(id), { ...stream.gridFSFile, data }); callback();
      },
    });
    stream.id = id; return stream;
  },
  find({ _id }) { reads++; return { next: async () => files.get(String(_id)) || null }; },
  openDownloadStream(id) { return Readable.from(files.get(String(id)).data); },
  async delete(id) { files.delete(String(id)); },
};
storage.getBucket = () => bucket;
const discardLocalUpload = storage.discardUpload;
storage.discardUpload = file => file.storageId ? bucket.delete(file.storageId) : discardLocalUpload(file);
const app = require('../server');
const id = n => n.toString(16).padStart(24, '0');
const actors = new Map(['Doctor', 'Patient', 'Patient'].map((role, index) => [id(index + 1), { _id: id(index + 1), role, firstName: 'Test', lastName: role, status: 'Active' }]));
const record = { _id: id(10), patient: id(2), doctor: id(1), documents: [], archivedDocuments: [], status: 'In Progress' };
const query = value => ({ populate() { return this; }, then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } });
User.findById = key => query(actors.get(String(key)));
Appointment.findById = () => query(record);
Appointment.exists = async filter => {
  const url = Object.values(filter.$or[0])[0];
  return [...record.documents, ...record.archivedDocuments].some(doc => doc.url === url || doc.versions?.some(version => version.url === url));
};
Appointment.findOneAndUpdate = async (filter, update) => {
  if (update.$push?.documents) record.documents.push(update.$push.documents);
  if (update.$set?.['documents.$']) {
    const index = record.documents.findIndex(doc => String(doc._id) === String(filter.documents.$elemMatch._id));
    record.documents[index] = update.$set['documents.$'];
  }
  if (update.$pull?.documents) {
    record.documents = record.documents.filter(doc => String(doc._id) !== String(update.$pull.documents._id));
    record.archivedDocuments.push(update.$push.archivedDocuments);
  }
  if (loseAcknowledgement) { loseAcknowledgement = false; throw new Error('PRIVATE_ACK_FAILURE'); }
  return record;
};
let server;
const fixture = path.resolve(__dirname, '../uploads', `gridfs-migration-check-${randomUUID()}.txt`);
async function main() {
  server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/appointments/${record._id}`;
  const call = (route, actor = id(1), options = {}) => fetch(base + route, {
    ...options, headers: { ...options.headers, ...(actor ? { Authorization: `Bearer ${jwt.sign({ id: actor }, process.env.JWT_SECRET)}` } : {}) },
  });
  const form = (text = 'original bytes', version) => {
    const data = new FormData(); data.append('type', 'lab_result');
    if (version !== undefined) data.append('version', String(version));
    data.append('file', new Blob([text]), 'Result.pdf'); return data;
  };
  assert.equal((await call('/upload', null, { method: 'POST', body: form() })).status, 401);
  assert.equal((await call('/upload', id(2), { method: 'POST', body: form() })).status, 403);
  assert.equal(files.size, 0, 'Authorization must run before persistent storage');
  let response = await call('/upload', id(1), { method: 'POST', body: form() });
  assert.equal(response.status, 201);
  let document = (await response.json()).data;
  assert(storage.gridfsId(document.url)); assert.equal(document.type, 'lab_result');
  const documentId = document._id;
  response = await call(`/documents/${documentId}/download`, id(2));
  assert.equal(response.status, 200); assert.equal(await response.text(), 'original bytes');
  assert.match(response.headers.get('content-disposition'), /attachment/);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const previousReads = reads;
  assert.equal((await call(`/documents/${documentId}/download`, id(3))).status, 403);
  assert.equal(reads, previousReads, 'Another patient must not read storage metadata');
  response = await call(`/documents/${documentId}/replace`, id(1), { method: 'POST', body: form('replacement bytes', 1) });
  assert.equal(response.status, 201); document = (await response.json()).data;
  assert.equal(document.version, 2); assert.equal(files.size, 2);
  response = await call(`/documents/${documentId}/versions/1/download`, id(2));
  assert.equal(response.status, 200); assert.equal(await response.text(), 'original bytes');
  assert.equal((await call(`/documents/${documentId}/replace`, id(1), { method: 'POST', body: form('stale replacement', 1) })).status, 409);
  assert.equal(files.size, 2, 'Rejected replacements must remove unattached uploads');
  response = await call(`/documents/${documentId}`, id(1), { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: '{"version":2}' });
  assert.equal(response.status, 200); assert.equal(files.size, 2, 'Archiving must retain historical bytes');
  response = await call(`/documents/${documentId}/versions/2/download`, id(2));
  assert.equal(response.status, 200); assert.equal(await response.text(), 'replacement bytes');
  const extraFiles = form(); extraFiles.append('file', new Blob(['extra']), 'Extra.pdf');
  assert.equal((await call('/upload', id(1), { method: 'POST', body: extraFiles })).status, 400);
  assert.equal(files.size, 2);
  const oversized = form(new Uint8Array(25 * 1024 * 1024 + 1));
  response = await call('/upload', id(1), { method: 'POST', body: oversized });
  assert.equal(response.status, 413); assert.match((await response.json()).message, /25 MB/); assert.equal(files.size, 2);
  failWrite = true;
  response = await call('/upload', id(1), { method: 'POST', body: form() });
  assert.equal(response.status, 500); assert(!(await response.text()).includes('PRIVATE_WRITE_FAILURE')); assert.equal(files.size, 2);
  failWrite = false; loseAcknowledgement = true;
  assert.equal((await call('/upload', id(1), { method: 'POST', body: form('committed bytes') })).status, 500);
  assert.equal(files.size, 3, 'A committed attachment must survive a failed acknowledgement');
  response = await call(`/documents/${record.documents[0]._id}/download`, id(2));
  assert.equal(await response.text(), 'committed bytes');
  const { snapshots, localPath } = require('../scripts/migrate-uploads-to-gridfs');
  assert.equal(snapshots(record).length, 3, 'Migration must include current, archived and historical references');
  await fs.mkdir(path.dirname(fixture), { recursive: true }); await fs.writeFile(fixture, 'isolated migration fixture', { flag: 'wx' });
  assert.equal(await localPath(`/uploads/${path.basename(fixture)}`), await fs.realpath(fixture));
  await assert.rejects(localPath('/uploads/../.env'));
  await assert.rejects(storage.discardUpload({ path: path.resolve(__dirname, '../.env') }));
  const previousDb = mongoose.connection.db;
  mongoose.connection.db = { collection: name => ({ deleteMany: async filter => { assert.deepEqual(filter, {}); cleared.push(name); } }) };
  try { await storage.clearStoredFiles(); } finally { mongoose.connection.db = previousDb; }
  assert.deepEqual(cleared, ['medicalFiles.chunks', 'medicalFiles.files']);
  console.log('Passed GridFS uploads, protected/versioned downloads, archiving, size limits, failure cleanup, migration paths and reset cleanup. No live database used.');
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { server?.close(); await fs.unlink(fixture).catch(error => { if (error.code !== 'ENOENT') throw error; }); });
