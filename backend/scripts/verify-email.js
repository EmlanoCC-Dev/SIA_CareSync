// Authenticate to Gmail without sending email or connecting to MongoDB.
// Run: node backend/scripts/verify-email.js
const { verifyEmail } = require('../src/services/email.service');
verifyEmail().then(() => console.log('Gmail SMTP connection and authentication verified. No email sent.'))
  .catch(err => {
    const code = /^[A-Z_]{1,40}$/.test(err.code || '') ? err.code : 'SMTP_VERIFY_FAILED';
    console.error(`Gmail SMTP verification failed (${code}). Check credentials and network access.`);
    process.exitCode = 1;
  });
