# Backup and restore status (honest record)

**Update, 2026-10-12 evening:** two real backups completed on the deployed service and one was restored into an isolated local database. See "Real backups and isolated restore" below. The sections after it, including the earlier local drill, are kept as recorded.

> Earlier statement, superseded by the section below: no real CareSync backup or restore had been performed when the first evidence was generated.


## Real backups and isolated restore (2026-10-12, Asia/Manila)

Source: screenshots and a saved-results export supplied by the backend developer (Imbang). They were reviewed, not re-run, for this paper. The restore export is `CareSync-restore-evidence.pdf` in this folder.

| Item | Result |
| --- | --- |
| Manual backup | 1:41 PM. Admin history "Completed", "Encrypted database backup verified in Google Drive". Drive file `CareSync-2026-10-12T05-41-18-734Z.archive.gz...` in the CareSync folder. |
| Scheduled backup | 7:25 PM, matching the saved daily time. Same status. Drive file `CareSync-2026-10-12T11-25-47-980Z.archive.gz.csbackup` (6,250 bytes). Shows the GitHub Actions trigger and saved schedule working. |
| Backup ID restored | `6accc3bb3142cb22000eeba2` (the scheduled backup) |
| SHA-256 | Downloaded file matched the completed backup record: `c46de480d4c07361ac595b3f53c8b549e833d9fb3bc9cbf00cdee610c9718ede` |
| Decryption | Authenticated decryption passed using `backend/scripts/decrypt-backup.js` |
| Restore | `mongorestore`, no `--drop`, into `caresync_restore_1791806960247` on a local instance (127.0.0.1). 213 documents restored, 0 failed. |
| Counts | 15 of 15 collections matched (source before, restored, source after). Non-empty: auditlogs 7, backupschedules 1, databasebackups 2, slotplans 6, slots 192, users 5. |
| Pending AssignmentRecovery | 0. Offline recovery not needed. |
| Time | 10.682 s total (checksum, decryption, local database startup, restore, verification); mongorestore alone 2.355 s. Excludes tool installation and the Drive download. |

**Not tested, stated plainly:**

- File-byte recovery. The source database held zero uploaded files and zero GridFS chunks, so no file could be downloaded and compared.
- Role login, appointment histories and report totals on the restored copy: the database held no appointments.
- Realistic data volume. The 10.7 s time must not be read as evidence for the 60-minute recoverability target.
- The Admin display name is blurred in the committed screenshots (`screenshots/SC12a-backup-history.png`, `screenshots/SC12b-drive-folder.png`). The top edge of SC12a still shows the clinic sender address cut off.

## What exists in the repository

| Item | Location | Status |
| --- | --- | --- |
| Documented procedure (Google/Drive setup, server settings, daily trigger, first-backup and isolated-recovery steps) | `docs/deployment/database-backups.md` | Written; recovery steps carried out once on 2026-10-12 (see above) |
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

## Still needed

1. Repeat the restore with at least one synthetic uploaded file and compare a current and a prior file download (closes the GridFS gap).
2. Check role login and appointment histories on the restored copy.
3. Capture SC12 in full (health, redacted topology, backup ID and a restored record **and file**).
