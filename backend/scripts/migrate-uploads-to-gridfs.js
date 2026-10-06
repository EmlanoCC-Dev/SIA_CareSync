// Defaults to a read-only inventory. --apply --offline copies files and updates
// document references; stop ALL API writers and back up the database first.
// Local files and document version numbers are preserved.
const fs = require('node:fs/promises');
const { createReadStream } = require('node:fs');
const path = require('node:path');
const { pipeline } = require('node:stream/promises');
const mongoose = require('mongoose');
const env = require('../src/config/env');
const Appointment = require('../src/models/Appointment');
const { getBucket, gridfsId } = require('../src/services/fileStorage.service');
const root = path.resolve(__dirname, '../uploads');

function snapshots(appointment) {
  return [...(appointment.documents || []), ...(appointment.archivedDocuments || [])]
    .flatMap(document => [document, ...(document.versions || [])]);
}

async function localPath(url) {
  const file = path.resolve(root, url.slice('/uploads/'.length));
  const inside = (base, candidate) => {
    const relative = path.relative(base, candidate);
    return relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
  };
  if (!inside(root, file) || !inside(await fs.realpath(root), await fs.realpath(file))) throw new Error('Invalid local upload path');
  if (!(await fs.stat(file)).isFile()) throw new Error('Upload path is not a file');
  return file;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => !['--apply', '--offline'].includes(arg)) || (args.includes('--apply') && !args.includes('--offline'))) {
    throw new Error('Use no arguments for a read-only inventory, or --apply --offline with ALL API writers stopped.');
  }
  await mongoose.connect(env.MONGO_URI, { autoIndex: false, autoCreate: false });
  const appointments = await Appointment.find({ $or: ['documents.url', 'documents.versions.url',
    'archivedDocuments.url', 'archivedDocuments.versions.url'].map(field => ({ [field]: /^\/uploads\// })) });
  const files = new Map();
  for (const appointment of appointments) for (const document of snapshots(appointment)) {
    if (document.url?.startsWith('/uploads/') && !gridfsId(document.url)) files.set(document.url, null);
  }
  let missing = 0, bytes = 0;
  for (const url of files.keys()) {
    try { const file = await localPath(url); files.set(url, file); bytes += (await fs.stat(file)).size; }
    catch { missing++; }
  }
  console.log(`Local file inventory: ${files.size} unique files, ${bytes} bytes, ${missing} missing or unsafe paths.`);
  if (missing) throw new Error('Restore the missing upload files before migration. No document references were changed.');
  if (!args.includes('--apply')) { console.log('Read-only inventory complete. No files or database records changed.'); return; }
  const bucket = getBucket(), replacements = new Map();
  for (const [url, file] of files) {
    // A previous interrupted migration can reuse its successfully copied file.
    let stored = await bucket.find({ 'metadata.legacyUrl': url }).next();
    if (!stored) {
      const stream = bucket.openUploadStream(path.basename(file), { metadata: { legacyUrl: url } });
      try { await pipeline(createReadStream(file), stream); }
      catch (error) { await bucket.delete(stream.id).catch(() => {}); throw error; }
      stored = stream.gridFSFile;
    }
    if (stored.length !== (await fs.stat(file)).size) throw new Error('A copied file does not match the local file size. Migration stopped.');
    replacements.set(url, `/uploads/gridfs/${stored._id}`);
  }
  let changed = 0;
  for (const appointment of appointments) {
    let dirty = false;
    for (const document of snapshots(appointment)) {
      if (replacements.has(document.url)) { document.url = replacements.get(document.url); dirty = true; }
    }
    if (dirty) { await appointment.save(); changed++; }
  }
  console.log(`Migration complete: ${files.size} file references mapped; ${changed} appointments updated. Local files retained.`);
}

if (require.main === module) main().catch(() => {
  console.error('Upload migration stopped. Check the inventory, database/storage access, and backups before retrying.');
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());
module.exports = { snapshots, localPath };
