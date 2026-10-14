# Keep Gmail and Drive authorization working beyond seven days

CareSync OTP codes expire after **10 minutes**. The separate seven-day limit applies to Gmail/Drive OAuth **refresh tokens** issued while an external Google app is in **Testing**. The backend already uses refresh tokens to renew short-lived access tokens automatically. A code change cannot extend a testing refresh token's lifetime.

1. Open [Google Cloud Console](https://console.cloud.google.com/) and select the project whose OAuth client ID matches CareSync's `GMAIL_CLIENT_ID`.
2. Open **Google Auth Platform → Audience**. Select **Publish app** and follow Google's requirements until the publishing status is **In production**. Publishing status and OAuth verification are separate: Google may require branding or sensitive-scope verification unless an exception applies. Do not describe the app as personal/internal unless that accurately matches its use.
3. After changing the status, authorize the clinic sender again to obtain fresh offline refresh tokens. Do not assume an existing testing token becomes long-lived automatically. Use the same OAuth client, clinic account, and narrowly scoped permissions documented in the [hosting guide](free-hosting-guide.md) and [backup guide](database-backups.md).
4. If using OAuth Playground, enable **Use your own OAuth credentials**, use offline access, and authorize with the clinic sender account. Obtain a Gmail token for `https://www.googleapis.com/auth/gmail.send` and a separate Drive token for `https://www.googleapis.com/auth/drive.file`. Store them as `GMAIL_REFRESH_TOKEN` and `DRIVE_REFRESH_TOKEN` respectively in Render's environment settings and any private configuration you retain. These are refresh tokens, not access tokens. Do not paste them into chat or commit them to Git.
5. Redeploy/resume the backend after updating its secrets. Verify sender authentication, then request and use a real CareSync OTP. Verify Drive readiness before re-enabling the scheduled backup workflow. Resume the Vercel project when the API is ready.

Production removes the testing-specific seven-day rule. Refresh tokens can still be revoked or expire for other reasons, including revoked consent or some Gmail password changes. CareSync does not automatically repair revoked Google consent. Moving to Production does not turn patient signup into Google sign-in: the clinic sender account authorizes email sending; patients continue receiving ordinary email codes.

Sources: [Google audience settings](https://support.google.com/cloud/answer/15549945?hl=en), [refresh-token expiration](https://developers.google.com/identity/protocols/oauth2#expiration), [verification requirements and exceptions](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification).

## Booking update deployment check

The booking update adds a unique partial database index to enforce one active appointment per patient. Before deploying to the hosted database, check for existing duplicate active appointments (`Pending`, `Needs correction`, `Confirmed`, `Checked In`, `In Progress`). Resolve those with clinic staff; never silently cancel or delete them. Startup waits for the appointment indexes and fails if an index cannot be built.

Patients may book through one calendar month from today. Clinic follow-ups are created after completion, may extend beyond one month, and still respect the one-active-appointment rule. Follow-ups reuse available consultation slots and are confirmed by the clinic. A failed confirmation leaves a visible pending request; retrying the same follow-up/slot resumes it without adding another visit.
