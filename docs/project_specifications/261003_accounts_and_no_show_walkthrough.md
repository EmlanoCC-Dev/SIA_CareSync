# Account maintenance and automatic no-show slots

Implemented October 3, 2026 (Asia/Manila).

## Admin account maintenance

In **User Directory**, select **Edit account** to change first/last name, email, contact number, role, or status. Choose **Deactivated** to block login and authenticated requests using existing tokens. Choose **Active** to restore access. Existing accounts without a stored status continue to work as Active; no migration is required.

Accounts are never deleted by this feature. Appointment references, consultations, schedules, documents, and audit records remain stored. Deactivating a doctor does not cancel their existing appointments; clinic staff must handle those visits. Deactivated doctors are excluded from doctor selection, available-slot lookup, and new slot reservations/generation.

Only Admin may call `PATCH /api/users/:id`. The endpoint validates a whitelist of profile/role/status fields, ignores password/schedule changes, reports duplicate email as a conflict, and records `USER_UPDATED` with the authenticated actor. Admin cannot deactivate themselves or remove their own Admin role. A doctor with Pending, Confirmed, or In Progress appointments cannot change to another role until those visits are resolved.

The account form reuses existing styling and uses a native dialog for keyboard focus and Escape behavior. Role/status changes are reflected in the directory after saving.

## No-show consistency

Automatic processing conditionally changes expired Pending/Confirmed appointments to No-show. A competing appointment status change prevents a stale no-show update. Arrived walk-ins remain exempt.

The linked reserved slot becomes **No-show**, with its appointment/reservation-operation cleared. Expired missed slots stay closed to booking. The slot release emits the existing audit/integration event; automatic walk-in assignment already rejects expired slots. Manual no-shows use the same terminal slot state after expiry; a future slot released manually remains Available.

Later passes also reconcile slots and waiting/assigned walk-ins belonging to existing No-show appointments, allowing cleanup to recover after an interrupted write. Reconciliation does not append duplicate history or emit another appointment no-show notification. Slots owned by another appointment and arrived/active/completed walk-ins are preserved.

These writes are conditional/compensating operations, not a multi-document transaction. Audit/notification delivery retains the existing best-effort behavior. Processing still runs through the existing appointment reads and testing-clock action.

## Verification

Run `node backend/tests/accounts-noshow.check.js` from the repository root. It checks Admin-only updates, validation, duplicate email, role changes, self-protection, retention/reactivation, rejected login/old tokens, doctor booking restrictions, future/expired no-shows, arrived walk-ins, competing status updates, cleanup retry, and reservation ownership. It uses isolated models and does not connect to MongoDB.

All six existing backend checks and the frontend production build passed during implementation. The expanded `docs/ui-smoke.mjs` includes account edit/deactivation/reactivation at desktop/mobile widths; browser execution requires an available Puppeteer module. Live MongoDB persistence and browser verification remain pending for this change.
