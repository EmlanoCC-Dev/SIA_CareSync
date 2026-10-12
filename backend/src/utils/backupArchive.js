const crypto = require('node:crypto');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const { pipeline } = require('node:stream/promises');

const MAGIC = Buffer.from('CSBKP001');
function encryptionKey(value) {
  const key = Buffer.from(value || '', 'base64');
  if (key.length !== 32 || key.toString('base64') !== value) throw new Error('Backup encryption needs a valid 32-byte base64 key.');
  return key;
}

async function encryptArchive(input, target, value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(value), iv);
  await fsp.writeFile(target, Buffer.concat([MAGIC, iv]), { flag: 'wx', mode: 0o600 });
  await pipeline(input, cipher, fs.createWriteStream(target, { flags: 'a' }));
  await fsp.appendFile(target, cipher.getAuthTag());
}

async function decryptArchive(source, target, value) {
  const key = encryptionKey(value);
  const size = (await fsp.stat(source)).size;
  if (size < 36) throw new Error('This is not a CareSync backup archive.');
  const handle = await fsp.open(source, 'r');
  const header = Buffer.alloc(20), tag = Buffer.alloc(16);
  try {
    await handle.read(header, 0, 20, 0);
    await handle.read(tag, 0, 16, size - 16);
  } finally { await handle.close(); }
  if (!header.subarray(0, 8).equals(MAGIC)) throw new Error('This backup format is unsupported.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, header.subarray(8));
  decipher.setAuthTag(tag);
  const temporary = `${target}.${crypto.randomBytes(8).toString('hex')}.partial`;
  try {
    await pipeline(fs.createReadStream(source, { start: 20, end: size - 17 }), decipher,
      fs.createWriteStream(temporary, { flags: 'wx', mode: 0o600 }));
    // Do not overwrite an existing restore archive.
    await fsp.link(temporary, target);
  } finally { await fsp.unlink(temporary).catch(() => {}); }
}

async function fileChecksums(source) {
  const sha256 = crypto.createHash('sha256'), md5 = crypto.createHash('md5');
  for await (const chunk of fs.createReadStream(source)) { sha256.update(chunk); md5.update(chunk); }
  return { sha256: sha256.digest('hex'), md5: md5.digest('hex'), size: (await fsp.stat(source)).size };
}
module.exports = { encryptionKey, encryptArchive, decryptArchive, fileChecksums };
