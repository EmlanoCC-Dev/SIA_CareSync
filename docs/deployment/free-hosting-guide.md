# CareSync free deployment guide

Prepared on 6 October 2026. This guide applies to the deployment preparation changes introduced after commit `1bd8e15`. Import the branch containing those changes into the hosting services.

## What runs where

| Part | Host | Configuration |
| --- | --- | --- |
| React website | Vercel Hobby | Repository root directory: `frontend` |
| Express API | Render Free web service | Repository root directory: `backend` |
| Accounts, appointments, queues, notes and uploaded files | MongoDB Atlas Free | Same MongoDB database for web and mobile; files use GridFS |
| Verification and appointment email | Your Gmail account | Gmail API over HTTPS; OAuth secrets stay in Render |
| Flutter mobile app | Installed on your phone | Build with `API_BASE_URL` pointing directly to the Render API |

The website calls the Render API directly. Vercel does not run Express or store uploads. The API checks authentication and appointment access before returning a file. Document replacement and archiving retain old GridFS files for version history.

Render Free blocks SMTP ports and clears local filesystem changes on restart, redeployment and idle shutdown. The preparation changes therefore add Gmail API email and MongoDB GridFS storage. Render also sleeps after 15 idle minutes and can take about a minute to wake. This setup suits the project demonstration; it does not promise continuous availability. [Render free-service documentation](https://render.com/docs/free).

## 1. Prepare MongoDB Atlas and existing data

If the project already uses Atlas, keep the authorized existing database and its database name. Reusing it lets the deployed web and mobile apps see the same accounts and records. Cloning GitHub does not copy the database or uploaded documents.

If you need a new cluster:

1. Create a **Free** Atlas cluster in a supported region near your Render service.
2. Create a database user with `readWrite` access to the CareSync database, using a generated password.
3. Copy the Node.js connection URI into Render's `MONGO_URI`. Replace the password placeholder and include the database name, for example `...mongodb.net/healthcare_app?retryWrites=true&w=majority`. URL-encode special characters in the password.
4. In Atlas Network Access, allow the outbound IP ranges displayed for your Render service. Add your PC's current IP while running local migration or maintenance. Prefer these specific ranges instead of allowing the whole internet. [Render outbound IP guidance](https://render.com/docs/outbound-ip-addresses), [Atlas connection guidance](https://www.mongodb.com/docs/atlas/connect-to-database-deployment/).

For an existing local database, back it up and restore it into Atlas with MongoDB Database Tools before switching the backend. Keep a separate backup of `backend/uploads/`. A database backup alone does not include old local upload bytes. [MongoDB backup and restore tools](https://www.mongodb.com/docs/database-tools/mongodump/).

Atlas Free includes 512 MB of storage shared by application records, indexes and GridFS files. Every retained file version consumes space; archiving a file does not free its bytes. Use small demonstration files and monitor the storage metric. [MongoDB pricing](https://www.mongodb.com/pricing).

### Move existing local uploads into GridFS

Skip this subsection for a fresh database with no uploaded documents. For existing documents, use the database containing their records and the PC holding the matching `backend/uploads/` files.

1. Back up the database and upload folder. Stop **all** local and hosted API processes writing to this database.
2. Point your local `backend/.env` at the intended Atlas database. Keep your existing secret values private.
3. From the web repository root, run the default inventory:

   ```powershell
   node backend/scripts/migrate-uploads-to-gridfs.js
   ```

   This checks current, archived and historical local file references without changing them. Restore any missing files before continuing.

4. With all API writers still stopped, run:

   ```powershell
   node backend/scripts/migrate-uploads-to-gridfs.js --apply --offline
   ```

   This copies bytes to `medicalFiles.files` / `medicalFiles.chunks` and updates document URLs to `/uploads/gridfs/...`. It preserves filenames and version numbers and retains the original local files. An interrupted run can reuse successfully copied files when retried. The `--offline` flag is your acknowledgement that writers are stopped; the script cannot stop other processes for you.

5. Run the inventory again: it should report zero remaining local references. Keep your backup until deployed current and historical downloads have been checked.

MongoDB's driver manages the GridFS chunk/file collections. [GridFS documentation](https://www.mongodb.com/docs/drivers/node/current/crud/gridfs/).

## 2. Configure Gmail API email

A Gmail App Password works with local SMTP, but it cannot overcome Render Free's blocked SMTP ports. Hosted email uses a Gmail OAuth refresh token instead.

1. In [Google Cloud Console](https://console.cloud.google.com/), create or select your project and enable **Gmail API**.
2. Configure Google Auth Platform branding and audience. For an external app in Testing, add the **sender Gmail account** as a test user.
3. Add the scope `https://www.googleapis.com/auth/gmail.send` in Data Access. It permits sending; the app does not need inbox-reading scopes. [Gmail scopes](https://developers.google.com/workspace/gmail/api/auth/scopes).
4. Create an OAuth client of type **Web application**. Add this authorized redirect URI exactly:

   ```text
   https://developers.google.com/oauthplayground
   ```

5. Open [Google OAuth Playground](https://developers.google.com/oauthplayground/). In its settings, select **Use your own OAuth credentials**, enter your client ID/secret, and use offline access with consent prompting.
6. Enter the `gmail.send` scope, authorize using the sender account, and exchange the authorization code for tokens. Copy the **refresh token**, client ID and client secret privately into Render's environment settings.
7. Set `SMTP_USER` to that same sender Gmail address. Despite its existing name, this variable identifies the sender for both transports. `SMTP_APP_PASSWORD` is unused with `gmail-api`.

Patients do not authorize Google or need these OAuth credentials; they only receive the application's emails. Keep the sender's tokens out of GitHub, screenshots, the mobile build and Vercel's `VITE_*` variables.

Google expires external **Testing** refresh tokens after seven days when Gmail scopes are used. For a short demo you can renew the token; for an ongoing deployment, resolve Google's publishing/verification requirements, switch the consent configuration appropriately, and generate a fresh token. Password changes or revoked account access can also invalidate Gmail refresh tokens. [Google OAuth token expiration](https://developers.google.com/identity/protocols/oauth2#expiration).

The API refreshes access tokens and sends base64url-encoded MIME messages over HTTPS. Authentication verification alone does not prove real email delivery; send a signup OTP during the final hosted checks. [Gmail sending documentation](https://developers.google.com/workspace/gmail/api/guides/sending).

## 3. Deploy the backend to Render

The repository includes `render.yaml` as an optional Blueprint. You can use **New → Blueprint** and supply its prompted values, or create a web service manually with these settings:

| Setting | Value |
| --- | --- |
| Repository | `EmlanoCC-Dev/SIA_CareSync` |
| Branch | The branch containing the preparation changes, normally `main` |
| Service type / runtime | Web Service / Node |
| Plan | Free |
| Root directory | `backend` |
| Build command | `npm ci --omit=dev` |
| Start command | `node server.js` |
| Health check path | `/health` |

Set the following environment variables in Render. Values below are placeholders or public settings, never actual credentials:

| Variable | Value |
| --- | --- |
| `NODE_VERSION` | `24` |
| `NODE_ENV` | `production` |
| `TZ` | `Asia/Manila` |
| `TRUST_PROXY` | `1`, for Render's proxy |
| `MONGO_URI` | Authorized Atlas URI, including database name |
| `JWT_SECRET` | Generated random secret of at least 32 characters; the Blueprint can generate one |
| `JWT_EXPIRES_IN` | `7d` |
| `UPLOAD_STORAGE` | `gridfs` |
| `EMAIL_ENABLED` | `true` |
| `EMAIL_TRANSPORT` | `gmail-api` |
| `SMTP_USER` | Sender Gmail address |
| `GMAIL_CLIENT_ID` | Your OAuth client ID |
| `GMAIL_CLIENT_SECRET` | Your OAuth client secret |
| `GMAIL_REFRESH_TOKEN` | Sender's refresh token |
| `CORS_ORIGINS` | Exact Vercel site origin, such as `https://YOUR-WEB.vercel.app` |

If you do not yet know the Vercel domain, temporarily use `https://pending.invalid` for `CORS_ORIGINS`. Native mobile and health requests can work while you finish configuring the website; browser requests will wait until you replace this value with the actual origin. Origins have **no `/api` path or trailing slash**. Multiple exact origins can be comma-separated.

Render provides `PORT`; let it do so. Do not copy your local `PORT=5000` into the hosted service. Backend secrets belong in Render, not the frontend.

Deploy, copy the service's actual URL, and open:

```text
https://YOUR-API.onrender.com/health
```

Wait for the service to wake if necessary. A connected backend returns HTTP 200 with `status: "ok"`; a disconnected database returns 503. Check the Render logs for missing configuration, Atlas network access, failed indexes or interrupted assignments. [Render configuration](https://render.com/docs/configure-environment-variables), [Blueprint reference](https://render.com/docs/blueprint-spec).

If startup reports pending interrupted assignments, stop all clinic writers and follow the existing [offline recovery walkthrough](../project_specifications/261002_concurrency_and_assignment_recovery_walkthrough.md). Run recovery locally with authorized Atlas access; the free service does not provide a dashboard shell. Do not delete recovery records to bypass this check.

## 4. Deploy the website to Vercel

1. Import the same GitHub repository into Vercel.
2. Set **Root Directory** to `frontend`, **Framework Preset** to Vite, **Install Command** to `npm ci`, **Build Command** to `npm run build`, and **Output Directory** to `dist`. Use Node.js 24 or a supported Node.js version at least 22. The included `frontend/vercel.json` supplies the Vite build settings.
3. Add this environment variable for the deployment environment you will use:

   ```dotenv
   VITE_API_BASE_URL=https://YOUR-API.onrender.com/api
   ```

4. Deploy and copy the resulting stable website origin.
5. In Render, replace `CORS_ORIGINS` with that exact origin and save/redeploy the backend.
6. Refresh the website. Its `/api` requests should go directly to the Render URL, rather than to the Vercel site.

The Vite development proxy only works during local development. `VITE_API_BASE_URL` supplies the production API address, is public, and is embedded at build time. Redeploy Vercel after changing it. Do not prefix backend secrets with `VITE_`. [Vercel Vite documentation](https://vercel.com/docs/frameworks/frontend/vite).

Preview deployments have different origins. Add an exact preview origin to Render only when you need to test it. A production origin does not automatically permit every `vercel.app` website.

## 5. Build the mobile app against the hosted API

The mobile repository already supports `API_BASE_URL` as a compile-time setting. Run these commands from `CareSync_mobile`, substituting your actual Render URL:

```powershell
flutter pub get
flutter run --dart-define=API_BASE_URL=https://YOUR-API.onrender.com/api
```

For an APK to install/share:

```powershell
flutter build apk --release --dart-define=API_BASE_URL=https://YOUR-API.onrender.com/api
```

The APK is normally written to `build/app/outputs/flutter-apk/app-release.apk`. Rebuild after changing the address; hot reload does not replace compile-time configuration. Installed apps need internet access but do not need the PC or a local MongoDB server.

Use the **Render backend address including `/api`**, not the Vercel website address. Both clients then share the same API and Atlas database. Native Android/iOS requests are not subject to browser CORS; Flutter Web requires its browser origin in `CORS_ORIGINS`.

The current mobile HTTP timeout is 20 seconds. A sleeping free Render service can need longer than that to wake: open `/health` and wait for HTTP 200 before the demonstration, then retry the mobile request. Do not treat a timeout as confirmation that a booking failed; check the appointment list before submitting again.

## 6. Complete the hosted checks

The local preparation checks use isolated database/email doubles. Before the final demonstration, verify the real deployed services:

1. `/health` returns 200. The browser's Network panel shows the actual Render API URL, successful CORS and authenticated requests.
2. Request a signup code using your test email, receive it, and complete registration. Confirm an invalid/used code is rejected.
3. Verify login and password reset/change. A password change invalidates the old login.
4. Create a Doctor/Staff account through Admin; configure the doctor's working hours and generate a future slot.
5. Book as Patient, assign/approve as Staff, check in, start/complete as Doctor, and verify the notification history and public queue display.
6. Upload a small sample file, replace it, and download current and old versions. Another patient's account must be refused access.
7. Restart/redeploy the Render backend, then download those versions again. This confirms the actual Atlas persistence, not just a mocked storage test.
8. Build/install the mobile app and confirm that a booking made on one client appears on the other after refreshing.

For a fresh database, there is no seeded Admin. Follow the README's database-owner bootstrap using your own account; preserve existing authorized Admin accounts when reusing data. Reset the demo clock to actual time before these checks. Use the destructive demo reset only when you intentionally want to clear demonstration records.

Run the backend production dependency advisory check on your own machine before public deployment:

```powershell
npm.cmd --prefix backend audit --omit=dev
```

That network check was not completed in this review because its permission was declined. The frontend production dependency advisory check returned zero findings. Build/tests passing cannot certify every dependency or every live workflow.

## Troubleshooting

| Symptom | Next step |
| --- | --- |
| Website calls Vercel `/api` and gets HTML/404 | Correct `VITE_API_BASE_URL` in Vercel and redeploy the frontend. |
| Browser says CORS blocked | Set the actual website origin in Render, without paths/trailing slash; restart the API. |
| Backend will not start / health is unavailable | Check required secrets, Atlas URI/database name/network access and startup logs. |
| Signup says email unavailable | Confirm `EMAIL_ENABLED=true`, `EMAIL_TRANSPORT=gmail-api`, Gmail API enabled, sender/client/refresh token correct; Testing tokens expire after seven days. |
| Files worked locally but fail online | Migrate matching old upload files into the same Atlas database; keep hosted `UPLOAD_STORAGE=gridfs`. |
| Upload returns 413 | Use a file below the existing 25 MB limit; also check remaining Atlas capacity. |
| Mobile times out after idle | Wake `/health`, wait until it returns 200, then retry/read the appointment list. |
| Mobile still connects to localhost | Rebuild the APK with the hosted `API_BASE_URL`, then install the new APK. |

Changing `JWT_SECRET` intentionally invalidates existing signed logins and outstanding OTP hashes. Keep it stable across redeployments unless you are deliberately rotating it.
