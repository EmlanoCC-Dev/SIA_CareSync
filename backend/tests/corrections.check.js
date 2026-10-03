// Run: node backend/tests/corrections.check.js. Real routes/services/events, isolated models; no MongoDB or SMTP.
const assert = require('node:assert/strict');
process.env.NODE_ENV = 'production';
process.env.EMAIL_ENABLED = 'false';
process.env.JWT_SECRET = 'isolated-corrections-check-secret-for-tests';
const jwt = require('jsonwebtoken');
const User = require('../src/models/User');
const Appointment = require('../src/models/Appointment');
const Slot = require('../src/models/Slot');
const Notification = require('../src/models/Notification');
const AuditLog = require('../src/models/AuditLog');
const service = require('../src/services/appointment.service');
const emitter = require('../src/events/emitter');
const { registerAllHandlers } = require('../src/events/handlers/notification.handler');
const { registerAuditHandlers } = require('../src/events/handlers/auditLog.handler');
const { setCustomTime } = require('../src/config/systemTime');
const app = require('../server');
const id = n => n.toString(16).padStart(24, '0');
const users = ['Patient', 'Patient', 'Doctor', 'Doctor', 'Staff', 'Admin', 'Staff'].map((role, index) => ({
  _id: id(index + 1), role, firstName: `User${index + 1}`, lastName: 'Test', status: index === 6 ? 'Deactivated' : 'Active',
}));
const [patient, otherPatient, doctor, otherDoctor, staff, admin, inactive] = users;
const slot = { _id: id(10), appointment: id(20), doctor: doctor._id, date: new Date('2026-10-06'),
  startTime: '09:00', endTime: '09:15', status: 'Reserved-Tentative' };
let visit, server, checks = 0, failWrite = false, beforeUpdate, loseSlotAcknowledgement = false;
const audits = [], notifications = [], originals = [];
const reset = () => {
  visit = { _id: id(20), patient: patient._id, doctor: doctor._id, slot: slot._id, walkIn: null, date: slot.date,
    timeSlot: '09:00-09:15', status: 'Pending', reason: 'PRIVATE original reason', consultationNotes: 'PRIVATE clinic notes',
    documents: [{ filename: 'PRIVATE result', url: '/uploads/test.txt' }], statusHistory: [], bookingHistory: [] }; // Legacy: no revision.
  slot.status = 'Reserved-Tentative'; slot.appointment = visit._id;
  notifications.length = 0; audits.length = 0;
};
const query = value => ({ select() { return this; }, populate() { return this; }, then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } });
const stub = (model, method, fn) => { originals.push([model, method, model[method]]); model[method] = fn; };
function matches(row, filter) {
  return row && Object.entries(filter).every(([key, value]) => {
    if (value?.$in) return value.$in.some(candidate => (row[key] ?? null) === candidate);
    if (value instanceof Date) return +new Date(row[key]) === +value;
    return (row[key] ?? null) === (value ?? null);
  });
}
function update(row, values) {
  Object.assign(row, values.$set);
  for (const [key, entry] of Object.entries(values.$push || {})) (row[key] ||= []).push(entry);
  for (const key of Object.keys(values.$pop || {})) row[key].pop();
  return structuredClone(row);
}
async function main() {
  reset(); setCustomTime('2026-10-04T08:00:00');
  stub(User, 'findById', key => query(users.find(user => user._id === String(key)) || null));
  stub(User, 'find', () => query([staff, admin]));
  stub(Appointment, 'findById', key => query(key === visit._id ? structuredClone(visit) : null));
  stub(Appointment, 'find', filter => query(filter.status.$in.includes(visit.status) ? [{ ...structuredClone(visit), slot: structuredClone(slot) }] : []));
  stub(Appointment, 'findOneAndUpdate', async (filter, values, options) => {
    if (failWrite) throw new Error('Injected database write failure');
    if (beforeUpdate) { const callback = beforeUpdate; beforeUpdate = null; await callback(); }
    if (!matches(visit, filter)) return null;
    assert(options.new);
    if (values.$push?.bookingHistory) {
      assert.equal(new Appointment({ ...visit, ...values.$set, bookingHistory: [...visit.bookingHistory, values.$push.bookingHistory] }).validateSync(), undefined);
    }
    return update(visit, values);
  });
  stub(Slot, 'findById', key => query(key === slot._id ? structuredClone(slot) : null));
  stub(Slot, 'findOneAndUpdate', async (filter, values) => {
    if (!matches(slot, filter)) return null;
    const result = update(slot, values);
    if (loseSlotAcknowledgement) { loseSlotAcknowledgement = false; throw new Error('Injected committed-slot acknowledgement failure'); }
    return result;
  });
  stub(Notification, 'create', async data => { notifications.push(data); return data; });
  stub(AuditLog, 'create', async data => { audits.push(data); return data; });
  registerAllHandlers(); registerAuditHandlers();
  server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  async function call(actor, suffix, body, expected = 200, appointmentId = visit._id) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/appointments/${appointmentId}/${suffix}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', ...(actor && { Authorization: `Bearer ${jwt.sign({ id: actor._id }, process.env.JWT_SECRET)}` }) },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    assert((Array.isArray(expected) ? expected : [expected]).includes(response.status), `${actor?.role || 'public'} ${suffix}: expected ${expected}, got ${response.status}: ${JSON.stringify(result)}`);
    await new Promise(resolve => setImmediate(resolve)); checks++;
    return { ...result, httpStatus: response.status };
  }
  const request = { explanation: 'PRIVATE Please clarify symptoms', bookingRevision: 0 };
  const resubmit = { reason: 'PRIVATE Revised symptoms', bookingRevision: 1 };
  for (const suffix of ['request-correction', 'resubmit']) {
    await call(null, suffix, request, 401);
    for (const actor of [otherPatient, otherDoctor]) await call(actor, suffix, request, 403);
    await call(inactive, suffix, request, 401);
    await call(staff, suffix, request, 400, 'invalid');
    await call(staff, suffix, request, 404, id(999));
  }
  for (const actor of [patient, doctor]) await call(actor, 'request-correction', request, 403);
  for (const actor of [staff, admin, doctor]) await call(actor, 'resubmit', resubmit, 403);
  for (const explanation of [null, 42, {}, [], '', '  ', 'x'.repeat(2001)]) await call(staff, 'request-correction', { ...request, explanation }, 400);
  for (const bookingRevision of [undefined, -1, 0.5, '0']) await call(staff, 'request-correction', { ...request, bookingRevision }, 400);
  await call(staff, 'request-correction', { ...request, doctor: otherDoctor._id }, 400);
  const original = structuredClone(visit);
  await call(staff, 'request-correction', request);
  assert.equal(visit.status, 'Needs correction'); assert.equal(visit.bookingRevision, 1);
  assert.equal(slot.status, 'Reserved-Tentative');
  assert.equal(visit.reason, original.reason);
  assert.deepEqual(visit.bookingHistory[0], { revision: 1, action: 'Correction requested', previousReason: original.reason,
    reason: original.reason, explanation: request.explanation, changedBy: staff._id, changedAt: new Date('2026-10-04T08:00:00'), actorName: 'User5 Test', actorRole: 'Staff' });
  assert.equal(audits[0].action, 'REVISION_REQUESTED'); assert.equal(audits[0].performedBy, staff._id);
  assert.deepEqual(notifications.map(row => row.user), [patient._id]);
  await call(admin, 'request-correction', request, 409);
  await call(staff, 'approve', {}, 400); await call(doctor, 'decline', { reason: 'Declined' }, 400);
  await call(patient, 'resubmit', { ...resubmit, reason: original.reason }, 400);
  for (const reason of [null, {}, '', ' ', 'x'.repeat(2001)]) await call(patient, 'resubmit', { ...resubmit, reason }, 400);
  for (const field of ['doctor', 'date', 'slot', 'consultationNotes', 'documents', 'status', 'changedBy']) {
    await call(patient, 'resubmit', { ...resubmit, [field]: 'forged' }, 400);
  }
  slot.appointment = id(99); await call(patient, 'resubmit', resubmit, 409); slot.appointment = visit._id;
  slot.status = 'Available'; await call(patient, 'resubmit', resubmit, 409); slot.status = 'Reserved-Tentative';
  setCustomTime('2026-10-06T09:00:00'); await call(patient, 'resubmit', resubmit, 409);
  setCustomTime('2026-10-04T08:00:00');
  failWrite = true; await call(patient, 'resubmit', resubmit, 500); failWrite = false;
  assert.equal(visit.bookingRevision, 1); assert.equal(visit.bookingHistory.length, 1); assert.equal(audits.length, 1);
  notifications.length = 0;
  const responses = await Promise.all([call(patient, 'resubmit', resubmit, [200, 409]), call(patient, 'resubmit', resubmit, [200, 409])]);
  assert.deepEqual(responses.map(response => response.httpStatus).sort(), [200, 409]);
  assert.equal(visit.status, 'Pending'); assert.equal(visit.bookingRevision, 2);
  assert.equal(visit.bookingHistory[1].previousReason, original.reason); assert.equal(visit.reason, resubmit.reason);
  for (const field of ['patient', 'doctor', 'slot', 'date', 'timeSlot', 'consultationNotes', 'documents']) assert.deepEqual(visit[field], original[field]);
  assert.equal(audits.at(-1).action, 'APPOINTMENT_RESUBMITTED'); assert.equal(audits.at(-1).performedBy, patient._id);
  assert.deepEqual(notifications.map(row => row.user).sort(), [doctor, staff, admin].map(actor => actor._id).sort());
  assert(!JSON.stringify(audits).includes('PRIVATE')); assert(!JSON.stringify(notifications).includes('PRIVATE'));
  await call(patient, 'resubmit', resubmit, 409);
  await call(admin, 'request-correction', { ...request, bookingRevision: 2 });
  await call(patient, 'resubmit', { reason: 'Another corrected reason', bookingRevision: 3 });
  assert.equal(visit.bookingHistory.length, 4); assert.equal(visit.bookingHistory[0].reason, original.reason);
  await call(staff, 'approve', {}); assert.equal(slot.status, 'Reserved-Confirmed');
  await call(admin, 'request-correction', { ...request, bookingRevision: 4 }, 409);
  // Approval read before a full correction/resubmission cycle must not review the newer reason.
  reset(); beforeUpdate = async () => {
    await service.requestCorrection(visit._id, staff, request);
    await service.resubmit(visit._id, patient, resubmit);
  };
  await assert.rejects(service.approve(visit._id, staff._id), err => err.statusCode === 409);
  assert.equal(visit.status, 'Pending'); assert.equal(slot.status, 'Reserved-Tentative');
  reset(); beforeUpdate = () => service.requestCorrection(visit._id, staff, request);
  await assert.rejects(service.decline(visit._id, doctor._id, 'Declined'), err => err.statusCode === 409);
  assert.equal(visit.status, 'Needs correction'); assert.equal(slot.appointment, visit._id);
  // A foreign reservation cannot be confirmed; failed approval restores Pending.
  reset(); slot.appointment = id(99);
  await call(staff, 'approve', {}, 409); assert.equal(visit.status, 'Pending'); assert.equal(slot.status, 'Reserved-Tentative');
  reset(); loseSlotAcknowledgement = true;
  await call(staff, 'approve', {}, 500);
  assert.equal(visit.status, 'Confirmed'); assert.equal(slot.status, 'Reserved-Confirmed');
  assert.equal(visit.statusHistory.at(-1).status, 'Confirmed', 'An unknown slot-write outcome must not erase committed approval history');
  reset(); visit.slot = null; visit.doctor = null; visit.timeSlot = undefined;
  await call(admin, 'request-correction', request); await call(patient, 'resubmit', resubmit);
  assert.equal(visit.doctor, null); assert.equal(visit.slot, null);
  reset(); visit.walkIn = id(88); await call(staff, 'request-correction', request, 409);
  reset(); await call(staff, 'request-correction', request);
  const savedHistory = structuredClone(visit.bookingHistory);
  await call(patient, 'cancel', { reason: 'Cancelled while correcting' });
  assert.equal(slot.status, 'Available'); assert.deepEqual(visit.bookingHistory, savedHistory);
  reset(); await call(staff, 'request-correction', request);
  setCustomTime('2026-10-06T09:16:00');
  await service.autoMarkNoShows(); assert.equal(visit.status, 'No-show'); assert.equal(slot.status, 'No-show');
  assert.equal(visit.bookingHistory.length, 1);
  console.log(`Passed ${checks} correction HTTP checks, history/audit/notification attribution, concurrency, reservation and expiry checks.`);
}
main().catch(err => { console.error(err); process.exitCode = 1; }).finally(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  for (const [model, method, original] of originals.reverse()) model[method] = original;
  emitter.removeAllListeners(); setCustomTime(null);
});
