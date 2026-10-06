# Before submitting CareSync

Use this checklist with `final-paper.md`. The draft is written; checkboxes refer to review, facts, and evidence that still need completion.

## 1. Confirm the specification and title page

- [ ] Compare every required section/subsection and minimum count against the original *Final Project Specification_MWA.pdf*.
- [ ] Fill school, department, course/section, instructor, clinic, team names and submission date.
- [ ] Apply the required paper layout and reference style.
- [ ] Confirm healthcare mappings for generic feedback, version tracking, correction and dialog-based screens.
- [ ] Record instructor acceptance of Gmail plus in-app delivery with the agreed SMS limitation.

## 2. Replace the assumed baseline

- [ ] Interview/observe the chosen clinic with permission and record date/source.
- [ ] Verify booking, queue, records, notifications and reporting workflow.
- [ ] Update Figure 1 and Section 2 to reflect the confirmed workflow.
- [ ] Include measured baseline metrics only if actually collected.

## 3. Complete test and integration evidence

- [x] Run the October 6 mocked UI review across all roles; attach synthetic screenshots and outputs in `testing-evidence/ui-review.md`.

- [ ] Run and record the complete live journey in Section 11 (E2E01).
- [ ] Attach case-level records for at least 8 functional, 5 integration, 5 error and 3 security cases.
- [ ] Include environment/date/commit, inputs, expected/actual result, status and evidence file for each.
- [ ] Capture report totals, date boundaries, notifications/read state, audit persistence, Admin account maintenance and protected historical downloads.
- [ ] Distinguish live cases from isolated checks, mocked browser checks and manual receipt confirmation.
- [ ] Document controlled outage/recovery behavior where required.
- [ ] Confirm each claimed appointment email outcome separately; avoid inferring all four from unspecified receipt confirmation.
- [ ] Measure NFR07 performance if required; otherwise retain the pending target and limitation.
- [ ] Capture sanitized API requests/responses, event payload mappings and corresponding saved records.

## 4. Finish deployment and recovery

- [ ] Supply actual demo/deployment inventory and dated running-system screenshots.
- [ ] Reconcile Figure 8 with the actual topology. Label any future-production topology as proposed.
- [ ] Make a coordinated source/docs/database/upload backup set and manifest.
- [ ] Restore into a separate environment; verify counts, current/prior notes, files, roles, tickets and report totals.
- [ ] Record restore duration, checksum/sample-file checks and differences; retain source data untouched.
- [ ] Set named governance/backup owners and agreed retention/recovery targets.

## 5. Assemble attachments

- [ ] Capture SC01–SC12 with synthetic data and redacted secrets.
- [ ] Include required synthetic database export or migration/reproduction material.
- [ ] Prepare presentation slides and practice the demo script.
- [ ] Complete the contribution sheet from actual work and evidence.
- [ ] Add required assistance/tool disclosures and references.
- [ ] Review figures against code and maintain figure numbering/captions.
- [ ] Regenerate PDFs after final edits and inspect every page/diagram for clipping and legibility.
- [ ] Remove placeholders only after replacing them with facts or recorded outcomes.

## Suggested paper/defense narrative

Explain the clinic coordination problem and validated baseline; show requirements and target process; explain one backend with HTTP plus process-local events; walk through booking/correction/arrival/consultation; demonstrate privacy and revision history; show categorized actual results; present backup restoration; finish with limitations and team contributions. Do not claim durable event delivery, completed production hosting, medical outcomes or waiting-time improvements without evidence.
