# Walk-in Patient Details in Appointment Tables

**Implemented:** October 2, 2026 (Asia/Manila).

Assigned walk-ins intentionally appear in Staff/Admin appointment lists and their assigned Doctor’s list. Assigning a slot creates a single appointment linked to the walk-in record; unassigned entries remain in the Walk-in Queue.

Previously, these tables displayed only `appointment.patient.firstName/lastName/email`. Account-free walk-ins have no `patient` account reference, so their patient-details cell was blank even though the API populated `appointment.walkIn` with a saved name and contact number.

## Changes

All three private tables now use [AppointmentPatientDetails](../../frontend/src/components/AppointmentPatientDetails.jsx):

- Name: account name when available, otherwise the linked walk-in name, otherwise **Patient details unavailable**.
- Contact: account email or contact number when available, otherwise the walk-in contact number.
- Source: a **Walk-in · Queue #…** label when a walk-in reference exists. If the ticket number is unavailable, show **Walk-in** without inventing a number.
- Existing registered-patient names/email remain visible.

The [Staff](../../frontend/src/pages/StaffDashboard.jsx), [Doctor](../../frontend/src/pages/DoctorDashboard.jsx), and [Admin](../../frontend/src/pages/AdminDashboard.jsx) tables share this component so their fallback behavior stays consistent. The existing consultation modal already handles walk-in names.

No database migration or automatic account creation is required. The fix reads existing API data and preserves the linked appointment/queue records. Patient portal lists remain scoped to their authenticated owner; the public waiting-room display still shows tickets rather than names.

## Walkthrough

1. Reload the frontend after rebuilding/restarting it.
2. Sign in as Staff and register a walk-in with a name/contact number in **Walk-in Queue**.
3. Assign a valid doctor/slot. Open **Appointments**: the assigned visit shows the walk-in name, contact, and queue label.
4. Sign in as that Doctor: the same details appear in their consultation list. Admin can also see them in **All Appointments**.
5. Check an existing registered patient appointment: the account name/email still appear.
6. The walk-in can continue through check-in/start/completion without creating a login account. Only a verified account link would enable that patient’s portal/inbox access; this change does not add account linking or repeat-visit patient profiles.
7. If an old linked identity is missing or unavailable, the table explicitly displays **Patient details unavailable**. Recover the original identity from clinic records rather than treating the fallback as a replacement patient record.

## Verification

From `frontend`, run `npm.cmd run build`. From the repository root:

```powershell
node backend/tests/api-access.check.js
node docs/ui-smoke.mjs <puppeteer-module-path> <chrome-executable-path> http://127.0.0.1:3000
```

The production build passed. The expanded browser check passed at 1440px and 390px using mocked API data: account-free walk-in names/contact/queue labels for Staff/Doctor/Admin, an explicit unavailable-identity fallback, registered patient details, and the existing role workflows. Changed screenshots were visually reviewed. API access checks passed 113 HTTP checks across 34 private routes. These checks do not replace verification with live MongoDB/test accounts.

See the [current gap analysis](261001_project_specification_gap_analysis.md) for remaining workflow and submission work.
