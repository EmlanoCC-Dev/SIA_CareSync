# Email policy and account verification

Implemented October 4, 2026 (Asia/Manila) under the user's request to reduce email traffic and add OTP verification. The user confirmed that Admin-created clinic accounts should remain direct; OTP applies only to patient self-registration for account creation.

## Delivery policy

| Recipient/action | Channel |
| --- | --- |
| Patient appointment confirmed, declined, cancelled, or marked no-show | In-app and Gmail email |
| Booking receipt, assignment, arrival/start/completion, comments | In-app only |
| Doctor/Staff/Admin appointment, queue, and review activity | In-app only |
| Patient self-registration | Email verification code required before creating the account |
| Password change/reset, any active role | Email verification code required before changing the password |

The shared notification service filters routine types before doing SMTP-related account lookups/writes. Other roles cannot receive appointment email even if an eligible type is addressed to them. In-app messages and their privacy/ownership rules remain intact. Security OTP email is independent of this appointment filter and is never stored in the inbox.

## Account workflows and APIs

All responses use the existing `{ success, data }` envelope and `Cache-Control: no-store`.

| Endpoint | Body | Behavior |
| --- | --- | --- |
| `POST /api/users/register/otp` | `{ email }` | Send a patient signup code; no account/token is created. Existing address returns 409. |
| `POST /api/users/register` | Existing profile/password fields plus `otp` as a six-digit string | Verify and atomically consume the registration code, then create only a Patient account, set `emailVerifiedAt`, and return user/token. Caller-supplied privileged role is ignored. |
| `POST /api/users/password/otp` | `{ email }` | Return 202 with the same message for existing, missing, and deactivated accounts; send only to active existing accounts. No code is returned. |
| `POST /api/users/password/reset` | `{ email, otp, password }` | Consume the password code, check the bound account/email/session version and active status, hash the new password, increment `tokenVersion`, and return a sign-in instruction without a login token. |
| `POST /api/users` | Existing Admin creation body | Admin authorization required; no signup OTP. |

Public OTP/reset endpoints are explicit exceptions to the central login gate because they support signup and forgotten-password recovery. They are limited by IP/address and require a purpose-bound code for completion. Admin creation and all existing private routes remain protected.

The registration UI sends a code after validating the account form and creates the account only when verification succeeds. It supports resend cooldown, editing details, error/draft retention, and native browser autocomplete. Login offers **Forgot password?**. All role dashboards offer **Change password**, using the registered email in a native focus-contained dialog. A completed password change signs out the same local session even when the dialog was closed while the request was pending; other existing JWT sessions are rejected by the backend. The user signs in again.

Existing/Admin-created accounts continue to log in without retroactive email verification. Changing an account's email through Admin editing clears `emailVerifiedAt`. Public signup has no OTP bypass when email is disabled.

## Code and password protections

- Six digits generated with Node's cryptographic `randomInt`; leading zeros are retained.
- Purpose/address-bound HMAC-SHA256 using the backend secret; only the keyed hash is stored, never the code. The HMAC input includes a domain label distinct from JWT use.
- Ten-minute validity, checked against actual server time, independent of the testing clinic clock. MongoDB TTL is cleanup only, not the expiry check.
- Atomic conditional consumption makes each code usable once, including concurrent requests. Registration codes cannot reset passwords; password codes cannot create accounts or target another email/account.
- At most five guesses per issued code; 60 seconds between requests; at most five code requests per purpose/address per hour. Request limits persist in MongoDB. A new code replaces the old one and is usable only after SMTP acceptance is recorded.
- A bounded per-process IP limiter allows 60 verification requests per 15 minutes across these endpoints and returns `Retry-After` on 429. For multiple API workers, use a shared limiter store. Configure trusted reverse proxies deliberately before using forwarded addresses.
- Failed delivery disables the challenge without logging its code, address, credentials, or raw SMTP response. Password requests respond before SMTP completion to avoid disclosing account existence through success/failure or SMTP latency.
- Passwords retain the existing six-character minimum and reject more than 72 UTF-8 bytes to avoid bcrypt truncation. Validation occurs before consuming a good code. Password updates hash explicitly because Mongoose update methods do not run the existing save hook.
- A password change increments `User.tokenVersion`; JWT authentication compares that stored version to the token. Legacy tokens without a version are treated as version zero and stop working after the first password change.
- Password changes emit the existing user-update audit event with only `{ passwordChanged: true }`; no password/hash/code enters audit payloads.

These safeguards follow the [OWASP password recovery guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html). Email verification confirms address access; login itself remains password-based.

## Verification and limits

```powershell
node backend/tests/otp.check.js
node backend/tests/email-notifications.check.js
node backend/tests/api-access.check.js
node backend/tests/audit-coverage.check.js
```

All thirteen backend check scripts passed, including 30 OTP/auth HTTP checks and expiry, replay, purpose/address scope, guessing/cooldown/send limits, concurrent consumption/issuance, SMTP/write failures, Admin creation, inactive accounts, password hashing, safe audit payloads, and revoked sessions. API access checks passed 124 HTTP cases covering all 43 private routes. The build and extended all-role Chrome checks passed at 1440px/390px; account checks included failed code delivery, wrong-code drafts, resend, password mismatch, signup gating, recovery, and completion after closing the password dialog.

These OTP checks use isolated database/SMTP doubles or mocked browser APIs and send no real emails. On October 4, Gmail authentication and read-only live MongoDB queries passed: one verified Patient account, consumed registration/password challenges, and a password-change audit record were present. The user confirmed receiving working codes, successful sign-in with the new password, and rejection of the old password. Complete fresh signup/recovery journeys, TTL/index behavior, and deployed session revocation still need dedicated live verification. See the [live verification report](261004_live_verification_results.md). Restart the backend after code/configuration changes.

Codes are consumed before the final account/password write. If that write fails, request a fresh code; the consumed code is not restored. Password-code delivery is process-local, so a process restart can lose an in-flight send; resend after the cooldown. OTP delivery has no durable outbox or automatic retry. Clinic email retains Gmail/provider limits and has no global delivery queue.
