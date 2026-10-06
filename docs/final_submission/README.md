# CareSync final submission draft

Prepared October 6, 2026 (Asia/Manila). This package gives you a substantial paper draft and all eight required diagrams plus the database ERD. It is editable and contains explicit evidence/placeholders that need completion before submission.

## Start here

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

Requirements come from the saved project specification checklist because the original PDF was unavailable at its recorded path. Check against the original before submission. The paper retains the October 4 verification baseline and now includes an October 6 follow-up with rerun isolated backend checks, the production build, and mocked browser checks. See [the UI review](testing-evidence/ui-review.md) for dated outputs, scope and screenshots. This follow-up did not operate the live clinic database, send email, restore data or deploy the system. Demo-reset checks are documented separately from the original evaluated feature baseline.

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
