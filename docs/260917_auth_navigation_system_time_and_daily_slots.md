# Authentication, navigation, system time, and daily slot changes

Documentation convention: save new change documents in `docs/` as `YYMMDD_descriptive_topic.md`, using the documentation date and lowercase words separated by underscores.

Retrospective of the September 2026 UI and slot-management work. This records the final implementation rather than intermediate attempts. Future behavior changes should record what changed, why, workflow effects, and verification here.

## Authentication

- Login and signup open in a large modal over the mounted landing page. Backdrop click, Escape, the close button, or the form home button dismiss it.
- Both forms remain mounted while switching, preserving typed values until the modal closes. Successful authentication opens the role dashboard.
- Desktop panels swap sides with a 380ms CSS transform; mobile uses a stacked layout. Reduced motion disables transitions.
- Snapshot transitions were replaced after reports of sluggishness. The backdrop is dimmed without blur.
- Sources: `frontend/src/App.jsx`, `pages/LoginPage.jsx`, `pages/RegisterPage.jsx`, and `styles/app-screens.css`.

## Landing navigation

- Icons reveal their labels on hover or keyboard focus. Section links scroll smoothly, except with reduced motion enabled.
- The fixed icon navigation hides on downward scrolling and appears on upward scrolling or near the page top. Its invisible dock reveals it on hover; keyboard focus also reveals it.
- The logo and login/signup buttons remain in the normal header. Auth actions explicitly use the right grid column to avoid being covered by the fixed navigation.
- Limit: direction detection requires a scroll-event delta over six pixels, so very slow scrolling may not change visibility.
- Sources: `pages/LandingPage.jsx`, `styles/public-pages.css`, `styles/foundation.css`, and `styles/responsive.css` under `frontend/src`.

## Custom system time

- The time modal renders into `document.body` through a React portal. This escapes the navbar backdrop filter that constrained fixed positioning and the navbar styles that made buttons unreadable.
- Its height is bounded by the viewport; header and footer remain visible while the body scrolls.
- The existing reset operation is always exposed in the footer as **Reset to Real Time**. It sends `{ reset: true }`, refreshes navbar status, and closes on success.
- Opening uses a 120ms fade without scaling or backdrop blur; reduced motion disables it.
- Simulation remains a fixed, in-memory backend timestamp, not an automatically advancing clock. Reset resumes real server time; it does not undo appointment/status changes caused during simulation.
- Sources: `frontend/src/components/SystemTimeModal.jsx`, `Navbar.jsx`, `styles/responsive.css`, `backend/src/config/systemTime.js`, and `backend/src/routes/system.routes.js`.

## Audit display

- Known internal codes receive readable labels, such as `APPOINTMENT_NO_SHOW` becoming **Appointment marked as no-show**. Stored audit records remain unchanged.
- Status and model labels receive display formatting. Raw JSON remains available under **View technical details**.
- Limit: the generic formatter replaces separators and capitalizes word starts but does not lowercase unknown uppercase codes.
- Source: `frontend/src/components/AuditLogViewer.jsx`.

## Doctor-grouped slot management

- Multi-doctor lists group by doctor ID and sort groups by displayed name. Groups start collapsed with a doctor name and slot count; expanding shows existing rows/actions in backend time order.
- The redundant Doctor column was removed. Doctor-specific views show rows directly.
- The filter uses a native searchable datalist. An exact matching name selects the doctor ID; clearing restores all doctors. The Custom Generator still has a normal doctor select.
- Limits: partial text retains the previous selection; duplicate names select the first match. Suggestion appearance depends on the browser.
- Sources: `frontend/src/components/SlotManagement.jsx` and `styles/app-screens.css`.

## Daily slots and availability

### Daily scope

- Slots were already stored per doctor, date, and start time with a unique index. Missing daily slots are generated on demand using doctor working hours and existing defaults.
- Listing/generation now default to the system date, including simulation, instead of the real UTC date.
- Slot Management defaults to **Today** and polls every ten seconds. Today follows system-date rollover; choosing an explicit date pins it until Today is selected again.
- Daily reset means a separate day's slots, not deleting history or reopening yesterday's bookings. There is no midnight deletion job.
- Dashboard navigation shows the system date and a simulated-mode label using its existing ten-second polling.

### Expiry and counts

- `GET /api/slots` excludes slots when their start minute has been reached or passed, using the backend system clock. This applies even with no status filter and to every status, including past-start in-progress/completed slots.
- Stored records remain intact, and the single-slot lookup is unchanged. The list response includes the resolved `date` and filtered `count`. Doctor-specific status filtering is now enforced as well.
- Management metrics and group counts use returned rows. **Total Slots** means filtered non-expired rows, not the original daily inventory. **Available** counts only those rows whose status is `Available`.
- Taken future slots may appear in management views but do not count as available. Existing booking selection rules prevent choosing taken slots.
- Polling can leave an expired row visible for approximately ten seconds plus network latency; server booking validation still rejects expired starts.

### Reservation integrity

- Existing past-start booking/reservation checks remain. Reservation now performs an atomic conditional update requiring `Available` status and no linked appointment, preventing two requests from reserving the same slot document.
- When reservation fails after creating a booking, the service deletes that newly created booking and returns the error before emitting its booking event.
- Limits: creation and reservation are not one database transaction; cleanup can fail during database outages. This protects one slot ID, not overlapping separately generated slots or bookings without a slot ID.
- Timezone handling was not redesigned: existing helpers combine date-only UTC storage with server-local comparisons. Keep the clinic/server timezone consistent; cross-timezone deployment needs separate verification.
- Sources: `backend/src/controllers/slot.controller.js`, `services/slot.service.js`, `services/appointment.service.js`, `models/Slot.js`, `utils/timeHelper.js`, and `frontend/src/components/SlotManagement.jsx` and `Navbar.jsx`.

## Styles and TV display

- `frontend/src/index.css` imports `foundation.css`, `public-pages.css`, `app-screens.css`, and `responsive.css` from `styles/` in that order. The initial mechanical split preserved the cascade.
- TV header, headings, clock, icons, footer, and panel padding were reduced. Empty states are centered and serving queue numbers remain prominent. Queue fetching/order was unchanged.

## Recorded verification

- Frontend production builds passed after UI changes and the initial daily-slot implementation.
- Backend syntax checks passed for the slot controller, slot service, and appointment service.
- Node assertions passed for past starts, exact start boundaries, future times/days, and simulated day rollover.
- A later small effect adjustment stopped polling from repeatedly overwriting the generator date; no additional build was recorded after that edit.
- Browser rendering, live-database concurrent booking, and end-to-end midnight rollover were not verified. Build success does not establish visual correctness or animation performance.
- Backend changes require a restart. No historical slot deletion or schema migration was performed.
