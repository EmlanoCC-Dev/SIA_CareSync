// SC06 + SC07: doctor starts the consultation (separate from arrival), saves two note versions,
// uploads and replaces a synthetic document, downloads an older version, then completes.
const { APP, launch, pageAs, shot, shotDialog } = require('./browser');

const file = (name, text) => ({ name, mimeType: 'text/plain', buffer: Buffer.from(text) });

(async () => {
  const browser = await launch();
  const doctor = await pageAs(browser, 'evidence.doctor@example.test');
  await doctor.getByText('Pia Evidence-Patient').first().waitFor();
  await doctor.getByRole('button', { name: 'Start consultation' }).first().click();
  const modal = doctor.locator('dialog[open]');
  await doctor.locator('#consultation-notes').waitFor();
  await doctor.getByRole('button', { name: 'Close', exact: true }).click();
  await doctor.locator('.badge-In-Progress').first().waitFor();
  await shot(doctor, 'SC06a-doctor-consultation-started-in-progress');

  await doctor.getByRole('button', { name: 'Notes', exact: true }).first().click();
  await doctor.fill('#consultation-notes', 'Tension-type headache suspected. Advised hydration and rest.');
  await doctor.getByRole('button', { name: 'Save Notes' }).click();
  await doctor.getByText('Consultation notes saved successfully!').waitFor();
  await doctor.fill('#consultation-notes', 'Tension-type headache. Advised hydration, rest and paracetamol as needed; return if fever develops.');
  await doctor.getByRole('button', { name: 'Save Notes' }).click();
  await doctor.waitForTimeout(1200);

  await modal.locator('input[type=file]').setInputFiles(file('synthetic-lab-result.txt', 'SYNTHETIC lab result v1: CBC within normal limits.'));
  await doctor.getByRole('button', { name: 'Upload & Attach' }).click();
  await doctor.getByRole('button', { name: 'Replace', exact: true }).first().waitFor();
  await doctor.getByRole('button', { name: 'Replace', exact: true }).first().click();
  await modal.locator('input[type=file]').setInputFiles(file('synthetic-lab-result-v2.txt', 'SYNTHETIC lab result v2: CBC within normal limits; corrected units.'));
  await doctor.getByRole('button', { name: 'Upload replacement' }).click();
  await doctor.waitForTimeout(1500);
  await doctor.getByRole('button', { name: 'Refresh history' }).click();
  await doctor.waitForTimeout(1000);
  for (const summary of await modal.locator('.record-versions details summary').all()) await summary.click();
  await shotDialog(doctor, 'SC07a-notes-and-document-versions');

  const [download] = await Promise.all([doctor.waitForEvent('download'),
    doctor.getByRole('button', { name: 'Download version 1' }).click()]);
  const content = await (await download.createReadStream()).toArray();
  console.log('authorized v1 download:', download.suggestedFilename(), Buffer.concat(content).toString());

  // Protected: the same historical URL opened in a fresh browser with no login.
  const ids = await doctor.evaluate(async () => {
    const token = localStorage.getItem('caresync_token');
    const list = await (await fetch('/api/appointments', { headers: { Authorization: `Bearer ${token}` } })).json();
    const appointment = list.data.find(item => item.documents?.length);
    return { appointment: appointment._id, document: appointment.documents[0]._id };
  });
  const anonymous = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await anonymous.goto(`${APP}/api/appointments/${ids.appointment}/documents/${ids.document}/versions/1/download`);
  await shot(anonymous, 'SC07b-historical-download-denied-without-login');

  await doctor.getByRole('button', { name: 'Complete Consultation' }).click();
  await doctor.getByRole('button', { name: 'Complete consultation', exact: true }).click();
  await doctor.locator('.badge-Completed').first().waitFor();
  await doctor.getByRole('button', { name: 'History & comments' }).first().click();
  await doctor.locator('.timeline').waitFor();
  await shotDialog(doctor, 'SC06b-completed-separate-start-and-complete-history');
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
