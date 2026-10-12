// SC02: Doctor saves weekly hours, then fills the simulated day with generated slots.
const { launch, pageAs, shot } = require('./browser');

(async () => {
  const browser = await launch();
  const page = await pageAs(browser, 'evidence.doctor@example.test');
  await page.getByRole('button', { name: 'My Slots' }).click();
  await page.getByRole('button', { name: 'Weekly hours', exact: true }).click();
  await page.getByRole('button', { name: 'Save weekly hours' }).waitFor();
  for (const day of ['Sunday', 'Saturday']) await page.getByLabel(day, { exact: true }).uncheck();
  for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']) {
    await page.getByLabel(`${day} start`).fill('09:00');
    await page.getByLabel(`${day} end`).fill('12:00');
  }
  await page.getByLabel('Consultation length (minutes)').fill('30');
  await page.getByRole('button', { name: 'Save weekly hours' }).click();
  await page.getByText('Weekly hours saved').waitFor();
  await shot(page, 'SC02a-doctor-weekly-hours-saved', { fullPage: true });
  await page.getByRole('button', { name: 'Weekly hours', exact: true }).click();
  await page.getByRole('button', { name: 'Auto-Fill Day' }).click();
  await page.getByText('09:00', { exact: false }).first().waitFor();
  await page.waitForTimeout(1500);
  await shot(page, 'SC02b-generated-slots-available', { fullPage: true });
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
