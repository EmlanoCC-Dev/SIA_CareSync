# CareSync: API access controls and security walkthrough

**Date:** October 1, 2026 (Asia/Manila)

**Scope:** All currently registered API routes, medical downloads, and the public queue display.

## 1. What changed

The patient dashboard already filtered its appointment list correctly. The missing protection was on separate requests for a specific appointment ID. A user could bypass the normal screen and ask the backend for a different person's record.

The API now verifies login centrally, applies the permitted roles for each operation, and checks ownership or doctor assignment before accessing an individual appointment. These checks run on the server, so changing browser controls or sending a request from another client does not remove them.

### Example: Patient 1 versus Patient 2

1. Patient 2 books an appointment; it belongs to Patient 2 because the booking controller takes the patient ID from the verified login.
2. Patient 1's appointment list continues to show only Patient 1's appointments.
3. A direct request using Patient 1's token and Patient 2's appointment ID now returns **403 Forbidden**.
4. Attempts to cancel or download documents from that same appointment are also rejected before the operation runs.
5. Patient 2 can still read their own appointment and download its documents. Staff/Admin retain their existing clinic-wide access.

## 2. How each request is checked

| Check | Implementation | Protection provided |
| --- | --- | --- |
| Central login requirement | [API router](../../backend/src/routes/index.js) authenticates every request except a short, explicit method/path allowlist. | A forgotten login middleware on a new private route no longer makes that route public. New operations still need appropriate role and record checks. |
| Token verification | [Authentication middleware](../../backend/src/middleware/auth.js) verifies the HS256 signature, expiry, and valid user ID; it reloads the user from the database. | Invalid/expired tokens and deleted users receive 401. Privileges come from the database role, not a role supplied in the request or token. |
| Signing secret | [Environment configuration](../../backend/src/config/env.js) loads `backend/.env` consistently and requires a configured secret of at least 32 characters. The example placeholder is rejected. | Removes the previous predictable fallback secret. Use a randomly generated secret; length alone does not guarantee randomness. |
| Operation permissions | Existing role middleware remains on restricted actions. | Patients cannot create staff accounts, approve appointments, edit schedules, or view audit logs. |
| Appointment ownership/assignment | Shared `appointmentAccess` middleware covers all `/appointments/:id` operations. | Patients access their own appointments; doctors access assigned appointments; Staff/Admin retain clinic-wide access. |
| Input checks | Appointment/document IDs, login credentials, clock input, and query value shapes are checked. Existing schedule/report validation remains. | Invalid IDs, nested credential operators, repeated/structured query values, and invalid clock settings are rejected. This is not a claim of exhaustive validation for every business field. |
| Response limits | Slot responses, doctor directories, doctor walk-in lists, and public queue responses are scoped or reduced. | Prevents unrelated records or unnecessary private fields from being returned through secondary endpoints. |
| Cache/content headers | API responses use `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`; medical downloads also use private/no-store. | Reduces retained API/download responses in HTTP caches and prevents content-type guessing. |

For appointments, the ownership check runs before notes changes, status changes, deletion, and Multer file handling. Unauthorized uploads are rejected before a file is written to disk.

Internal business services still assume the API authorization boundary has been applied. Background jobs and any future service callers need their own appropriate trusted context; do not expose a service through a new router that bypasses the central API router.

## 3. Current route access matrix

All paths below start with `/api` unless indicated. Authentication is enforced once by the parent API router; child routers supply operation permissions and record checks.

| Route/operation | Allowed access and scope |
| --- | --- |
| `POST /users/register` | Public; creates Patient accounts only. A supplied Admin/Doctor/Staff role is ignored. |
| `POST /users/login` | Public; credentials must be text and must authenticate successfully. |
| `GET /users/me` | Any valid login; current user's account. |
| `GET /users/doctors` | Any valid login; Patients receive names/IDs, without doctor email/contact numbers. |
| `GET /users`, `POST /users` | Admin only. |
| `GET/PATCH /users/:id/schedule` | Staff/Admin; Doctor only for their own schedule. |
| `POST /appointments` | Patient only; ownership comes from the verified account. |
| `GET /appointments` | Patient: own records; Doctor: assigned records; Staff/Admin: clinic records. |
| `GET /appointments/:id` | Owner Patient, assigned Doctor, Staff/Admin. |
| `PATCH /appointments/:id/cancel` | Owner Patient, assigned Doctor, Staff/Admin; existing status restrictions still apply. |
| `PATCH /appointments/:id/assign`, `/approve`, `/no-show` | Staff/Admin only. |
| `PATCH /appointments/:id/decline`, `/documents`, `/complete` | Assigned Doctor or Staff/Admin. |
| `PATCH /appointments/:id/check-in` | Assigned Doctor or Staff/Admin. This also fixes the Doctor's existing Start Consultation permission mismatch. |
| `POST /appointments/:id/upload` | Assigned Doctor or Staff/Admin; record access checked before upload handling. |
| `DELETE /appointments/:id/documents/:docId` | Assigned Doctor or Staff/Admin. |
| `GET /appointments/:id/documents/:docId/download` | Owner Patient, assigned Doctor, Staff/Admin; document must belong to that appointment. |
| `GET /slots`, `GET /slots/:id` | Patient: booking fields only; Doctor: own slots with scheduling fields only; Staff/Admin: clinic slots. |
| `POST /slots/generate`, `PATCH /slots/:id/status` | Staff/Admin or Doctor managing their own slots. |
| `GET /walkins` | Staff/Admin: clinic list; Doctor: assigned entries only; Patient denied. |
| `POST /walkins`, `POST /walkins/:id/assign` | Staff/Admin only. |
| `GET /walkins/now-serving` | Public; ticket numbers/statuses only, plus queue timing/open-state metadata. |
| `GET /reports` | Staff/Admin: clinic scope; Doctor: own records regardless of supplied doctor filter; Patient denied. |
| `GET /audit-logs` | Admin only. |
| `GET /system/time` | Public, read-only clock/open-state information. |
| `POST /system/time` | Admin only; validated custom time or reset. |
| `/uploads/*` outside `/api` | Disabled; returns 404 even when logged in. |
| `GET /health` outside `/api` | Public minimal health status and timestamp. |

Public GET routes also support HEAD. CORS preflight requests remain transport-level responses and return no protected records. All other API paths require login; an authenticated request to an unimplemented path returns 404. The missing walk-in status endpoint remains separate work.

## 4. Protected document downloads

The previous public `/uploads/...` URLs no longer serve files. The Patient medical-record dialog and clinical consultation dialog now use **Download** buttons that send the login token through the shared API client.

```http
GET /api/appointments/<appointmentId>/documents/<documentId>/download
Authorization: Bearer <token>
```

The backend:

1. Verifies the login and appointment ownership/doctor assignment.
2. Looks for the document ID in that appointment's stored documents.
3. Resolves its stored path inside the upload directory. Traversal outside that directory is rejected, and canonical filesystem paths are checked to reject links escaping the directory.
4. Returns the file as an attachment with private/no-store and nosniff headers.

The client receives the authenticated response as a Blob and starts a browser download. Tokens are not placed in file URLs. Existing local uploads do not need to be moved; their stored `/uploads/...` references are used internally to locate the file.

The notes endpoint no longer replaces stored file references from caller-supplied document URLs. Notes can be saved normally; additions/deletions use the existing upload/delete endpoints. This prevents a permitted doctor from inserting someone else's file URL into an appointment they can access and then downloading it through that appointment.

Legacy external links or placeholder document URLs are not served by the download endpoint. Reattach the actual file through the upload flow where appropriate.

## 5. Clock and queue behavior

Everyone can view the clinic clock. Only Admin sees the presets, custom-time form, and reset control. The backend also enforces this restriction, so manually sending the request as a Patient, Doctor, or Staff returns 403.

```http
POST /api/system/time
Authorization: Bearer <adminToken>
Content-Type: application/json

{ "time": "2026-10-01T08:30:00" }
```

Use `{ "reset": true }` to restore the real clock. Invalid calendar dates, invalid times, wrong types, and simultaneous reset/time commands return 400 without changing the clock. Reading the public clock no longer invokes no-show processing. A successful Admin clock change still runs the existing no-show workflow; resetting the clock does not undo appointment status changes.

The waiting-room display now identifies people by ticket number. Its public entries contain only `queueNumber` and `status`; names, phone numbers, database IDs, appointment references, and slot references are excluded. Staff/Admin retain their authenticated management list, while Doctors receive only their assigned walk-ins.

## 6. Walkthrough for checking access

Use test accounts and a test database when performing live checks.

1. Log in as Patient 2, create an appointment, and note its ID from the booking response in the browser Network panel.
2. Log in as Patient 1. Their ordinary list should still contain only their own records.
3. In an API client, request Patient 2's individual appointment using Patient 1's token. Expect **403**. Repeat with Patient 2's token and expect **200**.
4. Try a cancellation request with Patient 1's token. Expect **403** and no change to Patient 2's appointment.
5. Repeat notes/download requests with an unassigned Doctor and then the assigned Doctor. Expect **403** for the unassigned Doctor and normal permitted behavior for the assigned Doctor.
6. Upload a sample document using an authorized account. Download it through the application and confirm the file contents. Open its old `/uploads/...` URL and expect **404**.
7. Open the clock dialog as each role. Only Admin should have editing controls. Direct non-Admin POST requests must also fail.
8. Inspect the public queue response while test tickets exist. Its entries must contain only ticket numbers and statuses.

Status meanings: **401** means a valid login is missing; **403** means the logged-in user lacks permission; **400** means invalid input; **404** means a route, record, or downloadable document was not found.

## 7. Automated verification and limits

From the repository root:

```powershell
node backend/tests/api-access.check.js
node backend/tests/clinic-workflows.check.js
npm.cmd run build
```

The [API access check](../../backend/tests/api-access.check.js) uses the exported real Express app, routes, JWT middleware, controllers, and services with isolated model doubles. It enumerates every registered private route and checks missing-login rejection, then exercises cross-account access, forged role claims, denied uploads, authenticated file bytes/headers, traversal rejection, clock permissions/input, and response privacy. Its temporary dummy upload file is removed afterward. No MongoDB connection or real patient changes are involved.

Recorded on October 1, 2026:

- API access checks passed: 109 HTTP checks, including all 30 registered private routes.
- Existing backend workflow/HTTP checks passed.
- Frontend production build passed.
- Expanded browser smoke checks passed at 1440px and 390px widths, including Patient/Doctor authenticated download requests, clock controls for all roles, the Admin preset action, and ticket-only display behavior. Changed clock/display screenshots were visually reviewed.

The expanded [browser smoke script](../ui-smoke.mjs) checks authenticated download requests, Admin-only clock controls, ticket-only display behavior, existing role workflows, and desktop/mobile layouts using mocked APIs. Browser file saving is disabled during this check.

```powershell
node docs/ui-smoke.mjs <puppeteer-module-path> <chrome-executable-path> http://127.0.0.1:3000
```

Restart the backend to load the new route protection, then reload the frontend. The existing local signing secret was not changed. In another environment, generate a random secret for `backend/.env` if its current value is missing, short, or the example placeholder. Changing the signing secret invalidates existing tokens and requires users to sign in again.

No database migration is required for these access controls. Existing local uploads remain in place, and their raw URLs are intentionally disabled; use the new Download buttons.

Live MongoDB persistence, deployed proxy behavior, real-account workflows, and concurrent writes still need verification. These changes enforce the current access policy; they do not replace deployment controls such as HTTPS, secret management, or testing against the final environment. Account deactivation, comprehensive audit coverage, notification delivery, and remaining queue workflow gaps are separate work.
