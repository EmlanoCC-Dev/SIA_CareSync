# Missed Appointment Auto "No-Show" & Passed/Taken Time Slot Locking

## Packages & Dependencies to Install
No new external npm packages required. Existing dependencies are used:
- `lucide-react` (icons)
- `express` (backend API)
- `mongoose` (MongoDB ORM)
- `react`, `react-dom`, `vite` (frontend)

---

## Overview
1. **Automatic "No-Show" Status**: When an appointment's scheduled time has passed and its status is still `Pending` or `Confirmed`, the backend automatically transitions it to `No-show` and records the transition in `statusHistory`.
2. **Passed & Taken Time Slot Locking**:
   - In the appointment booking and slot assignment modals, slots that have already passed (based on system time `getNow()`) or are already reserved by another patient are **disabled and non-clickable**.
   - Disabled slots display clear visual badges (`Booked` / `Passed`), while available future slots remain clickable and selectable.
   - Backend enforces strict server-side validation rejecting any attempt to book or reserve past slots.

---

## Key Changes

### 1. Centralized Time Comparison Utility
- **File**: `backend/src/utils/timeHelper.js`
- `isDateTimePassed(dateVal, timeStr, boundary)`: Accurately checks if a given appointment/slot date and time window has passed relative to the system's active clock (`getNow()`).
- `parseTimeToMinutes()`: Parses 12-hour (AM/PM) and 24-hour time formats.

### 2. Appointment Lifecycle & Auto No-Show
- **File**: `backend/src/services/appointment.service.js`
- `autoMarkNoShows()`: Finds all appointments with status `Pending` or `Confirmed` whose scheduled end time is in the past, updates their status to `No-show`, pushes a history audit entry, updates linked walk-ins, and emits `APPOINTMENT_NO_SHOW`.
- Invoked automatically whenever appointments are queried or whenever system time is modified via `/api/system/time`.
- `create()`: Rejects bookings for past time slots with HTTP 400.

### 3. Slot Availability & Past-Time Rejection
- **File**: `backend/src/services/slot.service.js`
- `getAvailableSlots()`: Filters out slots whose start time has passed for today or past dates.
- `reserveSlot()`: Rejects reservations for past slots with HTTP 400.

### 4. Interactive Booking & Assignment Modals
- **Files**:
  - `frontend/src/components/BookAppointmentModal.jsx`
  - `frontend/src/components/AssignSlotModal.jsx`
  - `frontend/src/index.css`
- **Features**:
  - Slots are evaluated against live/simulated system time.
  - Slots with `isTaken === true` display a `[Booked]` badge and are disabled.
  - Slots with `isPassed === true` display a `[Passed]` badge and are disabled.
  - Only open future slots display an `[Available]` badge and remain clickable.
  - Auto-selects the first available upcoming slot.
  - Header counters show `Available Consultation Slots (X of Y available)`.
