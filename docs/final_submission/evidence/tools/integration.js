// Appendix B integration evidence: drives one booking through the real local API with synthetic users and
// records each sanitized request/response plus the audit and notification records it produced.
const fs = require('node:fs');
const path = require('node:path');
const { call, login, sanitize, db, mongoose } = require('./lib');

const out = path.resolve(__dirname, '../integration');
fs.mkdirSync(out, { recursive: true });
const emails = { patient: 'evidence.patient@example.test', staff: 'evidence.staff@example.test',
  doctor: 'evidence.doctor@example.test', admin: 'evidence.admin@example.test' };

(async () => {
  const tokens = {};
  for (const [role, email] of Object.entries(emails)) tokens[role] = await login(email);
  const database = await db();
  const steps = [];
  let appointmentId;

  async function step(id, actor, method, url, body, form) {
    const seen = async name => new Set((await database.collection(name).find({}, { projection: { _id: 1 } }).toArray()).map(doc => String(doc._id)));
    const before = { auditlogs: await seen('auditlogs'), notifications: await seen('notifications') };
    const added = async name => (await database.collection(name).find().sort({ _id: 1 }).toArray()).filter(doc => !before[name].has(String(doc._id)));
    const result = await call(method, url, { token: tokens[actor], body, form });
    await new Promise(resolve => setTimeout(resolve, 400)); // event handlers write audit/notification records asynchronously
    const created = result.body?.data?._id && method === 'POST' && url === '/appointments' ? result.body.data._id : appointmentId;
    const target = created && new mongoose.Types.ObjectId(created);
    const audit = await added('auditlogs');
    const notifications = await added('notifications');
    const appointment = target && await database.collection('appointments').findOne({ _id: target },
      { projection: { status: 1, bookingRevision: 1, queueNumber: 1, 'documents.filename': 1, 'documents.version': 1 } });
    const record = { id, actor: `${actor} (${emails[actor]})`, request: { method, url: `/api${url}`, body: form ? '[multipart: file=synthetic-referral.txt, type=general]' : body ?? null },
      response: { status: result.status, body: sanitize(result.body) },
      appointmentAfter: appointment || null,
      auditRecords: audit.map(({ action, targetModel, targetId, performedBy, timestamp }) => ({ action, targetModel, targetId, performedBy, timestamp })),
      notificationRecords: notifications.map(({ user, type, title, emailDelivery, readAt, createdAt }) => ({ user, type, title, emailDelivery, readAt, createdAt })) };
    fs.writeFileSync(path.join(out, `${id}.json`), JSON.stringify(record, null, 2));
    steps.push({ id, status: result.status, audit: record.auditRecords.map(a => a.action), notifications: record.notificationRecords.map(n => n.title), appointmentStatus: appointment?.status });
    console.log(id, result.status, appointment?.status || '', record.auditRecords.map(a => a.action).join(','));
    if (result.status >= 300) throw new Error(`${id} failed: ${JSON.stringify(result.body)}`);
    return result.body.data;
  }

  const doctor = (await call('GET', '/users/doctors', { token: tokens.patient })).body.data.find(item => item.lastName === 'Santos'); // the public doctor list omits emails
  const slots = (await call('GET', `/slots?doctor=${doctor._id}&date=2026-10-13`, { token: tokens.patient })).body.data;
  const slot = slots.find(item => item.status === 'Available' && item.startTime >= '11:00');
  const booked = await step('IE01-book', 'patient', 'POST', '/appointments',
    { doctorId: doctor._id, date: '2026-10-13', slotId: slot._id, reason: 'Integration run: follow-up for headache.' });
  appointmentId = booked._id;
  const revision = async () => (await database.collection('appointments').findOne({ _id: new mongoose.Types.ObjectId(appointmentId) })).bookingRevision || 0;
  await step('IE02-request-correction', 'staff', 'PATCH', `/appointments/${appointmentId}/request-correction`,
    { explanation: 'Please state when the headache started.', bookingRevision: await revision() });
  await step('IE03-resubmit', 'patient', 'PATCH', `/appointments/${appointmentId}/resubmit`,
    { reason: 'Integration run: follow-up for headache that started 12 Oct.', bookingRevision: await revision() });
  await step('IE04-approve', 'staff', 'PATCH', `/appointments/${appointmentId}/approve`);
  await step('IE05-check-in', 'staff', 'PATCH', `/appointments/${appointmentId}/check-in`);
  await step('IE06-start', 'doctor', 'PATCH', `/appointments/${appointmentId}/start`);
  const form = new FormData();
  form.append('type', 'general');
  form.append('file', new Blob(['SYNTHETIC referral note for the integration run.'], { type: 'text/plain' }), 'synthetic-referral.txt');
  await step('IE07-document-upload', 'doctor', 'POST', `/appointments/${appointmentId}/upload`, undefined, form);
  await step('IE08-complete', 'doctor', 'PATCH', `/appointments/${appointmentId}/complete`);
  await step('IE09-reports', 'admin', 'GET', '/reports?from=2026-10-13&to=2026-10-13');
  fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify({ date: new Date().toISOString(), appointmentId, steps }, null, 2));
  await mongoose.disconnect();
})().catch(async error => { console.error(error.message); await mongoose.disconnect(); process.exit(1); });
