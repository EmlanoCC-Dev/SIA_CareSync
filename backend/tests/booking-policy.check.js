const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const { isValidPassword, PASSWORD_REQUIREMENTS } = require('../src/utils/password');
const { validateContactNumber } = require('../src/utils/contactNumber');
const { oneMonthAhead, ACTIVE_APPOINTMENT_STATUSES } = require('../src/utils/booking');
const Appointment = require('../src/models/Appointment');

async function main() {
  const frontendPassword = await import(pathToFileURL(path.resolve(__dirname, '../../frontend/src/utils/password.js')));
  const frontendDates = await import(pathToFileURL(path.resolve(__dirname, '../../frontend/src/utils/dates.js')));
  const passwords = [
    ['Abcde1!x', true], ['A1!aaaaa', true], ['A1!' + 'a'.repeat(69), true],
    ['Abc1!xy', false], ['abcdef1!', false], ['Abcdefg!', false], ['Abcdefg1', false],
    ['Abcdef1é', false], ['Abcdef1 ', false], ['A1!' + 'a'.repeat(70), false],
    ['Ab1!' + 'é'.repeat(35), false], [null, false], [12345678, false],
  ];
  for (const [password, expected] of passwords) {
    assert.equal(isValidPassword(password), expected);
    assert.equal(frontendPassword.isValidPassword(password), expected);
  }
  assert.equal(frontendPassword.PASSWORD_REQUIREMENTS, PASSWORD_REQUIREMENTS);
  for (const [date, expected] of [['2026-10-15', '2026-11-15'], ['2026-01-31', '2026-02-28'],
    ['2028-01-31', '2028-02-29'], ['2026-12-31', '2027-01-31']]) {
    assert.equal(oneMonthAhead(date), expected);
    assert.equal(frontendDates.oneMonthAhead(date), expected);
  }
  assert.equal(validateContactNumber(undefined), '');
  assert.equal(validateContactNumber(' +63 917-123-4567 '), '+63 917-123-4567');
  for (const invalid of ['123', '+1234567890123456', 'call me', 9171234567, '0917<script>']) {
    assert.throws(() => validateContactNumber(invalid), error => error.statusCode === 400);
  }
  const indexes = Appointment.schema.indexes();
  assert(indexes.some(([fields, options]) => fields.patient === 1 && options.unique &&
    options.partialFilterExpression?.status?.$in === ACTIVE_APPOINTMENT_STATUSES));
  assert(indexes.some(([fields, options]) => fields.followUpOf === 1 && options.unique && options.sparse));
  console.log('Password, contact number, booking-window boundaries, and database uniqueness policies passed.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
