# PDF reference redesign

The eight screenshots in the user-supplied `1 (1).pdf` are the visual reference for this interface. The layout uses compact navy navigation, blue actions, teal highlights, pale workspace backgrounds, denser cards and tables, and consistent record dialogs.

`frontend/reference.css` contains the final responsive visual layer, imported after the base styles and contrast rules. `frontend/main.jsx` contains the React pages. Run `npm run build` after edits.

The Overview now presents current record counts, welding scrap comparisons, deployment lifecycle counts, recent approved improvements, and assignments needing attention. All values come from the existing APIs, rather than the illustrative counts or names in the PDF. Equipment search supports equipment name, shop, plant and formatted IDs such as EQ-001. The three decorative equipment illustrations in `static/equipment/` are extracted from the supplied reference and do not represent photographs of actual assets.

Existing record approval, deployment transitions, media, discussions, tasks, measurement verification, translations, revisions, notifications, QR downloads, and exports retain their existing handlers and backend permission checks. The mockup does not authorize new services or change business rules.

Validation: `npm test` runs the backend suite and isolated React DOM integration checks. UI checks include all eight pages, record and assignment dialogs, templates, equipment filtering, and image HTTP responses. Browser checks cover visual layout and responsive navigation. Hardware camera capture and all video codecs are not covered by these checks.
