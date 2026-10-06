// Mock HTTPS only; never authenticates to Google or sends email.
const assert = require('node:assert/strict');
process.env.JWT_SECRET = 'gmail-api-isolated-test-secret-at-least-32';
process.env.EMAIL_ENABLED = 'true';
process.env.EMAIL_TRANSPORT = 'gmail-api';
process.env.SMTP_USER = 'sender@example.test';
process.env.GMAIL_CLIENT_ID = 'fake-client';
process.env.GMAIL_CLIENT_SECRET = 'fake-client-secret';
process.env.GMAIL_REFRESH_TOKEN = 'fake-refresh-token';
const { sendEmail, verifyEmail } = require('../src/services/email.service');
const originalFetch = global.fetch, originalNow = Date.now;
let tokens = 0, sends = 0, status = 200, tokenFails = false, clock = originalNow();
Date.now = () => clock;
global.fetch = async (url, options) => {
  assert(options.signal);
  if (url === 'https://oauth2.googleapis.com/token') {
    tokens++;
    assert.equal(options.body.get('grant_type'), 'refresh_token');
    assert.equal(options.body.get('refresh_token'), process.env.GMAIL_REFRESH_TOKEN);
    return new Response(JSON.stringify(tokenFails ? { error: 'PRIVATE_TOKEN_ERROR' } : {
      access_token: 'fake-access-token', expires_in: 3600, scope: 'https://www.googleapis.com/auth/gmail.send',
    }), { status: tokenFails ? 400 : 200 });
  }
  assert.equal(url, 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send');
  assert.equal(options.headers.Authorization, 'Bearer fake-access-token');
  const mime = Buffer.from(JSON.parse(options.body).raw, 'base64url').toString();
  const [headers, body] = mime.split('\r\n\r\n');
  assert(headers.includes('From: CareSync <sender@example.test>'));
  assert(!headers.includes('\r\nBcc:'), 'Subject text must never inject a header');
  assert(Buffer.from(body.replace(/\r\n/g, ''), 'base64').toString().includes('Unicode: kumusta ✓'));
  sends++;
  return new Response(JSON.stringify(status === 200 ? { id: `message-${sends}` } : { error: 'PRIVATE_PROVIDER_ERROR' }), { status });
};
async function main() {
  assert((await Promise.all([verifyEmail(), verifyEmail()])).every(Boolean)); assert.equal(sends, 0);
  const email = { to: 'patient@example.test', title: 'Update\r\nBcc: attacker@example.test', message: 'Unicode: kumusta ✓' };
  await Promise.all([sendEmail(email), sendEmail(email)]);
  assert.equal(tokens, 1, 'Concurrent messages reuse a cached access token');
  status = 429;
  await assert.rejects(sendEmail(email), error => error.code === 'GMAIL_RATE_LIMITED' && !error.message.includes('PRIVATE'));
  status = 401;
  await assert.rejects(sendEmail(email), error => error.code === 'GMAIL_SEND_FAILED');
  status = 200;
  await sendEmail(email); assert.equal(tokens, 2, 'A rejected token is refreshed for the next attempt');
  clock += 3600000; tokenFails = true;
  await assert.rejects(verifyEmail(), error => error.code === 'GMAIL_AUTH_FAILED' && !error.message.includes('PRIVATE'));
  await assert.rejects(sendEmail({ ...email, to: 'a@example.test\r\nBcc: evil@example.test' }), error => error.code === 'RECIPIENT_REJECTED');
  console.log('Passed Gmail HTTPS authentication, caching, MIME safety, rejection, expiry and failure checks. No live email sent.');
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { global.fetch = originalFetch; Date.now = originalNow; });
