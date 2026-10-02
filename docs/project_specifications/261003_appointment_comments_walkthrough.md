# Appointment comments and replies

Implemented October 3, 2026 (Asia/Manila).

Select **History & comments** on an appointment in the Patient, Doctor, Staff, or Admin workspace. The appointment details dialog shows a private chronological discussion and the existing status history. Use **Post comment** to add a plain-text message, or **Refresh** to retrieve replies. Failed posts retain the draft.

The owning Patient, assigned Doctor, Staff, and Admin can read and post. This applies to pending, active, and finished appointments. Account-free walk-ins can be discussed by authorized clinic users; there is no public patient reply interface. An unassigned or former Doctor and unrelated Patients cannot access the discussion.

Comments are stored in the `AppointmentComment` collection with the appointment, authenticated author, author name and role at posting time, message, and timestamp. Input must contain 1–2000 characters after trimming. The API ignores supplied author, appointment, or timestamp fields. Messages have no edit/delete routes or attachments. Comments do not change appointment status, clinical notes, files, or status history. Existing appointments need no data migration; startup initializes the new collection's index.

`GET /api/appointments/:id/comments` returns the authorized appointment's comments in chronological order. `POST /api/appointments/:id/comments` accepts `{ "message": "Your message" }` and returns the stored comment. Both endpoints require authentication and reuse appointment-access checks. Discussions are returned separately from appointment listings and never appear on the public queue.

Posting emits the existing `COMMENT_ADDED` event. It creates in-app notifications for the owning Patient, assigned Doctor, and active Staff/Admin accounts, excluding the author and duplicate recipients. Notifications contain the appointment reference and instructions to open the discussion; they omit message text. The existing audit handler records the actor, appointment, and comment ID without copying the comment or clinical record.

## Verification

- `node backend/tests/comments.check.js`: passed 52 real-route HTTP checks using isolated models, plus attribution, notification/audit privacy, concurrent inserts, status preservation, assignment changes, validation, and failure checks.
- All eight existing backend check scripts passed; API access coverage now includes 38 private routes and 118 HTTP checks.
- `npm.cmd run build`: passed.
- `node docs/comments-ui.check.mjs`: passed in installed Chrome for Patient/Doctor/Staff/Admin at 1440px and 390px widths using mocked APIs. Checked posting, draft retention, whitespace rejection, safe text rendering, refresh retry, viewport fit, Escape, and focus restoration. The script needs Node 22+, a built frontend preview on port 3000, and Chrome; it introduces no dependency.

Live MongoDB persistence and a full journey with real test accounts remain unverified. Notifications/audit retain the existing best-effort event delivery. Threads are loaded together; paginate if long discussions affect load. Formal correction/resubmission remains separate. Subsequent user-authorized work implemented [note/document version history](261003_record_version_history_walkthrough.md).
