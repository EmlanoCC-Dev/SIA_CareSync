const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const mongoose = require('mongoose');
const env = require('../config/env');
const Backup = require('../models/DatabaseBackup');
const { encryptionKey, encryptArchive, fileChecksums } = require('../utils/backupArchive');
const { withDatabaseSnapshot } = require('./demoReset.service');
const { prepareDrive, uploadBackup } = require('./driveBackup.service');

const fail = (message, statusCode = 503) => Object.assign(new Error(message), { statusCode });
const schedule = { time: '18:00', timezone: 'Asia/Manila', cronUtc: '0 10 * * *' };
async function configuration() {
  const missing = [];
  if (!env.BACKUP_ENABLED) missing.push('Database backups are not enabled.');
  if (!env.DRIVE_REFRESH_TOKEN || !env.GMAIL_CLIENT_ID || !env.GMAIL_CLIENT_SECRET || !env.SMTP_USER) missing.push('Connect the clinic Gmail account to Google Drive.');
  try { encryptionKey(env.BACKUP_ENCRYPTION_KEY); } catch { missing.push('Configure the backup encryption key.'); }
  if (env.UPLOAD_STORAGE !== 'gridfs') missing.push('Move uploaded documents into database storage before backing up.');
  try { await fs.access(env.MONGODUMP_PATH, require('node:fs').constants.X_OK); } catch { missing.push('Install the database backup tool on the server.'); }
  return { configured: missing.length === 0, missing, account: env.SMTP_USER || null,
    schedule, schedulerConfigured: env.BACKUP_SCHEDULER_TOKEN.length >= 32 };
}

async function getBackupStatus() {
  return { ...(await configuration()), runs: await Backup.find().sort({ createdAt: -1 }).limit(20)
    .select('trigger status filename database createdAt finishedAt size sha256 driveFileId message').lean() };
}

function realManilaDay() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).map(part => [part.type, part.value]));
  if (Number(parts.hour) < 18) throw fail('The scheduled backup runs after 6 PM Manila time. Use Back up now for an earlier backup.', 409);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

async function startBackup(trigger, requestedBy) {
  const config = await configuration();
  if (!config.configured) throw fail(config.missing.join(' '));
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.name) throw fail('The database is unavailable. Retry the backup shortly.');
  const scheduleDate = trigger === 'scheduled' ? realManilaDay() : undefined;
  if (scheduleDate) {
    const existing = await Backup.findOne({ scheduleDate }).lean();
    if (existing) return existing;
  }
  let run;
  try {
    run = await Backup.create({ trigger, requestedBy, scheduleDate, database: mongoose.connection.name,
      filename: `CareSync-${new Date().toISOString().replace(/[:.]/g, '-')}.archive.gz.csbackup` });
  } catch (error) {
    if (error.code !== 11000) throw fail('The backup request could not be saved. Retry shortly.');
    if (scheduleDate) {
      const existing = await Backup.findOne({ scheduleDate }).lean();
      if (existing) return existing;
    }
    throw fail('A database backup is already running. Wait for it to finish.', 409);
  }
  setImmediate(() => runBackup(run).catch(() => console.error('[Database backup] Could not save the final backup status. Check Drive before retrying.')));
  return run;
}

async function dumpEncrypted(run, directory, archive) {
  const configPath = path.join(directory, 'mongodump.yaml');
  await fs.writeFile(configPath, JSON.stringify({ uri: env.MONGO_URI }), { mode: 0o600, flag: 'wx' });
  const child = spawn(env.MONGODUMP_PATH, ['--config', configPath, '--db', run.database,
    '--archive', '--gzip', '--numParallelCollections=1', '--readPreference=primary'], { shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stderr.resume(); // Tool errors can contain connection credentials; never expose them.
  const completion = new Promise((resolve, reject) => {
    child.once('error', () => reject(fail('The database backup tool could not start. Check the server installation.')));
    child.once('close', code => code === 0 ? resolve() : reject(fail('The database export failed. Check database access and retry.')));
  });
  const timer = setTimeout(() => child.kill('SIGKILL'), 300000);
  try {
    await Promise.all([completion, encryptArchive(child.stdout, archive, env.BACKUP_ENCRYPTION_KEY)]);
  } catch (error) { child.kill('SIGKILL'); throw error; }
  finally { clearTimeout(timer); }
}

async function runBackup(run) {
  let directory;
  try {
    const drive = await prepareDrive();
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'caresync-backup-'));
    await fs.chmod(directory, 0o700);
    const archive = path.join(directory, 'database.csbackup');
    await Backup.updateOne({ _id: run._id }, { $set: { status: 'capturing' } });
    // The deployed clinic uses one API process; all its requests and event writes drain first.
    await withDatabaseSnapshot(() => dumpEncrypted(run, directory, archive));
    const checksums = await fileChecksums(archive);
    if (checksums.size <= 36) throw fail('The database export was empty. The backup was not uploaded.');
    await Backup.updateOne({ _id: run._id }, { $set: { status: 'uploading' } });
    const driveFileId = await uploadBackup(drive, archive, run.filename, checksums, run._id);
    await Backup.updateOne({ _id: run._id }, { $set: { status: 'completed', active: false,
      finishedAt: new Date(), size: checksums.size, sha256: checksums.sha256, driveFileId,
      message: 'Encrypted database backup verified in Google Drive.' } });
  } catch (error) {
    await Backup.updateOne({ _id: run._id }, { $set: { status: 'failed', active: false, finishedAt: new Date(),
      message: error.statusCode ? error.message : 'The database backup could not be completed. Retry shortly.' }, $unset: { scheduleDate: '' } });
  } finally {
    if (directory) {
      for (const filename of ['mongodump.yaml', 'database.csbackup']) await fs.unlink(path.join(directory, filename)).catch(error => { if (error.code !== 'ENOENT') throw error; });
      await fs.rmdir(directory);
    }
  }
}

async function recoverInterruptedBackups() {
  await Backup.updateMany({ active: true }, { $set: { active: false, status: 'failed', finishedAt: new Date(),
    message: 'The server restarted before this backup was confirmed. Check Drive before retrying.' }, $unset: { scheduleDate: '' } });
}

module.exports = { getBackupStatus, startBackup, recoverInterruptedBackups };
