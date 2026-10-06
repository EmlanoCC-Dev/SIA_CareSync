# CareSync

CareSync is the **Healthcare Appointment, Queue, and Patient Notification Integration System**. It provides a React web application and an Express REST API backed by MongoDB for Patients, Doctors, Staff, and Admin accounts.

## Features

- Patient booking, clinic approval/decline, doctor assignment, and cancellation.
- Doctor working hours, consultation duration, generated slots, and slot blocking.
- Scheduled check-in and walk-in tickets on a combined public queue, with consultation start separate from arrival.
- Automatic no-show handling and reservation cleanup.
- Appointment comments, correction requests, and patient resubmission with retained history.
- Consultation notes, document uploads, and preserved note/document versions with protected downloads.
- Admin account creation, editing, role changes, deactivation, and reactivation. Deactivated accounts remain stored.
- Role-scoped dashboards, date-filtered reports, audit records, and private in-app notifications.
- Gmail email (local SMTP or hosted HTTPS Gmail API) for patient appointment confirmation, decline, cancellation, and no-show. Routine updates remain in-app.
- Email OTP for patient self-registration and password change/reset. Admin-created accounts do not require signup OTP.
- Visible notification email-delivery status and sent timestamps.

SMS is excluded from the agreed scope because paid providers are not feasible for this project. Automatic reminders and durable notification retries are not implemented.

## Prerequisites

| Requirement | Details |
| --- | --- |
| Git | Required to clone and pull the repository. |
| Node.js and npm | Use Node.js **22 or newer**. This workspace was tested with Node.js **24.11.1** and npm **11.6.2**. The root `concurrently` package requires Node.js 22+. npm is included with Node.js. |
| MongoDB | A running local MongoDB instance or accessible MongoDB Atlas database, with a connection URI and permissions to create application collections/indexes. |
| Browser | Required for the web application. Chrome is also used by the optional focused browser check. |
| Gmail sender account | Required for real email delivery, patient signup, and password OTPs. Use a Google App Password for local SMTP or OAuth credentials for the hosted Gmail API. |

MongoDB Compass is optional for inspecting a development database. MongoDB need not be installed locally when using a remote database. No global React, Vite, nodemon, Python, or Java installation is required.

## Clone and install dependencies

```sh
git clone https://github.com/EmlanoCC-Dev/SIA_CareSync.git
cd SIA_CareSync
npm ci
npm --prefix backend ci
npm --prefix frontend ci
```

Install dependencies in **all three directories**: the root, `backend`, and `frontend`. The root installation supplies the tool that starts both applications together; it does not install the backend/frontend packages automatically.

`npm ci` installs the versions in each committed `package-lock.json`; no individual package installation is needed. For development that intentionally changes dependencies, use `npm install` in the corresponding directory and include its updated lockfile with the change.

On Windows PowerShell, if `npm` is blocked by an execution-policy error involving `npm.ps1`, use **`npm.cmd`** instead of `npm` in these commands.

## Packages and dependencies

These are the declared version ranges in the package files. Lockfiles record the exact installed versions and their additional dependencies.

### Root development dependency

| Package | Version range | Purpose |
| --- | --- | --- |
| `concurrently` | `^10.0.5` | Start the backend and frontend development servers together. |

### Backend

| Package | Version range | Purpose |
| --- | --- | --- |
| `express` | `^4.21.2` | REST API server and routing. |
| `mongoose` | `^8.9.5` | MongoDB models, queries, and indexes. |
| `bcryptjs` | `^2.4.3` | Password hashing and comparison. |
| `jsonwebtoken` | `^9.0.2` | Login tokens and verification. |
| `dotenv` | `^16.4.7` | Backend environment configuration. |
| `cors` | `^2.8.5` | Cross-origin request middleware. |
| `multer` | `^2.3.0` | Document uploads. |
| `nodemailer` | `^10.0.14` | Gmail SMTP and OTP email delivery. |
| `socket.io` | `^4.8.3` | Included server-side integration dependency. |
| `nodemon` (development) | `^3.1.9` | Restart the backend when source files change. |

### Frontend

| Package | Version range | Purpose |
| --- | --- | --- |
| `react` | `^18.3.1` | UI components. |
| `react-dom` | `^18.3.1` | Render the React application. |
| `lucide-react` | `^1.16.0` | Interface icons. |
| `vite` (development) | `^6.0.1` | Development server and production build. |
| `@vitejs/plugin-react` (development) | `^4.3.4` | React support in Vite. |
| `@types/react` (development) | `^18.3.18` | React type definitions. |
| `@types/react-dom` (development) | `^18.3.5` | React DOM type definitions. |

## Environment configuration

From the repository root, copy the example to **`backend/.env`** using the command for your shell:

```powershell
# Windows PowerShell
Copy-Item backend/.env.example backend/.env
```

```sh
# macOS / Linux
cp backend/.env.example backend/.env
```

Do this on first setup; do not overwrite a configured `.env` when pulling updates. Edit the copied file:

```dotenv
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/healthcare_app
JWT_SECRET=replace_with_your_generated_random_secret
JWT_EXPIRES_IN=7d
EMAIL_ENABLED=true
SMTP_USER=your-sender@gmail.com
SMTP_APP_PASSWORD=your-google-app-password
```

| Variable | Configuration |
| --- | --- |
| `PORT` | Backend port. Keep `5000` for the current frontend development proxy. |
| `MONGO_URI` | Your local or Atlas URI. Start the MongoDB service for a local database. For Atlas, configure the database user and network access for your device. |
| `JWT_SECRET` | A random secret of at least 32 characters. The `.env.example` placeholder is rejected at startup. |
| `JWT_EXPIRES_IN` | Login-token lifetime; default `7d`. |
| `EMAIL_ENABLED` | Exactly `true` or `false`. Use `true` for email and OTP workflows. |
| `SMTP_USER` | Gmail sender address; required when email is enabled. |
| `SMTP_APP_PASSWORD` | Google App Password, rather than the normal login password; required for enabled SMTP. The Gmail API transport uses OAuth credentials instead. Spaces are removed by configuration loading. |
| `EMAIL_TRANSPORT` | `smtp` locally or `gmail-api` for the free hosted backend. |
| `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN` | Backend-only OAuth credentials, required with enabled Gmail API email. |
| `UPLOAD_STORAGE` | `local` for disk uploads in development; `gridfs` for persistent MongoDB files on free hosting. Defaults to GridFS in production when unset. |
| `TZ` | Clinic timezone; default `Asia/Manila` keeps operating hours correct on UTC-based hosts. |
| `CORS_ORIGINS` | Exact allowed browser origins, comma-separated. Configure the actual Vercel origin in production. |
| `TRUST_PROXY` | `0` locally, `1` behind Render's proxy, so account request limits use the client IP. |

Generate a JWT secret locally, then paste the result into `JWT_SECRET`:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

The backend loads `backend/.env`; no frontend `.env` is required for local development. For the hosted website, set the public `VITE_API_BASE_URL` to the Render URL including `/api`. Restart the backend or rebuild the frontend after changing its respective configuration.

The committed example starts with `EMAIL_ENABLED=false`. Existing accounts and the in-app inbox can work with email disabled, but **patient signup and password change/reset cannot complete without OTP email delivery**. There is no signup OTP bypass.

`.env` files and `backend/uploads/` are Git-ignored. Keep database credentials, JWT secrets, and SMTP passwords on the backend, outside frontend code and documentation.

## Start the application

From the repository root:

```sh
npm run dev
```

| Service | Local address |
| --- | --- |
| Web application | `http://localhost:3000` |
| Backend API | `http://localhost:5000/api` |
| Backend health check | `http://localhost:5000/health` |

The frontend requests `/api`; Vite proxies those requests to port `5000`. If you change the backend port, update [frontend/vite.config.js](frontend/vite.config.js). Use the frontend URL printed in the terminal if port `3000` is occupied.

Alternatively, run the applications separately in two terminals from the root:

```sh
# Terminal 1
npm run dev:backend
```

```sh
# Terminal 2
npm run dev:frontend
```

Stop development servers with `Ctrl+C`.

## Accounts and data on another device

Cloning downloads source code, **not** database records, account credentials, email configuration, or uploaded documents.

- For existing project accounts/data, use the team's authorized database configuration, supplied separately by its maintainer. Document downloads also need the matching `backend/uploads/` files.
- A fresh database has no default Admin account or bundled account-seeding script. For a new development/test database owned by you, enable email and register your own Patient account. Using MongoDB Compass, change only that account's `role` to `Admin` in the `users` collection, then sign out and sign in again. This is a one-time database-owner bootstrap step, not a public application feature; do not modify another person's account or a shared database without authorization.
- Create Doctor/Staff accounts and manage subsequent roles through the Admin dashboard. Configure doctor working hours before testing appointment availability.

Application models/indexes initialize on backend startup. Existing databases may need duplicate-ticket/slot cleanup before unique indexes initialize; see the [concurrency and recovery walkthrough](docs/project_specifications/261002_concurrency_and_assignment_recovery_walkthrough.md).

## Pull later updates

Stop development servers and handle local changes first. From the repository root:

```sh
git pull
npm ci
npm --prefix backend ci
npm --prefix frontend ci
npm run dev
```

Keep your configured `backend/.env`, compare it with `.env.example` for new settings, and restart after updating.

## Build and checks

Build the frontend from the repository root:

```sh
npm run build
```

Output is written to `frontend/dist/`. Use `npm run start:backend` to run the backend without nodemon. For the free Vercel + Render + MongoDB deployment, follow the [deployment guide](docs/deployment/free-hosting-guide.md). The preparation includes Gmail API email, MongoDB GridFS uploads, a Render Blueprint and Vercel configuration; the Vite development proxy is not used in production.

Run all isolated backend checks from Windows PowerShell after installation/configuration:

```powershell
foreach ($checkFile in (Get-ChildItem backend/tests -Filter '*.check.js')) {
    node $checkFile.FullName
    if ($LASTEXITCODE -ne 0) { throw "Backend check failed: $($checkFile.Name)" }
}
```

These checks use isolated database/SMTP doubles without sending real email or changing application records. They cover accounts, no-shows, access controls, clinical workflows, comments, concurrency, corrections, notifications, OTP, scheduled queues, and record versions.

Optional configured-service checks:

```sh
node backend/scripts/verify-email.js
node backend/scripts/verify-live-state.js
```

The first verifies the configured Gmail transport without sending email. The second reads backend health and aggregate MongoDB OTP/audit/delivery metadata without changing records or sending email. Verify real signup OTP delivery after configuring hosted Gmail API email.

The live concurrency check creates, tests, and removes a uniquely named **temporary database**. Its database user needs permission for that operation:

```sh
node backend/tests/concurrency.check.js --live
```

For the focused desktop/mobile browser check, build first, start this frontend preview in one terminal, then run the check in another:

```sh
npm --prefix frontend run preview -- --host 127.0.0.1 --port 3000
```

```sh
node docs/comments-ui.check.mjs
```

This check uses mocked APIs, Node's browser-debugging client, and Chrome. Its default Chrome path is for Windows; supply your executable and preview URL for other setups:

```sh
node docs/comments-ui.check.mjs "/path/to/chrome" "http://127.0.0.1:3000"
```

## Common setup issues

| Issue | Check |
| --- | --- |
| Missing package/module | Install dependencies in all three directories. |
| Node engine/version error | Use Node.js 22+; recorded checks used Node.js 24. |
| JWT configuration error | Set a generated secret of at least 32 characters in `backend/.env`. |
| MongoDB connection failure | Check the database service/URI, credentials, and remote network access. |
| OTP email unavailable | Enable email, configure the sender/App Password, restart, and run `verify-email.js`. |
| Frontend API request failure | Check backend health and the Vite proxy's target port. |
| Existing documents missing | Restore matching `backend/uploads/` files as well as database records. |
| Startup reports interrupted assignments | Stop all API processes and other clinic writers, then follow the offline recovery procedure below. |

For interrupted-assignment recovery, with all clinic writers stopped:

```sh
node backend/scripts/recover-assignments.js --offline
```

This maintenance command changes database records to reconcile interrupted work. Review the [recovery walkthrough](docs/project_specifications/261002_concurrency_and_assignment_recovery_walkthrough.md) before running it, then restart the backend.

## Repository layout and documentation

```text
CareSync/
  package.json                 Shared development commands
  backend/
    server.js                  Express application startup
    .env.example               Environment template
    src/                       Routes, controllers, services, models, events
    scripts/                   Verification and offline recovery utilities
    tests/                     Backend checks
    uploads/                   Local uploaded files (Git-ignored)
  frontend/
    src/                       React pages, components, styles, API client
    vite.config.js             Development server and API proxy
  docs/
    project_specifications/    Gap analysis, walkthroughs, verification results
```

- [Project specification checklist](docs/project_specifications/261001_project_specification_gap_analysis.md)
- [API access controls](docs/project_specifications/261001_api_access_controls_and_security_walkthrough.md)
- [Gmail email setup and delivery behavior](docs/project_specifications/261004_gmail_email_notifications_walkthrough.md)
- [Email policy and OTP workflows](docs/project_specifications/261004_email_policy_and_account_otp_walkthrough.md)
- [Live verification results](docs/project_specifications/261004_live_verification_results.md)
- [Free hosting, MongoDB file migration and mobile deployment guide](docs/deployment/free-hosting-guide.md)
- [Deployment preparation code review](docs/deployment/audit-2026-10-06.md)

The full live clinic journey, recovery evidence, and final submission documentation remain tracked in the specification checklist. Recorded isolated checks do not establish every live workflow.
