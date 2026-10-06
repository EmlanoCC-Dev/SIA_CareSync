// Run: node backend/tests/otp.check.js
// Real HTTP/JWT/services with model/SMTP doubles. No MongoDB or real email.
const assert = require('node:assert/strict');
process.env.NODE_ENV = 'production';
process.env.JWT_SECRET = 'isolated-otp-check-secret-at-least-32-characters';
process.env.EMAIL_ENABLED = 'true';
process.env.SMTP_USER = 'sender@example.test';
process.env.SMTP_APP_PASSWORD = 'fake-password';
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const User = require('../src/models/User');
const WalkIn = require('../src/models/WalkIn');
const EmailOtp = require('../src/models/EmailOtp');
const emitter = require('../src/events/emitter');
const EVENTS = require('../src/events/events');
const env = require('../src/config/env');
const originals = [], users = [], challenges = new Map(), mail = [], events = [], logs = [];
const stub = (object, key, fn) => { originals.push([object, key, object[key]]); object[key] = fn; };
let counter = 1, smtpFail = false, userWriteFail = false, server, checks = 0;
const id = n => n.toString(16).padStart(24, '0');
const query = value => ({ select() { return this; }, lean() { return this; }, then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } });
function matches(row, filter) {
  return row && Object.entries(filter).every(([key, value]) => {
    if (key === '$or') return value.some(part => matches(row, part));
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      return Object.entries(value).every(([op, wanted]) => op === '$lt' ? row[key] < wanted : op === '$lte' ? row[key] <= wanted
        : op === '$gt' ? row[key] > wanted : op === '$ne' ? row[key] !== wanted : op === '$exists' ? (row[key] !== undefined) === wanted : false);
    }
    return String(row[key]) === String(value);
  });
}
function apply(row, update) {
  Object.assign(row, update.$set);
  for (const [key, amount] of Object.entries(update.$inc || {})) row[key] = (row[key] || 0) + amount;
  return row;
}
async function makeUser(data) {
  const user = { tokenVersion: 0, status: 'Active', ...data, _id: id(10 + users.length), id: id(10 + users.length), password: await bcrypt.hash(data.password, 10),
    toObject() { const { toObject, comparePassword, ...fields } = this; return fields; },
    comparePassword(value) { return bcrypt.compare(value, this.password); },
  };
  users.push(user); return user;
}
const codeFor = email => mail.filter(item => item.to.address === email).at(-1)?.text.match(/verification code is (\d{6})/)[1];
const age = (purpose, email) => { challenges.get(`${purpose}:${email}`).lastSentAt = new Date(Date.now() - 61000); };
async function main() {
  // This suite verifies OTP/account behavior; walk-in ownership has its own integration check.
  stub(WalkIn, 'updateMany', async () => ({ modifiedCount: 0 }));
  stub(WalkIn, 'find', () => query([]));
  stub(crypto, 'randomInt', (min, max) => { assert.equal(min, 0); assert.equal(max, 1000000); return counter++; });
  stub(nodemailer, 'createTransport', () => ({ async sendMail(data) {
    if (smtpFail) throw new Error('PRIVATE_SMTP_SECRET');
    mail.push(data); return { accepted: [data.to.address], messageId: '<otp@example.test>' };
  } }));
  // Load services after replacing the randomness source; production still uses Node crypto.
  const otp = require('../src/services/otp.service');
  const service = require('../src/services/user.service');
  const app = require('../server');
  stub(console, 'error', value => logs.push(String(value)));
  stub(EmailOtp, 'updateOne', async (filter, update, options) => {
    let row = challenges.get(filter._id);
    if (!row && options?.upsert) {
      row = { _id: filter._id, ready: false, codeHash: null, consumedAt: null, attempts: 0, user: null, tokenVersion: 0, ...update.$setOnInsert };
      challenges.set(filter._id, row);
    }
    if (!matches(row, filter)) return { matchedCount: 0 };
    apply(row, update); return { matchedCount: 1 };
  });
  stub(EmailOtp, 'findOneAndUpdate', async (filter, update) => {
    const row = challenges.get(filter._id);
    if (!matches(row, filter)) return null;
    return { ...apply(row, update) };
  });
  stub(User, 'findOne', filter => query(users.find(user => matches(user, filter)) || null));
  stub(User, 'findById', key => query(users.find(user => user._id === String(key)) || null));
  stub(User, 'create', async data => { if (userWriteFail) throw new Error('Injected account write failure'); return makeUser(data); });
  stub(User, 'findOneAndUpdate', async (filter, update) => {
    const user = users.find(row => matches(row, filter));
    return user ? apply(user, update) : null;
  });
  emitter.on(EVENTS.USER_CREATED, data => events.push(data));
  emitter.on(EVENTS.USER_UPDATED, data => events.push(data));
  const admin = await makeUser({ firstName: 'Admin', lastName: 'Test', role: 'Admin', email: 'admin@example.test', password: 'admin-password' });
  server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  const base = `http://127.0.0.1:${server.address().port}/api/users`;
  async function call(path, body, expected = 200, token, method = 'POST') {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    assert.equal(response.status, expected, `${method} ${path}: expected ${expected}, got ${response.status}`);
    assert.equal(response.headers.get('cache-control'), 'no-store'); checks++;
    return response.json();
  }
  const email = 'patient@example.test';
  const account = { firstName: 'Test', lastName: 'Patient', email, password: 'test-password', role: 'Admin' };
  for (const value of [null, {}, 'invalid', 'one@example.test,two@example.test', 'one@example.test\r\nBcc: other@example.test']) {
    await call('/register/otp', { email: value }, 400);
  }
  await call('/register', account, 400);
  assert.equal(users.length, 1, 'Registration without a code cannot create an account');
  const response = await call('/register/otp', { email: ' Patient@Example.Test ' });
  assert.equal(response.data.expiresInSeconds, 600);
  assert(!JSON.stringify(response).includes(codeFor(email)), 'Never return the OTP');
  let row = challenges.get(`register:${email}`);
  assert.equal(row.codeHash.length, 64);
  assert(!row.codeHash.includes(codeFor(email)));
  assert.equal(row.expiresAt - row.lastSentAt, 600000);
  assert.equal(row.ready, true);
  assert(EmailOtp.schema.indexes().some(([fields, options]) => fields.purgeAt === 1 && options.expireAfterSeconds === 0));
  await call('/register/otp', { email }, 429);
  await call('/register', { ...account, otp: '999999' }, 400);
  assert.equal(row.attempts, 1);
  await call('/password/reset', { email, otp: codeFor(email), password: 'new-password' }, 400);
  assert.equal(users.length, 1, 'A registration code cannot reset a password');
  const oldCode = codeFor(email);
  age('register', email);
  await call('/register/otp', { email });
  await call('/register', { ...account, otp: oldCode }, 400);
  const currentCode = codeFor(email);
  await call('/register', { ...account, firstName: '', otp: currentCode }, 400);
  assert.equal(row.consumedAt, null, 'Invalid account fields do not consume a good code');
  const registered = (await call('/register', { ...account, otp: currentCode }, 201)).data;
  assert.equal(registered.user.role, 'Patient');
  assert(registered.user.emailVerifiedAt);
  assert(!registered.user.password && !registered.user.otp);
  assert.equal(jwt.verify(registered.token, env.JWT_SECRET).version, 0);
  await call('/register/otp', { email }, 409);
  await assert.rejects(otp.consumeOtp('register', email, currentCode), err => err.statusCode === 400);
  await call('/me', null, 200, registered.token, 'GET');

  const passwordResponse = await call('/password/otp', { email }, 202);
  await new Promise(resolve => setImmediate(resolve));
  row = challenges.get(`password:${email}`);
  const passwordCode = codeFor(email);
  assert.equal(row.ready, true);
  const missingResponse = await call('/password/otp', { email: 'missing@example.test' }, 202);
  assert.deepEqual(missingResponse, passwordResponse, 'Password requests must not disclose account existence');
  assert(!mail.some(item => item.to.address === 'missing@example.test'));
  await call('/password/reset', { email: 'missing@example.test', otp: passwordCode, password: 'new-password' }, 400);
  await call('/password/reset', { email, otp: passwordCode, password: 'x' }, 400);
  await call('/password/reset', { email, otp: passwordCode, password: 'é'.repeat(40) }, 400);
  assert.equal(row.consumedAt, null);
  await call('/password/reset', { email, otp: '999999', password: 'new-password' }, 400);
  await call('/password/reset', { email, otp: passwordCode, password: 'new-password' });
  const patient = users.find(user => user.email === email);
  assert.equal(patient.tokenVersion, 1);
  assert(await bcrypt.compare('new-password', patient.password));
  assert(!await bcrypt.compare('test-password', patient.password));
  await call('/me', null, 401, registered.token, 'GET');
  await call('/password/reset', { email, otp: passwordCode, password: 'replay-password' }, 400);
  await call('/login', { email, password: 'test-password' }, 401);
  const loggedIn = (await call('/login', { email: ' PATIENT@EXAMPLE.TEST ', password: 'new-password' })).data;
  assert.equal(jwt.verify(loggedIn.token, env.JWT_SECRET).version, 1);
  await call('/me', null, 200, loggedIn.token, 'GET');
  assert.deepEqual(events.at(-1).changes, { passwordChanged: true });
  assert(!JSON.stringify(events).includes('password"'));

  // Expiry, attempt exhaustion, send limits, and atomic single-use under competing requests.
  await otp.requestRegistrationOtp('expiry@example.test');
  const expiry = challenges.get('register:expiry@example.test');
  expiry.expiresAt = new Date(Date.now() - 1);
  await assert.rejects(otp.consumeOtp('register', 'expiry@example.test', codeFor('expiry@example.test')));
  await otp.requestRegistrationOtp('attempts@example.test');
  for (let n = 0; n < 5; n++) await assert.rejects(otp.consumeOtp('register', 'attempts@example.test', '999999'));
  assert.equal(challenges.get('register:attempts@example.test').attempts, 5);
  await assert.rejects(otp.consumeOtp('register', 'attempts@example.test', codeFor('attempts@example.test')));
  for (let n = 1; n < 5; n++) { age('register', 'attempts@example.test'); await otp.requestRegistrationOtp('attempts@example.test'); }
  age('register', 'attempts@example.test');
  await assert.rejects(otp.requestRegistrationOtp('attempts@example.test'), err => err.statusCode === 429);
  challenges.get('register:attempts@example.test').windowStart = new Date(Date.now() - 3600001);
  await otp.requestRegistrationOtp('attempts@example.test');
  assert.equal(challenges.get('register:attempts@example.test').sendCount, 1);
  const racers = await Promise.allSettled([otp.requestRegistrationOtp('race@example.test'), otp.requestRegistrationOtp('race@example.test')]);
  assert.equal(racers.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(mail.filter(item => item.to.address === 'race@example.test').length, 1);
  const oneUse = await Promise.allSettled([otp.consumeOtp('register', 'race@example.test', codeFor('race@example.test')),
    otp.consumeOtp('register', 'race@example.test', codeFor('race@example.test'))]);
  assert.equal(oneUse.filter(result => result.status === 'fulfilled').length, 1);
  await otp.requestRegistrationOtp('create-failure@example.test');
  userWriteFail = true;
  await assert.rejects(service.register({ ...account, email: 'create-failure@example.test', otp: codeFor('create-failure@example.test') }));
  userWriteFail = false;
  await assert.rejects(otp.consumeOtp('register', 'create-failure@example.test', codeFor('create-failure@example.test')));
  smtpFail = true;
  await assert.rejects(otp.requestRegistrationOtp('smtp-failure@example.test'), err => err.statusCode === 503 && !err.message.includes('PRIVATE_'));
  assert.equal(challenges.get('register:smtp-failure@example.test').codeHash, null);
  age('password', email);
  assert.deepEqual(await otp.requestPasswordOtp(email), passwordResponse.data);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(challenges.get(`password:${email}`).ready, false);
  assert(logs.every(value => !value.includes('PRIVATE_')));
  smtpFail = false;
  env.EMAIL_ENABLED = false;
  await assert.rejects(otp.requestRegistrationOtp('disabled@example.test'), err => err.statusCode === 503);
  env.EMAIL_ENABLED = true;

  // Admin creation stays direct. All active roles can change passwords; inactive accounts cannot.
  const adminToken = jwt.sign({ id: admin._id }, env.JWT_SECRET);
  const staff = (await call('', { ...account, email: 'staff@example.test', role: 'Staff' }, 201, adminToken)).data;
  assert.equal(staff.emailVerifiedAt, null);
  for (const target of [admin, users.find(user => user.email === staff.email)]) {
    await otp.requestPasswordOtp(target.email); await new Promise(resolve => setImmediate(resolve));
    await service.resetPassword({ email: target.email, otp: codeFor(target.email), password: 'changed-clinic-password' });
    assert.equal(target.tokenVersion, 1);
  }
  await call('/me', null, 401, adminToken, 'GET');
  const inactive = await makeUser({ role: 'Doctor', email: 'inactive@example.test', password: 'doctor-password', status: 'Deactivated' });
  await otp.requestPasswordOtp(inactive.email);
  assert(!mail.some(item => item.to.address === inactive.email));
  age('password', email); await otp.requestPasswordOtp(email); await new Promise(resolve => setImmediate(resolve));
  patient.status = 'Deactivated';
  await assert.rejects(service.resetPassword({ email, otp: codeFor(email), password: 'blocked-password' }), err => err.statusCode === 409);
  assert(await bcrypt.compare('new-password', patient.password));
  patient.status = 'Active';
  age('password', email); await otp.requestPasswordOtp(email); await new Promise(resolve => setImmediate(resolve));
  patient.email = 'changed@example.test';
  await assert.rejects(service.resetPassword({ email, otp: codeFor(email), password: 'wrong-address-password' }), err => err.statusCode === 409);
  patient.email = email;
  age('password', email); await otp.requestPasswordOtp(email); await new Promise(resolve => setImmediate(resolve));
  patient.tokenVersion++;
  await assert.rejects(service.resetPassword({ email, otp: codeFor(email), password: 'stale-password' }), err => err.statusCode === 409);
  for (let n = 0; n < 61; n++) {
    const response = await fetch(base + '/register/otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'invalid' }) });
    if (response.status === 429) { assert(Number(response.headers.get('retry-after')) > 0); break; }
    assert.equal(response.status, 400);
    if (n === 60) assert.fail('IP rate limit was not enforced');
  }
  console.log(`Passed ${checks} OTP/auth HTTP checks plus expiry, replay, guessing, cooldown/send limits, races, failure/privacy and session invalidation checks. No real email sent.`);
}
main().catch(err => { process.stderr.write(`${err.stack}\n`); process.exitCode = 1; }).finally(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  for (const [object, key, original] of originals.reverse()) object[key] = original;
  emitter.removeAllListeners();
});
