// SC10: Admin edits and deactivates a patient account; the record stays listed and its sign-in is refused.
const { launch, pageAs, shot, shotDialog } = require('./browser');

(async () => {
  const browser = await launch();
  const admin = await pageAs(browser, 'evidence.admin@example.test');
  await admin.getByRole('button', { name: 'User Directory' }).click();
  await admin.getByRole('button', { name: 'Edit Quinn Other-Patient' }).click();
  await admin.fill('#account-contact', '09170000000');
  await admin.selectOption('#account-status', 'Deactivated');
  await shotDialog(admin, 'SC10a-admin-edit-and-deactivate-form');
  await admin.getByRole('button', { name: 'Save changes' }).click();
  await admin.locator('dialog[open]').waitFor({ state: 'detached' }).catch(() => {});
  await admin.getByText('Deactivated').first().waitFor();
  await admin.waitForTimeout(800);
  await shot(admin, 'SC10b-deactivated-account-retained-in-directory', { fullPage: true });

  const login = await pageAs(browser);
  await login.getByRole('button', { name: 'Log In' }).first().click();
  await login.fill('#login-email', 'evidence.patient2@example.test');
  await login.fill('#login-password', process.env.EVIDENCE_PASSWORD);
  await login.locator('form').getByRole('button', { name: 'Sign in' }).click();
  await login.getByRole('alert').waitFor();
  await login.fill('#login-password', '');
  await shot(login, 'SC10c-deactivated-sign-in-blocked');
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
