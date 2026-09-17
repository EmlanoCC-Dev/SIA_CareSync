# Walk-in Operating Hours, Daily Queue Reset, & Custom System Time Simulator

## Packages & Dependencies to Install
No new external npm packages required. Existing dependencies are used:
- `lucide-react` (icons)
- `express` (backend API)
- `mongoose` (MongoDB ORM)
- `react`, `react-dom`, `vite` (frontend)

---

## Overview
1. **Walk-in Operating Hours**: Walk-in queue submissions are strictly open between **8:30 AM and 5:00 PM** (08:30–17:00). Requests outside this timeframe return a 400 rejection with an informative message.
2. **Daily Queue Number Reset**: Walk-in patient queue numbers automatically reset to `#1` each new calendar day.
3. **Custom System Time Simulator**: Built a centralized system time controller (`backend/src/config/systemTime.js`) allowing developers and testers to simulate any date/time or choose quick presets (Opening, Midday, Closing, Closed, Tomorrow) directly from the UI navbar.

---

## Key Changes

### 1. Backend Centralized Time Manager
- **File**: `backend/src/config/systemTime.js`
- `getNow()`: Returns simulated date/time if custom time is active, or actual server clock.
- `isClinicOpen()`: Validates whether `getNow()` is between 8:30 AM (510 min) and 5:00 PM (1020 min).
- `setCustomTime(timeStr)` / `resetCustomTime()`: Updates or clears simulated system time.

### 2. System Time API Endpoints
- **File**: `backend/src/routes/system.routes.js`
- `GET /api/system/time`: Returns current system time, operating status (`isOpen`), simulated flag (`isCustom`), and operating hours definition.
- `POST /api/system/time`: Sets custom time (`{ time: "..." }`) or resets to real clock (`{ reset: true }`).
- Mounted under `/api/system` in `backend/src/routes/index.js`.

### 3. Walk-In Queue Rules & Reset
- **File**: `backend/src/services/walkIn.service.js`
- `_getNextQueueNumber()`: Filters walk-ins using `getNow()` start-of-day (`00:00:00.000`) and end-of-day (`23:59:59.999`). Resets to `#1` on every new day.
- `addToHoldingList()`: Enforces `isClinicOpen()` check. Blocks walk-in submissions when closed outside 8:30 AM – 5:00 PM.
- `getTodayWalkIns()` & `getNowServing()`: Synchronized with `getNow()` to query entries for the active simulated date.

### 4. Frontend System Time Modal & Trigger
- **Files**: 
  - `frontend/src/components/SystemTimeModal.jsx`
  - `frontend/src/components/Navbar.jsx`
  - `frontend/src/components/AddWalkInModal.jsx`
  - `frontend/src/pages/ClinicDisplayScreen.jsx`
- **Features**:
  - Interactive System Clock button in Navbar displaying current time and open/closed indicator dot.
  - One-click testing presets:
    - **8:30 AM**: Clinic Opening (Queue opens)
    - **12:00 PM**: Midday (Queue active)
    - **5:00 PM**: Closing cutoff (End of walk-in intake)
    - **5:30 PM**: Clinic Closed (Submission blocked test)
    - **Tomorrow 8:30 AM**: Next day queue reset test (`#1` reset verification)
  - Custom date & time picker for arbitrary testing.
  - Reset button to restore live device time.
  - Clinic TV Display syncs with system clock and displays "Queue Open" / "Queue Closed (8:30 AM - 5:00 PM)" badge.
