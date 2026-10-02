# Scheduled arrivals and combined public queue

Implemented October 3, 2026 (Asia/Manila).

## Visit flow

Scheduled visits now follow **Pending → Confirmed → Checked In → In Progress → Completed**.

1. Patient books; Staff/Admin approve the assigned doctor and slot.
2. On the appointment day, reception selects **Check In**. The appointment becomes **Checked In**, a daily `A-` ticket is saved, and the slot remains **Reserved-Confirmed**. The doctor receives a patient-arrived notification.
3. Patient and clinic appointment tables show the scheduled ticket, such as **#A-1**. The public board lists that ticket with **Checked In** status alongside walk-in numbers.
4. When ready, the assigned Doctor selects **Start consultation**. Appointment and slot become **In Progress**, and the consultation editor opens. Staff/Admin can also use the explicit start action.
5. Complete the consultation to make both records **Completed** and remove the ticket from the active board. Confirmed/waiting appointments cannot be completed directly.

Check-in requires today's appointment and a matching confirmed reservation whose end has not passed. Once checked in, the patient is exempt from automatic no-show processing even if the doctor is delayed beyond the scheduled end. Starting requires check-in and the appointment day. Completion can finish an already-started consultation after a day rollover.

## Queue and privacy

`GET /api/walkins/now-serving` retains its existing URL but includes scheduled arrivals. Scheduled tickets use `A-1`, `A-2`, etc.; existing numeric walk-in tickets are preserved. Both sequences reset daily. A unique partial MongoDB index arbitrates competing scheduled ticket claims, and conditional appointment updates prevent duplicate arrivals/history for one visit.

The response retains `nowServing` for compatibility and adds `serving` for all active consultations. The board prominently shows the first serving ticket and lists other active tickets. Waiting entries are ordered by reserved start time, then arrival/registration time; unassigned walk-ins follow assigned visits. This is a display order, not enforcement of which patient a doctor must call next.

Public entries contain only **queueNumber** and **status**. Names, contact information, record IDs, doctor IDs, clinical notes, and reasons remain private. Scheduled appointments linked to walk-ins are excluded from the scheduled branch, preventing duplicate display entries. Unarrived scheduled bookings and previous-day visits are excluded.

## Shared transitions and events

`PATCH /api/appointments/:id/check-in` now records arrival. The new `PATCH /api/appointments/:id/start` starts consultation. Existing authentication, appointment ownership, and assigned-doctor checks protect both. Patient accounts cannot perform reception/clinical actions.

Walk-in arrivals also set the linked appointment to **Checked In**. Appointment start/completion actions for walk-ins delegate to the existing guarded walk-in transition service, keeping appointment, walk-in, and slot synchronized. Legacy walk-ins whose arrival was already recorded while their appointment stayed Confirmed remain usable through the existing walk-in actions.

`APPOINTMENT_CHECKED_IN` means arrival; `APPOINTMENT_STARTED` means consultation start. Both have audit coverage and distinct doctor notifications. Arrival no longer sends a consultation-start message. Manual cancellation/no-show claims also check the current appointment status, preventing a stale read from overwriting an arrival/start transition.

Scheduled start/completion use conditional writes and compensation if the linked slot cannot change. Failed recovery returns an explicit reconciliation error. These operations are not multi-document transactions; an outage or lost write acknowledgement can still require reconciliation. Audit/notification delivery remains best-effort.

## Verification and rollout

Restart the backend to create the scheduled daily ticket index and register the start event. Existing bookings have no queueDay and are excluded from the new partial index; no data rewrite is required. Existing scheduled In Progress visits without arrival tickets are not assigned retrospective tickets by this change.

Run from the repository root:

```powershell
node backend/tests/scheduled-queue.check.js
node backend/tests/walkin-status.check.js
node backend/tests/api-access.check.js
node backend/tests/accounts-noshow.check.js
node backend/tests/notifications.check.js
node backend/tests/clinic-workflows.check.js
node backend/tests/concurrency.check.js
node backend/tests/audit-coverage.check.js
npm.cmd run build
```

The new scheduled check passed **26 HTTP checks**, plus isolated ticket races, arrival/start/completion, no-show exemption, date rollover, reservation ownership, public privacy, mixed/multiple serving tickets, and rollback failure assertions. Updated notification checks distinguish arrival from start; existing backend checks passed. Tests use model doubles and do not establish actual MongoDB index/persistence behavior.

The expanded UI smoke script covers reception arrival, doctor start, scheduled ticket display, multiple serving tickets, and the public board at desktop/mobile widths. Its syntax was checked; browser execution requires an available Puppeteer module and remains pending. Live MongoDB and complete browser-to-database journey verification remain pending.
