# CareSync interface design

## Direction

Calm, professional clinical interfaces for patients booking visits, reception coordinating arrivals and walk-ins, doctors recording consultations, and administrators overseeing the clinic. Prioritize appointment times, request status, queue numbers, and the next available action. Use plain patient-facing language.

The signature is a clear care journey: book, receive confirmation, check in, consult. Use numbered steps for guidance and prominent ticket numbers for the waiting-room display. Guidance must remain distinct from actual patient status; never invent queue positions, waiting times, or activity.

## Palette and surfaces

Reuse the tokens in `frontend/src/styles/foundation.css`:

| Token | Value | Purpose |
| --- | --- | --- |
| `--care-teal` | `#087f75` | Primary actions and care identity |
| `--care-teal-dark` | `#06675f` | Hover and emphasized teal text |
| `--care-mint` | `#e8f5f1` | Selected navigation and care guidance |
| `--clinic-canvas` | `#f4f7f7` | Page and sidebar background |
| `--clinic-paper` | `#ffffff` | Cards and dialogs |
| `--clinical-ink` | `#183a3b` | Headings and primary text |
| `--clinical-muted` | `#596f73` | Supporting text |
| `--bg-muted` | `#f0f5f4` | Inset panels |
| `--border` | `rgb(24 58 59 / 12%)` | Quiet structural borders |

Semantic colors: amber `#926010` on `#fff5de` for pending/waiting; blue `#496995` on `#edf2fa` for confirmed/reserved; green `#237650` on `#e8f4ec` for completed/available; rose `#b43e50` on `#fceef0` for cancelled/declined. In-progress uses teal on mint. Always include text with status colors.

Use white cards over the pale canvas, lightly tinted inset inputs, and solid colors. Depth comes primarily from subtle borders, with `--shadow-sm` on cards and `--shadow-xl` on dialogs. Avoid decorative gradients, heavy shadows, and arbitrary accent colors. Preserve the existing CareSync logo and healthcare photography.

## Typography and spacing

- Typeface: Plus Jakarta Sans, with Segoe UI and sans-serif fallbacks.
- Compact type progression, approximately 1.2: labels 10–12px, body/table text 13px, section headings 18px, secondary headings 24px, page headings 30–32px. Hierarchy also uses weight and color.
- Body line-height: 1.6. Headings: 1.3 with `-.035em` tracking; page headings use responsive sizing. Primary headings are weight 700; supporting text is quieter.
- Metric values: 30px/700, line-height 1.25, tabular numerals, `-.04em` tracking.
- Spacing base: 4px. Prefer 8, 12, 16, 20, 24, 28, and 32px. Related controls are compact; separate major sections with 28–32px.
- Radii: 6px small controls, 8px buttons/inputs, 12px cards, 16px dialogs, pill radius for status badges.

## Reusable patterns

| Pattern | Measurements and behavior |
| --- | --- |
| Primary button | Minimum 44px high; 10px 16px padding; 8px radius; 13px/650; solid teal with white text |
| Small table action | Minimum 36px high; 7px 12px padding; 6px radius; 12px; keep action text on one line |
| Secondary/danger/success button | Quiet border or semantic tinted background; explicit label; reserve teal for the main action |
| Card | 24px padding; 12px radius; subtle border and small shadow; table cards have separate 24px header/inset |
| Metric card | Minimum 112px high; 20px padding; 16px gap; 44px icon square with 10px radius |
| Status badge | 4px 10px padding; 11px/650; pill shape; 6px status dot; normalize multiword status classes with hyphens |
| Input/select | Minimum 44px high; 10px 12px padding; 8px radius; lightly tinted inset surface; visible label and teal focus ring |
| Table | 13px body; 10px uppercase headers with `.075em` tracking; headers 13px 16px padding; cells 18px 16px; pale header surface |
| Dialog | 16px radius; 20px 24px header, 24px body, 16px 24px footer; fit within viewport and scroll content |
| Record version history | Native details groups with 12px padding and 8px radius; read-only 16px inset snapshot cards; author/time metadata at 12px; explicit current/previous/archived labels and protected version download actions |
| Email delivery feedback | Green confirmation banner after a confirmed signup-code send; neutral acknowledgement for password requests; inbox status badges at 12px with icon/text, green sent, amber pending and rose failed, plus a sent timestamp visible on desktop/mobile |
| Slot chip | Minimum 52px high; 10px 6px padding; 8px radius; 11px/600; teal selection; clearly disabled unavailable slots |

## Layout and focal points

- Desktop sidebar: 248px, same canvas as the workspace, subtle right border. Role navigation above clinic tools and account controls. Navigation items are at least 44px high, with mint selection and teal text.
- Workspace padding: 36px vertically and 24–48px horizontally. Page header precedes metrics and the selected work view.
- Patient portal: booking action and appointment schedule lead; visit guidance explains the process without implying live progress.
- Staff and doctor workspaces: appointments, slots, and walk-ins share the shell and table patterns. Administration uses the same shell for appointments, accounts, and audit activity.
- Waiting-room board: current ticket dominates a solid teal panel with 88–150px numerals; upcoming tickets use white/pale mint surfaces. Labels scale to 14–20px and names to 24–32px for distance legibility.
- Public entry: existing healthcare images, readable navigation, direct booking and queue actions, and the same care journey.
- Authentication: white form beside a mint guidance panel; visible labels, browser autocomplete, and native modal dialog behavior.

## Responsive behavior and accessibility

- At widths up to 1100px or heights up to 700px, use a horizontal header and in-flow wrapping workspace navigation.
- At 900px, stack the public hero and queue-board panels; simplify footer columns.
- At 640px, use 16px workspace gutters, two-column metrics, stacked form rows, 16px form text, and stacked authentication panels. Table scrolling stays inside its container; retain readable column widths.
- Keep native buttons, links, date/time inputs, and the existing controls. Give icon-only actions accessible names and preserve keyboard focus indicators.
- Focus ring: 3px teal outline with 3px offset. Inputs use a 3px teal translucent ring. Lock background scrolling while a dialog is open.
- Motion: 160–240ms, purposeful and restrained. Honor `prefers-reduced-motion`.

## Maintenance and verification

Update the shared styles in `foundation.css`, `app-screens.css`, `public-pages.css`, and `responsive.css` before adding page-specific overrides. Reuse installed Lucide icons and existing components; no additional design dependency is needed.

Run `npm.cmd run build` after UI changes. `docs/ui-smoke.mjs` checks all role screens, dialogs, status styling, empty states, and desktop/mobile overflow using mock API data; it accepts an existing Puppeteer module path and optional Chrome executable path. The redesign was checked at 1440px and 390px widths. Browser smoke checks do not establish live backend correctness.
