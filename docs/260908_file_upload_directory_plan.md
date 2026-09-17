# File Upload Directory Structure & Implementation Plan

Design and implementation plan for file uploads in CareSync, organizing medical files by patient identification and categorized document types.

## Proposed Directory Architecture

```
backend/
└── uploads/
    └── patient_<patientId>_<patientName>/
        ├── lab_results/
        │   └── <timestamp>_blood_work.pdf
        ├── radiology/
        │   └── <timestamp>_chest_xray.png
        ├── prescriptions/
        │   └── <timestamp>_rx_amoxicillin.pdf
        ├── referral_letters/
        │   └── <timestamp>_cardio_referral.pdf
        └── general/
            └── <timestamp>_medical_history.pdf
```

### Folder Breakdown & Rules

1. **Root Directory**:
   - `backend/uploads/`
   - Served statically via Express: `app.use('/uploads', express.static(path.join(__dirname, '../uploads')))`
   - Added to `.gitignore` to prevent committing patient files to git.

2. **Patient Directory**:
   - Format: `uploads/patient_<patientId>_<sanitizedPatientName>/`
   - For walk-ins: `uploads/walkin_<walkInId>_<sanitizedPatientName>/`
   - Example: `uploads/patient_64f1a2b3c4d5_john_doe/`

3. **Category Subdirectories**:
   Categorized based on selected file type:
   - `lab_result` $\rightarrow$ `lab_results/`
   - `radiology` $\rightarrow$ `radiology/`
   - `prescription` $\rightarrow$ `prescriptions/`
   - `referral` $\rightarrow$ `referral_letters/`
   - Default/Others $\rightarrow$ `general/`

4. **File Naming**:
   - Format: `<timestamp>_<sanitizedFilename>`
   - Prevents collision while keeping the original filename recognizable.

---

## Proposed Changes

### Backend Dependencies & Multer Configuration

#### [NEW] [upload.js](file:///c:/Users/Adrian/Documents/CareSync/backend/src/middleware/upload.js)
- Configure `multer.diskStorage` with dynamic destination:
  - Extract appointment / patient info from request.
  - Compute target directory: `uploads/patient_<id>_<name>/<category>/`.
  - Ensure directory exists using `fs.mkdirSync(dest, { recursive: true })`.
  - Validate allowed file types (PDF, PNG, JPG, JPEG, DOC, DOCX) and max file size (e.g. 15MB).

#### [MODIFY] [server.js](file:///c:/Users/Adrian/Documents/CareSync/backend/server.js)
- Serve `/uploads` directory statically.

#### [MODIFY] [appointment.routes.js](file:///c:/Users/Adrian/Documents/CareSync/backend/src/routes/appointment.routes.js) & [appointment.controller.js](file:///c:/Users/Adrian/Documents/CareSync/backend/src/controllers/appointment.controller.js)
- Add/update endpoint `POST /api/appointments/:id/files` (or multipart upload on `PATCH /api/appointments/:id/documents`).
- Save document records with `filename`, `url` (`/uploads/...`), `type`, `size`, and `uploadedAt`.

---

### Frontend Components

#### [MODIFY] [ConsultationModal.jsx](file:///c:/Users/Adrian/Documents/CareSync/frontend/src/components/ConsultationModal.jsx)
- Update "Add New Document / Lab Report" section to include an actual file input (`<input type="file" />`).
- Allow selecting file and file category (Lab Result, Radiology / X-Ray, Prescription, Referral Letter).
- Provide clickable preview / download links for attached documents.

#### [MODIFY] [api.js](file:///c:/Users/Adrian/Documents/CareSync/frontend/src/services/api.js)
- Add `uploadFile(appointmentId, formData)` for multipart `FormData` submissions.

---

## Verification Plan

### Automated Verification
- Verify `backend/package.json` includes `multer`.
- Run frontend build: `npm run build` to confirm no syntax or JSX errors.

### Manual Verification
1. Open doctor dashboard $\rightarrow$ Click Consultation Notes modal for a patient.
2. Select a file (e.g., PDF or image) and choose "Radiology / X-Ray" category.
3. Click Upload $\rightarrow$ Verify file is stored in `backend/uploads/patient_<id>_<name>/radiology/<timestamp>_<file>`.
4. Check uploaded document is accessible, viewable/downloadable from modal and patient dashboard.
