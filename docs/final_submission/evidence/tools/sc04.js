// SC04: staff approves; the patient's own inbox shows the update, its email-delivery status, then a manual read receipt.
const { launch, pageAs, shot, shotDialog } = require('./browser');

(async () => {
  const browser = await launch();
  const staff = await pageAs(browser, 'evidence.staff@example.test');
  const approve = staff.getByRole('button', { name: 'Approve', exact: true }).first();
  await staff.locator('table').first().waitFor();
  if (await approve.count()) { // rerun-safe: skip when already approved
    await approve.click();
    await staff.getByRole('button', { name: 'Approve appointment' }).click();
  }
  await staff.locator('.badge-Confirmed').first().waitFor();
  await staff.waitForTimeout(800);
  await shot(staff, 'SC04a-staff-approved-confirmed');

  const patient = await pageAs(browser, 'evidence.patient@example.test');
  await patient.locator('.notification-trigger').click();
  await patient.locator('.notification-list').waitFor();
  await shotDialog(patient, 'SC04b-patient-inbox-unread-email-status');
  await patient.locator('.notification-list li.is-unread').first().getByRole('button', { name: 'Mark as read' }).click();
  await patient.waitForTimeout(1200);
  await shotDialog(patient, 'SC04c-patient-inbox-marked-read');
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
