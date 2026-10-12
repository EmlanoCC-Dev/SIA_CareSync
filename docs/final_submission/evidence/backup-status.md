# Backup and restore status (honest record)

**No real CareSync backup or restore has been performed for this evidence.** Google Drive, the Render service, the GitHub workflow and the production database were not contacted. `docs/deployment/database-backups.md` (configured 2026-10-12) also states that no real backup or isolated restore had been performed at setup.

## What exists in the repository

| Item | Location | Status |
| --- | --- | --- |
| Documented procedure (Google/Drive setup, server settings, daily trigger, first-backup and isolated-recovery steps) | `docs/deployment/database-backups.md` | Written; recovery steps not yet carried out |
| Backup service (maintenance pause, `mongodump` archive, encryption, Drive upload, status records) | `backend/src/services/databaseBackup.service.js`, `driveBackup.service.js`, models `DatabaseBackup`, `BackupSchedule` | In code |
| Admin UI (Back up now, status, daily time) | `frontend/src/components/DatabaseBackups.jsx` | In code |
| Scheduler endpoint with a separate token | `backend/src/routes/backupScheduler.routes.js` (`/api/backup-jobs`, `X-Backup-Token`) | In code |
| External daily trigger | `.github/workflows/database-backup.yml` | In repo; run history not visible from the repo |
| Decryption script for recovery | `backend/scripts/decrypt-backup.js` | In repo; not run against a real backup |
| Tool installer for Render | `backend/scripts/install-mongodb-tools.js` | Linux x64 only |
| Automated test | `backend/tests/database-backup.check.js` | **Passed** on 2026-10-12. Uses doubles for the tool process, database records and Google responses. Covers authorization, scheduling, maintenance, encrypted dump/restore bytes, tamper rejection and Drive scope/upload. See `test-results.md`. |

## Local isolated drill (not the Drive pipeline)

> **This is a local isolated drill, not the Drive pipeline.** It shows only that MongoDB Database Tools can dump and restore the disposable synthetic database. It did not use CareSync's backup service, its encryption, Google Drive or `decrypt-backup.js`.

| Item | Value |
| --- | --- |
| When | 2026-10-12 08:58 UTC |
| Where | Inside the disposable Docker container `caresync-evidence-mongo` (`mongo:8.0`, server 8.0.32) |
| Tools | `mongodump` / `mongorestore` 100.19.1, bundled in the image |
| Source | `caresync_evidence` (synthetic data only) |
| Target | `caresync_restore_drill` (a new database in the same container) |

Commands (Git Bash; `MSYS_NO_PATHCONV=1` stops Git Bash from rewriting `/tmp`):

```bash
docker exec caresync-evidence-mongo mongodump --db caresync_evidence --archive=/tmp/drill.archive.gz --gzip
docker exec caresync-evidence-mongo mongorestore --archive=/tmp/drill.archive.gz --gzip --nsFrom='caresync_evidence.*' --nsTo='caresync_restore_drill.*'
```

| Check | Result |
| --- | --- |
| Archive | `/tmp/drill.archive.gz` inside the container, 9,676 bytes, SHA-256 `41d2cda4e17ee04147dbe89f9f2331ce93d5f835926a04513aed44b4ef888c3c`. Not copied out or committed. |
| Elapsed (measured from the host around each `docker exec`) | dump 0.64 s, restore 2.47 s |
| Restore output | `138 document(s) restored successfully. 0 document(s) failed to restore.` |
| Per-collection document count and `dbHash` (source vs restored) | All 14 collections matched: appointmentcomments 2, appointments 3, assignmentrecoveries 3, auditlogs 43, backupschedules 0, databasebackups 0, emailotps 3, medicalFiles.chunks 4, medicalFiles.files 4, notifications 45, slotplans 2, slots 22, users 6, walkins 1 |
| Indexes | Spot check: `users` has 2 indexes in both databases |

The first attempt failed because Git Bash rewrote `/tmp/...` to a Windows path (`Failed: open C:/Users/<user>/AppData/Local/Temp/drill.archive.gz`). Nothing was dumped or restored in that attempt. It was re-run with `MSYS_NO_PATHCONV=1`.

## Still needed (needs a person with access)

1. Run **Back up now** (or let the scheduled job run) on the deployed service, and confirm the encrypted archive appears in the clinic Drive folder.
2. Follow the isolated-recovery steps in `docs/deployment/database-backups.md`: download the archive, decrypt it with `backend/scripts/decrypt-backup.js` and the offline key, restore it into a **separate** database, and verify counts against production.
3. Record the date, archive name, size, checksum, elapsed time and verification result. This is SC12 / the Appendix E backup line.
