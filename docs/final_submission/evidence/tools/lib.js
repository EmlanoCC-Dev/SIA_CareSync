// Shared helpers for the local evidence run. Synthetic data only; never point this at a shared database.
// Run with NODE_PATH=backend/node_modules so mongoose resolves from the backend install.
const { createHmac } = require('node:crypto');
const mongoose = require('mongoose');

const API = process.env.EVIDENCE_API || 'http://localhost:5000/api';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/caresync_evidence';
const PASSWORD = process.env.EVIDENCE_PASSWORD;
if (!PASSWORD || PASSWORD.length < 12) throw new Error('Set EVIDENCE_PASSWORD (12+ chars, synthetic) before running');
if (!/\/\/(127\.0\.0\.1|localhost)[:/].*caresync_evidence/.test(MONGO_URI)) throw new Error('Refusing: MONGO_URI must be the local caresync_evidence database');

async function db() {
  if (mongoose.connection.readyState !== 1) await mongoose.connect(MONGO_URI);
  return mongoose.connection.db;
}

// Email is disabled locally, so the harness writes the OTP challenge the mailer would have delivered.
// The hash matches backend/src/services/otp.service.js; the code itself is never logged or saved.
async function injectOtp(purpose, email) {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const now = new Date();
  const codeHash = createHmac('sha256', process.env.JWT_SECRET)
    .update(JSON.stringify(['email-otp', purpose, email.toLowerCase(), code])).digest('hex');
  await (await db()).collection('emailotps').replaceOne({ _id: `${purpose}:${email.toLowerCase()}` }, {
    codeHash, ready: true, attempts: 0, consumedAt: null, lastSentAt: now, windowStart: now, sendCount: 1,
    expiresAt: new Date(now.getTime() + 600000), purgeAt: new Date(now.getTime() + 7200000), user: null, tokenVersion: 0,
  }, { upsert: true });
  return code;
}

// stack: dev-mode error traces carry local file paths, so they are redacted too.
const SECRET_KEYS = /^(token|otp|code|password|codeHash|authorization|stack)$/i;
function sanitize(value) {
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, SECRET_KEYS.test(key) ? '[REDACTED]' : sanitize(item)]));
  }
  return value;
}

async function call(method, path, { token, body, form } = {}) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  if (body) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${API}${path}`, { method, headers, body: form || (body && JSON.stringify(body)) });
  const text = await response.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: response.status, body: json };
}

async function login(email) {
  const result = await call('POST', '/users/login', { body: { email, password: PASSWORD } });
  if (result.status !== 200) throw new Error(`Login failed for ${email}: ${result.status} ${JSON.stringify(result.body)}`);
  return result.body.data.token;
}

module.exports = { API, MONGO_URI, PASSWORD, db, injectOtp, sanitize, call, login, mongoose };
