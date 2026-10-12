// SC01: patient signup with email disabled, harness-delivered OTP, then the role-correct dashboard.
const { launch, pageAs, shot } = require('./browser');
const { injectOtp, mongoose } = require('./lib');

const patient = { first: 'Pia', last: 'Evidence-Patient', email: 'evidence.patient@example.test' };

(async () => {
  const browser = await launch();
  const page = await pageAs(browser);
  await page.getByRole('button', { name: 'Sign Up' }).click();
  await page.fill('#register-name', patient.first);
  await page.fill('#register-last-name', patient.last);
  await page.fill('#register-email', patient.email);
  await page.fill('#register-password', process.env.EVIDENCE_PASSWORD);
  // Real server outcome with EMAIL_ENABLED=false.
  await page.getByRole('button', { name: 'Send verification code' }).click();
  await page.getByRole('alert').waitFor();
  await page.fill('#register-password', '');
  await shot(page, 'SC01a-signup-otp-unavailable-email-disabled');
  await page.fill('#register-password', process.env.EVIDENCE_PASSWORD);

  // Stand in for the mailer only: store the challenge server-side, then answer the send request.
  let code;
  await page.route('**/api/users/register/otp', async route => {
    code = await injectOtp('register', patient.email);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true,
      data: { message: 'Verification code sent. Check your email.', expiresInSeconds: 600, resendAfterSeconds: 60 } }) });
  });
  await page.getByRole('button', { name: 'Send verification code' }).click();
  await page.locator('#register-otp').waitFor();
  await shot(page, 'SC01b-signup-verify-email-step');
  await page.fill('#register-otp', code);
  await page.getByRole('button', { name: 'Verify & create account' }).click(); // real /users/register consumes the OTP
  await page.locator('.role-badge').waitFor();
  await page.waitForTimeout(1500);
  await shot(page, 'SC01c-patient-dashboard-role');
  await browser.close();
  await mongoose.disconnect();
})().catch(async error => { console.error(error); process.exit(1); });
