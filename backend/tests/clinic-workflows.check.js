// Run: node backend/tests/clinic-workflows.check.js
// Uses isolated model doubles, real services/routes/JWT middleware, and no database.
const assert = require('node:assert/strict');
const express = require('express');
process.env.NODE_ENV = 'production';
process.env.JWT_SECRET = 'isolated-workflow-check-secret-for-tests';
const jwt = require('jsonwebtoken');
const User = require('../src/models/User');
const Slot = require('../src/models/Slot');
const Appointment = require('../src/models/Appointment');
const SlotPlan = require('../src/models/SlotPlan');
const AssignmentRecovery = require('../src/models/AssignmentRecovery');
const recovery = require('../src/services/assignmentRecovery.service');
const userService = require('../src/services/user.service');
const slotService = require('../src/services/slot.service');
const appointmentService = require('../src/services/appointment.service');
const reportService = require('../src/services/report.service');
const emitter = require('../src/events/emitter');
const EVENTS = require('../src/events/events');
const { setCustomTime } = require('../src/config/systemTime');
const { parseDateOnly } = require('../src/utils/timeHelper');

const ids = { doctor: '000000000000000000000001', staff: '000000000000000000000002',
  patient: '000000000000000000000003', other: '000000000000000000000004',
  slot: '000000000000000000000005', appointment: '000000000000000000000006' };
const doctor = { _id: ids.doctor, id: ids.doctor, role: 'Doctor', workingHours: [], consultationDuration: 15, save: async () => {} };
const staff = { _id: ids.staff, id: ids.staff, role: 'Staff' };
const patient = { _id: ids.patient, id: ids.patient, role: 'Patient' };
const users = new Map([[ids.doctor, doctor], [ids.staff, staff], [ids.patient, patient]]);
const slots = new Map();
const appointments = new Map();
const plans = new Map();
const original = [];
const stub = (model, method, fn) => { original.push([model, method, model[method]]); model[method] = fn; };
const query = data => ({ populate() { return this; }, sort() { return this; }, then(resolve, reject) { return Promise.resolve(data).then(resolve, reject); } });
const error = code => err => err.statusCode === code;
const events = [];
const listeners = [EVENTS.APPOINTMENT_ASSIGNED, EVENTS.SCHEDULE_UPDATED, EVENTS.SLOT_STATUS_UPDATED].map(name => {
  const listener = data => events.push({ name, data });
  emitter.on(name, listener);
  return [name, listener];
});

async function main() {
  setCustomTime('2026-10-01T08:00:00');
  stub(recovery, 'begin', async values => ({ _id: 'isolated-operation', ...values }));
  stub(recovery, 'finish', async () => {});
  stub(AssignmentRecovery, 'updateOne', async () => {});
  stub(SlotPlan, 'updateOne', async (filter, update) => {
    if (!plans.has(filter._id)) plans.set(filter._id, { _id: filter._id, ...update.$setOnInsert });
  });
  stub(SlotPlan, 'findById', async key => plans.get(key));
  stub(SlotPlan, 'findOneAndUpdate', async (filter, update) => {
    const plan = plans.get(filter._id);
    if (plan.revision !== filter.revision) return null;
    plan.revision++;
    plan.slots.push(...update.$push.slots.$each);
    return plan;
  });
  stub(User, 'findById', id => Promise.resolve(users.get(String(id)) || null));
  stub(Slot, 'find', filters => query([...slots.values()].filter(slot => String(slot.doctor) === String(filters.doctor) && +slot.date === +filters.date)));
  stub(Slot, 'findById', id => query(slots.get(String(id)) || null));
  stub(Slot, 'bulkWrite', async operations => {
    for (const { updateOne } of operations) {
      const record = updateOne.update.$setOnInsert;
      const same = [...slots.values()].some(slot => slot.startTime === record.startTime && +slot.date === +record.date && slot.doctor === record.doctor);
      if (!same) { const id = String(slots.size + 100); slots.set(id, { _id: id, ...record }); }
    }
  });
  stub(Slot, 'findOneAndUpdate', async (filter, update) => {
    const slot = slots.get(String(filter._id));
    if (!slot || slot.status !== filter.status || slot.appointment !== filter.appointment) return null;
    Object.assign(slot, update.$set);
    return { ...slot };
  });
  stub(Slot, 'updateOne', async (filter, update) => {
    const slot = slots.get(String(filter._id));
    if ((filter.status?.$in?.includes(slot?.status) || slot?.status === filter.status) && slot.appointment === filter.appointment) Object.assign(slot, update.$set);
  });
  stub(Appointment, 'findById', async id => appointments.get(String(id)) || null);
  stub(Appointment, 'findOneAndUpdate', async (filter, update) => {
    const appointment = appointments.get(String(filter._id));
    if (!appointment || appointment.status !== filter.status || appointment.slot !== filter.slot) return null;
    Object.assign(appointment, update.$set);
    appointment.statusHistory.push(update.$push.statusHistory);
    return appointment;
  });

  assert.throws(() => parseDateOnly('2026-02-30'), error(400));
  assert.throws(() => parseDateOnly('2026-10-01T00:00:00Z'), error(400));
  const schedule = { consultationDuration: 30, workingHours: [{ day: 4, start: '09:00', end: '10:00' }] };
  await userService.updateSchedule(ids.doctor, staff, schedule);
  assert.equal(doctor.scheduleConfigured, true);
  assert.equal(doctor.workingHours[0].day, 4);
  await assert.rejects(userService.updateSchedule(ids.doctor, { ...doctor, _id: ids.other }, schedule), error(403));
  await assert.rejects(userService.updateSchedule(ids.doctor, staff, { ...schedule, consultationDuration: 0 }), error(400));
  await assert.rejects(userService.updateSchedule(ids.doctor, staff, { ...schedule, workingHours: [schedule.workingHours[0], schedule.workingHours[0]] }), error(400));
  await assert.rejects(userService.updateSchedule(ids.doctor, staff, { ...schedule, workingHours: [{ day: 4, start: '25:00', end: '26:00' }] }), error(400));
  await assert.rejects(userService.updateSchedule(ids.doctor, staff, { ...schedule, workingHours: [{ day: 4, start: '10:00', end: '09:00' }] }), error(400));
  const generated = await slotService.generateSlotsForDoctor(ids.doctor, '2026-10-01');
  assert.equal(generated.length, 2);
  assert.deepEqual(generated.map(slot => slot.startTime), ['09:00', '09:30']);
  await slotService.generateSlotsForDoctor(ids.doctor, '2026-10-01');
  assert.equal(slots.size, 2, 'Generation must be idempotent');
  assert.equal((await slotService.generateSlotsForDoctor(ids.doctor, '2026-10-02')).length, 0, 'Unlisted days are off');
  await userService.updateSchedule(ids.doctor, doctor, { consultationDuration: 30, workingHours: [] });
  assert.equal((await slotService.generateSlotsForDoctor(ids.doctor, '2026-10-03')).length, 0, 'All days off must not restore defaults');
  assert.equal(slots.size, 2, 'Saving hours must preserve existing dated slots');
  await assert.rejects(slotService.generateSlotsForDoctor(ids.doctor, '2026-10-01', -15, '09:00', '10:00'), error(400));
  await assert.rejects(slotService.generateSlotsForDoctor(ids.doctor, '2026-10-01', 15, '09:00', '10:00'), error(409));
  await assert.rejects(slotService.generateSlotsForDoctor(ids.doctor, '2026-10-01', 15, 'invalid', '10:00'), error(400));

  const slot = { _id: ids.slot, doctor: ids.doctor, date: parseDateOnly('2026-10-01'), startTime: '11:00', endTime: '11:30', status: 'Available', appointment: null, save: async () => {} };
  slots.set(ids.slot, slot);
  await slotService.updateStatus(ids.slot, 'Cancelled', doctor);
  assert.equal(slot.status, 'Cancelled');
  await assert.rejects(slotService.reserveSlot(ids.slot, ids.appointment), error(409));
  await slotService.updateStatus(ids.slot, 'Available', staff);
  await assert.rejects(slotService.updateStatus(ids.slot, 'Cancelled', { ...doctor, _id: ids.other }), error(403));
  await assert.rejects(slotService.updateStatus(ids.slot, 'Completed', staff), error(400));
  slot.appointment = ids.appointment;
  await assert.rejects(slotService.updateStatus(ids.slot, 'Cancelled', staff), error(409));
  slot.appointment = null;

  const appointment = { _id: ids.appointment, status: 'Pending', slot: null, doctor: null, walkIn: null, date: parseDateOnly('2026-10-01'), statusHistory: [], save: async () => {} };
  appointments.set(ids.appointment, appointment);
  await assert.rejects(appointmentService.approve(ids.appointment, ids.staff), error(400));
  const assigned = await appointmentService.assignSlot(ids.appointment, ids.slot, ids.staff);
  assert.equal(assigned.doctor, ids.doctor);
  assert.equal(assigned.slot, ids.slot);
  assert.equal(assigned.status, 'Pending');
  assert.equal(slot.status, 'Reserved-Tentative');
  assert.equal(assigned.statusHistory[0].changedBy, ids.staff);
  await assert.rejects(appointmentService.assignSlot(ids.appointment, ids.slot, ids.staff), error(409));
  await appointmentService.approve(ids.appointment, ids.staff);
  assert.equal(appointment.status, 'Confirmed');
  assert.equal(slot.status, 'Reserved-Confirmed');
  const second = { ...appointment, _id: ids.other, status: 'Pending', slot: null, statusHistory: [] };
  appointments.set(ids.other, second);
  await assert.rejects(appointmentService.assignSlot(ids.other, ids.slot, ids.staff), error(409));
  slot.status = 'Available'; slot.appointment = null;
  second.date = parseDateOnly('2026-10-02');
  await assert.rejects(appointmentService.assignSlot(ids.other, ids.slot, ids.staff), error(400));
  second.date = parseDateOnly('2026-10-01');
  const update = Appointment.findOneAndUpdate;
  Appointment.findOneAndUpdate = async () => null;
  await assert.rejects(appointmentService.assignSlot(ids.other, ids.slot, ids.staff), error(409));
  assert.equal(slot.status, 'Available', 'Losing an appointment claim must release the reserved slot');
  assert.equal(slot.appointment, null);
  Appointment.findOneAndUpdate = update;
  setCustomTime('2026-10-01T12:00:00');
  await assert.rejects(slotService.updateStatus(ids.slot, 'Cancelled', staff), error(400));
  await assert.rejects(appointmentService.assignSlot(ids.other, ids.slot, ids.staff), error(400));
  setCustomTime('2026-10-01T08:00:00');

  let lastMatch;
  stub(Appointment, 'aggregate', async pipeline => {
    lastMatch = pipeline[0].$match;
    assert(pipeline[1].$facet.daily && pipeline[1].$facet.doctors);
    return [{ statuses: [{ _id: 'Completed', count: 2 }, { _id: 'Pending', count: 1 }], daily: [], doctors: [] }];
  });
  const report = await reportService.getReport({ from: '2026-10-01', to: '2026-10-31' }, staff);
  assert.equal(report.total, 3);
  assert.equal(report.statuses['No-show'], 0);
  assert.equal(lastMatch.date.$gte.toISOString(), '2026-10-01T00:00:00.000Z');
  assert.equal(lastMatch.date.$lt.toISOString(), '2026-11-01T00:00:00.000Z');
  assert.equal(lastMatch.doctor, undefined);
  await reportService.getReport({ from: '2026-10-01', to: '2026-10-01', doctorId: ids.other }, doctor);
  assert.equal(String(lastMatch.doctor), ids.doctor, 'Doctors cannot expand report scope using query parameters');
  await reportService.getReport({ from: '2026-10-01', to: '2026-10-01', doctorId: ids.doctor }, staff);
  assert.equal(String(lastMatch.doctor), ids.doctor);
  await assert.rejects(reportService.getReport({ from: '2026-10-02', to: '2026-10-01' }, staff), error(400));
  await assert.rejects(reportService.getReport({ from: '2026-02-30', to: '2026-10-01' }, staff), error(400));
  await assert.rejects(reportService.getReport({ from: '2026-10-01', to: '2026-10-01', doctorId: 'invalid' }, staff), error(400));
  await assert.rejects(reportService.getReport({ from: '2026-10-01', to: '2026-10-01' }, patient), error(403));

  const app = express();
  app.use(express.json());
  app.use('/api', require('../src/routes'));
  app.use(require('../src/middleware/errorHandler').errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const call = async (route, actor, method = 'GET', body) => fetch(`http://127.0.0.1:${server.address().port}/api${route}`, {
    method, headers: { 'Content-Type': 'application/json', ...(actor ? { Authorization: `Bearer ${jwt.sign({ id: actor.id }, process.env.JWT_SECRET)}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  try {
    assert.equal((await call('/reports?from=2026-10-01&to=2026-10-31')).status, 401);
    assert.equal((await call('/reports?from=2026-10-01&to=2026-10-31', patient)).status, 403);
    assert.equal((await call('/reports?from=2026-10-01&to=2026-10-31', staff)).status, 200);
    assert.equal((await call(`/users/${ids.doctor}/schedule`, patient, 'PATCH', schedule)).status, 403);
    assert.equal((await call(`/users/${ids.other}/schedule`, doctor)).status, 403);
    assert.equal((await call(`/users/${ids.doctor}/schedule`, staff, 'PATCH', schedule)).status, 200);
    assert.equal((await call(`/slots/${ids.slot}/status`, patient, 'PATCH', { status: 'Cancelled' })).status, 403);
    assert.equal((await call(`/slots/${ids.slot}/status`, staff, 'PATCH', { status: 'Cancelled' })).status, 200);
    assert.equal((await call(`/appointments/${ids.other}/assign`, patient, 'PATCH', { slotId: ids.slot })).status, 403);
    await slotService.updateStatus(ids.slot, 'Available', staff);
    assert.equal((await call(`/appointments/${ids.other}/assign`, staff, 'PATCH', { slotId: ids.slot })).status, 200);
  } finally { await new Promise(resolve => server.close(resolve)); }
  assert(events.some(entry => entry.name === EVENTS.APPOINTMENT_ASSIGNED));
  assert(events.some(entry => entry.name === EVENTS.SCHEDULE_UPDATED && entry.data.performedBy === ids.staff));
  assert(events.some(entry => entry.name === EVENTS.SLOT_STATUS_UPDATED));
  console.log('Passed: schedule validation/generation, block/reopen guards, assignment/conflict rollback, report boundaries/scope, and authenticated HTTP routes.');
}

main().catch(err => { console.error(err); process.exitCode = 1; }).finally(() => {
  for (const [model, method, fn] of original.reverse()) model[method] = fn;
  for (const [name, listener] of listeners) emitter.off(name, listener);
  setCustomTime(null);
});
