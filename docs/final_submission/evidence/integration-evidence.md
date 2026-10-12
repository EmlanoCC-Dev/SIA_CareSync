# Integration evidence (Appendix B template)

Produced by `tools/integration.js` against the real local API (`http://localhost:5000/api`, database `caresync_evidence`) on **2026-10-12 at 08:56 UTC** (16:56 +08:00). The code under test is commit **`0e87172`**; the evidence files were added afterwards.

Each step has a raw record in `integration/IE0n-*.json` containing:

- the request (authorization header omitted),
- the sanitized response (`token`, `otp`, `code`, `password`, `codeHash` and `stack` are replaced with `[REDACTED]`),
- the appointment's state after the step,
- the audit-log and notification records the step created.

`integration/summary.json` lists all steps. IDs are synthetic MongoDB ObjectIds and were left unredacted because they identify only synthetic records.

| Field | Value for this run |
| --- | --- |
| Appointment | `6acca0a7f4e07f51c58e8ced` (Pia Evidence-Patient with Dr. Ben Santos, 2026-10-13, first open slot from 11:00) |
| Clinic clock | Simulated 2026-10-13 08:45 +08:00 (needed so check-in/start fall on the appointment day) |
| SMTP result | **Not sent.** `EMAIL_ENABLED=false`. Every notification is stored with `emailDelivery.status: "disabled"` and `sentAt: null`. No email was sent or received. |

## Results

| Evidence ID | Requirement / test IDs | Actor / role | Endpoint | Status / response | Changed records | Emitted event (audit action) | Inbox result (new notifications) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| IE01 | Booking; SC03; `clinic-workflows`, `concurrency` | Patient (Pia) | `POST /api/appointments` | 201, `success: true`, status Pending | Appointment created; slot reserved | `APPOINTMENT_BOOKED` | 4: patient "Appointment request received", doctor "Appointment request assigned", staff/admin "New appointment request" ×2 |
| IE02 | Correction request; SC03; `corrections` | Staff (Sam) | `PATCH /api/appointments/:id/request-correction` | 200, status Needs correction | Booking revision +1, history entry with explanation | `REVISION_REQUESTED` | 1: patient "Appointment needs correction" |
| IE03 | Resubmission; SC03; `corrections` | Patient (Pia) | `PATCH /api/appointments/:id/resubmit` | 200, status Pending | Reason updated, revision +1, previous reason retained | `APPOINTMENT_RESUBMITTED` | 3: "Appointment resubmitted" to doctor, admin and staff |
| IE04 | Approval; SC04; `clinic-workflows` | Staff (Sam) | `PATCH /api/appointments/:id/approve` | 200, status Confirmed | Status + history; slot reservation confirmed (IE05 check-in requires it) | `APPOINTMENT_APPROVED` | 2: patient "Appointment confirmed" (email `disabled`), doctor "Confirmed appointment" |
| IE05 | Check-in; SC05; `scheduled-queue` | Staff (Sam) | `PATCH /api/appointments/:id/check-in` | 200, status Checked In | `checkedInAt`, `queueDay`, `queueNumber` set | `APPOINTMENT_CHECKED_IN` | 1: doctor "Patient arrived" |
| IE06 | Consultation start; SC06; `scheduled-queue` | Doctor (Ben) | `PATCH /api/appointments/:id/start` | 200, status In Progress | Status + history | `APPOINTMENT_STARTED` | 1: doctor "Consultation started" |
| IE07 | Document upload; SC07; `versions`, `file-storage` | Doctor (Ben) | `POST /api/appointments/:id/upload` (multipart, `synthetic-referral.txt`) | 201 | Document version 1 added (GridFS) | `DOCUMENT_UPLOADED` | None |
| IE08 | Completion; SC06; `clinic-workflows` | Doctor (Ben) | `PATCH /api/appointments/:id/complete` | 200, status Completed | Status + history; slot status Completed (checked after the run) | `APPOINTMENT_COMPLETED` | 1: patient "Consultation completed" |
| IE09 | Reports; SC09; `clinic-workflows` (report scope) | Admin (Ada) | `GET /api/reports?from=2026-10-13&to=2026-10-13` | 200, `total: 3`, `Completed: 3`, scope "Clinic appointments" | None (read-only) | None | None |

The exact notification titles and counts per step are in `integration/summary.json`.

## Notes

- The report total of 3 for 2026-10-13 is three completed appointments, all with Dr. Ben Santos:
  1. the SC03–SC08 screenshot appointment (`…8e85d5`);
  2. this run (`…8ced`);
  3. an earlier attempt of this script, which completed the same flow. That attempt's per-step audit and notification capture came back empty because the harness filtered audit logs by `createdAt`, while the collection uses `timestamp`. The harness was corrected to diff record IDs, and the run above was repeated in full. The earlier appointment remains in the database and appears in the synthetic export.
- Audit `timestamp` and notification `createdAt` use the real server clock. Appointment status-history entries use the simulated clinic clock (see `README.md`).
