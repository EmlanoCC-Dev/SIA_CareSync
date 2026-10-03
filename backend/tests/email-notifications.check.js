// Run: node backend/tests/email-notifications.check.js
// Isolated SMTP/model doubles: never contacts Gmail or sends real email.
const assert = require('node:assert/strict');
process.env.JWT_SECRET = 'isolated-email-check-secret-at-least-32-characters';
process.env.EMAIL_ENABLED = 'true';
process.env.SMTP_USER = 'sender@example.com';
process.env.SMTP_APP_PASSWORD = 'fake app password';
const nodemailer = require('nodemailer');
const Notification = require('../src/models/Notification');
const User = require('../src/models/User');
const env = require('../src/config/env');
const { sendNotification } = require('../src/services/notification.service');
const { verifyEmail } = require('../src/services/email.service');
const emitter = require('../src/events/emitter');
const EVENTS = require('../src/events/events');
const { registerAllHandlers } = require('../src/events/handlers/notification.handler');

const id = n => n.toString(16).padStart(24, '0');
const users = ['Patient', 'Doctor', 'Staff', 'Admin'].map((role, n) => ({
  _id: id(n + 1), role, email: `${role.toLowerCase()}@example.com`, status: 'Active',
}));
const rows = [], mail = [], logs = [], originals = [];
const stub = (object, key, fn) => { originals.push([object, key, object[key]]); object[key] = fn; };
let smtpFailure, rejectRecipient = false, lookupFailure = false, saveFailure = false, statusFailure = false;
let lookups = 0, transports = 0, verifications = 0;
const query = value => ({ select() { return this; }, lean() { return this; },
  then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } });

async function main() {
  stub(nodemailer, 'createTransport', options => {
    transports++;
    assert.equal(options.host, 'smtp.gmail.com');
    assert.equal(options.port, 465);
    assert.equal(options.secure, true);
    assert.deepEqual(options.auth, { user: env.SMTP_USER, pass: 'fakeapppassword' });
    assert(options.connectionTimeout <= 15000 && options.socketTimeout <= 20000);
    assert.equal(options.disableFileAccess, true);
    assert.equal(options.disableUrlAccess, true);
    assert.notEqual(options.tls?.rejectUnauthorized, false);
    return {
      async sendMail(data) {
        mail.push(data);
        if (smtpFailure) throw smtpFailure;
        return { accepted: rejectRecipient ? [] : [data.to.address], messageId: `<mail-${mail.length}@example.com>` };
      },
      async verify() { verifications++; return true; },
    };
  });
  stub(console, 'error', value => logs.push(value));
  stub(User, 'findById', key => {
    lookups++;
    if (lookupFailure) throw new Error('PRIVATE_LOOKUP_ERROR');
    return query(users.find(user => user._id === String(key)) || null);
  });
  stub(User, 'find', () => query(users.filter(user => ['Staff', 'Admin'].includes(user.role))));
  stub(Notification, 'create', async data => {
    if (saveFailure) throw new Error('Injected inbox failure');
    const row = { _id: id(100 + rows.length), ...data };
    rows.push(row);
    return row;
  });
  stub(Notification, 'updateOne', async (filter, update) => {
    if (statusFailure) throw new Error('PRIVATE_STATUS_ERROR');
    Object.assign(rows.find(row => row._id === filter._id), update.$set);
    return { matchedCount: 1 };
  });
  const send = userId => sendNotification({ userId, appointment: id(50), type: 'BOOKING_CONFIRMED', title: 'Appointment confirmed', message: 'Your appointment is confirmed.' });

  assert.equal(await send(null), undefined);
  assert.equal(rows.length, 0);
  env.EMAIL_ENABLED = false;
  const disabled = await send(users[0]._id);
  assert.equal(disabled.emailDelivery.status, 'disabled');
  assert.equal(lookups, 0);
  assert.equal(transports, 0);
  await assert.rejects(verifyEmail, { code: 'EMAIL_DISABLED' });
  env.EMAIL_ENABLED = true;

  const sent = await send(users[0]._id);
  assert.equal(sent.emailDelivery.status, 'sent');
  assert(sent.emailDelivery.sentAt instanceof Date);
  assert(sent.emailDelivery.attemptedAt instanceof Date);
  assert(sent.emailDelivery.messageId);
  assert.deepEqual(mail[0].from, { name: 'CareSync', address: env.SMTP_USER });
  assert.deepEqual(mail[0].to, { address: users[0].email });
  assert.equal(mail[0].subject, 'CareSync: Appointment confirmed');
  assert(mail[0].text.includes('Your appointment is confirmed.'));
  assert.equal(mail[0].html, undefined);
  assert.equal(mail[0].attachments, undefined);

  for (const [email, status, code] of [
    ['bad-email', 'Active', 'INVALID_EMAIL'],
    ['one@example.com,two@example.com', 'Active', 'INVALID_EMAIL'],
    ['one@example.com\r\nBcc: other@example.com', 'Active', 'INVALID_EMAIL'],
    ['patient@example.com', 'Deactivated', 'ACCOUNT_DEACTIVATED'],
  ]) {
    Object.assign(users[0], { email, status });
    const skipped = await send(users[0]._id);
    assert.equal(skipped.emailDelivery.status, 'skipped');
    assert.equal(skipped.emailDelivery.errorCode, code);
  }
  const missing = await send(id(999));
  assert.equal(missing.emailDelivery.errorCode, 'USER_MISSING');
  assert.equal(mail.length, 1, 'Missing/inactive/invalid recipients never reach SMTP');
  Object.assign(users[0], { email: 'patient@example.com', status: 'Active' });

  smtpFailure = Object.assign(new Error('PRIVATE_CREDENTIAL in SMTP response'), { code: 'EAUTH' });
  const failed = await send(users[0]._id);
  assert.equal(failed.emailDelivery.status, 'failed');
  assert.equal(failed.emailDelivery.errorCode, 'EAUTH');
  assert.equal(failed.emailDelivery.sentAt, null);
  assert(rows.includes(failed), 'SMTP failure preserves the inbox entry');
  smtpFailure.code = 'PRIVATE_CREDENTIAL\r\n';
  assert.equal((await send(users[0]._id)).emailDelivery.errorCode, 'EMAIL_FAILED');
  smtpFailure = null;
  rejectRecipient = true;
  assert.equal((await send(users[0]._id)).emailDelivery.errorCode, 'RECIPIENT_REJECTED');
  rejectRecipient = false;
  lookupFailure = true;
  assert.equal((await send(users[0]._id)).emailDelivery.status, 'failed');
  lookupFailure = false;

  const before = mail.length;
  statusFailure = true;
  const pending = await send(users[0]._id);
  assert.equal(pending.emailDelivery.status, 'pending', 'Unrecorded success stays pending, not falsely failed');
  assert.equal(mail.length, before + 1, 'Delivery-log failure must not resend');
  statusFailure = false;
  saveFailure = true;
  await assert.rejects(send(users[0]._id), /Injected inbox failure/);
  assert.equal(mail.length, before + 1, 'Failed inbox persistence must not send an unrecorded email');
  saveFailure = false;
  assert(logs.every(value => !value.includes('PRIVATE_') && !value.includes('fakeapppassword')));
  assert(!JSON.stringify(rows).includes('PRIVATE_'));
  assert.equal(await verifyEmail(), true);
  assert.equal(verifications, 1);
  assert.equal(transports, 1, 'Reuse the Gmail transport');

  // The inbox still receives every event; SMTP sends only four patient appointment outcomes.
  registerAllHandlers();
  const emit = (event, payload) => Promise.all(emitter.listeners(event).map(listener => listener(payload)));
  const appointment = { _id: id(50), patient: users[0]._id, doctor: users[1]._id,
    date: new Date('2026-10-03'), timeSlot: '10:00-10:15', reason: 'PRIVATE_MEDICAL_REASON', consultationNotes: 'PRIVATE_NOTES' };
  let offset = mail.length;
  await emit(EVENTS.APPOINTMENT_BOOKED, { appointment });
  assert.equal(mail.length, offset, 'Booking receipts and clinic review requests remain in-app');
  assert.deepEqual(rows.slice(-4).map(item => item.user).sort(), users.map(user => user._id).sort());
  await emit(EVENTS.APPOINTMENT_APPROVED, { appointment });
  await emit(EVENTS.APPOINTMENT_DECLINED, { appointment, reason: 'PRIVATE_DECLINE_REASON' });
  await emit(EVENTS.APPOINTMENT_CANCELLED, { appointment });
  await emit(EVENTS.APPOINTMENT_NO_SHOW, { appointment });
  await emit(EVENTS.APPOINTMENT_COMPLETED, { appointment });
  assert.deepEqual(mail.slice(offset).map(item => item.to.address), Array(4).fill(users[0].email));
  assert(rows.some(row => row.type === 'APPOINTMENT_COMPLETED' && row.emailDelivery.errorCode === 'IN_APP_ONLY'));
  offset = mail.length;
  await emit(EVENTS.COMMENT_ADDED, { appointment, performedBy: users[0]._id, message: 'PRIVATE_COMMENT' });
  assert.equal(mail.length, offset, 'Comments remain in-app');
  await emit(EVENTS.REVISION_REQUESTED, { appointment, performedBy: users[2]._id });
  await emit(EVENTS.APPOINTMENT_RESUBMITTED, { appointment, performedBy: users[0]._id });
  assert.equal(mail.length, offset, 'Correction requests and resubmissions remain in-app');
  assert(rows.some(row => row.type === 'CORRECTION_REQUESTED' && row.emailDelivery.errorCode === 'IN_APP_ONLY'));
  assert(rows.some(row => row.type === 'APPOINTMENT_RESUBMITTED' && row.emailDelivery.errorCode === 'IN_APP_ONLY'));
  offset = mail.length;
  await emit(EVENTS.WALKIN_SLOT_ASSIGNED, { appointment: { ...appointment, patient: null },
    walkIn: { queueNumber: 7, name: 'PRIVATE_WALKIN_NAME' }, slot: { doctor: users[1]._id, startTime: '10:00', endTime: '10:15' } });
  assert.equal(mail.length, offset, 'Doctor queue activity remains in-app');
  for (const type of ['BOOKING_CONFIRMED', 'APPOINTMENT_DECLINED', 'CANCELLATION', 'APPOINTMENT_NO_SHOW']) {
    for (const user of users.slice(1)) {
      const row = await sendNotification({ userId: user._id, type, title: 'Outcome', message: 'Outcome' });
      assert.equal(row.emailDelivery.errorCode, 'IN_APP_ONLY', 'Clinic roles never receive appointment emails');
    }
  }
  assert.equal(mail.length, offset);
  assert(!JSON.stringify(mail).includes('PRIVATE_'), 'No clinical notes, reasons, comments, or walk-in identities in email');
  console.log('Passed Gmail transport, notification routing, status logging, privacy, and failure checks. No real email sent.');
}
main().catch(err => { process.stderr.write(`${err.stack}\n`); process.exitCode = 1; }).finally(() => {
  for (const [object, key, original] of originals.reverse()) object[key] = original;
  emitter.removeAllListeners();
});
