# User, Document, and Slot Generation Audit Walkthrough

**Implemented:** October 3, 2026 (Asia/Manila).

The agreed audit scope now records user creation, document deletion, and slot generation through the existing event-driven audit handler. **Clock changes are excluded because the clock is a testing tool**, as requested. Its existing authorization and clinic-transition behavior remain separate from audit coverage.

## Recorded actions

| Action | Actor and target | Stored details |
| --- | --- | --- |
| `USER_CREATED` — public registration | Newly created Patient account; target is that User | Name, role, ID, and Self-registration source. |
| `USER_CREATED` — Admin creates an account | Authenticated Admin; target is the created User | Name, role, ID, and Admin creation source. |
| `DOCUMENT_DELETED` | Authenticated assigned Doctor, Staff, or Admin; target is the Appointment | Removed document ID, filename, and type. |
| `SLOTS_GENERATED` — explicit generation | Authenticated Doctor managing their own slots, Staff, or Admin; target is the Doctor’s User record | Doctor name/ID, date, start/end, consultation duration, requested window count, total resulting slots, and Manual source. |
| `SLOTS_GENERATED` — on-demand generation | Authenticated user loading a schedule that needs generation; target is the Doctor | The same schedule metadata with On-demand source. This may be triggered by Patient booking-slot reads. |
| `SLOTS_GENERATED` — direct system generation | System (`performedBy: null`); target is the Doctor | The same metadata with System source. |

Passwords, password hashes, JWTs, document contents, file URLs, and consultation notes are not copied into these new payloads. Existing audit actions/payloads are not rewritten by this change.

Generation counts describe requested time windows and the total returned schedule, **not the number of newly inserted slots**. Repeating an identical manual generation request records another completed request while preserving the same slots. An off-day early return without generation emits no generation-success event. Generation errors emit no success event; a partially written plan may still need the documented reconciliation procedure.

Deletion removes the attachment reference from the appointment. It validates the document ID, requires that document to exist, and uses a conditional atomic removal. Two competing requests cannot both record a successful deletion of the same attachment. Missing documents return 404; a request losing the removal claim returns 409. The actor comes from the verified request, not the request body.

## Walkthrough

1. Restart the backend and reload the frontend to register the new events and audit labels. MongoDB must be reachable.
2. Register a test Patient through the public registration form. Sign in as Admin and open **Clinic activity & audit trail**: a **User account created** entry identifies the Patient and Self-registration source.
3. As Admin, create a Staff/Doctor account. Refresh the audit trail: the created account is the target and the signed-in Admin is the actor.
4. Open a test appointment as its assigned Doctor, Staff, or Admin, and remove an attachment. The audit trail displays **Document deleted** and the removed filename. A repeated removal of that same attachment does not create another deletion entry.
5. Generate a Doctor’s slots through **Slot Management**. Refresh the audit trail: **Doctor slots generated** displays the Doctor, date/range, duration, requested windows, total slots, and Manual source.
6. Load a booking/schedule date without slots. On-demand generation records the authenticated user who triggered that generation. Loading an already generated schedule does not generate a new batch or generation event.
7. Test an invalid generation request, duplicate registration, or unauthorized deletion: no successful action audit should appear for those rejected operations.
8. Change the testing clock as Admin. No clock-change audit entry is added. Existing clinical status events triggered by simulation, such as no-shows, may still produce their normal clinical audit entries.

Only Admin can read `/api/audit-logs`. The API exposes audit reads; it does not provide a client endpoint to create, edit, or delete audit records. The existing viewer shows readable summaries and optional technical details.

## Implementation

- [Event constants](../../backend/src/events/events.js) and [audit handler](../../backend/src/events/handlers/auditLog.handler.js): register the three new actions.
- [User service](../../backend/src/services/user.service.js) and [controller](../../backend/src/controllers/user.controller.js): record successful creation with self/Admin attribution and selected metadata.
- [Appointment service](../../backend/src/services/appointment.service.js) and [controller](../../backend/src/controllers/appointment.controller.js): record only successful conditional attachment removal and pass the authenticated actor.
- [Slot service](../../backend/src/services/slot.service.js) and [controller](../../backend/src/controllers/slot.controller.js): record successful generation centrally and carry actor/source through all schedule-generation callers.
- [Audit viewer](../../frontend/src/components/AuditLogViewer.jsx): readable account, removed-file, and generation summaries.

## Verification and limits

From the repository root:

```powershell
node backend/tests/audit-coverage.check.js
node backend/tests/api-access.check.js
node backend/tests/clinic-workflows.check.js
node backend/tests/concurrency.check.js
node backend/tests/walkin-status.check.js
node backend/tests/notifications.check.js
```

The new [audit check](../../backend/tests/audit-coverage.check.js) passed **33 HTTP checks** using real routes, JWT middleware, services, and audit handlers with isolated models. It checks actor/target attribution, credential/file-content exclusion, failures, competing deletion, manual/on-demand/system generation, read permissions, and clock exclusion. All existing backend checks also passed.

The frontend production build (`npm.cmd run build` from `frontend`) passed. The expanded [UI smoke script](../ui-smoke.mjs) passed all role screens and workflow checks, including the three new audit summaries at 1440px and 390px using intercepted APIs. Both audit screenshots were visually reviewed. The script accepts a Puppeteer module path, Chrome executable path, and frontend URL as documented in the other walkthroughs.

Audit persistence follows the existing best-effort, process-local event pattern. A database outage or process crash can lose an audit entry; failures are caught/logged and do not roll back a completed clinic action. This implementation does not introduce transactional audit writes, durable replay, or a tamper-evident ledger. Live MongoDB persistence and final deployment verification remain pending.

See the [updated gap report](261001_project_specification_gap_analysis.md) for remaining queue, reliability, and submission work.
