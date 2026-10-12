// Exports the synthetic evidence database to Extended JSON, one file per collection.
// Password hashes, OTP hashes and tokens are removed; OTP challenges and GridFS file bytes are skipped.
const fs = require('node:fs');
const path = require('node:path');
const { EJSON } = require('bson');
const { db, mongoose, MONGO_URI } = require('./lib');

const out = path.resolve(__dirname, '../synthetic-export');
const SKIP = new Set(['emailotps', 'medicalFiles.chunks']); // live codes / raw file bytes
const STRIP = /^(password|codeHash|token|tokenVersion|refreshToken|.*Token)$/;

function strip(value) {
  if (Array.isArray(value)) return value.map(strip);
  if (value && typeof value === 'object' && value.constructor === Object) {
    return Object.fromEntries(Object.entries(value).filter(([key]) => !STRIP.test(key)).map(([key, item]) => [key, strip(item)]));
  }
  return value;
}

(async () => {
  const database = await db();
  fs.mkdirSync(out, { recursive: true });
  const manifest = { source: MONGO_URI.replace(/\/\/[^@]*@/, '//'), exportedAt: new Date().toISOString(), collections: {}, skipped: [...SKIP] };
  for (const { name } of (await database.listCollections().toArray()).sort((a, b) => a.name.localeCompare(b.name))) {
    if (SKIP.has(name)) continue;
    const docs = (await database.collection(name).find().sort({ _id: 1 }).toArray()).map(strip);
    fs.writeFileSync(path.join(out, `${name}.json`), EJSON.stringify(docs, null, 2, { relaxed: true }));
    manifest.collections[name] = docs.length;
  }
  const leaked = fs.readdirSync(out).some(file => /"(password|codeHash)"\s*:/.test(fs.readFileSync(path.join(out, file), 'utf8')));
  if (leaked) throw new Error('Export still contains a password or OTP hash field');
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(manifest.collections);
  await mongoose.disconnect();
})().catch(async error => { console.error(error.message); await mongoose.disconnect(); process.exit(1); });
