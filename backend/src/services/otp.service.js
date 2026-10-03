const { randomInt, createHmac } = require('node:crypto');
const EmailOtp = require('../models/EmailOtp');
const User = require('../models/User');
const env = require('../config/env');
const { sendEmail } = require('./email.service');

const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
function normalizeEmail(value) {
  if (typeof value !== 'string' || value.length > 254 || !/^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(value.trim())) {
    throw fail('Provide a valid email address');
  }
  return value.trim().toLowerCase();
}
function hashCode(purpose, email, code) {
  // Keyed hashes prevent guessing six-digit codes from a database dump alone.
  return createHmac('sha256', env.JWT_SECRET).update(JSON.stringify(['email-otp', purpose, email, code])).digest('hex');
}

async function reserveOtp(purpose, email, user = null) {
  if (!env.EMAIL_ENABLED) throw fail('Email verification is unavailable. Contact the clinic.', 503);
  const now = new Date(), hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const key = `${purpose}:${email}`;
  try {
    await EmailOtp.updateOne({ _id: key }, { $setOnInsert: {
      lastSentAt: new Date(0), windowStart: now, sendCount: 0, expiresAt: new Date(0), purgeAt: new Date(now.getTime() + 2 * 60 * 60 * 1000),
    } }, { upsert: true });
  } catch (err) { if (err.code !== 11000) throw err; }
  await EmailOtp.updateOne({ _id: key, windowStart: { $lte: hourAgo } }, { $set: { windowStart: now, sendCount: 0 } });
  const code = String(randomInt(0, 1000000)).padStart(6, '0');
  const codeHash = hashCode(purpose, email, code);
  const challenge = await EmailOtp.findOneAndUpdate({
    _id: key, lastSentAt: { $lte: new Date(now.getTime() - 60000) }, sendCount: { $lt: 5 },
  }, { $set: {
    codeHash, ready: false, attempts: 0, consumedAt: null, lastSentAt: now,
    expiresAt: new Date(now.getTime() + 10 * 60 * 1000), purgeAt: new Date(now.getTime() + 2 * 60 * 60 * 1000),
    user: user?._id || null, tokenVersion: user?.tokenVersion || 0,
  }, $inc: { sendCount: 1 } }, { new: true });
  if (!challenge) throw fail('Wait 60 seconds between codes. At most five codes can be requested per hour.', 429);
  return { key, code, codeHash };
}

async function deliverOtp(purpose, email, challenge) {
  try {
    await sendEmail({ to: email,
      title: purpose === 'register' ? 'Verify your patient account' : 'Verify your password change',
      message: `Your CareSync verification code is ${challenge.code}.\n\nIt expires in 10 minutes and can be used once. Do not share this code. If you did not request it, ignore this email.`,
    });
    const result = await EmailOtp.updateOne({ _id: challenge.key, codeHash: challenge.codeHash, consumedAt: null }, { $set: { ready: true } });
    if (!result.matchedCount) throw fail('The verification code was replaced. Request a new code.', 503);
  } catch {
    await EmailOtp.updateOne({ _id: challenge.key, codeHash: challenge.codeHash }, { $set: { ready: false, codeHash: null } }).catch(() => {});
    // Never log codes, addresses, credentials, or raw SMTP responses.
    throw fail('Could not deliver the verification code. Try again in 60 seconds.', 503);
  }
}

async function requestRegistrationOtp(value) {
  const email = normalizeEmail(value);
  if (await User.findOne({ email })) throw fail('Email already registered', 409);
  const challenge = await reserveOtp('register', email);
  await deliverOtp('register', email, challenge);
  return { message: 'Verification code sent. Check your email.', expiresInSeconds: 600, resendAfterSeconds: 60 };
}

async function requestPasswordOtp(value) {
  const email = normalizeEmail(value);
  const user = await User.findOne({ email }).select('_id email status tokenVersion');
  const challenge = await reserveOtp('password', email, user);
  if (user && user.status !== 'Deactivated') {
    // Return the same response before SMTP for existing/missing accounts, avoiding account disclosure.
    // ponytail: process-local send; a lost code can be requested again after the cooldown.
    deliverOtp('password', email, challenge).catch(() => console.error('[OTP] Password verification delivery failed'));
  }
  return { message: 'If an active account uses this email, a verification code will arrive shortly.', expiresInSeconds: 600, resendAfterSeconds: 60 };
}

async function consumeOtp(purpose, value, code) {
  const email = normalizeEmail(value);
  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) throw fail('Enter the six-digit verification code');
  const filter = { _id: `${purpose}:${email}`, ready: true, consumedAt: null, expiresAt: { $gt: new Date() }, attempts: { $lt: 5 } };
  const challenge = await EmailOtp.findOneAndUpdate({ ...filter, codeHash: hashCode(purpose, email, code) },
    { $set: { consumedAt: new Date(), codeHash: null, ready: false } }, { new: true });
  if (!challenge) {
    await EmailOtp.updateOne(filter, { $inc: { attempts: 1 } });
    throw fail('Invalid, expired, or used code. After five attempts, request a new code.');
  }
  return challenge;
}

module.exports = { normalizeEmail, requestRegistrationOtp, requestPasswordOtp, consumeOtp };
