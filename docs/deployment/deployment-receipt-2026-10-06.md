# CareSync deployment receipt

Deployment performed on 6 October 2026 using the authorized existing MongoDB database and free hosting plans.

| Component | Location | Status |
| --- | --- | --- |
| Website | https://caresync-inky.vercel.app | Vercel Hobby production deployment ready |
| Backend | https://caresync-api-uhvz.onrender.com | Render Free, Singapore |
| API health | https://caresync-api-uhvz.onrender.com/health | Checks the MongoDB connection |
| Mobile API | https://caresync-api-uhvz.onrender.com/api | Compiled into the Android APK |
| Database and documents | Existing Atlas database `caresync_app`; GridFS bucket `medicalFiles` | Shared by web and mobile |
| Email | Gmail API over HTTPS | OAuth authentication verified; real delivery still requires a signup test |

The backend uses Node 24, Manila time, one trusted proxy hop, GridFS uploads, and exact Vercel origins for CORS. Gmail and database credentials are stored in Render environment settings. Vercel receives only the public API URL. No paid service was created.

## Verification

Seven live HTTP checks passed: Atlas-connected health, unauthenticated private-route rejection, frontend CORS, unrelated-origin rejection, malformed JSON handling, blocked public upload URLs, and the deployed website's hosted API configuration.

Isolated browser checks passed at 1440 and 390 pixels: landing page, login modal, no horizontal overflow, no JavaScript page errors, and a successful request from the actual website to the hosted API. External Google Fonts requests were blocked during these checks. Screenshots are saved locally in `build/deployment-evidence/`.

The backend dependency audit initially reported four moderate vulnerabilities and one critical vulnerability. Compatible updates were applied to Express 4.22.3, body-parser 1.20.8, proxy-addr 2.0.8, qs 6.16.0 and Multer 2.4.0. The updated production dependency audit reported zero vulnerabilities. All 17 backend check files then passed, including authentication/access control, uploads/version history, booking concurrency, OTP, Gmail transport, corrections, notifications, queue behavior and deployment configuration. These backend checks use isolated fixtures and do not send real email or mutate the hosted database. The audit result reflects the registry advisory data at the time of the check.

## Existing uploads

The one file present in the local uploads folder was copied into MongoDB GridFS: **198,202 bytes**, with its SHA-256 verified by downloading the stored bytes on Render. Original local bytes were retained. Appointment records and document history were not rewritten; the protected route resolves retained legacy URLs through GridFS metadata.

The database contains **two distinct legacy upload paths**. **One is missing** from the local folder and from GridFS. Restore that attachment from a backup before claiming that all historical downloads are available. Its document record was retained. No missing content was substituted.

## Android APK

Local artifact: `build/releases/CareSync-1.0.0.apk` — **53,783,997 bytes** (about 51.3 MiB).

SHA-256: `c44b3b8147fd01454be2c1dd82a3ac94d52c6f51d383f527d99199ffe8695d5d`

The APK was built with `--release --dart-define=API_BASE_URL=https://caresync-api-uhvz.onrender.com/api`. The hosted URL was verified in the Dart application libraries for arm64-v8a, armeabi-v7a and x86_64. Android's APK verifier confirmed a valid v2 signature. It uses the project's existing development signing key and `com.example.flutter_care_sync` application ID; it is suitable for installing for the demonstration. Configure your own release signing key and application ID before Play Store distribution.

The first build exhausted Java native memory. The successful retry used a 2 GB Gradle heap and one worker, without changing the mobile source. Existing uncommitted mobile changes were preserved. This turn did not install the APK or exercise it on a physical phone.

## Remaining demonstration checks

1. Open the backend health URL before a demonstration. Render Free sleeps after inactivity; waking it can exceed the mobile client's current 20-second timeout. Retry once health responds. [Render Free behavior](https://render.com/docs/free).
2. Install the APK on your Android phone and sign in to an existing account. Confirm that the website and phone show the same appointments.
3. Request a real signup code and password-reset code. Check inbox/spam and complete verification. OAuth authentication was checked; no real emails were sent during this deployment turn.
4. Exercise booking, staff approval/check-in, doctor completion, queue updates, and current/history document downloads with authorized accounts. Repeat a download after a backend restart. These private hosted workflows have not yet been exercised during this deployment turn.
5. Restore the missing historical upload from a backup.
6. Connect the Vercel account's GitHub login and link `EmlanoCC-Dev/SIA_CareSync` to the project with root directory `frontend`. The live website was deployed directly from tracked source because that GitHub login connection was absent. Future pushes do not automatically deploy Vercel until this is connected. Confirm Render's GitHub integration and deploy behavior too; its build used the public repository.
7. Rotate credentials posted in chat and update the corresponding provider and Render settings. For an external Google OAuth app still in Testing, Gmail refresh tokens normally expire after seven days; resolve publishing configuration or regenerate the token before your demonstration. [Google OAuth expiration](https://developers.google.com/identity/protocols/oauth2#expiration).

Detailed configuration and maintenance instructions: [free hosting guide](free-hosting-guide.md). The earlier [code audit](audit-2026-10-06.md) remains a historical pre-deployment report; this receipt records the later live deployment and completed dependency audit.
