/**
 * Environment Configuration
 * ─────────────────────────
 * Loads .env via dotenv and exports validated config values.
 */

require('dotenv').config({ path: require('node:path').resolve(__dirname, '../../.env') });

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
};

if (process.env.EMAIL_ENABLED && !['true', 'false'].includes(process.env.EMAIL_ENABLED)) {
  throw new Error('EMAIL_ENABLED must be true or false');
}
if (env.EMAIL_ENABLED && (!/^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(env.SMTP_USER) || !env.SMTP_APP_PASSWORD)) {
  throw new Error('Configure SMTP_USER and SMTP_APP_PASSWORD in backend/.env when email is enabled');
}

module.exports = env;
