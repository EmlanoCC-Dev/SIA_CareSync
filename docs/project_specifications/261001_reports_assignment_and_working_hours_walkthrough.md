# Reports, Flexible Appointment Assignment, and Doctor Schedules

**Date:** October 1, 2026 (Asia/Manila)

**Project:** CareSync — Healthcare Appointment, Queue, and Patient Notification Integration System

**Security follow-up:** The [API access-control walkthrough](261001_api_access_controls_and_security_walkthrough.md) documents the later login/role/record checks, authenticated medical downloads, Admin-only clock changes, and ticket-only public queue display.

## 1. Changes delivered

This implementation addresses three gaps from the [specification assessment](261001_project_specification_gap_analysis.md):

1. Reports with reporting-period filters.
2. Doctor/slot assignment for pending “Any Available Doctor” requests.
3. Recurring working-hours editing and connected slot-blocking actions.

The implementation uses existing React controls, Express routes, Mongoose models, event-driven audit logging, and native browser date/time/dialog controls. No application dependencies were added.

## 2. Access and navigation

| Capability | Patient | Doctor | Staff | Admin |
| --- | --- | --- | --- | --- |
| Submit an any-doctor booking request | Yes | No | No | No |
| Assign an existing flexible request | No | No | Yes | Yes |
| Approve an assigned request using the existing endpoint | No | No | Yes | Yes |
| View reports | No | Own consultations | Clinic-wide | Clinic-wide |
| Filter clinic reports by doctor | No | Own scope enforced | Yes | Yes |
| Read/edit weekly hours | No | Own schedule | Any doctor | Any doctor |
| Generate slots | No | Own slots | Any doctor | Any doctor |
| Block/reopen unbooked slots | No | Own slots | Any doctor | Any doctor |

- Staff and Doctor dashboards now include **Reports**.
- Admin includes **Reports** and **Slot Management**.
- Staff/Admin appointment rows offer **Assign doctor & slot** for pending patient requests without a linked slot.
- **Weekly hours** opens the recurring-hours editor inside Slot Management/My Slots.

## 3. Reports walkthrough

1. Sign in as Staff, Admin, or Doctor.
2. Select **Reports** in the workspace navigation.
3. The initial period runs from the first day of the current system month through the current system date. This follows simulated system time when active.
4. Select **From** and **To** using the native date controls.
5. Staff/Admin may select a doctor or keep **All doctors & unassigned**.
6. Select **Apply period**.
7. Review total appointments, completed consultations, pending requests, and no-shows.
8. Review the status breakdown, visits by scheduled day, and doctor workload tables.

The report displays the applied date range. Editing a filter does not change existing results until Apply period is selected. Empty periods and failures have explicit messages.

### What the counts mean

- Filter by the appointment's **scheduled date**, not creation date.
- Both selected dates are included. The backend uses an inclusive lower bound and the midnight after the selected end date as the exclusive upper bound.
- Date-only appointment data is queried/grouped in UTC, matching the stored slot dates.
- Statuses are the appointments' **current stored statuses**, not historical snapshots of their status at the reporting date.
- Assigned walk-in appointments count as appointments. Waiting walk-ins without an appointment do not count.
- Clinic-wide reports include unassigned requests. Selecting a specific doctor excludes unassigned requests.
- Doctor reports are restricted server-side to the authenticated doctor's ID, even if a different doctor ID is supplied manually.
- Report responses contain aggregate counts and doctor names, not patient names, contact numbers, notes, or documents.

### API

```http
GET /api/reports?from=2026-10-01&to=2026-10-31
Authorization: Bearer <token>
```

Staff/Admin may additionally supply `doctorId=<doctor ObjectId>`.

The response's `data` contains `from`, `to`, `scope`, `total`, `statuses`, `daily`, and `doctors`. Invalid calendar dates, reversed ranges, and malformed doctor filters are rejected.

## 4. Flexible appointment assignment walkthrough

### Patient submits the request

1. Sign in as a Patient and open **Book New Appointment**.
2. Choose **Any Available Doctor (Assigned by Staff)**.
3. Select a future appointment date, preferred time window, and reason for the visit.
4. Submit the request. It remains **Pending**, with no reserved slot yet.

When selecting a specific doctor, patients must choose an actual available slot. The previous fallback that allowed a doctor-specific booking without a real slot is removed. If no slots are available, choose another date or request any available doctor.

### Staff assigns and approves

1. Sign in as Staff and open **Appointments**.
2. Find the pending request marked **Unassigned**.
3. Select **Assign doctor & slot**. Approve is disabled until the doctor and slot are assigned.
4. Choose the attending doctor.
5. Choose an available slot on the patient's requested date. The date is fixed for this workflow.
6. Select **Assign Slot**.
7. The appointment remains Pending; the doctor, slot, and actual time window are now populated. The slot becomes **Reserved-Tentative**.
8. Review the assigned request and select **Approve**.
9. The existing approval flow changes the appointment to **Confirmed** and the slot to **Reserved-Confirmed**.
10. Patients and the assigned doctor can see the appointment through their existing lists after refreshing.

Admin can perform assignment from **All Appointments**. Approval remains available through the existing Staff/Admin API; the existing staff approval interface is the UI walkthrough above.

The preferred time is guidance, not a reservation. Assignment replaces it with the chosen actual slot's time window. This workflow does not reschedule the patient to another date or reassign already linked appointments.

### API

```http
PATCH /api/appointments/<appointmentId>/assign
Authorization: Bearer <staff-or-admin-token>
Content-Type: application/json

{ "slotId": "<available slot ObjectId>" }
```

### Validation and conflict handling

- Only pending patient requests without a slot can be assigned.
- The slot must be on the requested date and must not have started.
- The existing conditional slot reservation prevents claiming a slot already reserved by another request.
- A conditional appointment update prevents overwriting a request that another action already changed or assigned.
- If the appointment update fails, the service releases the slot only when it still belongs to that request and is Reserved-Tentative.
- Assignment appends a Pending history entry identifying the authenticated staff/admin actor.
- Assignment emits `APPOINTMENT_ASSIGNED`; the existing audit listener persists it.
- Approval rejects requests that still lack a doctor or slot.

The shared assignment dialog also supports the existing walk-in assignment endpoint. It now uses a native modal dialog with keyboard focus containment and Escape dismissal. Available slots load on demand through the existing slot API; stale doctor/date responses are ignored.

## 5. Weekly working-hours walkthrough

1. Sign in as a Doctor, Staff, or Admin.
2. Open **My Slots** (Doctor) or **Slot Management** (Staff/Admin).
3. Select **Weekly hours**.
4. Staff/Admin select the doctor. Doctors edit their own schedule directly.
5. Set the consultation length between **5 and 120 whole minutes**.
6. Check the working days and set the start/end times for each enabled day.
7. Uncheck days off. Leaving every day unchecked explicitly means no recurring working days.
8. Select **Save weekly hours** and wait for the success message.
9. Select a date that does not already have generated slots. Opening that date or using **Auto-Fill Day** generates slots from the saved weekly schedule.

Example: enable Monday–Friday from 09:00 to 17:00, set 30 minutes per consultation, and disable Saturday/Sunday. New weekday dates receive 30-minute slots; new weekend dates receive none.

### Existing slots and one-day exceptions

Saving weekly hours does **not** rewrite existing dated slots, reservations, or appointments. The editor explains this. Use individual slot blocking to close existing open slots. Editing already generated dates in bulk is outside this change.

**Auto-Fill Day** now uses saved weekly hours and consultation duration instead of forcing 09:00–17:00 with 15-minute consultations.

**Custom Generator** remains an explicit one-day override. It may generate slots outside recurring working days when authorized, but rejects times that overlap existing windows with different boundaries. Repeating an identical generation is idempotent and preserves existing slot states.

Doctors with no configured schedule retain the legacy default of 09:00–17:00 daily. Existing nonempty working-hours arrays are treated as configured weekly schedules. A new `scheduleConfigured` flag distinguishes an intentionally empty schedule from an unconfigured account.

### API

```http
GET /api/users/<doctorId>/schedule
PATCH /api/users/<doctorId>/schedule
Authorization: Bearer <token>
Content-Type: application/json

{
  "consultationDuration": 30,
  "workingHours": [
    { "day": 1, "start": "09:00", "end": "17:00" },
    { "day": 2, "start": "09:00", "end": "17:00" }
  ]
}
```

Day numbering: Sunday `0` through Saturday `6`. Omitted days are off after configuration. Duplicate days, invalid time formats, reversed windows, and windows shorter than one consultation are rejected. One working window per weekday is supported.

Saving emits `SCHEDULE_UPDATED` with the actor, doctor ID, hours, and consultation duration. Slot generation by a Doctor is limited to their own doctor ID.

## 6. Slot blocking walkthrough

1. Open Slot Management/My Slots and select the intended date.
2. In a multi-doctor view, expand the doctor's slot group.
3. Locate an **Available** slot and select **Block / Cancel Slot**.
4. Confirm **Block slot**.
5. The stored slot status becomes **Cancelled**, which represents an individually blocked, unbooked slot in this interface. It is unavailable for booking or assignment.
6. To reopen it, select **Make Available for Walk-Ins** and confirm **Make available**.

```http
PATCH /api/slots/<slotId>/status
Authorization: Bearer <token>
Content-Type: application/json

{ "status": "Cancelled" }
```

Use `Available` to reopen. Only transitions between Available and Cancelled are accepted here. The backend rejects linked appointments, occupied/terminal states, expired starts, and another doctor's slots. A conditional update protects against a concurrent reservation.

This action does not cancel a booked patient's appointment or automatically assign a walk-in. It emits `SLOT_STATUS_UPDATED` for audit logging.

## 7. Implementation map

| Area | Files |
| --- | --- |
| Reports | [Report service](../../backend/src/services/report.service.js), [report routes](../../backend/src/routes/report.routes.js), [Reports page](../../frontend/src/pages/ReportsPage.jsx) |
| Flexible assignment | [Appointment service](../../backend/src/services/appointment.service.js), [controller](../../backend/src/controllers/appointment.controller.js), [routes](../../backend/src/routes/appointment.routes.js), [shared dialog](../../frontend/src/components/AssignSlotModal.jsx) |
| Weekly hours | [User model](../../backend/src/models/User.js), [user service](../../backend/src/services/user.service.js), [controller](../../backend/src/controllers/user.controller.js), [routes](../../backend/src/routes/user.routes.js), [editor](../../frontend/src/components/WorkingHoursEditor.jsx) |
| Slot actions/generation | [Slot service](../../backend/src/services/slot.service.js), [controller](../../backend/src/controllers/slot.controller.js), [routes](../../backend/src/routes/slot.routes.js), [Slot Management](../../frontend/src/components/SlotManagement.jsx) |
| Audit events | [Event constants](../../backend/src/events/events.js), [audit listener](../../backend/src/events/handlers/auditLog.handler.js), [audit viewer](../../frontend/src/components/AuditLogViewer.jsx) |
| Validation | [Time helpers](../../backend/src/utils/timeHelper.js), [error handler](../../backend/src/middleware/errorHandler.js) |
| Verification | [Backend check](../../backend/tests/clinic-workflows.check.js), [browser smoke check](../ui-smoke.mjs) |

Mongoose casting/validation errors now return HTTP 400 rather than being reported as internal server errors.

## 8. Running and verification

Restart the backend after these changes. Existing doctor documents do not require a manual migration: the new flag defaults to false, and saving weekly hours records explicit configuration.

From the repository root:

```powershell
node backend/tests/clinic-workflows.check.js
npm.cmd run build
```

The backend check uses isolated model doubles, actual services, Express routes, and JWT middleware. It checks schedule validation, off-day generation, all-days-off behavior, idempotence, overlap rejection, slot permissions, blocking/reservation conflicts, assignment rollback, inclusive reporting boundaries, doctor scope, and authenticated HTTP access.

It does not connect to MongoDB or use real patient records. Model-double checks do not establish database-level concurrency or live aggregation correctness.

To run browser verification with an existing Puppeteer installation and local frontend server:

```powershell
node docs/ui-smoke.mjs <puppeteer-module-path> <chrome-executable-path> http://127.0.0.1:3000
```

The browser check covers role screens, weekly-hour submission, flexible assignment, report filters/empty states, modal keyboard dismissal, and desktop/mobile overflow using mock API responses. Screenshots are saved under the temporary `caresync-ui-review` directory.

### Recorded verification

- Backend workflow/HTTP checks passed on October 1, 2026.
- Frontend production build passed.
- Expanded browser smoke checks passed at 1440px and 390px widths, including all role screens, assignment, weekly-hour submission, report filtering, and empty states.
- Desktop/mobile screenshots were visually reviewed; report card spacing and assignment text were corrected during review.
- Markdown source-file links were verified, and `git diff --check` passed.
- Live MongoDB and deployed-system workflows were not tested.

### Remaining limits

- Live MongoDB persistence, aggregation, and concurrent writes still require a test database verification pass.
- Updated October 2: cross-record booking/assignment uses conditional claims, distinct operation ownership, and durable recovery records. Offline reconciliation handles interrupted work; this is not a multi-document transaction. See the [concurrency/recovery walkthrough](261002_concurrency_and_assignment_recovery_walkthrough.md).
- Updated October 2: doctor/day generation plans use a revision compare-and-set to coordinate competing generators, and saved plans repair partial writes. Actual MongoDB concurrency verification remains pending.
- Weekly edits affect newly generated dates; existing dated slots are preserved.
- One recurring working window per day is supported; split shifts and holiday calendars are not included.
- Reports summarize current appointment states, not historical snapshots, and do not include exports or notification-delivery analytics.
- Other gaps from the original assessment, such as notification delivery and walk-in status routes, remain separate work.
