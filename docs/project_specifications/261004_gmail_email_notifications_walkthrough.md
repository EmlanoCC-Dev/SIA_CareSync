# Gmail SMTP email notifications

Implemented October 4, 2026 (Asia/Manila) under the user's explicit request to use Gmail SMTP alongside the existing inbox. This completes the email implementation; SMS is not implemented. The installed Nodemailer version requires Node.js 20 or newer.

**Approved scope (October 4):** The user confirmed that paid SMS providers are not feasible for this project. Notifications use Gmail SMTP email and the in-app inbox. SMS is excluded from the implementation backlog and should be recorded as a resource limitation in the final paper and demonstration; instructor acceptance of the healthcare specification mapping is not established by this decision.

## Behavior

- The shared notification service saves the private inbox entry first. Only Patients receive appointment emails, for confirmation (`BOOKING_CONFIRMED`), decline (`APPOINTMENT_DECLINED`), cancellation (`CANCELLATION`), and no-show (`APPOINTMENT_NO_SHOW`). All other outcomes and all Doctor/Staff/Admin activity stay in-app. Routine event types skip SMTP and its account/status lookups to reduce clinic load.
- Each patient receives a separate plain-text message from CareSync. Messages reuse the existing notification summaries; they do not include medical reasons, consultation notes, comment content, attachments, or walk-in identities. Account-free walk-ins have no account address.
- Registration and password verification codes are security emails sent through the same Gmail transport independently of appointment notification filtering. Codes are never put in the notification inbox. See the [OTP walkthrough](261004_email_policy_and_account_otp_walkthrough.md).
- Missing accounts, deactivated accounts, and invalid addresses are skipped. Gmail failures do not remove the inbox entry, prevent other recipients' attempts, or fail the clinical action.
- `Notification.emailDelivery` stores status (`disabled`, `pending`, `sent`, `failed`, `skipped`), attempted/sent timestamps, SMTP message ID, and a bounded error/reason code. Passwords and raw SMTP errors are not logged or stored in notifications. Existing owner-only notification endpoints return this metadata without a new API route.
- `sent` means Gmail accepted the recipient/message, not that the user received or opened it. A failed status write after SMTP acceptance leaves `pending` and logs a safe warning; it never resends automatically.

## Visible delivery status

The owner-only **Notifications** inbox now displays email status from the stored delivery result:

- Green **Email sent**, with the accepted-send timestamp.
- Amber **Email delivery pending** until a result is recorded.
- Rose **Email delivery failed**, with a plain-language explanation; SMTP codes are not displayed.
- **In-app only**, **Email not sent**, or **Email unavailable** for updates without an email send.

The inbox polls at its existing 15-second interval and has a **Refresh** button. Read/unread state remains separate from email delivery. Older entries without email metadata show no invented status. “Sent” means Gmail accepted the message, not confirmed inbox receipt or reading.

Patient signup displays a green **Verification email sent successfully** banner after the OTP send completes, including successful resends. Failed sends show an error instead. Password-change/recovery requests display **Verification request received** with the existing neutral response; that public request returns before SMTP and must not claim confirmed delivery or reveal whether an account exists.

The production build, Gmail transport checks, and extended desktop/mobile Chrome checks passed. Browser checks cover all recorded delivery states, visible timestamps, refresh from pending to sent, successful signup/resend confirmation, failed-send suppression, and neutral password-request acknowledgement. They use mocked APIs and do not send real email.

## Configuration

Credentials are configured in the local, Git-ignored `backend/.env`. Do not copy that file into the mobile/frontend app or submission screenshots. The committed `backend/.env.example` contains blank credential placeholders.

```dotenv
EMAIL_ENABLED=true
SMTP_USER=your-sender@gmail.com
SMTP_APP_PASSWORD=your-google-app-password
```

Spaces in the app password are removed when reading configuration. Restart the backend after changing environment settings. Set `EMAIL_ENABLED=false` to keep in-app delivery only. Enabling email without valid configuration is rejected at startup.

Nodemailer uses `smtp.gmail.com`, port 465, immediate TLS with normal certificate validation, and an App Password. DNS/connection/greeting timeouts are 15 seconds; socket inactivity timeout is 20 seconds. File/URL content access is disabled. See the primary [Gmail guide](https://nodemailer.com/guides/using-gmail) and [SMTP transport documentation](https://nodemailer.com/smtp).

## Verification

```powershell
node backend/tests/email-notifications.check.js
node backend/tests/notifications.check.js
node backend/tests/comments.check.js
node backend/scripts/verify-email.js
```

The isolated email check passed secure transport configuration, role/event routing, accepted/rejected recipients, disabled delivery, inactive/invalid/missing recipients, inbox failure, SMTP failure, status-write failure, message privacy, and safe logs. It uses model/SMTP doubles and sends no real email. Existing notification checks passed 32 HTTP cases; comment checks passed 52 HTTP cases.

All thirteen backend check scripts passed after the email-policy/OTP and correction updates. The frontend production build and extended Chrome checks passed for patient signup, password recovery/change, and existing comments/history at desktop/mobile widths using mocked APIs.

`verify-email.js` successfully connected/authenticated to Gmail using the local configuration. It sends no email and does not connect to MongoDB. On October 4, the separate read-only `verify-live-state.js` confirmed one live notification marked sent with a sent timestamp and five marked skipped. The user confirmed receiving working OTP emails and successful password replacement. The user subsequently confirmed appointment-email receipt with matching Notifications sent timestamps; that manual verification is marked passed for the exercised cases. Remaining live recipient/read-state behavior and unexercised outcomes still need verification; SMTP acceptance alone is not proof of inbox delivery. See the [live verification report](261004_live_verification_results.md).

## Limits

One email attempt per eligible saved notification; no durable outbox, automatic retry, advance reminder, queue-turn alert, SMS provider, or delivery/bounce webhook. Existing process-local event loss remains possible. OTP resend/guess limits are documented separately. Add durable delivery only if the agreed scope requires it. Do not classify authentication verification as successful end-to-end delivery.
