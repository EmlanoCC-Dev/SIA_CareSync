const nodemailer = require('nodemailer');
const env = require('../config/env');

let transport;
let accessToken = '', expiresAt = 0, tokenRequest;
const emailFailure = code => Object.assign(new Error('Email delivery is unavailable'), { code });

async function getAccessToken() {
  if (!env.EMAIL_ENABLED) throw emailFailure('EMAIL_DISABLED');
  if (accessToken && Date.now() < expiresAt) return accessToken;
  if (!tokenRequest) {
    tokenRequest = (async () => {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST', signal: AbortSignal.timeout(15000),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: env.GMAIL_CLIENT_ID, client_secret: env.GMAIL_CLIENT_SECRET,
          refresh_token: env.GMAIL_REFRESH_TOKEN, grant_type: 'refresh_token' }),
      });
      const data = await response.json();
      if (!response.ok || !data.access_token || !Number.isFinite(data.expires_in) || data.expires_in <= 0) throw emailFailure('GMAIL_AUTH_FAILED');
      if (data.scope && !data.scope.split(' ').some(scope => ['https://www.googleapis.com/auth/gmail.send', 'https://mail.google.com/'].includes(scope))) {
        throw emailFailure('GMAIL_SCOPE_MISSING');
      }
      accessToken = data.access_token;
      expiresAt = Date.now() + Math.max(0, data.expires_in - 60) * 1000;
      return accessToken;
    })().catch(() => { throw emailFailure('GMAIL_AUTH_FAILED'); }).finally(() => { tokenRequest = null; });
  }
  return tokenRequest;
}

function getTransport() {
  if (!env.EMAIL_ENABLED) throw Object.assign(new Error('Email is disabled'), { code: 'EMAIL_DISABLED' });
  transport ||= nodemailer.createTransport({
    host: 'smtp.gmail.com', port: 465, secure: true,
    auth: { user: env.SMTP_USER, pass: env.SMTP_APP_PASSWORD },
    dnsTimeout: 15000, connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 20000,
    disableFileAccess: true, disableUrlAccess: true,
  });
  return transport;
}

async function sendEmail({ to, title, message }) {
  if (typeof to !== 'string' || !/^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(to)) throw emailFailure('RECIPIENT_REJECTED');
  if (env.EMAIL_TRANSPORT === 'gmail-api') {
    const token = await getAccessToken();
    // Encode headers and body so user text cannot become MIME headers.
    const body = Buffer.from(`${message}\n\nThis is an automated CareSync email.`).toString('base64').match(/.{1,76}/g).join('\r\n');
    const mime = [`From: CareSync <${env.SMTP_USER}>`, `To: <${to}>`,
      `Subject: =?UTF-8?B?${Buffer.from(`CareSync: ${title}`).toString('base64')}?=`,
      'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', body].join('\r\n');
    let response, data;
    try {
      response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST', signal: AbortSignal.timeout(15000),
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw: Buffer.from(mime).toString('base64url') }),
      });
      data = await response.json();
    } catch { throw emailFailure('GMAIL_SEND_FAILED'); }
    if (!response.ok || typeof data.id !== 'string' || !data.id) {
      if (response.status === 401) { accessToken = ''; expiresAt = 0; }
      throw emailFailure(response.status === 429 ? 'GMAIL_RATE_LIMITED' : 'GMAIL_SEND_FAILED');
    }
    return data.id;
  }
  const result = await getTransport().sendMail({
    from: { name: 'CareSync', address: env.SMTP_USER },
    to: { address: to }, subject: `CareSync: ${title}`,
    text: `${message}\n\nThis is an automated CareSync email.`,
  });
  if (!result.accepted?.some(address => address.toLowerCase() === to.toLowerCase())) {
    throw Object.assign(new Error('SMTP did not accept the recipient'), { code: 'RECIPIENT_REJECTED' });
  }
  return result.messageId;
}

module.exports = { sendEmail, verifyEmail: async () => env.EMAIL_TRANSPORT === 'gmail-api' ? Boolean(await getAccessToken()) : getTransport().verify() };
