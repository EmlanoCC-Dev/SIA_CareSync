// SC08: patient and assigned doctor exchange comments; each participant's own inbox shows its own unread state.
const { launch, pageAs, shot, shotDialog } = require('./browser');

async function comment(page, text) {
  await page.getByRole('button', { name: 'History & comments' }).first().click();
  await page.locator('#appointment-comment-message').waitFor();
  await page.waitForTimeout(800);
  await page.fill('#appointment-comment-message', text);
  await page.getByRole('button', { name: 'Post comment' }).click();
  await page.getByText(text).first().waitFor();
  await page.getByRole('button', { name: 'Close', exact: true }).last().click();
}

async function inbox(page, name) {
  await page.reload();
  await page.locator('.notification-trigger').click();
  await page.locator('.notification-list').waitFor();
  await shotDialog(page, name);
  await page.getByRole('button', { name: 'Close notifications' }).click();
}

(async () => {
  const browser = await launch();
  const patient = await pageAs(browser, 'evidence.patient@example.test');
  const doctor = await pageAs(browser, 'evidence.doctor@example.test');
  await patient.getByText('Dr. Ben Santos').first().waitFor();
  await comment(patient, 'Should I continue the paracetamol tomorrow if the headache returns?');
  await inbox(doctor, 'SC08a-doctor-inbox-unread-patient-comment');
  await doctor.getByText('Pia Evidence-Patient').first().waitFor();
  await comment(doctor, 'Yes, as needed up to the label limit. Please return if you develop a fever.');
  await inbox(patient, 'SC08b-patient-inbox-unread-doctor-reply');

  await patient.getByRole('button', { name: 'History & comments' }).first().click();
  await patient.getByText('Please return if you develop a fever.').waitFor();
  await shotDialog(patient, 'SC08c-patient-comment-thread-participants');
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
