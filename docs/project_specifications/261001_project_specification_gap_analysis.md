# CareSync: Project Specification Gap Analysis

**Project:** Healthcare Appointment, Queue, and Patient Notification Integration System

**Assessment date:** October 1, 2026; updated October 2, 2026 (Asia/Manila)

**Specification:** `C:/Users/Adrian/Downloads/Final Project Specification_MWA.pdf`

**Scope:** Current frontend, backend, repository documentation, and specification requirements.

**Updated status:** October 2, 2026, after queue actions/filtering, concurrency/assignment recovery, and persistent in-app notifications. See the [feature walkthrough](261001_reports_assignment_and_working_hours_walkthrough.md), [API security walkthrough](261001_api_access_controls_and_security_walkthrough.md), [queue walkthrough](261002_walkin_queue_status_and_filters_walkthrough.md), [concurrency/recovery walkthrough](261002_concurrency_and_assignment_recovery_walkthrough.md), and [notification walkthrough](261002_in_app_notifications_walkthrough.md).

**Latest code review:** October 2, 2026, including queue, concurrency/recovery, notification, and walk-in identity display changes in the workspace after baseline commit `910533d` on `main`. Automated checks use model doubles or mocked APIs; live MongoDB verification is still pending. Staff/Doctor/Admin appointment tables now display linked walk-in names/contact details without requiring a patient account; see the [identity walkthrough](261002_walkin_appointment_identity_walkthrough.md).

### Current remaining gaps at a glance

| Priority | Gap | Current evidence and completion target |
| --- | --- | --- |
| 1 — notification coverage/acceptance | Notification delivery and reminders | Persistent private in-app inbox and appointment/doctor queue updates are implemented. Live persistence, queue-turn/advance reminders, guaranteed delivery, and acceptance of in-app delivery versus the theme’s SMS/email requirement remain unresolved. |
| 2 — workflow integrity | Queue coverage and no-shows | Public display uses walk-ins only; scheduled appointment check-in immediately starts consultation; automatic no-shows leave linked slots unsynchronized. Safe slot-freed reassignment is now registered. |
| 3 — verification/reliability | Live competing writes and recovery | Unique daily ticket constraint, conditional automatic/manual assignment, operation-owned reservations, durable generation plans, and assignment recovery are implemented. Isolated checks passed; the live MongoDB command could not connect. Consultation/status outage behavior still needs separate verification. |
| 4 — traceability | Incomplete audit coverage | User creation, document deletion, slot generation, and clock changes lack corresponding audit records. Walk-in registration/status actions now record the authenticated actor; automatic assignments are identified as system actions. |
| Scope confirmation | Feedback, revisions, version history, and account maintenance | No dedicated feedback/correction/resubmission flow, previous note/document versions, or account editing/role changes/deactivation. Confirm how the generic specification applies to healthcare before fixing the accepted scope. |
| Verification | Live database and complete patient journey | Recorded checks use model doubles or mocked APIs. Verify persistence, aggregation, competing writes, role restrictions, downloads, and the full journey with real test accounts and MongoDB. |
| Submission | Final paper and evidence package | Development notes, walkthroughs, and runnable checks exist. Complete the final paper, diagrams/ERD, categorized results, deployment and integration evidence, backup/restore demonstration, and submission materials. |

Priorities are a recommended implementation order, not severity scores from the specification. Scope-confirmation items are absent features whose exact required healthcare behavior remains unsettled. Submission gaps describe repository evidence; independently maintained deliverables may already exist elsewhere.

### Completed since the initial assessment

| Previous gap | Current status | Verification still needed |
| --- | --- | --- |
| Reports with reporting-period filters | Implemented for Staff/Admin/Doctor, including date filters, status counts, daily totals, and doctor workload. Doctors are restricted to their own records. | Live MongoDB aggregation and reporting boundaries. |
| Later assignment for "Any available doctor" bookings | Staff/Admin can assign a doctor and available slot to a pending flexible booking. Approval requires assignment; conditional slot reservation and rollback checks are implemented. | Live persistence, simultaneous reservations, and failure recovery across records. |
| Recurring working-hours editing | Weekly hours and consultation duration can be edited. Configured off days affect new slot generation; existing dated slots are preserved. | Live save/reload and generation from stored schedules. |
| Slot blocking/reopening | Authorized slot-status route is implemented with ownership, occupied-slot, expired-slot, and reservation-conflict checks. | Live concurrent reservation versus blocking. |
| API access controls | Central authentication, appointment ownership/doctor assignment, protected downloads, Admin-only clock changes, scoped slot/walk-in responses, and ticket-only public queue responses are implemented. | Live test-account and deployment verification. |
| Doctor consultation-start permission | Assigned Doctors can now use the existing check-in/start action. | Live consultation workflow; separating arrival and actual consultation start remains open. |
| Walk-in queue actions and list filters | Status route, permitted transitions, appointment/slot synchronization, Doctor assignment checks, status/date filters, and status audit events are implemented. Walk-in arrival is separate from session start. | Live persistence, competing writes across endpoints, and recovery from database outages. |
| Queue concurrency, automatic assignment, and assignment recovery | Unique daily tickets, guarded/date-scoped automatic assignment, revision-controlled slot generation, and durable booking/assignment recovery are implemented. Slot-freed automation is registered. | Live MongoDB concurrency/index verification; the live check was attempted but could not connect. |

The private notification inbox, unread counts, read actions, and lifecycle handlers are also implemented. Backend service/HTTP checks, the frontend production build, and mocked desktop/mobile UI smoke checks passed. These features are implemented; live-database and full end-to-end verification remain outstanding. Reports exports, split shifts, and holiday calendars are optional enhancements, not established specification gaps.

## 1. Overall assessment

CareSync has the core healthcare modules, including persistent in-app notifications and account-free walk-in identity display. Remaining implementation gaps include queue coverage/no-show consistency and audit coverage. Notification channel acceptance and delivery reliability, live verification, and submission evidence also remain outstanding.

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

## 3. Requirement coverage

“Present” means implementation was identified in code; it does not mean the complete workflow passed live testing.

| Requirement | Current state | Missing or incomplete work |
| --- | --- | --- |
| User management | Mostly present | Login, patient registration, four roles, and admin account creation exist. Editing users, changing existing roles, and deactivating accounts are absent. |
| Patient booking | Implemented; live verification pending | Booking/listing and later doctor/slot assignment exist. Cross-record failure recovery and live concurrency still need verification. |
| Doctor schedules | Implemented; live verification pending | Daily/custom generation, weekly working hours, and blocking/reopening exist. Durable doctor/day plans coordinate competing generators and repair partial writes. Actual MongoDB concurrency/index verification remains pending. |
| Review and approval | Partial | Approve/decline exists. Correction requests, patient revisions, and resubmission are absent. |
| Consultation records/files | Implemented; live verification pending | Notes, attachments, owner/assigned-doctor checks, and authenticated downloads exist. Revision tracking remains subject to healthcare mapping confirmation. |
| Version tracking | Partial | Appointment status history exists. Previous versions of notes/documents are not tracked. |
| Comment/feedback | Missing as a workflow | Reasons and consultation notes exist, but no dedicated feedback thread or revision-instruction interface exists. |
| Patient notifications | In-app implemented; live verification pending | Persistent owner-only inbox, unread/read state, patient appointment outcomes, Staff/Admin requests, and doctor assignment/arrival updates exist. No SMS/email, advance reminders, queue-turn alerts, or durable event replay. Confirm instructor acceptance of in-app delivery. |
| Queue management | Partial | Registration, manual/automatic assignment, status transitions, daily ticket uniqueness, and filters exist. Scheduled patients are excluded from the board. Live transition/recovery checks remain pending. |
| Dashboard/reports | Implemented; live verification pending | Role dashboards and date-filtered reports exist. Live aggregation needs verification. |
| Audit logs | Partial | Assignment, schedule changes, slot-status changes, and appointment events are logged. Other important changes and actor attribution remain incomplete. |
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

`PATCH /api/walkins/:id/status` now handles Check In, Start Session, Complete, and Left with role/assignment checks, permitted transitions, linked-record validation, conditional writes, and compensating recovery. Check-in keeps the appointment Confirmed and slot reserved; start/completion synchronize all three records; leaving cancels the linked appointment and releases the slot.

The focused check passed 35 HTTP checks. Live competing writes, persistence, and outage recovery still need verification; compensating writes are not a multi-document transaction.

**Evidence:** [Walk-in queue](../../frontend/src/components/WalkInQueue.jsx), [API client](../../frontend/src/services/api.js), and [walk-in routes](../../backend/src/routes/walkIn.routes.js).

The [walk-in controller](../../backend/src/controllers/walkIn.controller.js) now applies validated status/date filters while retaining Doctor assignment scope. The screen uses the backend clinic day by omitting its former browser-derived date. Stale list responses are ignored. See the [queue walkthrough](261002_walkin_queue_status_and_filters_walkthrough.md).

### 4.5 Resolved: slot status endpoint

`PATCH /api/slots/:id/status` is now registered and connected to Block/Cancel Slot and Make Available controls.

Authorized Available/Cancelled transitions include checks for doctor ownership, linked appointments, occupied states, expired starts, and concurrent reservations. This item is removed from the remaining-work list; live-database verification is still needed.

**Evidence:** [Slot management](../../frontend/src/components/SlotManagement.jsx), [API client](../../frontend/src/services/api.js), and [slot routes](../../backend/src/routes/slot.routes.js).

### 4.6 Resolved in implementation: doctor start-consultation permission mismatch

The check-in/start endpoint now permits the assigned Doctor, with the common appointment-assignment guard. Staff/Admin retain access. Positive and unassigned-doctor denial checks passed with dummy records.

Separating arrival/waiting from actual consultation start remains a workflow question in Section 5. Live consultation-start verification is still needed.

**Evidence:** [Doctor dashboard](../../frontend/src/pages/DoctorDashboard.jsx) and [appointment routes](../../backend/src/routes/appointment.routes.js).

### 4.7 Resolved in implementation: safe automatic reassignment

The slot-freed handler is now registered at startup. It reuses the guarded manual assignment path and selects only today's unassigned waiting entries for future slots today during clinic hours. Conditional claims, distinct operation ownership, and durable recovery protect competing requests.

Isolated checks cover competing assignments and the registered event handler. Live MongoDB and deployment verification remain pending. See the [concurrency/recovery walkthrough](261002_concurrency_and_assignment_recovery_walkthrough.md).

**Evidence:** [Backend server](../../backend/server.js) and [slot-freed handler](../../backend/src/events/handlers/slotFreed.handler.js).

## 5. Workflow and reliability gaps

| Finding | Current behavior | Completion needed |
| --- | --- | --- |
| Flexible booking failure recovery | Reservations now carry an operation ID, and booking/assignment intents are persisted before claims. Failed cleanup remains recoverable through the offline script; committed links are preserved after lost acknowledgements. | Verify live database failures and the documented offline recovery procedure. Other appointment/status mutations are not covered by this journal. |
| Scheduled patient queue | The display backend queries walk-in records only. | Include checked-in scheduled patients if the intended queue covers all clinic patients. |
| Arrival versus consultation start | Walk-in queue check-in now records arrival separately and prevents automatic no-show processing for arrived walk-ins. Scheduled appointment check-in still marks consultation In Progress immediately. | Resolve the scheduled-patient arrival/start flow where the clinic workflow requires it. |
| Automatic no-show slot state | Automatic processing changes appointment status without calling the release service used by manual processing. | Keep related slot state consistent and define expired-slot behavior. |
| Queue-number concurrency | Resolved in implementation: the daily unique index arbitrates insertion retries; the clinic-clock timestamp/day is stored. Legacy tickets are preserved. | Verify actual index creation and concurrent registrations against MongoDB. |
| Automatic walk-in assignment | Resolved in implementation: automatic/manual paths share conditional claims, date restrictions, and durable assignment recovery. The handler is active. | Verify deployed event handling, competing requests, and recovery against MongoDB. |
| Concurrent custom slot generation | Resolved in implementation: durable doctor/day plans use a revision compare-and-set before materializing slots. Partial writes can be repaired without resetting reservations/blocks. | Verify actual MongoDB revision races, unique indexes, and startup restoration. |
| Audit completeness | User creation, document deletion, slot generation, and clock changes lack corresponding audit records. Walk-in registration now captures the authenticated actor. | Record the remaining important changes with the correct actor and affected record. |
| Walk-in identity in appointment lists | Resolved in implementation: Staff/Doctor/Admin tables use account details or linked walk-in name/contact and a Walk-in/queue label. Missing identities have an explicit fallback. Account-free registration and the existing single visit link are preserved. | Verify the display using live records/test accounts; permanent repeat-visit profiles/account linking are separate enhancements. |
| Public queue privacy | Resolved in implementation: public entries contain only queueNumber/status; the screen uses tickets instead of names. Doctors' private walk-in lists are scoped to assigned entries. | Verify the final deployed response and role scopes with live test accounts. |

Relevant implementation: [Appointment service](../../backend/src/services/appointment.service.js), [walk-in service](../../backend/src/services/walkIn.service.js), [slot service](../../backend/src/services/slot.service.js), and [audit handler](../../backend/src/events/handlers/auditLog.handler.js).

## 6. Notification status and remaining work

[Notification service](../../backend/src/services/notification.service.js) now stores MongoDB records. A shared inbox exposes owner-only history, unread counts, filtering, pagination, and read actions. Patient requests notify Staff/Admin and the selected doctor; assignment/approval/status events notify the relevant Patient/Doctor. Walk-in assignment and arrival notify the assigned Doctor; an account-free walk-in has no patient inbox. See the [notification walkthrough](261002_in_app_notifications_walkthrough.md).

Remaining notification work:

1. Verify stored records, read timestamps, indexes, and recipient scope against live test MongoDB/accounts.
2. Confirm acceptance of in-app delivery; add SMS/email if the instructor requires those channels.
3. Implement advance/queue-turn reminders if required; no active `PATIENT_TURN_ALERT` listener exists.
4. Add durable event dispatch/retry if guaranteed delivery is required. Current save failures are logged, and process-local events can be lost during outages.
5. Capture successful/failed notification and complete patient-journey evidence for testing and defense.

Persistent records and a visible inbox address the generic notification-log requirement. They are in-app delivery, not SMS/email. The isolated notification check passed event/privacy/failure cases and 32 HTTP checks; the mocked browser checks passed on desktop/mobile. Live persistence remains unverified.

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

- Comment/feedback page
- Actual document/note version history, if required by the healthcare mapping
- Complete user/role management beyond creation/listing, if expected by the instructor

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

The expanded [UI smoke script](../ui-smoke.mjs) checks intercepted API calls and mock responses at desktop/mobile widths, including the notification inbox for all roles. The [backend workflow check](../../backend/tests/clinic-workflows.check.js) passed using actual services, Express routes, and JWT middleware with isolated model doubles. The [API access check](../../backend/tests/api-access.check.js) passed 113 HTTP checks, including missing-login rejection on all 34 registered private routes, record scope, uploads/downloads, clock restrictions, and response privacy. The [notification check](../../backend/tests/notifications.check.js) passed event/privacy/failure cases and 32 HTTP checks. The frontend production build also passed. These checks do not establish live MongoDB persistence, aggregation, concurrency, notification delivery, or the complete patient journey. A categorized results package meeting all specification minimums remains outstanding.

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

1. **Verify the implemented queue fix:** run the reception-to-doctor lifecycle with real test accounts/MongoDB, including filtered lists, linked records, competing actions, and recovery. The former missing route/filter defects are implemented and covered by isolated checks.
2. **Verify notifications and channel acceptance:** the private persistent inbox and lifecycle handlers are implemented. Verify live records, confirm whether in-app delivery satisfies the instructor’s requirements, and identify required reminders or guaranteed-delivery behavior.
3. **Complete workflow integrity and verify reliability:** scheduled-patient queue coverage, arrival/start transitions, and automatic no-show slot consistency. Queue-number safety, conditional automatic assignment, generation coordination, and assignment recovery are implemented; verify them against reachable MongoDB infrastructure.
4. **Complete audit coverage:** record the missing changes and authenticated actors so the completed workflows can be traced.
5. **Resolve ambiguous module requirements:** obtain instructor confirmation for healthcare versioning, feedback, revision requests, user management, and screen mappings; implement the accepted scope. Seek this confirmation while completing the definite gaps above.
6. **Validate and prepare evidence:** use real test accounts and MongoDB to verify the implemented access controls, reports, assignment, schedules, blocking, and complete patient journey. Produce categorized results, diagrams, final documentation, integration screenshots/logs, deployment evidence, and demonstrated backup/restore. Start organizing existing evidence now; complete final workflow results after the defects are repaired.

### Remaining-work checklist

- [x] Implement patient ownership and assigned-doctor access on individual appointment reads and mutations; dummy-record HTTP checks passed.
- [x] Protect medical downloads, restrict/validate clock changes, and minimize public queue responses; dummy-record HTTP checks passed.
- [x] Connect doctor consultation start with correct role and assignment permissions; dummy-record HTTP checks passed.
- [x] Implement walk-in status transitions and working status/date filters; 35 isolated HTTP checks passed.
- [ ] Include scheduled patients in the intended clinic queue and define arrival versus consultation-start behavior.
- [ ] Release/synchronize slots during automatic no-show processing.
- [x] Implement new-ticket uniqueness, guarded automatic assignment, and active slot-freed events; isolated concurrency checks passed.
- [x] Coordinate slot generation with durable plans and add durable booking/assignment recovery plus an offline reconciliation script.
- [x] Store in-app notifications, expose an owner-only inbox/read state, and connect implemented appointment and doctor queue events; isolated API/event and mocked desktop/mobile checks passed.
- [ ] Confirm in-app channel acceptance and required queue-turn/advance reminders; verify live persistence and assess required delivery reliability.
- [x] Display account-free walk-in names/contact details and queue labels in Staff/Doctor/Admin appointment tables, with an explicit missing-identity fallback; mocked desktop/mobile checks and production build passed.
- [ ] Complete audit event coverage and actor attribution.
- [ ] Confirm the expected healthcare scope for feedback, revision requests, note/document versions, and user editing/deactivation.
- [ ] Verify access controls, reports, assignment, schedules, and blocking against a test MongoDB database, including competing writes and rollback failure handling.
- [ ] Produce the required final paper, diagrams/ERD, categorized test evidence, demo data/screenshots, database export or migration material, backup/restore evidence, slides, and contribution records.

## 10. Review method and limitations

- Read the 14-page supplied specification and inspected current application code and repository documentation.
- Inspected registered Express routes without starting the server or connecting to MongoDB.
- Inspected event listeners after the notification/audit registrations currently used at startup.
- The initial review confirmed absent walk-in/slot status routes, the audit-only slot-freed listener, and absence of a patient-turn-alert listener under those registrations. The slot-status route and Doctor check-in permissions have since been implemented; the other findings remain open.
- Subsequent implementation passed backend workflow/HTTP checks with model doubles, the frontend build, and mocked desktop/mobile browser smoke checks. See the walkthrough for recorded verification and commands.
- Live database workflows, delivery-provider tests, and deployed-system checks have not been run.
- Subsequent user-authorized work implemented access controls and passed 109 HTTP checks, including all 30 private routes, with dummy database responses. No real patient records were changed by the checks.
- Expanded desktop/mobile UI checks also passed with mocked APIs for authenticated downloads, Admin-only clock editing, and ticket-only queue display.
- The October 1 source review against `910533d` reconfirmed the then-missing walk-in status route and ignored filters, plus console-only notifications, inactive slot-freed handling, queue-number allocation, no-show slot inconsistency, and incomplete audit coverage.
- On October 2, the user-authorized queue fix added status transitions and filters. The new check passed 35 HTTP checks, the existing workflow check passed, API access checks passed 110 HTTP checks across 31 private routes, and the frontend build passed. These results do not establish live database correctness.
- Expanded mocked browser checks passed at 1440px/390px, including Staff Check In/Left and Doctor Start Session/Complete with status filtering. Changed queue screenshots were visually reviewed.
- Subsequent October 2 concurrency/recovery changes passed the new isolated concurrency suite and all existing backend suites. Live mode was attempted outside the sandbox and could not connect to MongoDB. The new walkthrough documents what the journal covers, index rollout, and offline recovery prerequisites.
- Subsequent October 2 in-app notification changes passed event/privacy/failure checks and 32 isolated HTTP checks. API access checks now pass 113 HTTP checks across all 34 private routes. The frontend build and expanded all-role desktop/mobile browser checks passed; inbox screenshots were reviewed. Actual MongoDB notification persistence remains unverified.

Findings describe the workspace updated on October 2, 2026. "Implemented" and "verified against live infrastructure" are separate states. Record relevant live-backend evidence before claiming complete workflow verification.
