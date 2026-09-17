# Walk-in manual slot assignment fix

## Problem

The staff assignment dialog posted to `POST /api/walkins/:id/assign`, but the backend did not register that route. Express returned an HTML 404 response: `Cannot POST /api/walkins/:id/assign`.

## Behavior added

- Staff and Admin users can manually assign the selected available slot to the selected waiting walk-in.
- The backend rejects missing, expired, or already occupied slots and walk-ins that are missing or already assigned.
- The walk-in and slot are claimed with conditional database updates, preventing concurrent requests from assigning either record twice.
- Assignment creates a confirmed walk-in appointment, links it to both records, records the authenticated staff/admin user in status history, and emits the existing `WALKIN_SLOT_ASSIGNED` event.
- If appointment creation or linking fails, the newly created appointment is removed and the claimed slot/walk-in are restored where possible.

## API

`POST /api/walkins/:id/assign`

Request body:

```json
{ "slotId": "<slot id>" }
```

Authorization: Staff or Admin.

## Limits

The rollback is compensating logic rather than a MongoDB transaction. A database outage during rollback may require manual reconciliation.
