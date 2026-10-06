/**
 * Environment Configuration
 * ─────────────────────────
 * Loads .env via dotenv and exports validated config values.
 */

require('dotenv').config({ path: require('node:path').resolve(__dirname, '../../.env') });
// Clinic hours must stay in Philippine time on hosts that default to UTC.
process.env.TZ ||= 'Asia/Manila';
new Intl.DateTimeFormat('en', { timeZone: process.env.TZ });

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET === 'change_me_to_a_long_random_string') {
  throw new Error('Configure JWT_SECRET with at least 32 characters in backend/.env');
}

const env = {
  PORT: process.env.PORT || 5000,
  MONGO_URI: process.env.MONGO_URI || 'mongodb://localhost:27017/caresync_app',
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  EMAIL_ENABLED: process.env.EMAIL_ENABLED === 'true',
  SMTP_USER: (process.env.SMTP_USER || '').trim(),
  SMTP_APP_PASSWORD: (process.env.SMTP_APP_PASSWORD || '').replace(/\s/g, ''),
  EMAIL_TRANSPORT: process.env.EMAIL_TRANSPORT || 'smtp',
  GMAIL_CLIENT_ID: (process.env.GMAIL_CLIENT_ID || '').trim(),
  GMAIL_CLIENT_SECRET: (process.env.GMAIL_CLIENT_SECRET || '').trim(),
  GMAIL_REFRESH_TOKEN: (process.env.GMAIL_REFRESH_TOKEN || '').trim(),
  UPLOAD_STORAGE: process.env.UPLOAD_STORAGE || (process.env.NODE_ENV === 'production' ? 'gridfs' : 'local'),
  CORS_ORIGINS: (process.env.CORS_ORIGINS || '').split(',').map(origin => origin.trim()).filter(Boolean),
  TRUST_PROXY: Number(process.env.TRUST_PROXY || 0),
};

if (process.env.EMAIL_ENABLED && !['true', 'false'].includes(process.env.EMAIL_ENABLED)) {
  throw new Error('EMAIL_ENABLED must be true or false');
}
if (!['smtp', 'gmail-api'].includes(env.EMAIL_TRANSPORT)) throw new Error('EMAIL_TRANSPORT must be smtp or gmail-api');
if (!['local', 'gridfs'].includes(env.UPLOAD_STORAGE)) throw new Error('UPLOAD_STORAGE must be local or gridfs');
if (!Number.isInteger(env.TRUST_PROXY) || env.TRUST_PROXY < 0 || env.TRUST_PROXY > 5) throw new Error('TRUST_PROXY must be a whole proxy-hop count from 0 to 5');
for (const origin of env.CORS_ORIGINS) {
  const url = new URL(origin);
  if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin) throw new Error('CORS_ORIGINS must contain exact HTTP(S) origins without paths or trailing slashes');
}
if (env.EMAIL_ENABLED && (!/^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(env.SMTP_USER) || (env.EMAIL_TRANSPORT === 'smtp' && !env.SMTP_APP_PASSWORD))) {
  throw new Error('Configure SMTP_USER and SMTP_APP_PASSWORD in backend/.env when email is enabled');
}
if (env.EMAIL_ENABLED && env.EMAIL_TRANSPORT === 'gmail-api' && (!env.GMAIL_CLIENT_ID || !env.GMAIL_CLIENT_SECRET || !env.GMAIL_REFRESH_TOKEN)) {
  throw new Error('Configure GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET and GMAIL_REFRESH_TOKEN for Gmail API email');
}

module.exports = env;
