# Verification record

Executed locally on 13 September 2026 using Python 3.14 and the Codex in-app browser.

## Automated checks

`python -m unittest discover -s tests -v`: **20 tests passed**.

Coverage includes unauthenticated 401, forbidden audit access, forbidden approval, independent approval, draft editing and edit ownership, approved-record immutability, full Kaizen-to-closed-HD workflow, transition history, invalid transition denial, lower/higher KPI calculations, zero/non-finite/negative inputs, incompatible units/windows, ranked welding retrieval, explained target ranking, benchmark correctness, missing metadata, unknown record handling, append-only audit and backup restoration.

`node --check static/app.js`: passed. `python -m compileall -q app`: passed.

## Browser smoke verification

- Dashboard renders with 120 approved records, 24 seeded deployments, and the 2.1 / 3.4 / 4.8 Welding scrap comparison.
- Searching `welding fixture misalignment` returns 20 approved Welding matches, with the representative source first at 74% token relevance.
- Opening the source and requesting recommendations shows Plant C Welding first at 89/100, with all six factors visible.
- Capture form saves a synthetic record through the UI; it appears first as Draft KZ-0121.
- Draft editing loads existing values and successfully saves lessons learned.
- Desktop dashboard screenshot inspected for layout, readability and clipping.

The browser-created draft is intentionally retained as a starting point for a presenter. Its title is `Demo walkthrough: welding fixture verification`; owner is OpEx Lead 05. Choose a different approver for independent approval.

## Limits of this evidence

Functional tests use isolated synthetic fixtures. They are not SME relevance validation, representative performance/load evidence, a penetration test, real MES integration, or signed stakeholder acceptance. No responsive device matrix has been executed. See COVERAGE.md for the complete distinction between local demo delivery and industrial acceptance.
