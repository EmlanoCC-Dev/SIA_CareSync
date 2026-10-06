// Authenticate to Gmail without sending email or connecting to MongoDB.
// Run: node backend/scripts/verify-email.js
const { verifyEmail } = require('../src/services/email.service');
const { EMAIL_TRANSPORT } = require('../src/config/env');
verifyEmail().then(() => console.log(`Gmail ${EMAIL_TRANSPORT} authentication verified. No email sent.`))
  .catch(err => {
    const code = /^[A-Z_]{1,40}$/.test(err.code || '') ? err.code : 'EMAIL_VERIFY_FAILED';
    console.error(`Gmail ${EMAIL_TRANSPORT} verification failed (${code}). Check credentials and network access.`);
    process.exitCode = 1;
  });
