# CareSync evidence run (local, synthetic)

This folder holds evidence captured on 2026-10-12 from a live local run of commit `0e87172`. The existing `../testing-evidence/` folder is separate, and nothing in it was changed.

## Environment

| Item | Value |
| --- | --- |
| OS | Windows 11 Home Single Language 10.0.26300 |
| Node.js | v26.8.1 |
| Database | Disposable Docker container `mongo:8.0` (MongoDB 8.0.32), database `caresync_evidence` on `127.0.0.1:27017` |
| Browser | Microsoft Edge 155.0.4283.45 (headless), driven by `playwright-core@1.57.0` |
| Email | `EMAIL_ENABLED=false`. No email was sent or received. |
| Uploads | `UPLOAD_STORAGE=gridfs`, so files were stored inside the disposable database and not in `backend/uploads/` |
| Clinic clock | Set through the Admin system-time API to `2026-10-13T08:45:00+08:00` (a frozen simulated time) |

The real `backend/.env` was not read, changed or used. dotenv does not override variables that are already set, so every setting was passed to the processes as environment variables. Secrets (`JWT_SECRET` and the shared synthetic password `EVIDENCE_PASSWORD`) were generated randomly for this run. They were kept outside the repository and are not recorded here.

## Commands used

The commands below are Git Bash, run from the repository root.

```bash
docker pull mongo:8.0
docker run -d --name caresync-evidence-mongo -p 127.0.0.1:27017:27017 mongo:8.0

# Install the Playwright library outside the repo (no change to package.json).
mkdir -p "$SCRATCH/pw" && npm --prefix "$SCRATCH/pw" install playwright-core@1.57.0

# Evidence environment (values are placeholders; generate your own).
export PORT=5000 MONGO_URI=mongodb://127.0.0.1:27017/caresync_evidence TZ=Asia/Manila
export JWT_SECRET="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
export JWT_EXPIRES_IN=7d CORS_ORIGINS= TRUST_PROXY=0 UPLOAD_STORAGE=gridfs
export EMAIL_ENABLED=false EMAIL_TRANSPORT=smtp SMTP_USER= SMTP_APP_PASSWORD= GMAIL_CLIENT_ID= GMAIL_CLIENT_SECRET= GMAIL_REFRESH_TOKEN=
export BACKUP_ENABLED=false DRIVE_REFRESH_TOKEN= BACKUP_ENCRYPTION_KEY= BACKUP_SCHEDULER_TOKEN=
export EVIDENCE_PASSWORD="<random synthetic password, 12+ chars>"
export NODE_PATH="$PWD/backend/node_modules"
export PLAYWRIGHT_CORE="$SCRATCH/pw/node_modules/playwright-core"
export CHROMIUM_PATH="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"

(cd backend && node server.js) &          # API on :5000
(cd frontend && npx vite --port 3000) &   # UI on :3000, proxies /api

node docs/final_submission/evidence/tools/bootstrap.js   # Admin bootstrap + Doctor/Staff/second Patient
node docs/final_submission/evidence/tools/sc01.js
node docs/final_submission/evidence/tools/sc02.js
node docs/final_submission/evidence/tools/sc02b.js
node docs/final_submission/evidence/tools/sc03.js
node docs/final_submission/evidence/tools/sc04.js
node docs/final_submission/evidence/tools/sc05.js
node docs/final_submission/evidence/tools/sc06-07.js
node docs/final_submission/evidence/tools/sc08.js
node docs/final_submission/evidence/tools/sc09.js
node docs/final_submission/evidence/tools/sc11.js        # run before sc10 (sc10 deactivates the second patient)
node docs/final_submission/evidence/tools/sc10.js
```

The scripts run in sequence against one database, and each one depends on the state left by the one before. The deviations listed below were run once by hand during the session. Running the scripts from an empty database is the intended reproduction path.

## Synthetic accounts

All accounts use `@example.test` addresses and share the same synthetic password, which was not recorded.

| Role | Name | Email | Created by |
| --- | --- | --- | --- |
| Admin | Ada Evidence-Admin | evidence.admin@example.test | Self-registration, then `role` set to `Admin` directly in the `users` collection (the one-time database-owner step in the README) |
| Doctor | Ben Santos | evidence.doctor@example.test | Admin `POST /api/users` |
| Doctor (unassigned) | Carla Lim | evidence.doctor2@example.test | Admin `POST /api/users` |
| Staff | Sam Reception | evidence.staff@example.test | Admin `POST /api/users` |
| Patient | Pia Evidence-Patient | evidence.patient@example.test | Self-registration in the UI (SC01) |
| Patient (other) | Quinn Other-Patient | evidence.patient2@example.test | Self-registration through the API |
| Walk-in | Walt Walk-in | evidence.walkin@example.test | Staff UI (SC05) |

## How OTP worked with email disabled

With `EMAIL_ENABLED=false`, the real server rejects every OTP request with `503 Email verification is unavailable` (shown in SC01a). The README states that there is no signup OTP bypass. To finish signup, `tools/lib.js#injectOtp` played the part of the mailer only:

1. It wrote a ready OTP challenge into `emailotps`, using the same keyed hash as `backend/src/services/otp.service.js`.
2. In the UI run (SC01b), Playwright answered the browser's `POST /users/register/otp` with a success body.
3. The real `POST /users/register` then verified and consumed the challenge.

Codes lived only in process memory and were never printed, saved or captured in a screenshot.

## Notes and limitations

- **Simulated clock.** The clinic clock was frozen at 2026-10-13 08:45 (+08:00). Workflow history entries (corrections, approval, check-in, start and complete) carry that time. Notification `createdAt`, document and note version times, the audit-log timestamps and the first "Appointment booked by patient" timeline entry use the real server clock (2026-10-12, about 16:40 +08:00). This mix is how the app currently behaves; it is not an editing artifact.
- **Dev-mode stack traces.** With `NODE_ENV` unset, error responses include a `stack` field holding local file paths (`backend/src/middleware/errorHandler.js:26`). The field is redacted as `[REDACTED]` in SC07b, SC11 and the JSON evidence. Production (`NODE_ENV=production`) omits it.
- **SC02c.** The 13 Oct slots (09:00–17:00) were generated on demand from the default schedule when the Doctor first opened My Slots, one second before the weekly hours were saved. The audit trail (SC09c) records this. By design, existing dated slots stay unchanged. SC02b shows a new date (14 Oct) generated from the saved 09:00–12:00 hours.
- **Rendered responses.** SC07b and SC11 are pages that the harness rendered from real, sanitized API responses, so the status code and body appear together. The data underneath is in `screenshots/SC11-negative-requests.json`.
- **Expanded dialogs.** For SC03, SC04, SC06–SC08 and SC10a, scrolling modals were expanded to full height with a capture-only stylesheet (`tools/browser.js#shotDialog`), so each record fits in one image. No content was changed.
