// Decrypts into a new local archive; it never connects to or restores a database.
require('dotenv').config({ path: require('node:path').resolve(__dirname, '../.env') });
const { decryptArchive } = require('../src/utils/backupArchive');
const [source, target] = process.argv.slice(2);
if (!source || !target) {
  console.error('Usage: node backend/scripts/decrypt-backup.js <download.csbackup> <new.archive.gz>');
  process.exitCode = 1;
} else decryptArchive(source, target, process.env.BACKUP_ENCRYPTION_KEY)
  .then(() => console.log('Archive authenticated and decrypted. Restore only into an isolated test database.'))
  .catch(() => { console.error('Decryption failed. Check the key, archive integrity, and that the output file does not already exist.'); process.exitCode = 1; });
