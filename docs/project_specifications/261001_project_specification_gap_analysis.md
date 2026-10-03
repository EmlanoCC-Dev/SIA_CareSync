# CareSync: Project Specification Gap Analysis

**Project:** Healthcare Appointment, Queue, and Patient Notification Integration System

**Assessment date:** October 1, 2026; updated October 4, 2026 (Asia/Manila)

**Specification:** `C:/Users/Adrian/Downloads/Final Project Specification_MWA.pdf`

**Scope:** Current frontend, backend, repository documentation, and specification requirements.

**Updated status:** October 3, 2026, reviewed against pushed commit `8c503d3` on `main`. Queue actions/filtering, concurrency/assignment recovery, persistent in-app notifications, account-free walk-in patient display, agreed audit events, account maintenance, automatic no-show cleanup, scheduled arrival with a combined public queue, private appointment comments/replies, and consultation note/document version history are implemented. See the [feature walkthrough](261001_reports_assignment_and_working_hours_walkthrough.md), [API security walkthrough](261001_api_access_controls_and_security_walkthrough.md), [queue walkthrough](261002_walkin_queue_status_and_filters_walkthrough.md), [concurrency/recovery walkthrough](261002_concurrency_and_assignment_recovery_walkthrough.md), [notification walkthrough](261002_in_app_notifications_walkthrough.md), [identity walkthrough](261002_walkin_appointment_identity_walkthrough.md), [audit walkthrough](261003_audit_coverage_walkthrough.md), [comment walkthrough](261003_appointment_comments_walkthrough.md), and [version history walkthrough](261003_record_version_history_walkthrough.md).

**Latest code review:** October 4, 2026, including the user-authorized Gmail SMTP implementation after pushed commit `8c503d3`. The user-authorized correction/resubmission workflow is now implemented: Pending -> Needs correction -> Pending, with reason-only patient edits, retained booking history, status history, and actor-attributed audit events. See the [correction walkthrough](261004_booking_corrections_and_resubmission_walkthrough.md). Gmail email is restricted to Patients for confirmation, decline, cancellation, and no-show. Routine and clinic-role updates remain in-app. Patient signup and password change/reset use purpose-bound email OTPs; Admin account creation remains direct. User creation/updates, document archiving, and manual/on-demand slot generation emit actor-attributed audit events. Clock-change auditing is excluded by the user because that clock is a testing tool. See the [audit walkthrough](261003_audit_coverage_walkthrough.md), [account/no-show walkthrough](261003_accounts_and_no_show_walkthrough.md), [scheduled queue walkthrough](261003_scheduled_arrival_and_combined_queue_walkthrough.md), and [Gmail email walkthrough](261004_gmail_email_notifications_walkthrough.md). Gmail authentication and stored delivery metadata were verified; the user confirmed actual appointment-email receipt with matching Notifications sent timestamps. Remaining live workflow verification is described below.

### Current remaining gaps at a glance

**Notification scope decision (October 4):** The user confirmed that paid SMS APIs are not feasible for this project. The approved delivery scope is Gmail SMTP email plus the existing in-app inbox. SMS is excluded from the implementation backlog and should be documented as a project limitation. This records the user's delivery constraint; it does not claim instructor approval of the specification mapping.

**Latest verification update (October 4):** All thirteen backend checks passed. The live MongoDB concurrency suite passed in a disposable database and cleanup completed; existing application records were unchanged. Read-only live queries confirmed a verified Patient, consumed registration/password OTP challenges, a password-change audit record, and one notification marked sent with a timestamp. Gmail authentication and local backend health passed. The user confirmed working emailed codes, successful sign-in with the new password, and rejection of the old password. The user also confirmed appointment-email receipt with matching Notifications sent timestamps. The complete live clinic journey remains unverified. This supersedes the earlier blanket live-verification-pending statements below; see the [verification report](261004_live_verification_results.md).

**Latest implementation update (October 3):** Automatic no-show slot consistency and Admin account editing/role changes/deactivation/reactivation are now implemented. Deactivated accounts remain stored and cannot authenticate. Expired missed slots become No-show and lose their reservation; later passes repair interrupted cleanup. See the [account/no-show walkthrough](261003_accounts_and_no_show_walkthrough.md). References to these gaps in earlier review history describe their previous state. Live database verification remains pending.

**Scheduled queue update (October 3):** Scheduled arrival now records Checked In and a daily A- ticket while preserving the reserved slot. Consultation start is a separate action. The public board combines scheduled arrivals with walk-ins and shows multiple serving tickets. See the [scheduled queue walkthrough](261003_scheduled_arrival_and_combined_queue_walkthrough.md). The former queue/arrival gaps are implemented; live MongoDB and browser verification remain pending.

**Comment/feedback update (October 3):** Private appointment-linked review remarks and patient replies are implemented, with author/role snapshots, timestamps, in-app notifications, and audit events. See the [comment walkthrough](261003_appointment_comments_walkthrough.md). Live MongoDB verification remains pending. Comments alone do not change status; the separate formal correction/resubmission workflow was implemented on October 4.

**Version history update (October 3):** Changed consultation notes and replaced/archived documents preserve earlier content, author details where known, and timestamps. History is read-only with protected file downloads. All ten backend checks, the production build, and extended desktop/mobile Chrome checks passed. See the [version history walkthrough](261003_record_version_history_walkthrough.md). Live MongoDB verification remains pending. Legacy author/time metadata is not fabricated; already overwritten or removed records cannot be reconstructed.

**Email update (October 4):** Gmail SMTP is implemented alongside the in-app inbox under the user's explicit request. Only Patients receive appointment email for confirmation, decline, cancellation, and no-show; routine updates and all clinic-role activity remain in-app. Signup/password OTPs are separate security emails. Delivery status is recorded without credentials or raw SMTP errors and displayed in the owner-only Notifications inbox, including a sent timestamp and manual refresh. Signup displays confirmation after a successful verification-code send; password requests keep their neutral acknowledgement. Local credentials are stored only in ignored `backend/.env`; the shared example contains blank placeholders. SMTP connection/authentication was verified without sending email. SMS is excluded under the user's resource constraint. Automatic reminders and durable retry remain optional scope decisions; stored delivery results were verified, and the user confirmed appointment-email receipt with matching Notifications sent timestamps. See the [email walkthrough](261004_gmail_email_notifications_walkthrough.md).

| Priority | Gap | Current evidence and completion target |
| --- | --- | --- |
| Verification | Combined queue and consultation flow | Scheduled arrival, distinct start/completion, daily A- tickets, combined public board, and no-show protection are implemented. Verify real MongoDB indexes, persistence, and the complete patient journey. |
| 2 — verification/reliability | Live competing writes and recovery | Unique daily ticket constraint, conditional automatic/manual assignment, operation-owned reservations, durable generation plans, and assignment recovery are implemented. Isolated and live MongoDB concurrency checks passed. Consultation/status outage behavior and offline recovery still need separate verification. |
| Verification/reliability | Audit persistence | The agreed user/document/slot-generation events are implemented, alongside existing clinical audit events. A password-change audit record was confirmed in live MongoDB; remaining event persistence and outage behavior need verification. Events are best-effort without durable replay. Testing-clock changes are outside the agreed audit scope. |
| Verification/reliability | Notification delivery | Persistent private in-app inbox and Gmail SMTP email delivery are implemented. Gmail authentication and a stored sent result/timestamp passed; the user confirmed OTP receipt. The user confirmed appointment-email receipt with matching Notifications sent timestamps. Verify remaining recipient/read-state behavior. SMS is excluded under the user's resource constraint; reminders and durable retry are optional scope decisions. |
| Verification | Formal correction/resubmission | Staff/Admin correction requests and patient reason-only resubmission are implemented with immutable snapshots, status history, audit metadata, and in-app notifications. Verify live MongoDB persistence and competing writes. |
| Verification | Live database and complete patient journey | Isolated checks, live concurrency, and read-only OTP/audit/delivery metadata checks passed. The user confirmed password-change receipt and login behavior. Verify the remaining account and clinic journeys, aggregation, role restrictions, and downloads with real test accounts and MongoDB. |
| Submission | Final paper and evidence package | Development notes, walkthroughs, and runnable checks exist. Complete the final paper, diagrams/ERD, categorized results, deployment and integration evidence, backup/restore demonstration, and submission materials. |

Priorities are a recommended implementation order, not severity scores from the specification. Scope-confirmation items are absent features whose exact required healthcare behavior remains unsettled. Submission gaps describe repository evidence; independently maintained deliverables may already exist elsewhere.

### Remaining feature implementation checklist

These are specification findings, not new implementation instructions from the user. The proposed healthcare behaviors for generic requirements need instructor acceptance.

No further feature implementation is currently scheduled under the agreed scope. The healthcare theme names SMS/email; this project implements Gmail SMTP email and the in-app inbox. SMS is excluded because paid providers are not feasible for the user. Document that limitation in the final paper and demonstration; acceptance of this mapping remains an instructor decision.

Queue-turn alerts, advance reminders, and durable delivery retries are additional scope/reliability decisions; they should not be represented as explicit minimum requirements without an accepted delivery scope. Live database/browser verification and submission evidence are outstanding completion work, separate from these missing features.

### Completed since the initial assessment

| Previous gap | Current status | Verification still needed |
| --- | --- | --- |
| Reports with reporting-period filters | Implemented for Staff/Admin/Doctor, including date filters, status counts, daily totals, and doctor workload. Doctors are restricted to their own records. | Live MongoDB aggregation and reporting boundaries. |
| Later assignment for "Any available doctor" bookings | Staff/Admin can assign a doctor and available slot to a pending flexible booking. Approval requires assignment; conditional slot reservation and rollback checks are implemented. | Live persistence, simultaneous reservations, and failure recovery across records. |
| Recurring working-hours editing | Weekly hours and consultation duration can be edited. Configured off days affect new slot generation; existing dated slots are preserved. | Live save/reload and generation from stored schedules. |
| Slot blocking/reopening | Authorized slot-status route is implemented with ownership, occupied-slot, expired-slot, and reservation-conflict checks. | Live concurrent reservation versus blocking. |
| API access controls | Central authentication, appointment ownership/doctor assignment, protected downloads, Admin-only clock changes, scoped slot/walk-in responses, and ticket-only public queue responses are implemented. | Live test-account and deployment verification. |
| Doctor consultation-start permission and scheduled arrival | Assigned Doctors can start a checked-in visit through a separate action. Scheduled check-in records arrival without starting consultation. | Live consultation workflow and cross-record failure recovery. |
| Combined scheduled/walk-in public queue | Arrived scheduled patients receive daily A- tickets and appear alongside walk-ins; the board shows multiple serving tickets without patient identities. | Live ticket indexes, simultaneous arrivals, and browser verification. |
| Automatic no-show cleanup | Missed appointments release their owned expired reservations as No-show; later processing repairs interrupted cleanup. Checked-in patients are protected. | Live persistence and concurrent arrival/no-show verification. |
| Admin account maintenance | Admin can edit accounts, change roles, deactivate, and reactivate. Deactivation retains the account and blocks authentication. | Live persistence, existing-session rejection, and browser verification. |
| Formal correction/resubmission | Staff/Admin supplies an explanation; the owning Patient edits the reason and resubmits the same appointment. Prior reasons, explanations, actors, timestamps and status changes are retained. Stale writes and expired/invalid reservations are rejected. | Live persistence, competing review/correction writes, and audit/notification delivery. |
| Appointment comment/feedback workflow | Owning Patients, assigned Doctors, Staff, and Admin can read/post private plain-text comments with author/role/time details. Notifications and audit events are implemented. | Live persistence and notification/audit delivery with real test accounts. |
| Consultation note/document version history | Changed notes, document replacement, and archiving preserve read-only earlier content with protected downloads. Unchanged notes create no extra revision. | Live persistence, concurrent writes, and backup/restore of histories and retained files. |
| Walk-in queue actions and list filters | Status route, permitted transitions, appointment/slot synchronization, Doctor assignment checks, status/date filters, and status audit events are implemented. Walk-in arrival is separate from session start. | Live persistence, competing writes across endpoints, and recovery from database outages. |
| Queue concurrency, automatic assignment, and assignment recovery | Unique daily tickets, guarded/date-scoped automatic assignment, revision-controlled slot generation, and durable booking/assignment recovery are implemented. Slot-freed automation is registered. Isolated and live MongoDB concurrency checks passed. | Live outage behavior, offline recovery, and production index rollout. |
| Persistent in-app notifications | Owner-only inbox, unread counts, read actions, and appointment/doctor queue handlers are implemented for the relevant role accounts. | Live persistence/recipient/read-state verification; clarify required external channels, reminders, and delivery guarantees. |
| Gmail SMTP email notifications | Four important patient appointment outcomes send email; routine and clinic-role events stay in-app. Signup/password OTPs use the same transport. Gmail authentication and live sent-status persistence passed; the user confirmed working OTP receipt. | User-confirmed appointment-email receipt/timestamp matching passed. Remaining live recipient/read-state checks are pending. Document the agreed email-only external delivery scope and SMS limitation; durable retry is absent. |
| Account-free walk-in details in appointment tables | Staff/Doctor/Admin display the linked name/contact and Walk-in/queue label. Missing identities have an explicit fallback. | Live records/test-account verification; repeat-visit profiles and verified account linking remain optional enhancements. |
| User creation, document deletion, and slot generation audits | Implemented with actor/target attribution and selected metadata. The Admin viewer displays readable summaries. Clock-change auditing is excluded by user instruction. | Live MongoDB/deployment verification and required audit delivery reliability. |

All thirteen backend check scripts, the frontend production build, and extended Chrome checks passed after the email-policy/OTP and correction/resubmission changes. Correction checks cover protected actors, preserved reasons, competing resubmissions/reviews and invalid reservations; desktop/mobile Chrome checks cover correction forms and history across all four roles. Signup, recovery, and password changes were tested at desktop/mobile widths with mocked APIs. Extended Chrome checks passed for comments/history across all four roles and note-save/replacement/archive controls at desktop/mobile widths. Earlier mocked desktop/mobile UI smoke checks passed for previously implemented screens; the new account-maintenance and scheduled-queue browser checks remain pending because Puppeteer is unavailable. Live-database and full end-to-end verification remain outstanding. Reports exports, split shifts, holiday calendars, and permanent repeat-visit patient profiles are optional enhancements, not established specification gaps.

## 1. Overall assessment

CareSync has the core healthcare modules, persistent in-app notifications, Gmail SMTP email delivery, account-free walk-in identity display, account maintenance, no-show slot consistency, scheduled arrival/start separation, a combined public queue, private appointment comments/replies, note/document version history, and the agreed audit events. Acceptance of email without SMS, audit/notification delivery reliability, live verification, and submission evidence remain outstanding. Formal correction/resubmission is implemented within the user-approved reason-only scope.

This assessment distinguishes:

- **Specification requirements:** Items stated in the supplied project document.
- **Implementation findings:** Behaviors and gaps identified in the current code.
- **Recommendations:** Proposed ways to complete the system; these are not additional instructor requirements.

The supplied document is treated as assessment criteria, not as authorization to change the application. The completed features and access controls above were implemented under the user's subsequent requests.

## 2. Specification interpretation

The healthcare theme appears on page 2 and connects patient booking, clinic dashboards, doctor schedules, queue management, SMS/email notifications, and consultation records.

Several later requirements use animation and production terminology. The following healthcare mappings are proposed and require instructor confirmation, especially for version tracking, feedback, and revision requests.

| Generic specification term | Proposed healthcare equivalent |
| --- | --- |
| Project/production module | Appointment and consultation management |
| Asset/file submission | Medical documents and consultation attachments |
| Version tracking | Medical document and consultation-note revisions, alongside appointment status history |
| Review and approval | Appointment review, approval, rejection, and requests to correct submitted information |
| Comment/feedback | Appointment feedback, correction instructions, and review remarks |
| Dashboard/report | Appointment, queue, consultation, and notification summaries |

Important scope distinctions:

- The specification permits mobile **and/or** web; a separate native mobile app is not clearly mandatory.
- At least one integration option is required. REST APIs and event-driven integration can cover this without adding ETL, webhooks, or microservices.
- The healthcare theme mentions SMS/email, while the general requirements allow notification logs and integration simulations. Acceptance of simulated delivery should be confirmed with the instructor.
- This document is a gap assessment, not the final project paper or a numerical grading rubric.
- The user excludes clock-change auditing because the clock is a testing tool. Its existing Admin-only access control remains implemented. That exclusion does not remove clinical audit events triggered by simulated time.

## 3. Requirement coverage

“Present” means implementation was identified in code; it does not mean the complete workflow passed live testing.

| Requirement | Current state | Missing or incomplete work |
| --- | --- | --- |
| User management | Implemented; live verification pending | Login, OTP-verified patient signup, OTP password change/reset with session invalidation, four roles, direct Admin creation/editing, role changes, and retained-account deactivation/reactivation exist. Live persistence/session verification remains pending. |
| Patient booking | Implemented; live verification pending | Booking/listing and later doctor/slot assignment exist. Cross-record failure recovery and live concurrency still need verification. |
| Doctor schedules | Implemented; live verification pending | Daily/custom generation, weekly working hours, and blocking/reopening exist. Durable doctor/day plans coordinate competing generators and repair partial writes. Actual MongoDB concurrency/index verification remains pending. |
| Review and approval | Implemented; live verification pending | Approve/decline and formal correction requests/resubmission exist. Clinic explanations and previous reasons remain in protected history with actor/time attribution. |
| Consultation records/files | Implemented; live verification pending | Notes, attachments, owner/assigned-doctor checks, protected downloads, replacement, archiving, and content version history exist. |
| Version tracking | Implemented; live verification pending | Appointment status history and read-only note/document versions exist. New snapshots retain author/time details; missing legacy metadata is labelled unavailable. |
| Comment/feedback | Implemented; live verification pending | Private appointment threads support clinic review remarks and patient replies, author/role snapshots, timestamps, notifications, and audit events. Formal revision requests/resubmission remain separate. |
| Patient notifications | Implemented; live receipt/timestamp matching passed for user-tested cases | Owner-only inbox, unread/read state, patient appointment outcomes, Staff/Admin requests, and doctor assignment/arrival updates exist. Gmail authentication and stored delivery metadata passed; the user confirmed appointment-email receipt with matching timestamps. Remaining live recipient/read-state verification is pending. SMS is excluded; reminders and durable replay remain absent. |
| Queue management | Implemented; live verification pending | Walk-in registration/assignment/transitions/filters, scheduled arrival/start separation, daily ticket uniqueness, and combined public display exist. Live index/transition/recovery checks remain pending. |
| Dashboard/reports | Implemented; live verification pending | Role dashboards and date-filtered reports exist. Live aggregation needs verification. |
| Audit logs | Agreed event coverage implemented; live verification pending | Existing clinical events plus user creation, document deletion, and slot generation are logged with actor/source metadata. Testing-clock changes are excluded. Best-effort event delivery and live persistence still need verification against accepted reliability requirements. |
| Integration component | Present | REST APIs, audit events, active slot-freed reassignment, and persistent in-app notification handlers connect modules. Event delivery is in-process and lacks durable replay. |

## 4. Defects and resolution status

### 4.1 Resolved in implementation: appointment ownership and assignment checks

The original list endpoints correctly filtered records by patient or doctor. Separate individual-record endpoints lacked equivalent checks. Shared appointment-access middleware now verifies the owner Patient or assigned Doctor before every individual appointment read/mutation. Staff/Admin retain existing clinic-wide permissions.

Cross-patient and unassigned-doctor requests were rejected in real-route HTTP checks using dummy database records. Live-account verification remains pending.

**Evidence:** [Appointment controller](../../backend/src/controllers/appointment.controller.js), [appointment service](../../backend/src/services/appointment.service.js), and [appointment routes](../../backend/src/routes/appointment.routes.js).

### 4.2 Resolved in implementation: public medical file access

Public `/uploads` serving is disabled. Downloads now require login, appointment ownership/assignment, a document ID belonging to that appointment, and a filesystem path inside the upload directory. The frontend sends the token through the authenticated download API.

HTTP checks verified permitted file contents/headers, denied cross-account access, rejection of path traversal, and disabled old URLs. Caller-supplied replacement file references are also rejected. Live deployment verification remains pending.

**Evidence:** [Backend server](../../backend/server.js).

### 4.3 Resolved in implementation: unprotected system clock changes

`POST /api/system/time` now requires Admin access and validated date/time or reset input. The public GET remains read-only and no longer runs no-show processing. Non-Admin and invalid-input requests preserve the clock in automated checks.

A successful Admin clock change still invokes existing no-show processing. Resetting the clock does not undo status changes caused by simulation. Live-account verification remains pending.

**Evidence:** [System routes](../../backend/src/routes/system.routes.js).

### 4.4 Resolved in implementation: walk-in status endpoint and filters

`PATCH /api/walkins/:id/status` handles Check In, Start Session, Complete, and Left with role/assignment checks, permitted transitions, linked-record validation, conditional writes, and compensating recovery. Check-in now sets the appointment Checked In while keeping the slot reserved; start/completion synchronize all three records; leaving cancels the linked appointment and releases the slot. Previously checked-in walk-ins with Confirmed appointments remain supported.

The focused check passed 35 HTTP checks. Live competing writes, persistence, and outage recovery still need verification; compensating writes are not a multi-document transaction.

**Evidence:** [Walk-in queue](../../frontend/src/components/WalkInQueue.jsx), [API client](../../frontend/src/services/api.js), and [walk-in routes](../../backend/src/routes/walkIn.routes.js).

The [walk-in controller](../../backend/src/controllers/walkIn.controller.js) now applies validated status/date filters while retaining Doctor assignment scope. The screen uses the backend clinic day by omitting its former browser-derived date. Stale list responses are ignored. See the [queue walkthrough](261002_walkin_queue_status_and_filters_walkthrough.md).

### 4.5 Resolved: slot status endpoint

`PATCH /api/slots/:id/status` is now registered and connected to Block/Cancel Slot and Make Available controls.

Authorized Available/Cancelled transitions include checks for doctor ownership, linked appointments, occupied states, expired starts, and concurrent reservations. This item is removed from the remaining-work list; live-database verification is still needed.

**Evidence:** [Slot management](../../frontend/src/components/SlotManagement.jsx), [API client](../../frontend/src/services/api.js), and [slot routes](../../backend/src/routes/slot.routes.js).

### 4.6 Resolved in implementation: doctor start-consultation permission mismatch

The check-in/start endpoint now permits the assigned Doctor, with the common appointment-assignment guard. Staff/Admin retain access. Positive and unassigned-doctor denial checks passed with dummy records.

Arrival/waiting is now separate from consultation start, including scheduled visits; see the scheduled queue walkthrough. Live consultation-start verification is still needed.

**Evidence:** [Doctor dashboard](../../frontend/src/pages/DoctorDashboard.jsx) and [appointment routes](../../backend/src/routes/appointment.routes.js).

### 4.7 Resolved in implementation: safe automatic reassignment

The slot-freed handler is now registered at startup. It reuses the guarded manual assignment path and selects only today's unassigned waiting entries for future slots today during clinic hours. Conditional claims, distinct operation ownership, and durable recovery protect competing requests.

Isolated checks cover competing assignments and the registered event handler. Live MongoDB and deployment verification remain pending. See the [concurrency/recovery walkthrough](261002_concurrency_and_assignment_recovery_walkthrough.md).

**Evidence:** [Backend server](../../backend/server.js) and [slot-freed handler](../../backend/src/events/handlers/slotFreed.handler.js).

## 5. Workflow and reliability gaps

| Finding | Current behavior | Completion needed |
| --- | --- | --- |
| Flexible booking failure recovery | Reservations now carry an operation ID, and booking/assignment intents are persisted before claims. Failed cleanup remains recoverable through the offline script; committed links are preserved after lost acknowledgements. | Verify live database failures and the documented offline recovery procedure. Other appointment/status mutations are not covered by this journal. |
| Scheduled patient queue | Resolved in implementation: the board combines ticketed scheduled arrivals and walk-ins, excludes duplicate linked visits, and exposes only ticket/status. | Verify live ticket indexes, persistence, day rollover, and display. |
| Arrival versus consultation start | Resolved in implementation: check-in sets Checked In and preserves reservation; explicit start sets appointment/slot In Progress. Arrived patients are exempt from automatic no-shows. | Verify live transitions and failures; conditional compensation is not a multi-document transaction. |
| Automatic no-show slot state | Resolved in implementation: conditional no-show transitions release linked reservations to the terminal No-show slot state; later passes repair interrupted cleanup. | Verify live persistence, competing status actions, and cleanup recovery. |
| Queue-number concurrency | Resolved in implementation: the daily unique index arbitrates insertion retries; the clinic-clock timestamp/day is stored. Legacy tickets are preserved. | Verify actual index creation and concurrent registrations against MongoDB. |
| Automatic walk-in assignment | Resolved in implementation: automatic/manual paths share conditional claims, date restrictions, and durable assignment recovery. The handler is active. | Verify deployed event handling, competing requests, and recovery against MongoDB. |
| Concurrent custom slot generation | Resolved in implementation: durable doctor/day plans use a revision compare-and-set before materializing slots. Partial writes can be repaired without resetting reservations/blocks. | Verify actual MongoDB revision races, unique indexes, and startup restoration. |
| Audit completeness | Resolved for the agreed missing actions: user creation, successful conditional document removal, and manual/on-demand slot generation emit selected actor-attributed payloads. Testing-clock changes are excluded. | Verify live persistence, read permissions, and required delivery guarantees; the current handler catches/logs persistence failures without durable replay. |
| Walk-in identity in appointment lists | Resolved in implementation: Staff/Doctor/Admin tables use account details or linked walk-in name/contact and a Walk-in/queue label. Missing identities have an explicit fallback. Account-free registration and the existing single visit link are preserved. | Verify the display using live records/test accounts; permanent repeat-visit profiles/account linking are separate enhancements. |
| Public queue privacy | Resolved in implementation: public entries contain only queueNumber/status; the screen uses tickets instead of names. Doctors' private walk-in lists are scoped to assigned entries. | Verify the final deployed response and role scopes with live test accounts. |

Relevant implementation: [Appointment service](../../backend/src/services/appointment.service.js), [walk-in service](../../backend/src/services/walkIn.service.js), [slot service](../../backend/src/services/slot.service.js), and [audit handler](../../backend/src/events/handlers/auditLog.handler.js).

## 6. Notification status and remaining work

[Notification service](../../backend/src/services/notification.service.js) now stores MongoDB records. A shared inbox exposes owner-only history, unread counts, filtering, pagination, and read actions. Patient requests notify Staff/Admin and the selected doctor; assignment/approval/status events notify the relevant Patient/Doctor. Walk-in assignment and arrival notify the assigned Doctor; an account-free walk-in has no patient inbox. See the [notification walkthrough](261002_in_app_notifications_walkthrough.md).

After saving inbox records, the same service attempts Gmail SMTP delivery only for Patients' confirmation, decline, cancellation, and no-show notifications. All other notifications stay in-app. Signup/password OTP security emails use the same transport separately. Missing/deactivated/invalid recipients are skipped. SMTP failure preserves the inbox and records a safe error code. A successful SMTP acceptance records `sent`, its timestamp, and message ID; this does not prove final inbox receipt. See the [Gmail email walkthrough](261004_gmail_email_notifications_walkthrough.md).

Remaining notification work:

1. Verify stored records, read timestamps, indexes, and recipient scope against live test MongoDB/accounts.
2. Appointment-email receipt and matching Notifications sent timestamps passed through user confirmation. Verify remaining delivery/read-state behavior. Document Gmail email plus in-app delivery as the approved scope, with SMS excluded under the user's resource constraint.
3. Implement advance/queue-turn reminders if required; no active `PATIENT_TURN_ALERT` listener exists.
4. Add durable event dispatch/retry if guaranteed delivery is required. Current save failures are logged, and process-local events can be lost during outages.
5. Capture successful/failed notification and complete patient-journey evidence for testing and defense.

Persistent records and a visible inbox address the generic notification-log requirement. Gmail SMTP adds an external email channel; SMS is absent. The isolated notification check passed event/privacy/failure cases and 32 HTTP checks; the isolated email check passed transport/routing/status/privacy/failure cases. Gmail connection and authentication passed without sending email. Earlier mocked browser checks passed on desktop/mobile. Stored delivery metadata was verified in live MongoDB, and the user confirmed appointment-email receipt with matching Notifications sent timestamps. Remaining live recipient/read-state and outage checks are pending.

## 7. Documentation and submission gaps

The complete deliverables below were not found in the repository reviewed. Existing development notes, implementation walkthroughs, the API role/access matrix, and runnable checks cover parts of the work. Other materials may exist outside the repository and should be checked before creating duplicates.

| Required deliverable | Gap to address |
| --- | --- |
| Final project document | Existing change notes do not cover the required 15-part document. |
| Functional requirements | Document at least 10 functional requirements. |
| Nonfunctional requirements | Document at least 8 nonfunctional requirements with assessable criteria. |
| Integration traceability | Link requirements to stakeholders, modules, diagrams, and test cases. |
| Enterprise architecture | Document business, data, application, and technology architecture, including sources of truth. |
| Architecture decisions | Compare architecture styles/integration patterns and record the selected approach, rationale, and consequences. |
| Required diagrams | Prepare the eight required diagrams and database design/ERD. |
| Security/governance | The API role/access matrix and privacy controls are documented in the security walkthrough. Incorporate them into the final paper and complete separation of duties, module/data ownership, and governance responsibilities. |
| Risk register | Identify at least 8 risks with likelihood, impact, risk level, controls, and monitoring plans. |
| Integration evidence | Capture requests/responses, mappings, payloads, saved database records, and successful/failed integration logs. |
| Test plan/results | Categorize test cases and record actual outcomes against the required minimums. |
| Deployment | Document the demonstration/deployment environment and capture running-system evidence. |
| Backup/recovery | Document source, database, file, and documentation backups; demonstrate restoration. |
| Demo package | Provide demo script, accounts, reproducible sample data, and logs. |
| Final submission | Include database export or migration material, screenshots, slides, and individual contribution sheet. |

### Required final-document structure

Include a title page, followed by:

1. Introduction
2. Current-State Analysis
3. Requirements Analysis
4. Enterprise Architecture
5. Target-State Architecture
6. System Design
7. Integration Design and Implementation
8. Security, Governance, and Risk Management
9. Testing and Evaluation
10. Deployment, Backup, and Recovery
11. System Demonstration Guide
12. Limitations and Future Enhancements
13. Individual Contribution
14. References
15. Appendices

Use the supplied PDF's subsections when preparing the final paper.

### Required diagrams

- Current-state process flow
- Target-state process flow
- Context diagram
- Use-case diagram
- Data-flow diagram
- Sequence diagram
- Application architecture diagram
- Deployment diagram

Database design/ERD is additionally requested under System Design.

### Required prototype screen gaps

Existing pages/modals cover login, dashboards, appointment lists, submission, status history, approval actions, audit logs, and user creation/listing. The generic screen list still leaves these gaps:

- Comment/feedback is implemented inside appointment details; confirm that this dialog satisfies the generic screen requirement.
- Note/document version history is implemented inside appointment and medical-record dialogs; confirm acceptance of that screen mapping.
- Admin user/role management is implemented; verify editing/deactivation/reactivation against live accounts.

Confirm whether existing appointment detail/history modals count as the corresponding required screens.

## 8. Required testing evidence

The specification requires the following minimum evidence:

| Test category | Minimum |
| --- | ---: |
| Functional test cases | 8 |
| Integration test cases | 5 |
| Error-handling test cases | 5 |
| Security/access-control test cases | 3 |
| End-to-end scenario | 1 |

The expanded [UI smoke script](../ui-smoke.mjs) checks intercepted API calls and mock responses at desktop/mobile widths, including the notification inbox for all roles. The [backend workflow check](../../backend/tests/clinic-workflows.check.js) passed using actual services, Express routes, and JWT middleware with isolated model doubles. The [API access check](../../backend/tests/api-access.check.js) passed 124 HTTP checks, including missing-login rejection on all 43 registered private routes, record scope, uploads/downloads, clock restrictions, and response privacy. The [notification check](../../backend/tests/notifications.check.js) passed event/privacy/failure cases and 32 HTTP checks. The [comment check](../../backend/tests/comments.check.js) passed 52 HTTP checks and notification/audit/privacy/failure checks. The [version history check](../../backend/tests/versions.check.js) passed 58 HTTP checks with real temporary uploads/downloads and isolated database models. The [focused browser check](../comments-ui.check.mjs) passed for all four roles at desktop/mobile widths, including history, record-editing controls, signup verification, password recovery/change, and session clearing, with mocked APIs. The frontend production build also passed. These checks do not establish live MongoDB persistence, aggregation, concurrency, notification delivery, or the complete patient journey. A categorized results package meeting all specification minimums remains outstanding.

Recommended cases should include:

- Patient registration/login and patient booking.
- Staff approval and doctor consultation start/completion.
- Walk-in registration, assignment, and queue transitions.
- Cancellation/no-show effects on slots and waiting patients.
- Notification persistence and delivery/simulation outcomes.
- Missing fields, invalid dates/durations, unsupported/oversized uploads, occupied slots, and integration failures.
- Cross-patient appointment access, unassigned-doctor actions, unauthenticated document access, and unauthorized clock changes.
- Concurrent booking/assignment and daily queue rollover.

Suggested end-to-end scenario: patient books a slot, staff approves, patient receives a notification, reception checks in the patient, the queue updates, the assigned doctor starts consultation, records notes/documents, completes the visit, and the patient views the resulting record. Verify related database records and audit entries throughout.

## 9. Recommended completion order

1. **Verify queue coverage:** scheduled-patient arrival/start separation, combined public display, daily tickets, and no-show slot consistency are implemented. Verify the full journey, index rollout, competing transitions, and recovery with test MongoDB.
2. **Verify audit persistence:** user creation, document deletion, and slot generation events are implemented. Confirm actor/target attribution, selected metadata, and audit reads with real test accounts/MongoDB. Clock-change auditing is excluded as requested for the testing tool.
3. **Verify implemented workflows against MongoDB:** exercise queue actions/filters, identity display, notification persistence/read state, role scope, reports, scheduling, competing reservations, and offline recovery with real test accounts. The former missing routes, console-only inbox, and blank walk-in details are implemented fixes, not remaining implementation tasks.
4. **Verify delivery and document scope:** Gmail SMTP email is implemented; authentication and user-confirmed appointment-email receipt/timestamp matching passed. SMS is excluded under the user's resource constraint. Reminders and durable retries are optional scope decisions. The user-approved reason-only correction/resubmission workflow, comments, content version history, and account maintenance are implemented; verify their live persistence and delivery.
5. **Prepare the submission evidence:** complete the full patient journey, categorized results, eight diagrams plus ERD, final paper, integration screenshots/logs, deployment evidence, and demonstrated backup/restore. Start organizing existing evidence while completing the workflows.

### Remaining-work checklist

- [x] Implement patient ownership and assigned-doctor access on individual appointment reads and mutations; dummy-record HTTP checks passed.
- [x] Protect medical downloads, restrict/validate clock changes, and minimize public queue responses; dummy-record HTTP checks passed.
- [x] Connect doctor consultation start with correct role and assignment permissions; dummy-record HTTP checks passed.
- [x] Implement walk-in status transitions and working status/date filters; 35 isolated HTTP checks passed.
- [x] Include ticketed scheduled arrivals in the combined public queue and separate arrival from consultation start; 26 isolated HTTP checks and race/privacy/recovery assertions passed. Live database and browser verification remain pending.
- [x] Release/synchronize slots during automatic no-show processing; expired slots become No-show and interrupted cleanup is retried. Isolated checks passed.
- [x] Implement new-ticket uniqueness, guarded automatic assignment, and active slot-freed events; isolated concurrency checks passed.
- [x] Coordinate slot generation with durable plans and add durable booking/assignment recovery plus an offline reconciliation script.
- [x] Store in-app notifications, expose an owner-only inbox/read state, and connect implemented appointment and doctor queue events; isolated API/event and mocked desktop/mobile checks passed.
- [x] Implement Gmail SMTP email for four important patient appointment outcomes alongside the in-app inbox, preserve inbox entries on email failure, and record safe delivery status. Isolated checks and Gmail authentication passed without sending email.
- [x] Add email OTP verification to patient self-registration and all-role password change/reset, with expiry, single-use/attempt/resend limits, and session invalidation. Admin creation remains direct as requested. See [OTP walkthrough](261004_email_policy_and_account_otp_walkthrough.md).
- [x] Verify Gmail authentication, read-only stored OTP consumption/password audit/sent-email metadata, and live database concurrency. User confirmed emailed codes and new-password success/old-password rejection; see the [verification report](261004_live_verification_results.md).
- [x] Record Gmail email plus in-app notifications as the approved delivery scope; SMS is excluded because paid providers are not feasible for the user and must be documented as a limitation.
- [x] Confirm appointment-email receipt and matching Notifications sent timestamps through the user's manual test; see the [verification report](261004_live_verification_results.md).
- [ ] Verify remaining live account flows and notification recipient/read-state behavior; assess delivery reliability. Queue-turn/advance reminders remain optional scope decisions.
- [x] Display account-free walk-in names/contact details and queue labels in Staff/Doctor/Admin appointment tables, with an explicit missing-identity fallback; mocked desktop/mobile checks and production build passed.
- [x] Add user creation, document deletion, and slot generation audit events with actor attribution; 33 isolated HTTP checks passed. Testing-clock changes are excluded from this scope.
- [ ] Verify audit persistence and accepted reliability against live MongoDB/deployment infrastructure.
- [x] Implement Admin profile editing, role changes, and retained-account deactivation/reactivation with login/session restrictions and audit events. Isolated checks passed.
- [x] Implement appointment-linked comments/replies and note/document version history under the user's approved healthcare mapping.
- [x] Implement the user-approved formal patient correction/resubmission workflow with preserved history and audit events.
- [ ] Verify correction/resubmission persistence and competing writes with live MongoDB.
- [ ] Verify access controls, reports, assignment, schedules, and blocking against a test MongoDB database, including competing writes and rollback failure handling.
- [ ] Produce the required final paper, diagrams/ERD, categorized test evidence, demo data/screenshots, database export or migration material, backup/restore evidence, slides, and contribution records.

## 10. Review method and limitations

- Read the 14-page supplied specification and inspected current application code and repository documentation.
- Inspected registered Express routes without starting the server or connecting to MongoDB.
- Inspected event listeners after the notification/audit registrations currently used at startup.
- The initial review confirmed absent walk-in/slot status routes, the audit-only slot-freed listener, and absence of a patient-turn-alert listener under those registrations. Walk-in/slot status routes, Doctor check-in permissions, and active slot-freed assignment have since been implemented. Patient-turn alerts remain absent.
- Subsequent implementation passed backend workflow/HTTP checks with model doubles, the frontend build, and mocked desktop/mobile browser smoke checks. See the walkthrough for recorded verification and commands.
- At the initial review, live database workflows, delivery-provider tests, and deployed-system checks had not been run. October 4 live verification is recorded separately below.
- Subsequent user-authorized work implemented access controls and passed 109 HTTP checks, including all 30 private routes, with dummy database responses. No real patient records were changed by the checks.
- Expanded desktop/mobile UI checks also passed with mocked APIs for authenticated downloads, Admin-only clock editing, and ticket-only queue display.
- The October 1 source review against `910533d` reconfirmed the then-missing walk-in status route and ignored filters, plus console-only notifications, inactive slot-freed handling, queue-number allocation, no-show slot inconsistency, and incomplete audit coverage.
- On October 2, the user-authorized queue fix added status transitions and filters. The new check passed 35 HTTP checks, the existing workflow check passed, API access checks passed 110 HTTP checks across 31 private routes, and the frontend build passed. These results do not establish live database correctness.
- Expanded mocked browser checks passed at 1440px/390px, including Staff Check In/Left and Doctor Start Session/Complete with status filtering. Changed queue screenshots were visually reviewed.
- Subsequent October 2 concurrency/recovery changes passed the new isolated concurrency suite and all existing backend suites. Live mode was attempted outside the sandbox and could not connect to MongoDB. The new walkthrough documents what the journal covers, index rollout, and offline recovery prerequisites.
- Subsequent October 2 in-app notification changes passed event/privacy/failure checks and 32 isolated HTTP checks. API access checks now pass 113 HTTP checks across all 34 private routes. The frontend build and expanded all-role desktop/mobile browser checks passed; inbox screenshots were reviewed. Actual MongoDB notification persistence remains unverified.
- Account-free walk-in display changes passed the build, API access checks, and expanded all-role 1440px/390px browser checks with mocked APIs. The categorized changes were pushed through `7176784`. This review reconfirmed remaining source-level gaps without rerunning the prior suites or attempting live database writes.
- On October 3, user-authorized work added user creation, document deletion, and slot generation audit coverage, excluding the testing clock. The new audit check passed 33 HTTP checks; all existing backend suites passed. Tests use isolated models and do not establish live audit persistence or durable delivery.

Findings describe the workspace updated on October 4, 2026. "Implemented" and "verified against live infrastructure" are separate states. Record relevant live-backend evidence before claiming complete workflow verification.

On October 4, all thirteen backend suites passed again. Gmail authentication, local backend health, read-only OTP/audit/delivery metadata, and live concurrency in a disposable MongoDB database passed. The user confirmed working emailed codes and successful password replacement. The user also confirmed appointment-email receipt with matching Notifications sent timestamps. The full live clinic journey and outage/deployment checks remain outstanding. See the [live verification report](261004_live_verification_results.md) for commands, evidence, and limits.
