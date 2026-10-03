# Live verification results

Verified October 4, 2026 (Asia/Manila), under the user's request to test email, signup, password changes, and stored delivery results.

## Automated checks

All thirteen backend check scripts passed: accounts/no-show, API access, audit coverage, clinic workflows, comments, concurrency, corrections, email notifications, notifications, OTP, scheduled queue, versions, and walk-in status. These checks exercise actual routes/services with isolated database/SMTP doubles; they do not send email. API access covered 124 HTTP cases and all 43 private routes; OTP covered 30 HTTP cases plus expiry, replay, limits, concurrency, failure, and session checks.

The real MongoDB concurrency check also passed:

```powershell
node backend/tests/concurrency.check.js --live
```

It verified unique walk-in tickets, competing assignments/bookings, date-scoped automation, and non-overlapping slot generation in a uniquely named temporary database. Cleanup completed successfully. The test does not register email handlers and did not alter application records. Its original database name exceeded this cluster's reported 38-byte limit; the harness now uses a shorter unique `cs_test_` name with a matching cleanup guard.

## Live service and stored-state checks

```powershell
node backend/scripts/verify-email.js
node backend/scripts/verify-live-state.js
```

Gmail SMTP connection/authentication and local backend health passed. The read-only MongoDB check disabled automatic collection/index creation and returned aggregate metadata only:

| Stored evidence at verification time | Result |
| --- | --- |
| Email-verified Patient accounts | 1 |
| Password-change audit records | 1 |
| Retained registration OTP challenges | 1, consumed |
| Retained password OTP challenges | 1, consumed |
| Notification delivery marked sent | 1, with a sent timestamp |
| Notification delivery marked skipped | 5 |

These are database-wide counts, not a correlation of records to a particular user or appointment. OTP records are temporary, so later counts can change after TTL cleanup. A stored `sent` result means SMTP acceptance, not confirmed inbox delivery.

Restricted network attempts could not finish; permitted runs outside the sandbox succeeded. Neither verification utility sent email or changed records. No addresses, passwords, OTP codes/hashes, connection strings, or raw provider errors were included in the report.

## User-confirmed results

The user reported receiving working email codes in the account and password flows, then confirmed that the new password signs in and the old password is rejected. This provides manual receipt and password-change evidence; the agent did not independently access the recipient inbox. The exact reported account flow was not observed, so a complete fresh signup or forgotten-password UI journey is not claimed here.

The user subsequently confirmed receiving appointment emails with the correct corresponding Notifications sent timestamp. Appointment-email receipt and timestamp matching are marked passed for the manually exercised cases. The user did not specify which appointment outcomes were exercised; this does not claim individual live verification of all four email-triggering outcomes or failed-delivery recovery.

## Remaining verification

- Run any account journey not already exercised manually, including fresh patient signup and forgotten-password recovery, and record the steps/results.
- Verify the full clinic journey against real accounts: booking/review/correction, arrival, consultation, comments, retained documents, and reports, including role restrictions.
- Verify live TTL/index behavior, session revocation, outage recovery, and audit/notification reliability where required. Isolated checks cover these behaviors but do not establish every deployed scenario.

The existing application accounts were not changed by these automated checks. No further password test is needed to repeat the successful new-password/old-password checks already reported by the user.
