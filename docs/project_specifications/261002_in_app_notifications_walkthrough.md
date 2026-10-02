# CareSync: In-App Notifications Walkthrough

**Implemented:** October 2, 2026 (Asia/Manila).

In-app notifications suit this system: clinic staff need to know about new requests, doctors need assignment updates, and patients need booking outcomes. Updates are stored in MongoDB and shown in a private inbox shared by all four role dashboards. They complement the existing appointment lists and history.

## What each role receives

| Event | Recipient and update |
| --- | --- |
| Patient submits a booking | Patient: request received. Every Staff/Admin account: new request to review. The selected doctor, when present: assigned request pending approval. |
| Staff assigns an “Any available doctor” request | Assigned doctor: pending request assigned. Patient: doctor/time assigned, still awaiting approval. |
| Clinic approves | Patient and assigned doctor: appointment confirmed. |
| Clinic declines | Patient: declined; consult appointment history for details. |
| Appointment is cancelled | Patient and assigned doctor: cancelled. |
| Appointment is marked no-show | Patient and assigned doctor: no-show. |
| Consultation starts through the existing check-in/start endpoint | Assigned doctor: consultation in progress. This endpoint currently starts consultation; the notification does not invent a separate arrival state for scheduled patients. |
| Consultation completes | Patient: consultation complete; view the appointment record. |
| Walk-in receives a slot, manually or automatically | Assigned doctor: queue ticket and assigned slot. |
| Walk-in is checked in | Assigned doctor: ticket has arrived and is waiting for consultation. |

Walk-ins without a user account have no private inbox. No medical reasons, consultation notes, uploaded files, cancellation/decline reasons, or walk-in names are copied into messages. Dates, times, status descriptions, and queue tickets provide the update; clinical details stay in the protected appointment record.

## Walkthrough

1. Restart the backend to register the updated handlers and notification routes; start/reload the frontend. MongoDB must be reachable. Normal startup initializes the notification indexes alongside the existing indexes.
2. Sign in as a Patient and submit an appointment request. Open **Notifications** in the shared clinic tools. A request-received message appears; the unread badge updates within approximately 15 seconds while the tab is visible. Opening the inbox also refreshes it.
3. Sign in as Staff/Admin. The inbox contains a **New appointment request** update. Open the dashboard’s Appointments view to review it.
4. For an “Any available doctor” request, assign a doctor/slot. Sign in as that Doctor: the pending assignment appears. Approval generates a separate confirmation for Doctor and Patient; assignment itself does not mean approval.
5. Approve, decline, cancel, mark no-show, or complete a test appointment. Check the recipient’s inbox against the table above. Existing permission and status-transition checks still decide whether each action is allowed.
6. Register/assign a walk-in and check it in. Its assigned Doctor receives the ticket assignment and arrival updates. Starting its session generates the consultation-start update.
7. Open **Unread**, select **Mark as read**, or use **Mark all as read**. Marking all includes older unread records beyond the displayed page. Reading does not change the appointment or mark another user’s inbox as read.
8. Use **All**, **Previous**, and **Next** to browse stored history, 20 items per page. Escape, the close button, or the backdrop dismisses the native dialog. Keyboard focus returns to the notification button.
9. If loading or a read action fails, the inbox shows an error and **Retry**. Failed read actions retain unread state. Switching accounts creates a fresh inbox component; pending responses from the previous component are ignored.

Opening an inbox does not automatically mark its items as read. A successful save persists the notification and first read timestamp across reloads and logins. Historical events from before this change are not backfilled.

## How the integration works

The existing appointment and walk-in services emit lifecycle events after successful workflow changes. The [notification handler](../../backend/src/events/handlers/notification.handler.js) chooses recipients and calls the [notification service](../../backend/src/services/notification.service.js). The service creates a [Notification record](../../backend/src/models/Notification.js) containing the recipient, appointment reference, type, title, message, creation timestamp, and nullable `readAt`.

Staff/Admin recipients come from current database roles, rather than a client-supplied list. Recipient IDs support populated references as well as ObjectIds. A failure to save one recipient’s update does not suppress saves for the others. Handler failures are caught/logged and do not turn an already completed clinic operation into a failed response.

The [inbox component](../../frontend/src/components/NotificationInbox.jsx) reuses the authenticated API client, Lucide icons, clinic colors, and native dialog. It polls every 15 seconds in visible tabs, refreshes on tab visibility/open, and stops polling when unmounted. No additional packages or notification permissions are required.

## Endpoint protection

| Endpoint | Behavior |
| --- | --- |
| `GET /api/notifications?page=1&unread=false` | Own records only; newest first; 20 per page, total matching count and total own unread count. Page must be 1–9999; unread must be true/false; other query parameters are rejected. |
| `PATCH /api/notifications/:id/read` | Find/update using both notification ID and authenticated user ID. Invalid IDs return 400. Missing/other-owner records return 404. Repeated calls preserve the original read timestamp. |
| `PATCH /api/notifications/read-all` | Mark only the authenticated user’s unread records, including older pages. |

All three routes inherit the central JWT protection and `Cache-Control: no-store`. There is no public notification route and no client endpoint to create notifications or choose recipients. Even Admin accesses only their own inbox through these endpoints. Extra mutation-body recipient fields cannot override the server’s ownership filter. Notification read state grants no additional appointment or download permissions.

## Verification

From the repository root:

```powershell
node backend/tests/notifications.check.js
node backend/tests/api-access.check.js
node backend/tests/clinic-workflows.check.js
node backend/tests/walkin-status.check.js
node backend/tests/concurrency.check.js
```

Build from `frontend` using `npm.cmd run build`. For browser checks, start the frontend on port 3000 and run:

```powershell
node docs/ui-smoke.mjs <puppeteer-module-path> <chrome-executable-path> http://127.0.0.1:3000
```

The new notification check passed event-recipient/privacy/failure cases and **32 HTTP checks** with isolated model doubles. API access checks passed **113 HTTP checks across all 34 private routes**. Existing workflow, walk-in, and concurrency checks passed. These do not verify actual MongoDB persistence, indexes, or update-pipeline behavior; confirm those using real test accounts and a reachable test database.

Browser checks passed for all roles at 1440px/390px, including unread badges, filters, paginated history, individual/all read actions, failed reads/loading and retry, focus containment/restoration, and the existing clinical screens using intercepted APIs. Changed inbox screenshots were visually reviewed. The production build passed.

## Current limits

- This implements real in-app records and read state; it does not deliver SMS, email, operating-system push, or background alerts to a closed browser. Confirm whether the instructor accepts in-app delivery for the healthcare theme’s notification requirement.
- Event dispatch is process-local. A crash between committing an appointment and saving its notification, or a failed notification save, can lose an update. Errors are logged; there is no durable outbox, automatic retry/replay, or exactly-once delivery guarantee. Add that reliability mechanism if guaranteed delivery is required.
- There is no queue-turn reminder or advance appointment reminder yet. The queue notifications implemented here concern doctor assignment and walk-in arrival.
- Existing stored updates have no automatic retention cleanup. Live persistence, cross-account behavior, and the complete patient journey still need demonstration evidence.

See the updated [project gap analysis](261001_project_specification_gap_analysis.md) for the remaining queue, audit, verification, and submission work.
