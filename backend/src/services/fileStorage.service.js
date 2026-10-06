const mongoose = require('mongoose');
const fs = require('node:fs/promises');
const path = require('node:path');

const BUCKET_NAME = 'medicalFiles';
function getBucket() {
  if (!mongoose.connection.db) throw Object.assign(new Error('Document storage is unavailable'), { statusCode: 503 });
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: BUCKET_NAME });
}

function gridfsId(url) {
  const match = /^\/uploads\/gridfs\/([a-f\d]{24})$/i.exec(url || '');
  return match ? new mongoose.Types.ObjectId(match[1]) : null;
}

async function discardUpload(file) {
  if (file.storageId) return getBucket().delete(file.storageId);
  if (!file.path) return;
  const root = path.resolve(__dirname, '../../uploads');
  const relative = path.relative(root, path.resolve(file.path));
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error('Invalid upload cleanup path');
  }
  await fs.unlink(file.path).catch(err => { if (err.code !== 'ENOENT') throw err; });
}

async function clearStoredFiles() {
  // The demo reset already requires Admin confirmation and an idle API process.
  const db = mongoose.connection.db;
  if (!db) throw new Error('Document storage is unavailable');
  await db.collection(`${BUCKET_NAME}.chunks`).deleteMany({});
  await db.collection(`${BUCKET_NAME}.files`).deleteMany({});
}

module.exports = { getBucket, gridfsId, discardUpload, clearStoredFiles, BUCKET_NAME };
