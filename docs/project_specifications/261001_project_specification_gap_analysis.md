# CareSync: Project Specification Gap Analysis

**Project:** Healthcare Appointment, Queue, and Patient Notification Integration System

**Assessment date:** October 1, 2026 (Asia/Manila)

**Specification:** `C:/Users/Adrian/Downloads/Final Project Specification_MWA.pdf`

**Scope:** Current frontend, backend, repository documentation, and specification requirements.

**Updated status:** October 1, 2026, after the reports, assignment, schedule, and API access-control implementations. This document now reflects the remaining gaps. See the [feature walkthrough](261001_reports_assignment_and_working_hours_walkthrough.md) and [API security walkthrough](261001_api_access_controls_and_security_walkthrough.md) for behavior, verification, and limits.

### Completed since the initial assessment

| Previous gap | Current status | Verification still needed |
| --- | --- | --- |
| Reports with reporting-period filters | Implemented for Staff/Admin/Doctor, including date filters, status counts, daily totals, and doctor workload. Doctors are restricted to their own records. | Live MongoDB aggregation and reporting boundaries. |
| Later assignment for "Any available doctor" bookings | Staff/Admin can assign a doctor and available slot to a pending flexible booking. Approval requires assignment; conditional slot reservation and rollback checks are implemented. | Live persistence, simultaneous reservations, and failure recovery across records. |
| Recurring working-hours editing | Weekly hours and consultation duration can be edited. Configured off days affect new slot generation; existing dated slots are preserved. | Live save/reload and generation from stored schedules. |
| Slot blocking/reopening | Authorized slot-status route is implemented with ownership, occupied-slot, expired-slot, and reservation-conflict checks. | Live concurrent reservation versus blocking. |
| API access controls | Central authentication, appointment ownership/doctor assignment, protected downloads, Admin-only clock changes, scoped slot/walk-in responses, and ticket-only public queue responses are implemented. | Live test-account and deployment verification. |
| Doctor consultation-start permission | Assigned Doctors can now use the existing check-in/start action. | Live consultation workflow; separating arrival and actual consultation start remains open. |

Backend service/HTTP checks, the frontend production build, and mocked desktop/mobile UI smoke checks passed. These features are implemented; live-database and full end-to-end verification remain outstanding. Reports exports, split shifts, and holiday calendars are optional enhancements, not established specification gaps.

## 1. Overall assessment

CareSync has the core healthcare modules, but several workflows are incomplete or disconnected. The largest remaining implementation gaps are patient notifications and queue operations. Live verification of the completed access controls and the documentation/testing evidence required for submission also remain outstanding.

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
| Doctor schedules | Implemented; live verification pending | Daily/custom generation, weekly working-hours editing, and slot blocking/reopening exist. Simultaneous custom generation with different slot boundaries remains a reliability concern. |
| Review and approval | Partial | Approve/decline exists. Correction requests, patient revisions, and resubmission are absent. |
| Consultation records/files | Implemented; live verification pending | Notes, attachments, owner/assigned-doctor checks, and authenticated downloads exist. Revision tracking remains subject to healthcare mapping confirmation. |
| Version tracking | Partial | Appointment status history exists. Previous versions of notes/documents are not tracked. |
| Comment/feedback | Missing as a workflow | Reasons and consultation notes exist, but no dedicated feedback thread or revision-instruction interface exists. |
| Patient notifications | Stub only | Messages print to the console. No SMS/email delivery, persistent notification records, or notification page exists. |
| Queue management | Partial | Registration/manual assignment exists. Status actions are disconnected, and scheduled patients are excluded from the queue board. |
| Dashboard/reports | Implemented; live verification pending | Role dashboards and date-filtered reports exist. Live aggregation needs verification. |
| Audit logs | Partial | Assignment, schedule changes, slot-status changes, and appointment events are logged. Other important changes and actor attribution remain incomplete. |
| Integration component | Present | REST APIs and event-driven audit logging connect modules. Some advertised automation is not activated. |

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

### 4.4 High: missing walk-in status endpoint

Check In, Start Session, Complete, and Left controls call `PATCH /api/walkins/:id/status`, but the backend does not register that route.

**Required outcome:** Connect these actions to backend transitions that keep walk-in, appointment, and slot records consistent.

**Evidence:** [Walk-in queue](../../frontend/src/components/WalkInQueue.jsx), [API client](../../frontend/src/services/api.js), and [walk-in routes](../../backend/src/routes/walkIn.routes.js).

### 4.5 Resolved: slot status endpoint

`PATCH /api/slots/:id/status` is now registered and connected to Block/Cancel Slot and Make Available controls.

Authorized Available/Cancelled transitions include checks for doctor ownership, linked appointments, occupied states, expired starts, and concurrent reservations. This item is removed from the remaining-work list; live-database verification is still needed.

**Evidence:** [Slot management](../../frontend/src/components/SlotManagement.jsx), [API client](../../frontend/src/services/api.js), and [slot routes](../../backend/src/routes/slot.routes.js).

### 4.6 Resolved in implementation: doctor start-consultation permission mismatch

The check-in/start endpoint now permits the assigned Doctor, with the common appointment-assignment guard. Staff/Admin retain access. Positive and unassigned-doctor denial checks passed with dummy records.

Separating arrival/waiting from actual consultation start remains a workflow question in Section 5. Live consultation-start verification is still needed.

**Evidence:** [Doctor dashboard](../../frontend/src/pages/DoctorDashboard.jsx) and [appointment routes](../../backend/src/routes/appointment.routes.js).

### 4.7 High: automatic reassignment handler is not registered

The slot-freed handler exists but is not registered at startup. A runtime inspection using the current startup registrations found one `SLOT_FREED` listener, belonging to audit logging only. Cancellations therefore do not activate the intended walk-in reassignment.

**Required outcome:** Register the handler and verify assignment safety before enabling the automation.

**Evidence:** [Backend server](../../backend/server.js) and [slot-freed handler](../../backend/src/events/handlers/slotFreed.handler.js).

## 5. Workflow and reliability gaps

| Finding | Current behavior | Completion needed |
| --- | --- | --- |
| Flexible booking failure recovery | Assignment now reserves a slot conditionally and updates the appointment, with compensating rollback on failure. | Verify live concurrency and rollback; define reconciliation if a database failure prevents rollback. |
| Scheduled patient queue | The display backend queries walk-in records only. | Include checked-in scheduled patients if the intended queue covers all clinic patients. |
| Arrival versus consultation start | Appointment check-in immediately marks the consultation In Progress. | Separate arrival/waiting from actual consultation start where the clinic workflow requires it. |
| Automatic no-show slot state | Automatic processing changes appointment status without calling the release service used by manual processing. | Keep related slot state consistent and define expired-slot behavior. |
| Queue-number concurrency | Registration reads the last number and increments it. | Prevent duplicate daily queue numbers under concurrent requests. |
| Automatic walk-in assignment | Unlike manual assignment, the automatic path lacks conditional claims and a restriction to today's waiting patients. | Prevent concurrent duplicate assignments and assignment of stale waiting entries. |
| Concurrent custom slot generation | Date/time/duration validation and overlap rejection are implemented. The overlap check runs before writes without serializing competing generators. | Verify simultaneous generation with different boundaries; coordinate writes if concurrent generation must be supported. |
| Audit completeness | User creation, document deletion, slot generation, and clock changes lack corresponding audit records. Walk-in creation omits the authenticated actor. | Record important changes with the correct actor and affected record. |
| Public queue privacy | Resolved in implementation: public entries contain only queueNumber/status; the screen uses tickets instead of names. Doctors' private walk-in lists are scoped to assigned entries. | Verify the final deployed response and role scopes with live test accounts. |

Relevant implementation: [Appointment service](../../backend/src/services/appointment.service.js), [walk-in service](../../backend/src/services/walkIn.service.js), [slot service](../../backend/src/services/slot.service.js), and [audit handler](../../backend/src/events/handlers/auditLog.handler.js).

## 6. Notification gap

[Notification service](../../backend/src/services/notification.service.js) only prints messages to the server console. No persistent notification model/API/page was identified. A runtime listener inspection also found no active `PATIENT_TURN_ALERT` listener under the current startup registrations.

Recommended minimum completion:

1. Store notification records with recipient, event type, message, timestamp, and delivery/simulation outcome.
2. Provide a notification or notification-log screen with recipient-appropriate access.
3. Connect relevant appointment and queue events to notification records.
4. Implement SMS/email delivery or document an instructor-accepted simulation.
5. Capture successful and failed notification evidence for testing and defense.

Persistent logs and a visible screen address the generic notification-log requirement more clearly. They should not be described as actual SMS/email delivery unless a delivery integration exists.

## 7. Documentation and submission gaps

The following items were not found in the repository reviewed. They may exist outside the repository and should be checked before creating duplicates.

| Required deliverable | Gap to address |
| --- | --- |
| Final project document | Existing change notes do not cover the required 15-part document. |
| Functional requirements | Document at least 10 functional requirements. |
| Nonfunctional requirements | Document at least 8 nonfunctional requirements with assessable criteria. |
| Integration traceability | Link requirements to stakeholders, modules, diagrams, and test cases. |
| Enterprise architecture | Document business, data, application, and technology architecture, including sources of truth. |
| Architecture decisions | Compare architecture styles/integration patterns and record the selected approach, rationale, and consequences. |
| Required diagrams | Prepare the eight required diagrams and database design/ERD. |
| Security/governance | Prepare RBAC matrix, least-privilege/separation-of-duties explanation, privacy controls, and module/data ownership. |
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
- Notification or notification-log page
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

The expanded [UI smoke script](../ui-smoke.mjs) checks intercepted API calls and mock responses at desktop/mobile widths. The [backend workflow check](../../backend/tests/clinic-workflows.check.js) passed using actual services, Express routes, and JWT middleware with isolated model doubles. The [API access check](../../backend/tests/api-access.check.js) passed 109 HTTP checks, including missing-login rejection on all 30 registered private routes, record scope, uploads/downloads, clock restrictions, and response privacy. The frontend production build also passed. These checks do not establish live MongoDB persistence, aggregation, concurrency, notification delivery, or the complete patient journey. A categorized results package meeting all specification minimums remains outstanding.

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

1. **Validate implemented access controls:** use real test accounts and MongoDB to confirm ownership, doctor assignment, medical downloads, public response fields, and Admin-only clock changes in the final environment.
2. **Repair disconnected queue actions:** implement walk-in status routes. Make automatic assignment safe before registering the slot-freed handler. Doctor consultation-start permissions are implemented.
3. **Complete workflow integrity:** scheduled-patient queue coverage, arrival/start transitions, automatic no-show slot consistency, queue-number safety, and date-scoped conditional automatic assignment. Verify concurrent assignment and custom slot generation against MongoDB.
4. **Complete notifications:** persistent records, visible log screen, and actual or accepted simulated delivery.
5. **Resolve ambiguous module requirements:** obtain instructor confirmation for healthcare versioning, feedback, revision requests, and screen mappings; implement the accepted scope.
6. **Prepare evidence:** live verification of the completed features/access controls and the full patient journey, categorized test results, diagrams, final documentation, integration screenshots/logs, deployment, and demonstrated backup/restore.

### Remaining-work checklist

- [x] Implement patient ownership and assigned-doctor access on individual appointment reads and mutations; dummy-record HTTP checks passed.
- [x] Protect medical downloads, restrict/validate clock changes, and minimize public queue responses; dummy-record HTTP checks passed.
- [x] Connect doctor consultation start with correct role and assignment permissions; dummy-record HTTP checks passed.
- [ ] Implement walk-in status transitions.
- [ ] Include scheduled patients in the intended clinic queue and define arrival versus consultation-start behavior.
- [ ] Release/synchronize slots during automatic no-show processing.
- [ ] Prevent duplicate queue numbers and unsafe automatic walk-in assignment; then activate reassignment events.
- [ ] Store notifications, expose a notification/log screen, and connect appointment/queue events to actual or instructor-accepted simulated delivery.
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

Findings describe the workspace reviewed and updated on October 1, 2026. "Implemented" and "verified against live infrastructure" are separate states. Record relevant live-backend evidence before claiming complete workflow verification.
