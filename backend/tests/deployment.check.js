// Isolated HTTP/configuration checks. No live database, files, or email.
const assert = require('node:assert/strict');
process.env.NODE_ENV = 'production';
process.env.JWT_SECRET = 'deployment-isolated-test-secret-at-least-32';
process.env.EMAIL_ENABLED = 'false';
process.env.UPLOAD_STORAGE = 'local';
process.env.CORS_ORIGINS = 'https://care.example.test';
process.env.TRUST_PROXY = '1';
process.env.TZ = 'Asia/Manila';
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../src/models/User');
const app = require('../server');
const { isClinicOpen } = require('../src/config/systemTime');
const admin = { _id: '000000000000000000000001', role: 'Admin', status: 'Active' };
let userLookupFails = false;
User.findById = async () => { if (userLookupFails) throw new Error('PRIVATE_LOOKUP_FAILURE'); return admin; };
User.findOne = () => { throw new Error('PRIVATE_DATABASE_ERROR'); };
let server;

async function main() {
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let checks = 0;
  const expect = async (route, status, options = {}) => {
    const response = await fetch(base + route, options);
    assert.equal(response.status, status, route); checks++; return response;
  };
  await expect('/health', 503);
  Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });
  await expect('/health', 200); delete mongoose.connection.readyState;
  const response = await expect('/api/system/time', 200, { headers: { Origin: process.env.CORS_ORIGINS } });
  assert.equal(response.headers.get('access-control-allow-origin'), process.env.CORS_ORIGINS);
  await expect('/api/system/time', 403, { headers: { Origin: 'https://other.example.test' } });
  const preflight = await expect('/api/users/me', 204, { method: 'OPTIONS', headers: {
    Origin: process.env.CORS_ORIGINS, 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'authorization,content-type',
  } });
  assert.match(preflight.headers.get('access-control-allow-headers'), /authorization/);
  const post = body => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
  const invalid = await expect('/api/users/login', 400, post('{'));
  assert.match((await invalid.json()).message, /valid JSON/);
  await expect('/api/users/login', 413, post(JSON.stringify({ value: 'x'.repeat(110000) })));
  const failed = await expect('/api/users/login', 500, post(JSON.stringify({ email: 'test@example.test', password: 'password' })));
  const error = await failed.json();
  assert(!JSON.stringify(error).includes('PRIVATE_DATABASE_ERROR')); assert(!error.stack);
  const authorization = `Bearer ${jwt.sign({ id: admin._id }, process.env.JWT_SECRET)}`;
  for (const query of ['page=-1', 'page=1.5', 'page=2abc', 'limit=-5', 'limit=201', 'page=9007199254740991&limit=200']) {
    await expect(`/api/audit-logs?${query}`, 400, { headers: { Authorization: authorization } });
  }
  userLookupFails = true;
  await expect('/api/users/me', 500, { headers: { Authorization: authorization } });
  userLookupFails = false;
  for (let i = 0; i < 60; i++) await expect('/api/users/login', 400, {
    ...post('{}'), headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '198.51.100.10' },
  });
  const limited = await expect('/api/users/login', 429, {
    ...post('{}'), headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '198.51.100.10' },
  });
  assert(Number(limited.headers.get('retry-after')) > 0);
  await expect('/api/users/login', 400, { ...post('{}'), headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '198.51.100.11' } });
  assert(isClinicOpen(new Date('2026-10-06T00:30:00Z'))); // 08:30 in Manila.
  assert(!isClinicOpen(new Date('2026-10-06T09:01:00Z'))); // 17:01 in Manila.
  console.log(`Passed ${checks} deployment HTTP checks plus Philippine clinic-hour boundaries.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server?.close());
