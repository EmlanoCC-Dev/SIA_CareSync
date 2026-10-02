# CareSync: Concurrent requests and assignment recovery

**Updated:** October 2, 2026 (Asia/Manila)

The backend now prevents new duplicate daily tickets, routes automatic assignment through the guarded manual workflow, coordinates slot generation through a durable doctor/day plan, and records interrupted booking/assignment work for reconciliation.

## Changes

| Area | Protection |
| --- | --- |
| Queue numbers | New registrations store `queueDay` and the clinic-clock registration timestamp. A partial unique MongoDB index on `queueDay + queueNumber` arbitrates simultaneous registrations; a losing insertion retries the next number. The index is awaited before registration. |
| Existing tickets | Number allocation starts above today's highest stored number, including older records without `queueDay`. Historical tickets are preserved; the new constraint does not renumber or repair pre-existing duplicate legacy records. |
| Automatic assignment | Only today's unassigned Waiting entries qualify. The clinic must be open, and the freed slot must belong to today and have a future start. Automatic and manual assignment use the same conditional claims. Competing workers retry the next eligible patient after a lost claim. |
| Assignment links | Walk-in and slot claims reference a preallocated appointment ID before creating that appointment. Claims are conditional; one patient or slot cannot win two assignments. Manual walk-in assignment is also restricted to today's entries/slots. |
| Reservation ownership | Slots store the recovery-operation ID as well as the appointment ID. This distinguishes competing requests for the same existing flexible appointment, preventing one request's cleanup from releasing another's reservation. |
| Slot release | Release checks the expected appointment and conditionally matches the current slot state/reference, preventing stale cancellation/no-show requests from freeing a newer reservation. |
| Generation | One `SlotPlan` per doctor/day stores accepted boundaries. A revision compare-and-set coordinates competing generators across API processes; overlap checks are repeated after a lost revision claim. Identical generation remains idempotent. |
| Partial generation | Accepted boundaries are saved before materializing individual slots. Upserts insert missing rows and preserve reservations/blocks. Retry, startup, or the recovery script can restore rows after a partial bulk-write failure. |
| Assignment recovery | An `AssignmentRecovery` record is persisted before booking, flexible assignment, or walk-in claims. Success marks it done. Failed requests attempt guarded cleanup; if recovery fails, the pending record survives and the API returns 503 with a recovery reference. |

No additional package or replica-set requirement was added. These safeguards use MongoDB document updates and indexes with the existing Mongoose dependency.

## Automatic reassignment walkthrough

1. During clinic hours, register two walk-ins and leave them Waiting.
2. Cancel/decline an appointment whose slot starts later today. The backend emits `SLOT_FREED`.
3. The registered handler selects the earliest eligible waiting patient, conditionally claims the entry and slot, and creates a Confirmed appointment linking them.
4. If another request takes the patient first, the handler retries the next eligible entry. If the slot is already taken, it stops.
5. Yesterday's entries, tomorrow's slots, expired starts, and closed-clinic processing do not qualify.

The existing public board polls for updates; this change does not require adding Socket.io infrastructure. The existing handler catches/logs assignment failures. Events are still in-process rather than a durable messaging system.

## Interrupted assignment recovery

The recovery service preserves an assignment whose appointment/slot/walk-in links already committed, including a lost acknowledgement after creation. Otherwise it releases only reservations belonging to that exact operation and resets its incomplete walk-in claim. It does not delete existing appointment records or overwrite another operation's reservation. Inconsistent/advanced records requiring manual review remain unresolved.

Startup waits for required indexes and restores saved slot plans. It refuses to accept requests while assignment recovery records remain pending. This keeps unfinished claims visible instead of silently losing the recovery context.

To reconcile interrupted work:

1. Stop **all** API processes and other clinic database writers. Offline reconciliation must not race active requests.
2. Confirm the backend is configured for the intended database and normal backups are available.
3. From the repository root, run:

```powershell
node backend/scripts/recover-assignments.js --offline
```

4. The script preserves committed assignments, releases interrupted claims, marks resolved records done, and materializes missing saved slots. If records conflict, it stops with an error rather than deleting patient records.
5. Inspect any unresolved records, correct their links with authorized clinic/database maintenance, rerun reconciliation, and restart the backend.

The `--offline` argument acknowledges the operational prerequisite; it does not detect or stop other processes automatically. Roll out the updated code to all writers: older code/direct database writes bypass the new application guards. Completed recovery records are retained for tracking.

## Verification

```powershell
node backend/tests/concurrency.check.js
node backend/tests/clinic-workflows.check.js
node backend/tests/api-access.check.js
node backend/tests/walkin-status.check.js
```

The isolated concurrency check passed concurrent daily registration, patient/slot assignment races, automatic date scoping, booking races, identical and different-slot flexible assignment races, blocking versus reservation, guarded slot release, overlapping/identical generation, slot-freed handler integration, injected failures, durable recovery, lost acknowledgements, and partial generation repair. Existing workflow, API access (110 HTTP checks across 31 private routes), and walk-in status (35 HTTP checks) suites also passed.

A live mode is provided:

```powershell
node backend/tests/concurrency.check.js --live
```

It connects using `TEST_MONGO_URI` if supplied, otherwise the configured MongoDB server, but overrides the database name with a generated `caresync_concurrency_check_*` name. It uses synthetic records and drops only that generated database after checking its name. It never runs against the configured application database. Failure injection is covered by the isolated mode; live mode checks actual indexes and competing writes.

The live command was attempted on October 2 and could not connect to MongoDB, including an approved attempt outside the sandbox. No live database result is claimed. Run it when a test MongoDB server is reachable before final deployment/defense.

## Remaining limits

- These are guarded writes, durable intent records, and reconciliation rather than multi-document transactions. A crash can temporarily leave incomplete links until recovery; exactly-once notification/audit delivery is not provided.
- The recovery journal covers booking and doctor/slot assignment. Consultation/status mutations still use their existing workflow handling; their complete outage/competing-write behavior needs separate live verification.
- The offline script requires all writers to stop. It is not a distributed background recovery worker.
- Automatic no-show slot synchronization, scheduled-patient queue coverage, persistent notifications, and broader audit completeness remain separate gaps.

Implementation: [walk-in service](../../backend/src/services/walkIn.service.js), [slot service](../../backend/src/services/slot.service.js), [appointment service](../../backend/src/services/appointment.service.js), [recovery service](../../backend/src/services/assignmentRecovery.service.js), [recovery script](../../backend/scripts/recover-assignments.js), and [concurrency check](../../backend/tests/concurrency.check.js).
