const nodemailer = require('nodemailer');
const env = require('../config/env');

let transport;
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

module.exports = { sendEmail, verifyEmail: async () => getTransport().verify() };
