# Walkthrough: Patient Categorized File Upload System

## Packages & Dependencies to Install

### Backend (`backend/`)
```bash
cd backend
npm install multer
```

- `multer`: Middleware for handling `multipart/form-data` and disk storage for uploaded medical documents.

### Frontend (`frontend/`)
No new packages required (uses native `FormData` and existing `lucide-react` icons).

### 1. Upload Storage & Directory Structure
Files are dynamically stored in:
```
backend/uploads/patient_<patientId>_<patientName>/<category>/<timestamp>_<originalFilename>
```
For walk-ins:
```
backend/uploads/walkin_<walkInId>_<patientName>/<category>/<timestamp>_<originalFilename>
```
Categories mapped:
- `lab_result` $\rightarrow$ `lab_results/`
- `radiology` $\rightarrow$ `radiology/`
- `prescription` $\rightarrow$ `prescriptions/`
- `referral` $\rightarrow$ `referral_letters/`
- `general` $\rightarrow$ `general/`

### 2. Backend Implementation
- **Multer Middleware ([upload.js](file:///c:/Users/Adrian/Documents/CareSync/backend/src/middleware/upload.js))**: Dynamically determines patient folder and category directory; creates directories recursively; handles file filtering (PDF, images, documents, text).
- **Static File Serving ([server.js](file:///c:/Users/Adrian/Documents/CareSync/backend/server.js))**: Serves `/uploads` statically so doctors and patients can view/download uploaded documents directly.
- **Controller & Routes ([appointment.controller.js](file:///c:/Users/Adrian/Documents/CareSync/backend/src/controllers/appointment.controller.js) & [appointment.routes.js](file:///c:/Users/Adrian/Documents/CareSync/backend/src/routes/appointment.routes.js))**: Added `POST /api/appointments/:id/upload` and `DELETE /api/appointments/:id/documents/:docId`.
- **Git Ignore ([.gitignore](file:///c:/Users/Adrian/Documents/CareSync/.gitignore))**: Added `uploads/` and `backend/uploads/` to prevent committing patient files.

### 3. Frontend Implementation
- **API Client ([api.js](file:///c:/Users/Adrian/Documents/CareSync/frontend/src/services/api.js))**: Added `uploadAppointmentFile(id, formData)` and `deleteAppointmentDocument(id, docId)` with `FormData` support.
- **Consultation Modal ([ConsultationModal.jsx](file:///c:/Users/Adrian/Documents/CareSync/frontend/src/components/ConsultationModal.jsx))**: Added file picker, category selection dropdown, upload progress feedback, document badges, direct view/download links, and delete action.

## Testing & Verification
- Verified all backend files with Node runtime test.
- Tested production build with `npm run build` (vite build completed with 0 errors).
