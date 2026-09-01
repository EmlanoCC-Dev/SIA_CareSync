# Walkthrough: CareSync MERN Stack Frontend

We have built a responsive React frontend for **CareSync** using Vite, connecting seamlessly to the Express/Node.js/MongoDB backend.

---

## 🚀 Key Modules & Features Implemented

### 1. Unified Authentication & Role-Based Routing
* **[AuthContext.jsx](file:///c:/Users/Adrian/Documents/CareSync/frontend/src/context/AuthContext.jsx)**: Persistent JWT authentication via localStorage.
* **[LoginPage.jsx](file:///c:/Users/Adrian/Documents/CareSync/frontend/src/pages/LoginPage.jsx)** & **[RegisterPage.jsx](file:///c:/Users/Adrian/Documents/CareSync/frontend/src/pages/RegisterPage.jsx)**: Multi-role registration (`Patient`, `Doctor`, `Staff`, `Admin`).

### 2. Role Dashboards
* **Patient Dashboard ([PatientDashboard.jsx](file:///c:/Users/Adrian/Documents/CareSync/frontend/src/pages/PatientDashboard.jsx))**:
  * Live status metric cards (Pending, Confirmed, Completed).
  * Real-time appointment schedule with doctor name and time slot.
  * Instant appointment booking modal.
  * Cancellation and History Timeline controls.
* **Staff Dashboard ([StaffDashboard.jsx](file:///c:/Users/Adrian/Documents/CareSync/frontend/src/pages/StaffDashboard.jsx))**:
  * Master triage queue with status filter dropdown.
  * One-click **Approve** (transitions `Pending → Confirmed`), **Complete**, or **Cancel**.
* **Doctor Dashboard ([DoctorDashboard.jsx](file:///c:/Users/Adrian/Documents/CareSync/frontend/src/pages/DoctorDashboard.jsx))**:
  * Daily scheduled consultations.
  * One-click **Complete** consultation action.
* **Admin Dashboard ([AdminDashboard.jsx](file:///c:/Users/Adrian/Documents/CareSync/frontend/src/pages/AdminDashboard.jsx))**:
  * System overview analytics and doctor count.
  * **System Audit Trail (Module 9)** with actor details and JSON change diffs.
  * Master appointment registry and User directory.

### 3. Interactive Modals & Features
* **[BookAppointmentModal.jsx](file:///c:/Users/Adrian/Documents/CareSync/frontend/src/components/BookAppointmentModal.jsx)**: Doctor dropdown (dynamically loaded from `GET /api/users/doctors`), date picker, time slot select, and symptom notes.
* **[StatusTimelineModal.jsx](file:///c:/Users/Adrian/Documents/CareSync/frontend/src/components/StatusTimelineModal.jsx)**: Module 4 Version Tracking timeline showing all historical status transitions, remarks, and timestamps.
* **[AuditLogViewer.jsx](file:///c:/Users/Adrian/Documents/CareSync/frontend/src/components/AuditLogViewer.jsx)**: Admin viewer for immutable audit records.

---

## 🛠️ How to Run

You can run the backend and frontend simultaneously:

```bash
# Terminal 1 — Backend API (Port 5000)
npm run dev:backend

# Terminal 2 — Frontend App (Port 3000)
npm run dev:frontend
```

Then open your browser at **http://localhost:3000**.
