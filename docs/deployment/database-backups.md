# Database backups to the clinic Gmail account's Google Drive

The Admin workspace has **Database backups**, a manual **Back up now** action, and recent backup results. The daily job requests a backup at **6 PM Asia/Manila**, one hour after the current 5 PM closing time. This uses the real clock, not the demonstration clock.

The feature stays unavailable until its server settings and Google consent are configured. An SMTP app password cannot authorize Google Drive. The existing Gmail sender, Google project, and OAuth client can be reused; **Drive uses its own refresh token**, leaving `GMAIL_REFRESH_TOKEN` in place for email.

## Google configuration

1. Sign into [Google Cloud Console](https://console.cloud.google.com/) using the clinic email account. Select the same project used for Gmail API email.
2. In **APIs & Services → Library**, enable **Google Drive API**. Gmail API remains enabled.
3. In **Google Auth Platform → Audience**, add that clinic Gmail address as a test user if the project is in Testing. For ongoing scheduled backups, resolve publishing requirements and use an appropriate **In production** configuration: external Testing refresh tokens expire after seven days for Drive/Gmail scopes. [Google OAuth token expiration](https://developers.google.com/identity/protocols/oauth2#expiration).
4. In **Data Access**, add `https://www.googleapis.com/auth/drive.file`. Keep existing Gmail scopes. This grants access to files and folders created by the app, rather than the whole Drive. [Drive scope documentation](https://developers.google.com/workspace/drive/api/guides/api-specific-auth).
5. Open the existing **Web application** OAuth client under **Clients**. Its authorized redirect URIs must include `https://developers.google.com/oauthplayground`. Keep the client ID/secret in backend environment settings.
6. Open [OAuth Playground](https://developers.google.com/oauthplayground/). Open settings, enable **Use your own OAuth credentials**, and enter that client ID and secret. Use **Offline** access with the consent prompt. Enter `https://www.googleapis.com/auth/drive.file` in Step 1 and authorize using the **same account as `SMTP_USER`**.
7. In Step 2, exchange the authorization code for tokens. Store the **refresh token** as `DRIVE_REFRESH_TOKEN` in Render. Do not replace `GMAIL_REFRESH_TOKEN`; a short-lived access token is not the refresh token.
8. The application creates **CareSync Database Backups** privately in that account's My Drive on the first backup. Do not pre-create a folder and expect `drive.file` to grant access to it. No folder ID or public sharing setting is needed. Leave the app-created folder unshared.

Never put credentials, the encryption key, database archives, or medical records in frontend `VITE_*` variables, public source, screenshots, or GitHub workflow text.

## Server settings

The existing `MONGO_URI`, `SMTP_USER`, `GMAIL_CLIENT_ID`, and `GMAIL_CLIENT_SECRET` are reused. Set these additional Render environment variables:

| Variable | Value |
| --- | --- |
| `BACKUP_ENABLED` | `true`, once the other settings are ready |
| `DRIVE_REFRESH_TOKEN` | The separately authorized Drive refresh token |
| `BACKUP_ENCRYPTION_KEY` | 32 random bytes encoded as base64 |
| `BACKUP_SCHEDULER_TOKEN` | A separate random secret of at least 32 characters |
| `UPLOAD_STORAGE` | `gridfs`, so file bytes are included |

Generate the two independent secrets locally, in a private terminal:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

The first output is the encryption key; the second is the scheduler token. Store the key in a separate password manager/offline recovery record as well as Render. Losing the key makes encrypted backups unusable. Keep old keys with the backup dates they decrypt if rotating the key.

Render's build command must be:

```text
npm ci --omit=dev && node scripts/install-mongodb-tools.js
```

The installer downloads MongoDB Database Tools 100.19.1 from MongoDB, checks its pinned SHA-256, and installs `mongodump` in `backend/bin/`. `render.yaml` records this build command. For local Windows testing, install [MongoDB Database Tools](https://www.mongodb.com/try/download/database-tools) and set `MONGODUMP_PATH` to the absolute `mongodump.exe` path.

Restart/redeploy after environment changes. The initial readiness check verifies configuration; the first job verifies Google account access and upload permissions. An API process restart records unfinished jobs as failed, with instructions to inspect Drive before retrying.

## Enable the daily cron job

Render Free sleeps while idle, so an in-process timer would miss backups. The workflow in `.github/workflows/database-backup.yml` runs outside Render and wakes the API by requesting the backup. [Render free-service behavior](https://render.com/docs/free).

1. Publish the workflow to the GitHub repository's **default branch** and enable GitHub Actions.
2. Under **Settings → Secrets and variables → Actions → Variables**, set `BACKUP_API_URL` to `https://caresync-api-uhvz.onrender.com`.
3. Under **Secrets**, set `BACKUP_SCHEDULER_TOKEN` to the **same value stored in Render**. The workflow does not need the database URI, Drive token, or encryption key.
4. Confirm that **Daily database backup** appears under Actions. Its cron expression is `0 10 * * *`: 10 AM UTC = 6 PM Manila. Manual workflow dispatch is available after 6 PM; use the Admin button for daytime testing.
5. The workflow polls the recorded job until it completes or fails. A completed scheduled backup is reused for repeated requests on the same Manila date. Failed/interrupted jobs can be retried. Check Actions failure notices and the Admin backup history.

GitHub schedules can be delayed or dropped during high load; this is not an exact-time guarantee. Public-repository schedules are disabled after 60 days without repository activity. Keep the workflow enabled and monitor missing daily backups. [GitHub scheduling rules](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

## What is captured and how it is protected

`mongodump --archive --gzip` captures the whole application database, BSON types, collection metadata/indexes, and GridFS `medicalFiles.files` plus `medicalFiles.chunks`. Local upload storage is rejected because a database dump would omit those file bytes.

The current deployment has one API process. Clinic requests are blocked while existing requests and tracked event writes drain and the database is captured. Backup status reads remain available. Requests resume before the Drive upload starts. Keep other direct database writers and any local API using the same database stopped; this guard does not coordinate other processes or direct Atlas edits. Do not deploy/restart during a backup. Multi-instance operation requires a shared maintenance mechanism or managed snapshots before enabling this workflow. [MongoDB consistency requirements](https://www.mongodb.com/docs/manual/tutorial/backup-and-restore-tools/).

The archive streams directly through AES-256-GCM into a temporary encrypted file. The database URI is passed in a private temporary configuration file rather than process arguments. Raw tool/provider errors are not returned to clients. Google Drive's file size and MD5 must match the local encrypted bytes before success is recorded; SHA-256 is retained in the Admin history and Drive app metadata. Temporary credentials and archives are removed after the job. No old backups are automatically deleted; monitor Drive capacity and establish a retention policy.

This feature backs up the database. Preserve matching web/backend source, the separate mobile repository, documentation, configuration/recovery secrets, and source revision separately. Render's local files are temporary; download encrypted archives from Drive to retain an additional local copy.

## First backup and isolated recovery demonstration

1. After Google/server configuration, open **Admin → Database backups → Back up now**. Wait for **Completed**, then open the file in Drive using the clinic Gmail account. Confirm the matching date and recorded checksum.
2. Download the `.csbackup` file to private local storage. Save a local encrypted copy and verify its SHA-256 against the Admin history.
3. Set `BACKUP_ENCRYPTION_KEY` privately in `backend/.env` or the terminal environment. Decrypt into a new local archive:

   ```text
   node backend/scripts/decrypt-backup.js private-backup.csbackup private-restore.archive.gz
   ```

   The command authenticates the archive before publishing the plaintext output. A wrong key, modified archive, or existing output file causes failure. Protect/remove the plaintext restore archive when testing finishes.
4. Create an **isolated** restoration target and a private MongoDB tools YAML config containing its URI. Match the MongoDB version/compatibility and encryption key. Confirm the source database name from the Admin result, then restore with namespace mapping, for example:

   ```text
   mongorestore --config private-restore.yaml --archive=private-restore.archive.gz --gzip --nsFrom="caresync_app.*" --nsTo="caresync_restore_test.*"
   ```

   Do not target production or use `--drop`. If the source database name differs, replace the source namespace. Keep the isolated API's email and scheduled backups disabled; never use production connection settings for the restored test app. Do not expose the test API to clinic users.
5. Verify account/appointment/comment/history/audit/inbox counts and relationships, indexes, current/previous medical file hashes/downloads, and test-account sign-in. Save sanitized export/restore logs, evidence, actual duration, and the code revision used. No successful live backup or full restore is claimed until these steps are executed.
