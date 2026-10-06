// Copy a private JSON bundle into GridFS without changing appointment records.
// Run once before API startup, then remove the bundle from the hosting service.
const fs = require('node:fs/promises');
const { createHash } = require('node:crypto');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const mongoose = require('mongoose');
const env = require('../src/config/env');
const { getBucket, gridfsId } = require('../src/services/fileStorage.service');
const { snapshots } = require('./migrate-uploads-to-gridfs');
const hash = data => createHash('sha256').update(data).digest('hex');

async function copyBundle(bundle, bucket) {
  if (!Array.isArray(bundle)) throw new Error('Invalid upload bundle');
  const entries = bundle.map(entry => {
    if (typeof entry.url !== 'string' || !/^\/uploads\/(?:[\w.-]+\/)*[\w.-]+$/.test(entry.url)
      || entry.url.split('/').some(part => part === '.' || part === '..') || gridfsId(entry.url)
      || typeof entry.data !== 'string') throw new Error('Invalid upload entry');
    const data = Buffer.from(entry.data, 'base64');
    if (!data.length || data.length > 25 * 1024 * 1024 || data.toString('base64') !== entry.data
      || hash(data) !== entry.sha256) throw new Error('Upload checksum or size mismatch');
    return { ...entry, data };
  });
  if (new Set(entries.map(entry => entry.url)).size !== entries.length) throw new Error('Duplicate upload paths');
  for (const entry of entries) {
    let file = await bucket.find({ 'metadata.legacyUrl': entry.url }).next();
    if (!file) {
      const stream = bucket.openUploadStream(entry.url.split('/').pop(), { metadata: { legacyUrl: entry.url } });
      try { await pipeline(Readable.from(entry.data), stream); }
      catch (error) { await bucket.delete(stream.id).catch(() => {}); throw error; }
      file = stream.gridFSFile;
    }
    const checksum = createHash('sha256');
    for await (const chunk of bucket.openDownloadStream(file._id)) checksum.update(chunk);
    if (file.length !== entry.data.length || checksum.digest('hex') !== entry.sha256) throw new Error('Stored upload checksum mismatch');
  }
  return entries.length;
}

async function main() {
  if (process.argv.length !== 3) throw new Error('Provide one private bundle path');
  const bundle = JSON.parse(await fs.readFile(process.argv[2], 'utf8'));
  await mongoose.connect(env.MONGO_URI, { autoIndex: false, autoCreate: false });
  const bucket = getBucket();
  const copied = await copyBundle(bundle, bucket);
  const appointments = await mongoose.connection.db.collection('appointments')
    .find({}, { projection: { documents: 1, archivedDocuments: 1 } }).toArray();
  const urls = new Set(appointments.flatMap(row => snapshots(row).map(doc => doc.url))
    .filter(url => typeof url === 'string' && url.startsWith('/uploads/') && !gridfsId(url)));
  let missing = 0;
  for (const url of urls) if (!await bucket.find({ 'metadata.legacyUrl': url }).next()) missing++;
  console.log(`[Legacy uploads] ${copied} files verified; ${urls.size} referenced legacy paths; ${missing} missing. Appointment records unchanged.`);
  if (missing) throw new Error('Some legacy uploads are still missing');
}
if (require.main === module) main().catch(() => {
  console.error('[Legacy uploads] Import failed; check bundle, checksums and database access.'); process.exitCode = 1;
}).finally(() => mongoose.disconnect());
module.exports = { copyBundle };
