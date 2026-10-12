# Test results (Appendix E)

All results come from local runs on 2026-10-12, between 16:52 and 16:55 (+08:00), at commit `0e87172` (the code under test; this evidence was committed afterwards).

| Item | Value |
| --- | --- |
| Node.js | v26.8.1 |
| OS | Windows_NT 10.0.26300 x64 (Windows 11 Home Single Language) |
| Runner | `docs/final_submission/evidence/tools/run-tests.js` (one process per suite; exit code 0 = pass) |
| Environment | Evidence variables exported so dotenv loaded nothing from the real `backend/.env`. `UPLOAD_STORAGE=local` (the `.env.example` default). `TEST_MONGO_URI=mongodb://127.0.0.1:27017` (disposable Docker MongoDB 8.0) for the optional live concurrency run only. |
| Raw output | `test-runs/<suite>.txt` and `test-runs/summary.json`. Absolute paths are replaced with `<repo>` / `<home>`. |

None of the tests were edited.

## Summary

| Suite | Result | Time | Suite's own pass line (abridged) |
| --- | --- | --- | --- |
| accounts-noshow.check.js | Pass | 1.4 s | Account edit/role/status, deactivated login/session/booking, no-show expiry |
| api-access.check.js | Pass | 3.9 s | 128 HTTP checks; authentication on all 47 private routes; ownership/assignment |
| audit-coverage.check.js | Pass | 1.8 s | 33 audit HTTP checks: actor/target attribution, metadata privacy |
| clinic-workflows.check.js | Pass | 1.7 s | Schedule generation, block/reopen, assignment rollback, report scope |
| comments.check.js | Pass | 2.0 s | 52 comment HTTP checks, private notifications, audit |
| concurrency.check.js | Pass | 0.8 s | Isolated: unique tickets, competing assignments/bookings |
| concurrency.check.js --live | Pass | 2.3 s | **Live MongoDB** (throwaway `cs_test_*` database, dropped by the suite) |
| corrections.check.js | Pass | 2.0 s | 65 correction HTTP checks, history/audit/notification attribution |
| database-backup.check.js | Pass | 1.9 s | Backup authorization, scheduling, encrypted dump/restore bytes, tamper rejection, Drive scope/upload checks (all doubles) |
| demo-reset.check.js | Pass | 1.2 s | Role/confirmation guards, account preservation, failure retry |
| deployment.check.js | Pass | 2.2 s | 77 deployment HTTP checks plus Philippine clinic-hour boundaries |
| email-notifications.check.js | Pass | 0.8 s | Gmail transport doubles; no real email sent |
| file-storage.check.js | Pass | 1.2 s | GridFS double: protected/versioned downloads, size limits |
| gmail-api.check.js | Pass | 0.2 s | Mock HTTPS only; no live email |
| notifications.check.js | Pass | 1.5 s | 32 owner-scoped HTTP checks |
| otp.check.js | Pass | 3.2 s | 30 OTP/auth HTTP checks, replay/guessing/cooldown |
| scheduled-queue.check.js | Pass | 1.2 s | 26 scheduled-queue HTTP checks |
| versions.check.js | Pass | 1.9 s | 58 version-history HTTP checks |
| walkin-account.check.js | Pass | 1.4 s | 29 HTTP checks, verified ownership |
| walkin-status.check.js | Pass | 1.3 s | 35 walk-in HTTP checks |
| `npm --prefix frontend run build` | Pass | 6.5 s | Vite: 1870 modules transformed, built in 4.83 s |

**Result: 21 of 21 runs passed (19 suites, the optional live concurrency mode, and the frontend build).**

`database-backup.check.js` passed. Its stderr lines (`[400] Provide a valid daily backup time…`, `[409] …scheduled for 18:00…`, `[503] Database backups are not enabled.`) are expected responses that the suite asserts. They are not failures.

## Failure observed (environment-dependent)

The first full run exported `UPLOAD_STORAGE=gridfs`, the setting used for the screenshot run. In that run `demo-reset.check.js` **failed** (exit 1). The verbatim output is in `test-runs/demo-reset.check.js.UPLOAD_STORAGE-gridfs.FAILED.txt`, and its run summary is in `test-runs/summary.UPLOAD_STORAGE-gridfs.json`. Decisive lines:

```
[Demo reset] Reset interrupted: Document storage is unavailable
❌  [500] Demo reset was interrupted; some data may have been cleared. Retry to finish clearing the remaining data.
AssertionError [ERR_ASSERTION]: Admin reset

500 !== 200
    at call (<repo>\backend\tests\demo-reset.check.js:71:12)
    at async main (<repo>\backend\tests\demo-reset.check.js:121:18) {
```

The suite passes with `UPLOAD_STORAGE=local` or with the variable unset. It does not stub GridFS storage, so it fails when the process environment selects `gridfs`. All other suites passed in both runs.

## Skipped

No suite was skipped. Every suite runs with doubles by default and contacts no external service (no Gmail, Google Drive or Atlas). The only live dependency is the optional `--live` concurrency mode, and it used the disposable local MongoDB.

## Side effect noticed

During these runs, `versions.check.js` (the only suite that references this fixture user) left an empty folder `backend/uploads/patient_000000000000000000000001_user1_test/general/` (git-ignored). It held no files and was removed after the run.
