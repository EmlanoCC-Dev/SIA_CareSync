// SC03: patient books, staff requests a correction, patient resubmits; history keeps the same visit ID.
const { launch, pageAs, shot, shotDialog } = require('./browser');

const original = 'Headache for two days.';
const corrected = 'Headache for two days; took paracetamol 500 mg once; no fever.';
const explanation = 'Please add how long the symptom has lasted and any medicine already taken.';

async function openDetails(page, button) {
  await page.getByRole('button', { name: button }).first().click();
  await page.locator('#booking-corrections-title').waitFor();
}

(async () => {
  const browser = await launch();
  const patient = await pageAs(browser, 'evidence.patient@example.test');
  await patient.getByRole('button', { name: 'Book New Appointment' }).click();
  const booking = patient.locator('dialog.booking-dialog');
  await booking.locator('select').first().selectOption({ label: 'Dr. Ben Santos' });
  await booking.locator('input[type=date]').fill('2026-10-13');
  await booking.getByRole('button', { name: /^10:00 - 10:30/ }).click();
  await booking.locator('textarea').fill(original);
  await booking.getByRole('button', { name: 'Confirm Appointment' }).click();
  await patient.getByText(original).first().waitFor();

  const staff = await pageAs(browser, 'evidence.staff@example.test');
  await openDetails(staff, 'Request correction');
  await staff.fill('#booking-correction-text', explanation);
  await staff.getByRole('button', { name: 'Request correction' }).last().click();
  await staff.getByText('Correction requested. The patient').waitFor();

  await patient.reload();
  await openDetails(patient, 'Edit & resubmit');
  await shot(patient.locator('dialog[open]'), 'SC03a-patient-sees-correction-request');
  await patient.fill('#booking-correction-text', corrected);
  await patient.getByRole('button', { name: 'Resubmit for review' }).click();
  await patient.getByText('Changes resubmitted for clinic review.').waitFor();

  await staff.reload();
  await staff.getByRole('button', { name: 'History & comments' }).first().click();
  await staff.locator('#booking-corrections-title').waitFor();
  await staff.locator('.booking-history summary').click();
  await shotDialog(staff, 'SC03b-staff-correction-history-after-resubmit');
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
