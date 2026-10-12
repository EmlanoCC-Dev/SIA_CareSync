# Evidence manifest

This manifest covers everything added under `docs/final_submission/evidence/` in commits `3073c82` (Appendix C screenshots) and `7a234e2` (Appendix E attachments), plus this file. That is 100 files from those commits plus `MANIFEST.md`. The code under test is unchanged at `0e87172`. Nothing in `../testing-evidence/` or `../final-paper.md` was modified.

## Files added

| File(s) | Purpose | Appendix C | Appendix E line |
| --- | --- | --- | --- |
| `README.md` | Environment, commands, synthetic accounts, OTP handling, limitations | All SC | Screenshots; reproduction |
| `screenshots/INDEX.md` | Per-capture index: file, what it shows, time, method, limitation | SC01–SC12 | Screenshots |
| `screenshots/SC01a…SC01c` (3 PNG) | Signup with email disabled, verify step, Patient dashboard and role | SC01 | Screenshots |
| `screenshots/SC02a…SC02c` (3 PNG) | Weekly hours saved; generated Available slots; pre-save default slots | SC02 | Screenshots |
| `screenshots/SC03a`, `SC03b` | Correction request, resubmission history, retained visit ID | SC03 | Screenshots |
| `screenshots/SC04a…SC04c` | Approval, the patient's own inbox with "Email unavailable" status, manual read receipt | SC04 | Screenshots |
| `screenshots/SC05a…SC05c` | Private check-in, combined queue with walk-in, public ticket-only display | SC05 | Screenshots |
| `screenshots/SC06a`, `SC06b` | Separate start action; start/complete history | SC06 | Screenshots |
| `screenshots/SC07a`, `SC07b` | Note/document versions with author and time; protected historical download | SC07 | Screenshots |
| `screenshots/SC08a…SC08c` | Owner-specific inboxes and comment thread | SC08 | Screenshots |
| `screenshots/SC09a…SC09c` | Date-range reports (Admin and Doctor scope); audit trail | SC09 | Screenshots |
| `screenshots/SC10a…SC10c` | Edit and deactivate; account retained; sign-in blocked | SC10 | Screenshots |
| `screenshots/SC11-negative-access-responses.png`, `SC11-negative-requests.json` | Sanitized 401/403 responses plus 200 controls | SC11 (and SC07) | Screenshots; integration (negative cases) |
| `test-results.md`, `test-runs/*.txt`, `test-runs/summary*.json` (24 files) | Raw output per suite, summary table, verbatim environment-dependent failure | — | Test results |
| `integration-evidence.md`, `integration/IE01…IE09*.json`, `integration/summary.json` | Appendix B fields for booking through reports, with audit and notification records | SC03–SC09 (API side) | Integration evidence |
| `deployment-inventory.md` | Services, build/start commands, variable names, recorded URLs, unconfirmed items | SC12 (context only) | Deployment inventory |
| `synthetic-export/*.json` (13 files incl. `manifest.json`) | Synthetic database export, no password/OTP hashes or tokens | — | Synthetic export |
| `reproduction.md` | How to recreate the synthetic data from scratch | — | Synthetic export |
| `backup-status.md` | What exists, an honest "no real backup/restore", and the local isolated mongodump/mongorestore drill | SC12 (not captured) | Backup/restore |
| `tools/lib.js`, `tools/browser.js` | Shared harness: local-DB guard, OTP stand-in, sanitizer, Playwright helpers | All SC | Reproduction |
| `tools/bootstrap.js`, `tools/sc01.js` … `tools/sc11.js` (12 scripts) | Account bootstrap and per-capture UI scripts | SC01–SC11 | Screenshots; reproduction |
| `tools/run-tests.js` | Test runner that saves raw output | — | Test results |
| `tools/integration.js` | Appendix B API run | — | Integration evidence |
| `tools/export-synthetic.js` | Synthetic DB export | — | Synthetic export |
| `MANIFEST.md` | This file | — | — |

## Appendix C coverage

| ID | Status | Reason |
| --- | --- | --- |
| SC01 | **Provided** | Live UI. Email was disabled, so the OTP send was stubbed by the harness. This is stated in the index, and no code is visible. |
| SC02 | **Provided** | Doctor, date, window, 30-minute duration and Available status shown. SC02c documents the pre-save default slots. |
| SC03 | **Provided** | Original/current reason, explanation, actor/role/time and #8e85d5 retained across revisions. |
| SC04 | **Partly provided** | Status, recipient-owned inbox, timestamp and manual read are shown. Email delivery shows "Email unavailable" because email was disabled; a real delivery timestamp needs a run with email on. |
| SC05 | **Provided** | Private staff check-in versus a public display with tickets only. |
| SC06 | **Provided** | Separate start and complete actions with history. |
| SC07 | **Provided** | Version, author and time for notes and file. The historical download is denied to others (403/401) and allowed to the owner and assigned doctor (200). |
| SC08 | **Provided** | Participants, timestamps, and separate per-owner unread state. |
| SC09 | **Provided** | Date range plus Admin and Doctor scope; actor and target in the audit trail. Doctor scope is shown by the label and the missing filter; the synthetic set has no second doctor's appointments to exclude. |
| SC10 | **Provided** | Edit, deactivate, record retained, sign-in blocked. |
| SC11 | **Provided** | Sanitized negative requests with real status and body. |
| SC12 | **Not provided (needs a person)** | Needs the deployed environment and a real Drive backup/restore. |

## Appendix E coverage

| Appendix E line | Status | Reason |
| --- | --- | --- |
| Specification review | **Not provided (needs a person)** | A confirmed requirement review needs the client or adviser. Nothing new was added here; the existing `../specification-compliance-report.md` is generated, not confirmed. |
| Baseline interview notes | **Not provided (needs a person)** | Clinic interview notes can only come from the people interviewed. |
| Test results | **Provided** | 21/21 runs passed (19 suites, live concurrency mode, frontend build). An environment-dependent `demo-reset` failure under `UPLOAD_STORAGE=gridfs` is recorded verbatim. |
| Integration evidence | **Provided** | Nine Appendix B records from the real local API. SMTP is recorded as disabled and not sent. |
| Deployment inventory | **Partly provided** | Everything recorded in the repo is listed. The live state, dashboard values and URL reachability were deliberately not checked. |
| Backup/restore | **Partly provided** | Procedure, code and passing test documented, plus a local isolated tools drill. No real Drive backup or restore has been performed (needs a person). |
| Synthetic export | **Provided** | Export plus reproduction steps; no hashes or tokens. |
| Screenshots | **Partly provided** | SC01–SC11 captured live. SC12 not captured. |
| Slides | **Not provided (needs a person)** | Not part of this run. |
| Contribution sheet | **Not provided (needs a person)** | Only the team can state each member's contribution. |
