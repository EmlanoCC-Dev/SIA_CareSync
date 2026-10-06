# CareSync: Optional walk-in accounts and verified email linking

Updated October 7, 2026 (Asia/Manila).

## Policy

Walk-in patients do not need an account to join the queue or receive care. Reception collects name and the patient's own email. Signup remains optional indefinitely; it is never required for assignment, check-in, consultation or completion.

If a patient later registers using the same email, the existing signup OTP must verify ownership before earlier visits are linked. Comparison trims spaces and ignores case. It does not rewrite provider aliases or match names/phones. A different email does not claim earlier visits. Each patient should use their own email; shared family addresses can mix records.

Multiple visits can use the same email. Each queue entry still represents one day's visit. An existing active, verified Patient account links immediately when reception uses its email. Unverified, deactivated and non-Patient accounts cannot claim records. Collecting email does not create an account or send a signup code; patients initiate signup themselves.

## Walkthrough

1. As Staff/Admin, open Walk-in Queue → Add Walk-In. Enter Patient Name and Patient Email. No phone, password or signup is required.
2. Add the patient and follow the ordinary slot/queue/consultation workflow. Private queue/appointment views show email; the public board continues to show tickets/status only.
3. If the patient chooses to register later, use the same email and verify the signup OTP.
4. Open the patient dashboard. Earlier assigned visits appear alongside bookings, labelled Walk-in with their original queue number. Medical Records and History & comments use the existing protected routes.
5. A waiting queue entry has no consultation/appointment yet and appears in the patient dashboard after slot assignment. Further walk-ins with the same verified account email also link without duplicating accounts or records.

## Data model and API

`POST /api/walkins` accepts `{ "name": "Patient Name", "email": "patient@example.com" }`, remains Staff/Admin-only and returns 201. Invalid/missing email, non-text/blank names or names longer than 200 characters return 400. Operating hours and daily ticket allocation still apply. Clients sending only `contactNumber` must switch to `email`.

| Field | Behavior |
| --- | --- |
| `WalkIn.email` | Required for new entries; normalized/validated, at most 254 characters. Non-unique because a patient can have multiple visits. |
| `WalkIn.patient` | Optional User reference, null until linked to a verified Patient. |
| `WalkIn.contactNumber` | Optional legacy field/display fallback; new reception entries do not collect it. |
| `Appointment.patient` | Owner of the linked walk-in consultation; existing ownership is never replaced. |
| `Appointment.walkIn` | Retained, preserving original queue entry, ticket, visit source and clinic workflow. |

An `{ email: 1, patient: 1 }` index supports matching; a `{ patient: 1 }` index supports reconciliation of already attached visits. Old phone-only records remain readable but cannot be matched automatically. This release does not guess/backfill emails or add an email-edit endpoint; accurate legacy-email corrections require a separately authorized correction/migration.

## Linking and access

[walkInAccount.service.js](../../backend/src/services/walkInAccount.service.js) requires an active Patient with `emailVerifiedAt`. It attaches unowned matching queue entries, then unowned appointments referencing that patient's attached walk-ins. It does not copy/rewrite notes, documents, versions, status history, queues or slots. Existing ownership remains authoritative even if an email subsequently changes.

Signup attempts linking after creating the verified account. If linking fails, signup still succeeds. Current-account lookup and the authenticated appointment list retry the idempotent writes. Assignment also reconciles signup racing with appointment creation. A later portal read repairs partial writes or an appointment created after the signup query; retries create no duplicate visits.

Patient list/detail/comment/version/download access continues to check `Appointment.patient` against the authenticated user. There is no public email lookup or claim endpoint. Patients cannot access reception's private queue. Staff/Admin and assigned-Doctor permissions remain in force.

## Verification

```sh
node backend/tests/walkin-account.check.js
node backend/tests/otp.check.js
node backend/tests/concurrency.check.js
node backend/tests/api-access.check.js
node backend/tests/walkin-status.check.js
npm run build
```

The account-linking check covers optional signup, normalized email, multiple historical visits, failed verification, existing verified accounts, unrelated/legacy/unverified accounts, conflicting ownership, retained notes, list/detail/version access, private-queue denial, public-board privacy, partial writes, idempotency and signup/assignment ordering. The OTP suite separately exercises real OTP generation/consumption with model/email doubles.

The browser smoke check (`docs/ui-smoke.mjs`, with its documented Puppeteer path) verifies the email form, optional-account guidance, submitted payload, identity display, keyboard dismissal and desktop/mobile layouts. These isolated checks use no production patient records or real email. They do not establish real OTP delivery or a live migration.
