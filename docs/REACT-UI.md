# React interface release

The primary interface now uses React 19, React DOM, Lucide icons and a small esbuild production build. Python remains the backend: React is a UI library, not a database/API server. Existing SQLite records and evidence files are preserved.

## What changed

- Eight React pages: Overview, Kaizen Repository, Recommendations, Horizontal Deployment, KPI Benchmarking, Audit Trail, Work Hub and Equipment Library.
- Consistent midnight navy navigation, pearl workspace, indigo actions and turquoise outcomes; readable type and contrast refinements across pages and forms.
- Responsive mobile navigation, visible focus indicators, skip navigation, real request loading/error states and reduced-motion support.
- Repository search, plant/shop/status filters, sorting, list/grid views and pagination. Opening a record preserves the React page and its filter state.
- Recommendations use a ranked target list and a six-factor detail panel with visible model limitations.
- Deployment filtering and lifecycle counts; KPI comparison bars and CSV export; audit search and JSON export; templates, saved collections, tasks and equipment QR downloads.
- Existing record workspaces, approval forms, evidence uploads, camera controls, captions, comments, measurements, revisions and exports remain available through a compatibility controller outside the React root. These dialogs are restyled to match the React interface. They have not all been rewritten as React components.

The 30 design prompts describe a mixture of pages and supporting states/forms. They are organized into the eight main pages and contextual record/dialog views rather than 30 duplicate navigation entries. Existing limitations around automatic transcription, translation, external messaging, production identity and media scanning still apply; see COLLABORATION.md.

## Run

```powershell
python -m app.server
```

Open http://127.0.0.1:8765. Built frontend assets are included, so Node is not required to run the delivered demo.

## Edit and rebuild

```powershell
npm ci
npm run build
```

React source: `frontend/main.jsx`. Styling: `frontend/theme.css` and `frontend/accessibility.css`. Build: `frontend/build.cjs`. The build writes `static/react/app.js`, CSS and source maps, bundles existing workflow controllers into `static/react/workflows.js`, and updates the HTML entry point.

Compatibility sources remain `static/app.js` and `static/collaboration.js`. After editing these controllers, rebuild so `workflows.js` is refreshed. `static/legacy.html` retains the previous entry point for comparison/recovery.

## Verification

- All 46 Python tests pass after migration.
- `tests/react-smoke.cjs` tests all eight React pages against an isolated local API database, including chart data, repository pagination, record workspace opening, assignment forms, deployment management and template capture.
- Production build and JavaScript syntax checks pass.
- DOM tests do not establish screenshot fidelity, browser media codec support, or mobile-device hardware behavior. No new visual browser QA was performed in this release.

To run the DOM integration test with the project-local test dependency already installed on this workstation:

```powershell
python -m app.server --port 8767 --db tmp/react-check/demo.sqlite3
node tests/react-smoke.cjs
```

The main application remains local. Its Python/SQLite runtime is not a Cloudflare Worker build, and this change does not publish or expose it externally.
