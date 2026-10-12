// SC02b: after hours are saved, a new date fills with slots matching the saved 09:00-12:00, 30-minute window.
const { launch, pageAs, shot } = require('./browser');

(async () => {
  const browser = await launch();
  const page = await pageAs(browser, 'evidence.doctor@example.test');
  await page.getByRole('button', { name: 'My Slots' }).click();
  await page.locator('input[type=date]').first().fill('2026-10-14');
  await page.getByRole('button', { name: 'Auto-Fill Day' }).click();
  await page.getByText('11:30 - 12:00').waitFor();
  await page.waitForTimeout(1000);
  await shot(page, 'SC02b-generated-slots-available-oct14', { fullPage: true });
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
