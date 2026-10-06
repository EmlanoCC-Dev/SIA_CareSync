# CareSync final submission draft

Prepared October 6, 2026 (Asia/Manila). This package gives you a substantial paper draft and all eight required diagrams plus the database ERD. It is editable and contains explicit evidence/placeholders that need completion before submission.

## Start here

- **[technical-specification-code-guide.pdf](technical-specification-code-guide.pdf)**: current technical implementation guide for all 21 specification headings, with exact code excerpts, pinned file/line links, roles, API/data flows, GridFS, Gmail, deployment, testing boundaries and pending backup/restore. Editable source is `.md`; offline version is `.html`; `technical-specification-source-index.json` records source hashes and citation lines. The reviewed web/backend revision is `b48083e`; mobile references are the separate local working copy with uncommitted changes. This guide updates the technical account without silently marking unfinished evidence complete.
- **[specification-compliance-report.pdf](specification-compliance-report.pdf)**: direct comparison with the original 14-page specification, complete requirement/subsection mapping, categorized test summaries and remaining work. Editable source is `specification-compliance-report.md`; offline browser version is `.html`.
- **testing-evidence/specification-review/**: current `88fee61` baseline, source PDF hash, 14 passing isolated backend reruns, and verification that all 44 existing browser source hashes still match. The complete live E2E scenario and backup/restore evidence remain pending.
- **final-paper.pdf**: printable paper with the diagrams included.
- **final-paper.html**: the same document, self-contained and readable offline in a browser.
- **final-paper.md**: editable source for all 15 required sections and appendices.
- **diagram-atlas.pdf / diagram-atlas.html**: nine diagrams with captions in numerical order.
- **diagrams/**: editable SVG exports; eight Mermaid `.mmd` sources and one UML use-case SVG.
- **completion-checklist.md**: what to replace, verify, capture and submit.
- **testing-evidence/ui-review.md**: October 6 UI fixes, coverage, passing run outputs and synthetic screenshots.

For Word/Google Docs, paste the paper text and insert the SVG diagrams where the figure references appear. Use the HTML or PDF as the layout reference. Apply the instructor's font, margin, citation, pagination, and title-page requirements; none were supplied in this session. Do not submit the placeholder title page or pending evidence as completed work.

## Coverage

The paper includes 17 functional requirements, 10 quality requirements with assessable criteria, stakeholder/module/diagram/test traceability, business/data/application/technology architecture, architecture tradeoffs, database dictionary, example interface contracts, role matrix, governance responsibilities, 11 preliminary risks, and a categorized test matrix. It supplies deployment/backup/restore procedures and a step-by-step end-to-end demo guide.

The eight required diagrams are current-state process flow, target-state process flow, context, UML use case, data flow, sequence, application architecture and deployment. The ERD is the additional ninth figure. The current-state baseline is an assumption requiring clinic confirmation. The deployment drawing represents local development, not a claimed public deployment.

## Evidence boundary

The original PDF was unavailable when the paper draft was prepared. It has now been read directly for the separate [specification coverage report](specification-compliance-report.md), which identifies required subsection corrections and updates the evidence baseline to `88fee61`. The existing final paper still needs those corrections; its earlier baseline/status statements are historical draft text. The paper retains the October 4 verification baseline and an October 6 UI follow-up. See [the UI review](testing-evidence/ui-review.md) for dated browser/build outputs, scope and screenshots. The new coverage review reran all 14 isolated backend suites and verified existing browser source hashes; it did not operate the live clinic database, send email, restore data, rerun Flutter/browser checks or deploy the system.

The document deliberately preserves remaining live verification, event-delivery limitations, SMS exclusion, and missing submission evidence. It does not invent team contributions, clinic observations, load metrics, screenshots, or test results. Existing paper/materials outside this repository should be reconciled with this draft.

## Editing and regenerating

Edit `final-paper.md` and the relevant `.mmd` diagram sources. The UML diagram is directly editable in `diagrams/04-use-case.svg`; preserve its system boundary, actors, ellipses and role associations.

The export uses Node 22+, Chrome and two pinned documentation-only renderers. They are saved under ignored `build/paper-export/`; application package files and lockfiles are unchanged. If those renderer files are missing, download them from the pinned URLs below into that directory:

```powershell
New-Item -ItemType Directory -Path build/paper-export -Force
curl.exe -L --fail https://cdn.jsdelivr.net/npm/mermaid@10.9.3/dist/mermaid.min.js -o build/paper-export/mermaid.min.js
curl.exe -L --fail https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js -o build/paper-export/marked.min.js
node docs/final_submission/export.mjs
```

An alternative Chrome executable can be supplied as the first argument. The exporter runs a temporary local renderer, validates all Mermaid sources by actually rendering them, writes SVG/HTML/PDF artifacts, and checks the PDF signatures. It launches headless Chrome and does not connect to the clinic API/database or send messages. Finished HTML files contain embedded vector diagrams and need no online scripts.

Mermaid usage: https://mermaid.js.org/config/usage.html.

Regenerate the coverage PDF separately with `node docs/final_submission/export-specification-report.mjs`. It reuses the pinned Markdown renderer in `build/paper-export/` and Puppeteer Core in `build/ui-tools/`, embeds the four selected synthetic screenshots, and prints through headless Chrome. It does not change the paper/diagrams or run application tests.

Regenerate the technical guide with `node docs/final_submission/export-technical-guide.mjs`. It uses the same installed Markdown/browser tooling, checks section anchors and layout, and writes self-contained HTML/PDF without calling the application API. Edit the Markdown first; code excerpts and the source index describe the reviewed revision, so update those together when documenting a different revision. The main paper/diagram atlas and earlier coverage report remain historical drafts requiring the corrections identified in the newer guide.
