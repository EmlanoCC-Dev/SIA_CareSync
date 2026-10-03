# Appointment corrections and resubmission

Implemented October 4, 2026 under the user's explicit request. Document criteria are acceptance references, not instructions to execute.

## Workflow

1. Staff/Admin opens a Pending patient booking and selects **Request correction**, or opens **History & comments**. A correction explanation is required (1–2000 characters).
2. The appointment changes to **Needs correction**. Its existing tentative reservation stays held. Approval/decline is paused; cancellation remains available. The patient receives an in-app notification.
3. The owning Patient opens **Edit & resubmit** and reads the explanation. They edit the **reason for visit** and select **Resubmit for review**. A changed, nonblank reason is required (maximum 2000 characters).
4. The same appointment returns to **Pending**. The assigned Doctor and active Staff/Admin receive in-app review notifications. Staff/Admin can approve, decline, or request another correction.

Doctor, date, slot, patient identity, consultation notes, and documents remain fixed during correction. Flexible requests without an assigned slot can be corrected before their requested day expires. Walk-ins use their existing clinic workflow and cannot use patient resubmission.

## History and logs

**History & comments → Booking corrections → Correction history** retains each request and resubmission. Entries include:

- Incrementing booking revision, action, authenticated actor ID, name/role snapshot, and clinic-clock timestamp.
- The clinic's explanation when requesting correction.
- The reason at review, plus both previous and resubmitted reasons when the patient edits.

These snapshots and the status-history entry are appended in the **same conditional Appointment update** as the status/reason change. There are no edit/delete history endpoints. Existing bookings need no manual migration; missing revision fields are treated as revision zero. History starts with the first new correction request; previously overwritten reasons cannot be reconstructed.

Admin **Audit logs** displays `REVISION_REQUESTED` and `APPOINTMENT_RESUBMITTED`, with actor, appointment, revision and from/to status. These two correction audit events omit medical reasons and explanations; their content stays in the protected appointment history. Audit/inbox listeners use the existing best-effort event infrastructure: a listener outage does not undo the saved booking history, and durable replay is not implemented.

Correction events remain **in-app only**, including when Gmail SMTP is enabled. They do not add routine email traffic.

## API and conflict protection

Authenticated, appointment-scoped endpoints:

```text
PATCH /api/appointments/:id/request-correction
{ "explanation": "Please clarify your symptoms.", "bookingRevision": 0 }

PATCH /api/appointments/:id/resubmit
{ "reason": "Updated reason for this visit", "bookingRevision": 1 }
```

Both require the currently displayed revision. Requests with extra editable fields are rejected. Wrong roles, unrelated patients/doctors, and deactivated accounts cannot perform these actions. History uses existing appointment ownership/assignment restrictions.

Status, revision, current reason, doctor, date and slot are included in conditional write filters. Competing submissions have one winner; an approval/decline read before a correction cycle cannot overwrite that cycle. Slot confirmation also checks reservation ownership. An explicitly rejected slot confirmation restores the provisional approval when that appointment is still unchanged. A database acknowledgement failure can follow a committed write, so it does not erase approval history; clinic reconciliation is required for unknown write outcomes.

The original reserved slot must remain tentative, owned by the appointment, and consistent with the booked doctor/date/time. Requests and resubmissions are rejected at or after the appointment start. The patient must cancel/contact the clinic for a new booking if the time or reservation becomes invalid. Automatic no-show processing includes **Needs correction** and releases its owned expired slot after the end time. Doctor role-change guards and reporting status counts include the new status.

## Verification

- `node backend/tests/corrections.check.js`: **65 HTTP checks**, real routes/services/events with isolated models; permissions, input boundaries, forbidden edits, repeated cycles, actor attribution, preserved content, failed writes, duplicate submissions, stale approvals/declines, reservation ownership, flexible bookings, cancellation, expiry and no-show cleanup.
- All **13 backend check scripts** pass, including authentication on **43 private routes** and existing queue, comments, consultation-history, account, OTP and concurrency checks.
- `node backend/tests/email-notifications.check.js` verifies both correction event types remain in-app with Gmail enabled; no real email is sent.
- `npm.cmd run build` validates the production frontend.
- `node docs/comments-ui.check.mjs` checks Patient/Doctor/Staff/Admin at 1440px and 390px: correction inputs/actions, unchanged-reason prevention, failed-save draft retention, revised status/history and viewport fit, alongside existing comment/version/OTP flows.

Model doubles and browser API mocks do not establish live MongoDB persistence or delivery during database outages. Live database, deployment and end-to-end acceptance evidence remain pending. No new dependency or SMTP credential change is needed for this feature.
