// Read configuration only; no database connection or email/network request.
// Run from the repository root: node backend/scripts/check-email-config.js
const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');
const file = path.resolve(__dirname, '../.env');
const inherited = process.env.EMAIL_ENABLED;
const flag = value => value === undefined ? 'unset' : ['true', 'false'].includes(value) ? value : 'invalid (must be true or false)';

console.log(`Backend configuration file: ${file}`);
console.log(`Inherited EMAIL_ENABLED: ${flag(inherited)}`);
let parsed = {};
try {
  const text = fs.readFileSync(file, 'utf8');
  parsed = dotenv.parse(text);
  console.log(`File EMAIL_ENABLED: ${flag(parsed.EMAIL_ENABLED)}`);
  if ((text.match(/^\s*(?:export\s+)?EMAIL_ENABLED\s*=/gm) || []).length > 1) {
    console.log('Duplicate EMAIL_ENABLED entries: keep one; the last entry in the file wins.');
  }
} catch {
  console.log('Backend .env is missing or unreadable. Check the path above and the filename.');
}
if (inherited !== undefined && parsed.EMAIL_ENABLED !== undefined && inherited !== parsed.EMAIL_ENABLED) {
  console.log('The inherited EMAIL_ENABLED overrides the value in backend/.env.');
}
try {
  const env = require('../src/config/env');
  console.log(`Effective email setting in this NEW process: ${env.EMAIL_ENABLED ? 'enabled' : 'disabled'}`);
  console.log(`Sender configured: ${Boolean(env.SMTP_USER)}`);
  console.log(`App Password configured: ${Boolean(env.SMTP_APP_PASSWORD)}`);
  console.log('Restart the running backend to load edited configuration; this command does not change it.');
  process.exitCode = env.EMAIL_ENABLED ? 0 : 1;
} catch {
  console.error('Backend configuration failed validation. Check JWT_SECRET and email settings; credentials are not displayed.');
  process.exitCode = 1;
}
