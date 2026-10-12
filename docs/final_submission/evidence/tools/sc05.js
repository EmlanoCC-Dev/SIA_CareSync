// SC05: private staff check-in of the scheduled patient, a walk-in added to the same queue, and the public ticket-only display.
const { APP, launch, pageAs, shot } = require('./browser');

(async () => {
  const browser = await launch();
  const staff = await pageAs(browser, 'evidence.staff@example.test');
  await staff.getByText('Pia Evidence-Patient').first().waitFor();
  const checkIn = staff.getByRole('button', { name: 'Check In', exact: true });
  if (await checkIn.count()) await checkIn.first().click(); // rerun-safe
  await staff.locator('.badge-Checked-In').first().waitFor();
  await staff.waitForTimeout(800);
  await shot(staff, 'SC05a-staff-private-scheduled-check-in');

  await staff.getByRole('button', { name: 'Walk-in Queue' }).click();
  await staff.getByRole('button', { name: 'Add Walk-In' }).click();
  await staff.fill('#walkin-name', 'Walt Walk-in');
  await staff.fill('#walkin-email', 'evidence.walkin@example.test');
  await staff.getByRole('button', { name: 'Add to Queue' }).click();
  await staff.getByText('Walt Walk-in').first().waitFor();
  await staff.waitForTimeout(1000);
  await shot(staff, 'SC05b-staff-combined-queue-with-walk-in', { fullPage: true });

  const display = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await display.goto(`${APP}/#/display`);
  await display.waitForTimeout(3000);
  await shot(display, 'SC05c-public-display-ticket-only');
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
