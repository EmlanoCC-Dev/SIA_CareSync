# CareSync UI review — October 6, 2026

All three browser suites and the production build passed. The broad suite recorded **275 screen captures** across the public pages and all four roles. The focused record/account suite produced 32 captures; demo-reset checks produced four. These checks used synthetic data and intercepted API responses. They establish browser behavior, layout and recovery for the exercised cases; live MongoDB persistence, SMTP delivery and a complete live clinical journey require separate evidence.

## Issues corrected

| Issue | Correction and verification |
| --- | --- |
| Admin navigation covered Notifications and the clock, as in the reported screenshot. | Put each role's navigation into the sidebar's normal flow; allow scrolling when space runs out. Navigation controls and clinic tools remain separate at 1920 × 870 and at each tested breakpoint. |
| Failed appointment, directory and audit loads appeared as empty lists or silently retained stale results. | Show a visible error and Retry control; retain prior rows during failed refreshes; distinguish unavailable lists from successful empty results. Admin's appointment and user requests recover independently. |
| Booking and slot management hid failures to load doctors or available slots. | Show load errors and retry controls. A failed slot request cannot enable a booking with an old selected slot. Ignore late booking responses after a date/doctor change or closing the form. |
| Booking, walk-in and clock popups allowed keyboard focus into the background and lacked consistent Escape handling. | Use native modal dialogs. Tab stays within the active dialog or browser chrome; Escape closes without submitting; dismissal is blocked while saving. |
| Clock settings could show a default “Clinic OPEN” after a failed read. | Display an error with Retry and hide the claimed current status until recovery. An unavailable sidebar status uses a neutral indicator. |
| Dates could slip to the previous day around midnight in Manila. | Use local calendar dates consistently for booking limits, clock inputs/presets, initial slot generation and reports. Tested 2026-09-30 17:00 UTC, which is October 1 at 01:00 in Manila. |
| Afternoon flexible-booking choices were parsed as morning times. | Read the AM/PM suffix for the whole time range. At 09:00, 08:00 AM is unavailable while 01:00 PM remains available. |

The browser test also now distinguishes action confirmations from an underlying consultation dialog and resets appointment fixtures between role scenarios. This prevents test failures caused by selecting the wrong dialog or carrying one role's fixture mutations into another scenario.

## Screen and interaction coverage

| Area | Exercised behavior | Evidence |
| --- | --- | --- |
| Public entry | Landing page, login/register dialogs, switching forms, keyboard focus and Escape. | [Broad run](run-output/ui-smoke.txt), `screenshots/ui/landing-*`, `login-*`, `register-*`. |
| Every role's workspace | Role navigation, selected view, account controls, sidebar overlap, horizontal overflow and broken images. | [Capture index](screenshot-index.md), including all four `navigation-1920x870` views. |
| Appointments | Initial failures, retry, stale-row preservation after failed refresh, Admin partial recovery, registered/walk-in/missing patient display. | `screenshots/ui/*load-error*`, `*load-recovered*`, `walkin-appointment-identity-*`. |
| Patient booking | Doctor/slot failures and recovery, submission disabled after failed slot load, midnight minimum date, morning/afternoon availability, focus and Escape. | `screenshots/ui/booking-*`. |
| Appointment actions | Cancel, decline with required reason, approve, no-show, complete; confirmation, Escape/cancel without mutation, one request per confirmed action, server error notice. | `screenshots/ui/*Cancel-appointment*`, `*Decline-appointment*`, `staff-*`, `error-notice-*`. |
| Details/comments/corrections | Four-role threads, draft preservation on failure, correction/resubmission/history, permission-specific controls and delivery status. | [Focused run](run-output/comments-ui.txt), `screenshots/records-and-accounts/`. |
| Consultation/records | Start consultation, current/history displays, save failure/retry, unchanged-save behavior, replacement/archive, late-save draft preservation, protected download request with token. | Both browser runs; `consultation-*`, `records-*`, `record-*`. |
| Notifications | Role inbox, unread count, individual/all read actions, pagination, empty inbox, failed read/load and retry, timestamp visibility, focus and Escape. | `screenshots/ui/notifications-*`. |
| Clock | Read-only access for Patient/Doctor/Staff, Admin editing, failed status/retry, keyboard dismissal, local date and preset request. | `screenshots/ui/clinic-clock-*`. |
| Slots/weekly hours | Staff/Doctor views, doctor/slot failures and recovery, block confirmation, generator feedback, seven-day editor and save payload. | `screenshots/ui/*slots*`, `weekly-hours-*`. |
| Walk-ins/assignment | Queue and status filters, start/complete/check-in/left actions, assignment dialog, add form, flexible appointment assignment, requested date retained. | `screenshots/ui/*queue*`, `assign-slot-*`, `walkin-form-*`, `flexible-assignment-*`. |
| Accounts/OTP/password | Add/edit/deactivate/reactivate UI, signup-code and password-code flows and failed requests. | Both browser runs; `users-*`, `add-user-*`, `edit-user-*`, `signup-otp-*`, `password-change-*`. |
| Reports/audit | Period/scope controls, populated/empty reports, user/document/slot audit details, audit failure with retained rows and retry. | `screenshots/ui/reports-*`, `audit-*`. |
| Demo reset | Exact typed confirmation, failure/retry, disabled busy controls, refreshed counts, session preservation; synthetic responses only. | [Reset UI run](run-output/demo-reset-ui.txt), `screenshots/demo-reset/`. |
| Public waiting room | Scheduled and walk-in ticket display, multiple serving tickets, populated/empty states, absence of fixture patient names. | `screenshots/ui/display-*`. |
| Sign out | Escape/Stay signed in retain session; confirmation clears token and returns to landing page. | `screenshots/ui/sign-out-*`. |

Full role and interaction runs used 1440 × 960 and 390 × 960. Additional navigation checks used 1920 × 870, 1280 × 720, 1120 × 701, 1100 × 900, 1440 × 650, 768 × 1024 and 320 × 640. Dialogs encountered in the desktop run were also checked at 320 × 640. Automated assertions found no uncaught JavaScript errors, broken loaded images, page-wide horizontal overflow, overlapping workspace controls or dialog content extending horizontally in the exercised views. Tables intentionally scroll inside their containers. Screenshots were reviewed for representative desktop and narrow-phone layouts.

## Environment and reproduction

- Date: October 6, 2026; Asia/Manila.
- Chrome: 154.0.8037.97; Node: v24.11.1; Puppeteer Core: 25.12.0; Vite: 6.4.3.
- Preview: `http://127.0.0.1:3000`; browser timezone explicitly set to Asia/Manila for the broad suite.
- Baseline commit: `e179fd10ce98aea2fe9c737c9c14421fb8786da2`, plus the uncommitted working-tree changes. [Source hashes](source-hashes.csv) identify the reviewed frontend/test files.
- Final assets: `index-BjuUCXMb.css` and `index-C6cVvcyP.js`. [Build output](run-output/frontend-build.txt).
- Browser tools were installed under ignored `build/ui-tools`; application dependencies and lockfiles were unchanged.

Run from the repository root. Start the preview in a separate terminal after building:

```powershell
npm.cmd --prefix frontend run build
npm.cmd --prefix frontend exec vite preview -- --host 127.0.0.1 --port 3000 --strictPort
```

Then run:

```powershell
node docs/ui-smoke.mjs ./build/ui-tools/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js
node docs/comments-ui.check.mjs
node docs/demo-reset-ui.check.mjs ./build/ui-tools/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js
```

The broad and reset scripts accept an alternate Chrome executable as their next argument. The original output names temporary screenshot directories; the submitted copies are indexed alongside this report.

## Additional backend evidence and remaining submission work

The 13 isolated baseline backend suites were rerun successfully on October 6; their individual outputs are in `run-output/`. The API suite reported 125 HTTP checks across 44 private routes in the current working tree. The separate demo-reset backend check also passed with isolated model/filesystem doubles; injected storage/permission failures and negative HTTP responses are expected assertions, and no real records or files were deleted.

These results support the paper's UI01 evidence and the isolated portions of its test matrix. They do not complete E2E01 or replace the required case-level live integration, actual email receipt, deployment and backup/restore records. Use the paper's categorized matrix and completion checklist to finish those records; retain the distinction between mocked browser, isolated backend and live results.
