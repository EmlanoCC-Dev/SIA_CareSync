# Documentation: Appointment Booking, Walk-in Queue & Event-Driven Notification System

## Overview
Recent commit (`8d70550`) introduces end-to-end appointment slot scheduling, walk-in queue management, automated slot reallocation on cancellations, real-time public clinic display screen, and event-driven notifications.

---

## 🏗️ Architecture & Core Modules

### 1. Slot Management System
- **Model ([Slot.js](file:///c:/Users/Adrian/Documents/CareSync/backend/src/models/Slot.js))**:
  - Defines appointment slots with date, `startTime`, `endTime`, `doctorId`, `maxCapacity`, `currentBookings`, `isWalkInOnly`, and status (`Available`, `Booked`, `Blocked`).
- **Service & Controller ([slot.service.js](file:///c:/Users/Adrian/Documents/CareSync/backend/src/services/slot.service.js), [slot.controller.js](file:///c:/Users/Adrian/Documents/CareSync/backend/src/controllers/slot.controller.js))**:
  - Bulk slot generation utility for doctors/admins across custom date ranges and time intervals.
  - Slot availability checking, capacity verification, and slot blocking/unblocking.
- **Frontend UI ([SlotManagement.jsx](file:///c:/Users/Adrian/Documents/CareSync/frontend/src/components/SlotManagement.jsx))**:
  - Interactive UI for doctors and staff to configure working schedules, generate slots, and toggle slot availability.

---

### 2. Walk-in Queue Management
- **Model ([WalkIn.js](file:///c:/Users/Adrian/Documents/CareSync/backend/src/models/WalkIn.js))**:
  - Tracks walk-in patients with queue number (daily auto-incrementing), patient details, priority (`Regular`, `Senior/PWD`, `Emergency`), status (`Waiting`, `Serving`, `Completed`, `Cancelled`, `NoShow`), and assigned slot reference.
- **Service & Controller ([walkIn.service.js](file:///c:/Users/Adrian/Documents/CareSync/backend/src/services/walkIn.service.js), [walkIn.controller.js](file:///c:/Users/Adrian/Documents/CareSync/backend/src/controllers/walkIn.controller.js))**:
  - Patient queue registration, priority-weighted sorting, manual triage, and status updates.
  - Aggregates "Now Serving" payload for public displays.
- **Frontend Components**:
  - **[WalkInQueue.jsx](file:///c:/Users/Adrian/Documents/CareSync/frontend/src/components/WalkInQueue.jsx)**: Staff queue board to call next patient, advance queue, and manage patient turns.
  - **[AddWalkInModal.jsx](file:///c:/Users/Adrian/Documents/CareSync/frontend/src/components/AddWalkInModal.jsx)**: Reception modal to quickly log walk-in patients with priority categorization.

---

### 3. Event-Driven Architecture & Automated Slot Reallocation
- **Events Registry ([events.js](file:///c:/Users/Adrian/Documents/CareSync/backend/src/events/events.js))**:
  - Added event definitions: `SLOT_FREED`, `WALKIN_ADDED`, `WALKIN_SLOT_ASSIGNED`, `APPOINTMENT_NO_SHOW`, `APPOINTMENT_CHECKED_IN`, `PATIENT_TURN_ALERT`.
- **Slot Freed Handler ([slotFreed.handler.js](file:///c:/Users/Adrian/Documents/CareSync/backend/src/events/handlers/slotFreed.handler.js))**:
  - Listens for `SLOT_FREED` (triggered when an appointment is cancelled, declined, or marked as no-show).
  - Automatically searches waiting walk-in queue and auto-assigns freed slot to highest-priority waiting walk-in patient.
  - Emits real-time `nowServing:update` via Socket.io.
- **Notification Handler ([notification.handler.js](file:///c:/Users/Adrian/Documents/CareSync/backend/src/events/handlers/notification.handler.js))**:
  - Dispatches alerts for slot reallocation, appointment confirmations, reminders, and queue turn updates.

---

### 4. Public Clinic Display Screen
- **Page ([ClinicDisplayScreen.jsx](file:///c:/Users/Adrian/Documents/CareSync/frontend/src/pages/ClinicDisplayScreen.jsx))**:
  - TV / Waiting Area display view accessible at `/display`.
  - Displays real-time "Now Serving" queue tickets by room/doctor, upcoming queue tickets, and emergency priority highlights.
  - Listens to Socket.io `nowServing:update` events for zero-refresh updates.

---

### 5. Enhanced Dashboards & Doctor Consultation Flow
- **Doctor Dashboard ([DoctorDashboard.jsx](file:///c:/Users/Adrian/Documents/CareSync/frontend/src/pages/DoctorDashboard.jsx))**:
  - Daily schedule with direct patient calling and consultation workflow.
- **Consultation Modal ([ConsultationModal.jsx](file:///c:/Users/Adrian/Documents/CareSync/frontend/src/components/ConsultationModal.jsx))**:
  - Allows doctors to record vitals (BP, heart rate, temperature), diagnosis, clinical notes, and prescription medications during patient visit.
- **Staff Dashboard ([StaffDashboard.jsx](file:///c:/Users/Adrian/Documents/CareSync/frontend/src/pages/StaffDashboard.jsx))**:
  - Unified view with tabs for Appointment Triage, Walk-in Queue Management, and Slot Oversight.
- **Patient Dashboard & Booking ([PatientDashboard.jsx](file:///c:/Users/Adrian/Documents/CareSync/frontend/src/pages/PatientDashboard.jsx), [BookAppointmentModal.jsx](file:///c:/Users/Adrian/Documents/CareSync/frontend/src/components/BookAppointmentModal.jsx))**:
  - Live doctor slot fetching during booking modal selection.

---

## 📡 API Endpoints Added

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/slots` | Query slots with date & doctor filters |
| `POST` | `/api/slots/generate` | Batch generate time slots for a doctor |
| `PATCH` | `/api/slots/:id/block` | Block/unblock slot |
| `GET` | `/api/walk-ins` | List active walk-in queue |
| `POST` | `/api/walk-ins` | Register new walk-in patient |
| `PATCH` | `/api/walk-ins/:id/status` | Update walk-in status (`Serving`, `Completed`, `Cancelled`, `NoShow`) |
| `GET` | `/api/walk-ins/now-serving` | Fetch public display "Now Serving" data |
| `POST` | `/api/appointments/:id/consultation` | Save consultation notes & prescriptions |
