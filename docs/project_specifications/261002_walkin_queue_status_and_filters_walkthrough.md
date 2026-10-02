# CareSync: Walk-in queue actions and filters

**Updated:** October 2, 2026 (Asia/Manila)

The walk-in queue's Check In, Start Session, Complete, and Left buttons now use a registered backend endpoint. Status and date filters are applied by the backend, including Doctor assignment restrictions.

## Changes

- Added `PATCH /api/walkins/:id/status`, protected by central JWT authentication and role/assignment checks.
- Added permitted transitions, linked appointment/slot validation, conditional writes, and compensating rollback if a later write fails.
- Added a `WALKIN_STATUS_UPDATED` audit event with the actor, target, previous status, and requested status. Linked appointment and slot events are emitted after successful changes.
- Applied validated `status` and `date` filters to `GET /api/walkins`. Invalid filters return 400. The holding view contains Waiting entries for the requested day.
- Removed the frontend's duplicate doctor filtering, which could hide records when the doctor reference was populated as an object. The backend retains the authoritative assignment check.
- The UI omits the date parameter so the backend uses the clinic system clock. It handles stale responses, shows loading/error states, and disables action buttons during an update.
- Automatic no-show processing skips checked-in walk-ins waiting for their doctor, even if the appointment's end time passes.

## Transitions and permissions

| Action | Walk-in change | Appointment | Slot | Permitted actor |
| --- | --- | --- | --- | --- |
| Check In | Slot Assigned → Checked In | Remains Confirmed; arrival added to history | Remains Reserved-Confirmed | Staff/Admin |
| Start Session | Checked In → In Progress | In Progress | In Progress | Assigned Doctor or Staff/Admin |
| Complete | In Progress → Completed | Completed | Completed | Assigned Doctor or Staff/Admin |
| Left | Waiting, Slot Assigned, or Checked In → Left | Cancelled when linked | Available; reservation reference cleared when linked | Staff/Admin |

The existing UI exposes Start Session and Complete on the Doctor queue; Staff/Admin can also perform these actions through the API. Patients cannot access private queue operations. Doctors cannot modify another doctor's walk-in or perform reception-only actions.

Invalid/skipped/repeated transitions return 409. Malformed IDs/status values return 400, missing entries return 404, missing authentication returns 401, and denied permissions return 403. A linked entry must reference the same appointment, slot, and doctor in all three records before changing state.

## Walkthrough

1. Sign in as Staff and open Walk-in Queue. Add a patient and assign an available slot.
2. Click Check In. The queue becomes Checked In while the appointment remains Confirmed and the slot remains reserved. Select Checked In in the dropdown; only matching entries should remain.
3. Sign in as the assigned Doctor and open Walk-in Queue. Click Start Session. The queue, appointment, and slot become In Progress. The public display shows the ticket number when its next poll runs.
4. Click Complete. All three records become Completed; the entry leaves the public waiting/serving display on refresh.
5. For a different waiting/assigned/checked-in patient, sign in as Staff and click Left. Any linked appointment becomes Cancelled, and its slot becomes Available. An unassigned entry changes only its queue status.
6. Select each status and All Statuses to verify filtering. API clients can additionally request a day, for example `GET /api/walkins?status=Completed&date=2026-10-02`. The date is interpreted in the backend's local clinic-day convention, with the next midnight excluded.

## Verification

```powershell
node backend/tests/walkin-status.check.js
node backend/tests/clinic-workflows.check.js
node backend/tests/api-access.check.js
```

The focused walk-in check passed 35 HTTP checks covering lifecycle transitions, linked record states, permissions, conflicts, simulated write failures and rollback, events, public display data, filters, and protection against marking an arrived patient as a no-show. Existing workflow checks passed. API access checks passed 110 HTTP checks, including missing-login rejection on all 31 registered private routes. The frontend production build passed.

These backend checks use isolated model doubles and do not connect to MongoDB or change real patient data. The expanded [UI smoke script](../ui-smoke.mjs) passed at 1440px and 390px, including Staff Check In/Left and Doctor Start Session/Complete, followed by status-filter verification. It uses mocked APIs; changed queue screenshots were also visually reviewed. Live persistence, competing database writes, and the complete clinic journey still need verification.

## Remaining limits

- Conditional writes and compensating rollback support the existing standalone MongoDB setup. They are not a multi-document transaction: an outage during writes or recovery may still require reconciliation, and competing writes through other appointment endpoints still need live testing.
- Subsequent October 2 work activated guarded slot-freed reassignment, daily ticket uniqueness, coordinated generation, and durable booking/assignment recovery. See the [concurrency/recovery walkthrough](261002_concurrency_and_assignment_recovery_walkthrough.md). The status-transition rollback described here remains separate from that assignment journal.
- Scheduled patients are still excluded from the walk-in display. Scheduled appointment check-in still starts consultation immediately; only the queue-specific walk-in flow separates arrival from start.
- Live concurrency verification, persistent notifications/delivery, and the other gaps in the [assessment](261001_project_specification_gap_analysis.md) remain open.

Implementation: [walk-in service](../../backend/src/services/walkIn.service.js), [controller](../../backend/src/controllers/walkIn.controller.js), [routes](../../backend/src/routes/walkIn.routes.js), [queue UI](../../frontend/src/components/WalkInQueue.jsx), and [focused check](../../backend/tests/walkin-status.check.js).
