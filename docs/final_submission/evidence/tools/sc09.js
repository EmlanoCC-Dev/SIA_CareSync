// SC09: date-range reports for Admin (all doctors) and Doctor (own scope only), plus the Admin audit trail.
const { launch, pageAs, shot } = require('./browser');

async function report(page, name) {
  await page.getByRole('button', { name: 'Reports' }).click();
  await page.locator('input[name=from]').fill('2026-10-12');
  await page.locator('input[name=to]').fill('2026-10-14');
  await page.getByRole('button', { name: 'Apply period' }).click();
  await page.getByText('Doctor workload').waitFor();
  await page.waitForTimeout(800);
  await shot(page, name, { fullPage: true });
}

(async () => {
  const browser = await launch();
  const admin = await pageAs(browser, 'evidence.admin@example.test');
  await report(admin, 'SC09a-admin-report-date-range-all-doctors');
  await report(await pageAs(browser, 'evidence.doctor@example.test'), 'SC09b-doctor-report-own-scope');
  await admin.getByRole('button', { name: 'Activity & audit trail' }).click();
  await admin.getByText('Performed By').waitFor();
  await admin.waitForTimeout(1500);
  await shot(admin, 'SC09c-admin-audit-trail-actor-target', { fullPage: true });
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
