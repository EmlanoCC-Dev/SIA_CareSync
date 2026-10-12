// Render build helper. Version and SHA-256 come from MongoDB's official release manifest.
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { spawnSync } = require('node:child_process');
const version = '100.19.1';
const archiveName = `mongodb-database-tools-ubuntu2204-x86_64-${version}`;
const sha256 = '8312f251c360ddfbcdd430c64758bee58b7050e1041e8c9df2906761098acd49';

async function install() {
  if (process.platform !== 'linux' || process.arch !== 'x64') throw new Error('This installer targets Linux x64 hosting. Install MongoDB Database Tools locally and set MONGODUMP_PATH.');
  const destination = path.resolve(__dirname, '../bin');
  await fsp.mkdir(destination, { recursive: true });
  const archive = path.join(destination, 'tools.tgz');
  try {
    const response = await fetch(`https://fastdl.mongodb.org/tools/db/${archiveName}.tgz`, { signal: AbortSignal.timeout(120000), redirect: 'error' });
    if (!response.ok) throw new Error('MongoDB tools download failed.');
    await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(archive));
    const hash = crypto.createHash('sha256');
    for await (const chunk of fs.createReadStream(archive)) hash.update(chunk);
    if (hash.digest('hex') !== sha256) throw new Error('MongoDB tools checksum did not match.');
    const unpack = spawnSync('tar', ['-xzf', archive, '-C', destination, '--strip-components=2', `${archiveName}/bin/mongodump`], { stdio: 'inherit' });
    if (unpack.status !== 0) throw new Error('MongoDB tools extraction failed.');
    const executable = path.join(destination, 'mongodump');
    await fsp.chmod(executable, 0o755);
    const verify = spawnSync(executable, ['--version'], { encoding: 'utf8' });
    if (verify.status !== 0 || !verify.stdout.includes(version)) throw new Error('MongoDB backup tool verification failed.');
    console.log(`Verified mongodump ${version}.`);
  } finally { await fsp.unlink(archive).catch(() => {}); }
}
install().catch(error => { console.error(error.message); process.exitCode = 1; });
