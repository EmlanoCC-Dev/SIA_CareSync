# Consultation note and document version history

Implemented October 3, 2026 (Asia/Manila).

Open **History & comments** on any authorized appointment, or **Medical Records / View Notes**, then expand **Version history**. Earlier notes are read-only. Document versions have authenticated download buttons. The owning Patient, assigned Doctor, Staff, and Admin can view history; clinical record changes retain the existing Doctor/Staff/Admin permissions.

Each changed note save appends a complete snapshot with its version, author name/role, author ID, and timestamp. Unchanged saves create no extra version. Clearing notes preserves previous content. The current notes and history change in a single conditional appointment update; concurrent writes and stale revision tokens return 409 rather than silently overwriting a different edit. The editor retains failed drafts and refreshes the appointment list on conflicts; close and reopen the record to load the refreshed saved data.

In the Doctor's record editor, select **Replace** beside a current attachment, choose a file, and select **Upload replacement**. The document retains its identity, advances its version, and preserves previous metadata and physical files. Ordinary uploads create separate documents. Select **Archive** to remove an attachment from the current record while preserving all versions. There is no history edit/delete/restore interface. Native record dialogs support focus containment, Escape, and focus restoration. Late responses cannot update another record-editing session.

Existing notes become a baseline on their first changed save; the history viewer can also show the baseline before that save. Missing legacy author/time data is labelled unavailable. Existing files become version 1. Already overwritten content or previously removed database references cannot be reconstructed. No bulk migration is required.

The Appointment schema now contains `notesRevision`, `noteVersions`, document version/author metadata, and `archivedDocuments`. Replacement/archive writes compare the current file reference to protect competing edits. History and current file changes are atomic within one MongoDB document. Stored files receive UUID-based names so uploads with the same original name and clock tick cannot overwrite each other. Appointment listings omit history arrays; the history endpoint loads them on demand.

API routes:

- `GET /api/appointments/:id/versions` — read notes and current/archived document histories.
- Existing `PATCH /api/appointments/:id/documents` — save notes, optionally supplying `notesRevision`.
- `POST /api/appointments/:id/documents/:docId/replace` — multipart file, category/title, and optional expected `version`.
- Existing `DELETE /api/appointments/:id/documents/:docId` — archive, optionally supplying an expected numeric `version`.
- `GET /api/appointments/:id/documents/:docId/versions/:version/download` — protected download of a current, earlier, or archived file version.

Downloads reuse path containment and authenticated appointment access. Public upload URLs remain disabled. Audit events identify the actor, operation, and version without copying note contents or file URLs. The existing document-removal audit event now includes `archived: true` and is labelled **Document archived** in the Admin viewer.

Verification: `node backend/tests/versions.check.js` passed 58 real-route HTTP checks with isolated database models and real temporary uploads/downloads. All nine existing backend checks passed; API access coverage is now 121 HTTP checks across 41 private routes. The production build and extended `node docs/comments-ui.check.mjs` passed; Chrome checks cover all four roles at 1440px/390px, read-only viewing, old-version downloads, note-save retries, unchanged saves, replacement, archiving, and delayed replies after reopening.

Live MongoDB persistence remains unverified. Embedded history must stay within MongoDB's document-size limit; a larger history would require a separate collection with transactional writes. Failed or ambiguously acknowledged uploads may leave unreferenced files; retain them until reconciliation establishes whether they were committed. Backup/restore must include both the database histories and retained uploaded files. Audit delivery retains its existing best-effort behavior.
