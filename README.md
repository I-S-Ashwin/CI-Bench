# CI-BENCH — Manufacturing Improvement Platform

CI-BENCH is a local demonstration of **continual improvement, horizontal deployment, and KPI benchmarking**. Manufacturing teams can document a Kaizen, review and approve it, find related improvements, deploy it elsewhere, and verify its outcome with evidence.

The application uses a **React frontend**, **Python backend**, and **SQLite database**. React renders the main interface. Python handles APIs, permissions, workflows, uploads, and storage. Records persist between restarts.

> This is a synthetic-data proof of concept, not a production-certified industrial system. Demo personas are freely selectable. Use demonstration information rather than sensitive operational data.

## Contents

1. [Quick start](#quick-start)
2. [Prerequisites](#prerequisites)
3. [Developer setup](#developer-setup)
4. [Pages and functions](#pages-and-functions)
5. [Complete demonstration workflow](#complete-demonstration-workflow)
6. [Architecture and project files](#architecture-and-project-files)
7. [Search, scoring, and calculations](#search-scoring-and-calculations)
8. [Media and collaboration](#media-and-collaboration)
9. [Data, backup, and restore](#data-backup-and-restore)
10. [Testing](#testing)
11. [Configuration and API access](#configuration-and-api-access)
12. [Troubleshooting](#troubleshooting)
13. [Limitations and documentation](#limitations-and-documentation)

## Quick start

The delivered copy includes built React assets and the QR library. **Only Python and a browser are needed to run it.** No separate frontend server, database service, Docker installation, API key, or `.env` file is required.

### Option A: Windows launcher

1. Open the `Ashok_Leyland` folder.
2. Double-click **`start-demo.cmd`**.
3. Wait for `CI-BENCH local demo: http://127.0.0.1:8765` in the terminal.
4. Open [http://127.0.0.1:8765](http://127.0.0.1:8765/) in your browser.
5. Keep the terminal open while using the app. Press **Ctrl+C** to stop it.

The launcher prints the URL; it does not automatically open a browser.

### Option B: PowerShell

```powershell
cd C:\Users\isash\Desktop\Ashok_Leyland
python -m app.server
```

Open [the website](http://127.0.0.1:8765/). If you copied the project elsewhere, adjust the folder path. If Windows recognizes `py` instead of `python`, use `py -3 -m app.server`.

There is no password login in this demo. Use the **Demo persona** selector in the sidebar. The default is **OpEx Lead 05**.

### Different port or fresh dataset

```powershell
python -m app.server --port 8766
```

Open [http://127.0.0.1:8766](http://127.0.0.1:8766/).

For a fresh dataset without deleting existing work:

```powershell
python -m app.server --port 8766 --db data/fresh-session/demo.sqlite3
```

A missing database is created and seeded automatically. Use a **new directory** for an isolated session so its evidence files stay separate too.

## Prerequisites

| Purpose | Requirement |
|---|---|
| Run the included application | Python 3.11 or newer and a modern browser |
| Rebuild React or run UI tests | Node.js 20.19+ or 22.12+, with npm; prefer a current supported Node release |
| Generate QR labels | Included `vendor/qrcode` library, version 8.2 |
| Camera recording | Browser camera/microphone permission and MediaRecorder support |
| Optional malware scanning | ClamAV `clamscan` on PATH with usable definitions |

Check installed tools:

```powershell
python --version
node --version
npm --version
```

Node is optional when running the included build. The backend uses Python's standard library; there is no required `pip install -r requirements.txt` step. Keep the included `vendor/` directory for QR support.

If missing, install [Python](https://www.python.org/downloads/) and, for development, [Node.js](https://nodejs.org/en/download). Enable Python's **Add to PATH** option on Windows, then reopen the terminal.

## Developer setup

Run from the project root:

```powershell
npm ci
npm run build
python -m app.server
```

`npm ci` installs the exact dependencies in `package-lock.json`; registry access is needed unless packages are cached. The build generates JavaScript, CSS, source maps, the workflow bundle, and the HTML entry point. It does not start Python.

### Commands

| Command | Action |
|---|---|
| `python -m app.server` | Start the app on port 8765 |
| `npm start` | Start the same Python server; requires `python` on PATH |
| `npm run build` | Rebuild frontend assets |
| `npm run test:api` | Run Python unit and API integration tests |
| `npm run test:ui` | Automatically start an isolated API server, run React DOM checks, and clean up |
| `npm test` | Run API tests followed by UI tests |

### Dependencies

| Package | Version | Purpose |
|---|---|---|
| React / React DOM | 19.1.1 | Main UI and rendering |
| Lucide React | 0.468.0 | Interface icons |
| esbuild | 0.25.9 | Production asset build |
| jsdom | 26.1.0 | Development-only DOM tests |
| qrcode | 8.2 | Vendored Python SVG QR generator |

### Editing and refreshing

- React pages: `frontend/main.jsx`.
- Layout, animation, responsive styles: `frontend/theme.css`.
- Final text contrast/readability: `frontend/accessibility.css`.
- HTML template: `frontend/index.html`.
- Record/dialog controllers: `static/app.js` and `static/collaboration.js`.
- React/workflow adapter: `frontend/bridge.cjs`.
- API endpoints: `app/server.py` and `app/collaboration.py`.
- Business rules: `app/domain.py`.
- Database and seed fixtures: `app/store.py`.

After changing frontend or workflow-controller source, **run `npm run build` and refresh the browser**. Do not edit `static/react/` directly because the build replaces those files. Restart Python after changing backend code. Automatic hot reload is not configured.

## Pages and functions

| Page | Main functions |
|---|---|
| **Overview** | Approved knowledge, deployment counts, validated outcomes, plant filter, and synthetic welding scrap comparisons |
| **Kaizen Repository** | Approved-knowledge search, record filters, sorting, pagination, grid/list views, draft creation and record access |
| **Recommendations** | Approved source selection, ranked targets, six-factor explanations, feedback and assessment assignment |
| **Horizontal Deployment** | Assignment filters, lifecycle counts, plans, evidence, tasks, measurements and state transitions |
| **KPI Benchmarking** | KPI selection, synthetic shop comparison, plant filter and CSV export |
| **Audit Trail** | Actor/action/entity search, stored snapshots and JSON export; restricted to Auditor and OpEx |
| **Work Hub** | Templates, transcript-based draft suggestions, collections, team tasks and notifications |
| **Equipment Library** | Equipment-related improvements and downloadable QR labels |

### Inside a record

Opening a Kaizen or deployment reveals:

| Tab / action | Purpose |
|---|---|
| **Evidence** | Upload, view, download and compare attachments; video playback and captions |
| **Discussion** | Comments, replies, mentions, resolution and video timestamps |
| **Tasks** | Assignments, progress, milestones, checklists, deadlines and blockers |
| **Measurements** | Provisional baseline/post observations and independent verification |
| **Languages** | Human-supplied translated content on eligible drafts |
| **Versions** | Stored record snapshots, actors, actions and timestamps |
| **Details & approval** | Full Kaizen content and submit/review/approve/return/reject actions |
| **Lifecycle & sign-off** | Controlled deployment transitions and outcome validation |
| **Create draft revision** | Preserve an approved source while creating an editable successor |
| **Save to collection** | Bookmark a Kaizen in a named personal collection |
| **Evidence pack** | Download the selected record and supporting files as ZIP |

The bell opens mentions, workflow updates, due-date reminders, overdue escalation and notification preferences. Supporting workflows are tabs/dialogs, not 30 separate sidebar pages.

### Demo personas

| Persona | Typical use |
|---|---|
| Contributor 01 | Create and submit own Kaizens |
| Reviewer 02 | Review submitted Kaizens |
| Shop Head 03 | Approve reviewed records and verify outcomes |
| Plant Coordinator 04 | Assign and advance deployments |
| OpEx Lead 05 | Coordinate operational workflows and access audit |
| Auditor 06 | Inspect audit and accessible records without operational editing |
| Executive Viewer 07 | Read approved knowledge and dashboards |

Other personas repeat these roles. An OpEx user cannot approve its own Kaizen. Permissions are checked by the backend. Plant labels provide demonstration context, not complete tenant isolation.

## Complete demonstration workflow

1. Choose **Contributor 01 → Kaizen Repository → New Kaizen**.
2. Enter a welding-fixture problem, root cause, countermeasure, baseline `4.8`, KPI `Scrap Rate`, and synthetic evidence note. Save the draft.
3. Clear search filters and open the new draft. Add photos/video in **Evidence** before approval. Later evidence changes require a draft revision.
4. Select **Details & approval → Submit** and enter a comment.
5. Close the dialog, switch to **Reviewer 02**, and record a review.
6. Switch to **Shop Head 03** and approve with a comment.
7. Open **Recommendations**, select the approved record, and inspect its target explanations.
8. As **Plant Coordinator 04**, assign Plant C / Welding, choose an owner and due date, and create the assessment.
9. Open the deployment, update feasibility/planning information, and progress through its allowed states to **Implemented**.
10. Switch to **Shop Head 03** for validation. Enter baseline `4.8`, post `2.1`, unit `%`, window `30 days`, and evidence. The relative improvement is `56.25%`.
11. Record lessons learned and close. Inspect history and export an evidence pack.
12. Switch to **Auditor 06** to inspect resulting audit events.

The **Measurements** tab is a separate observation workflow: independently verifying an observation does not automatically validate or close a deployment. See [the presenter guide](docs/DEMO.md) for a compact walkthrough.

## Architecture and project files

```text
Browser: React pages + record/dialog controllers
                  |
          Same-origin /api/v1/*
                  |
Python: validation, sessions, permissions, workflows
                  |
          +-------+--------+
          |                |
        SQLite         Evidence files
   Records and audit   Random names + hashes
```

Main pages are React components. Existing workflow dialogs remain JavaScript controllers through `frontend/bridge.cjs`, outside the React-managed DOM. They are styled consistently but have not all been rewritten as React components.

Python serves the interface and APIs from one origin. SQLite provides record storage, schema versioning and atomic record/audit writes. Triggers prevent ordinary audit update/delete operations. Requests are serialized in this demo to protect state transitions; this is not a high-throughput production server.

### Seed data

A new database starts with **3 plants, 9 shops, 120 approved Kaizens, 24 deployments, 20 personas, 10 KPI definitions and 3 equipment categories**. Kaizens repeat three scenario families across cells. These fixtures are not a representative AI evaluation corpus. Existing `data/` may contain extra demonstration records; seeded histories are explicitly synthetic.

### Directory guide

```text
Ashok_Leyland/
├── README.md                 Setup and project guide
├── start-demo.cmd            Windows launcher
├── package.json              Node dependencies and commands
├── package-lock.json         Reproducible Node versions
├── app/
│   ├── server.py             HTTP server and core APIs
│   ├── collaboration.py      Evidence, revisions, tasks and related APIs
│   ├── domain.py             Scoring, KPI formulas and lifecycle definitions
│   ├── store.py              SQLite and seed data
│   ├── archive.py            Database + evidence backup/restore
│   └── backup.py             Database-only snapshot utility
├── frontend/                 React source, styles, template and build scripts
├── static/
│   ├── index.html            Generated entry page
│   ├── app.js                Required workflow source controller
│   ├── collaboration.js      Required collaboration source controller
│   └── react/                Built JS, CSS, workflow bundle and source maps
├── tests/                    API tests, React DOM tests and isolated runner
├── docs/                     API, feature, demo and verification guides
├── vendor/                   Included QR library and license metadata
├── data/                     Databases and uploaded evidence
└── node_modules/             Installed Node dependencies
```

Keep `static/react/` to run without building. Keep `static/app.js` and `static/collaboration.js`: their filenames are older, but the current build still needs them. Keep `vendor/` and its license metadata. `node_modules/` is reproducible with `npm ci` but is retained for convenient development. **Do not delete `data/` or backups as routine cleanup.**

## Search, scoring, and calculations

### Retrieval

Search normalizes text, uses a small manufacturing synonym dictionary, and ranks approved Kaizens by token cosine similarity. It returns up to 20 matches. This is an **offline fallback, not pretrained semantic embeddings or a free-form chatbot**. Duplicate suggestions support human review rather than proving equivalence.

### Recommendation weights

| Factor | Weight |
|---|---:|
| Text relevance | 30% |
| Equipment match | 20% |
| Process match | 20% |
| KPI gap | 15% |
| Historical success | 5% |
| Feasibility | 10% |

Scores are rankings, not probabilities. Feasibility uses a neutral prior; KPI-gap scoring uses synthetic scrap-rate context. Feedback is persisted but does not automatically retrain the ranking model.

### KPI formulas

```text
Higher is better: (post - baseline) / baseline × 100
Lower is better:  (baseline - post) / baseline × 100
```

Scrap changing from `4.8%` to `2.1%` gives **56.25% relative improvement** and **2.7 percentage-point absolute reduction**. Units and observation windows must match. Benchmark charts contain fixed synthetic shop observations, separate from deployment measurements.

## Media and collaboration

- Supported files: **PNG, JPEG, WebP, MP4, WebM, PDF and WebVTT**, maximum **24 MB each**.
- Files have titles, categories, uploader/date metadata, random storage names and SHA-256 hashes. API access checks parent-record permissions.
- Video uses browser-native playback, speed controls and supplied caption tracks. There is no automatic transcoding.
- Camera recording starts only after the user clicks Record and grants permission. File upload is available as a fallback.
- Photos can be compared side by side. Discussion can reference a specific attachment or video timestamp.
- Approved evidence is frozen. Draft revisions preserve original records and copy eligible evidence references.
- Translations/captions are human supplied. Transcript-to-draft assistance extracts suggestions from pasted text; it does not transcribe video audio.
- If `clamscan` is available, uploads require a clean result. Without it, uploads need explicit acknowledgement and remain **unscanned local-demo evidence**. File-type checks are not malware assurance.
- Notifications are in-app; reminders are evaluated when the queue opens. External email/SMS and background scheduling are not configured.

See [COLLABORATION.md](docs/COLLABORATION.md) for all controls and related API routes.

## Data, backup, and restore

Default database: `data/demo.sqlite3`. Evidence lives in an `evidence/` directory beside the selected database. Business records are stored server-side, not only in the browser. Browser session storage holds the selected page and demo token. Server restart invalidates in-memory sessions; the UI establishes a new demo session.

### Full backup

```powershell
python -m app.archive backup data/demo.sqlite3 backups/ci-bench-backup.zip
```

The destination must be new. Choose a different filename for each snapshot. The tool takes a SQLite snapshot and checks referenced media hashes.

### Restore into a new directory

```powershell
python -m app.archive restore backups/ci-bench-backup.zip data/restored-session
python -m app.server --db data/restored-session/demo.sqlite3 --port 8766
```

Open [the restored instance](http://127.0.0.1:8766/) and verify records and media. Restoration rejects unexpected archive paths and checks database integrity and file hashes. Archives are unencrypted local files.

### Database-only copy

```powershell
python -m app.backup data/demo.sqlite3 backups/database-only.sqlite3
```

This does **not** include uploaded files. Prefer `app.archive` for full recovery.

## Testing

### Backend

```powershell
python -m unittest discover -s tests -v
```

There are **46 tests** covering workflows, authorization, calculations, revisions, media access, notifications, tasks, observations, captions, QR generation, export and recovery. Tests create temporary databases and do not modify your live demo.

### React integration

```powershell
npm ci
npm run build
npm run test:ui
```

The runner starts its own temporary API server on a free localhost port, creates an isolated database, runs DOM checks, stops the server and cleans up. No second terminal or manual test-server setup is required.

### Everything

```powershell
npm test
```

Build first after frontend changes. Tests verify functional/DOM behavior, not screenshot fidelity, all mobile devices, camera hardware, every codec, performance targets, or production security.

## Configuration and API access

| Setting | Default | Purpose |
|---|---|---|
| `--port` | `8765` | HTTP port |
| `--db` | Project `data/demo.sqlite3` | SQLite file |
| Bind address | `127.0.0.1` | Local computer only; not a CLI option |
| `CI_PUBLIC_URL` | `http://127.0.0.1:8765` | Origin encoded in equipment QR labels |
| `clamscan` on PATH | Optional | Enables upload malware checks |

To match QR labels to a different local port:

```powershell
$env:CI_PUBLIC_URL = "http://127.0.0.1:8766"
python -m app.server --port 8766
```

This variable changes QR destinations only; it does not publish or expose the app. A phone cannot reach this computer through its own localhost address. Mobile network access requires a separate secured deployment.

### API example

Base: `http://127.0.0.1:8765/api/v1`. Health, user listing and session creation are available without a token in this local demo. Other endpoints need the issued bearer token.

```powershell
$demoSession = Invoke-RestMethod -Method Post `
  -Uri "http://127.0.0.1:8765/api/v1/session" `
  -ContentType "application/json" `
  -Body '{"user_id":5}'

$demoHeaders = @{ Authorization = "Bearer $($demoSession.token)" }

Invoke-RestMethod `
  -Uri "http://127.0.0.1:8765/api/v1/kaizens" `
  -Headers $demoHeaders
```

Read [core API routes](docs/API.md) and [collaboration routes](docs/COLLABORATION.md#added-api-routes). There is no enterprise sign-in flow in this demo.

## Troubleshooting

| Problem | Resolution |
|---|---|
| `python` not recognized | Install Python with PATH enabled, reopen the terminal, or use `py -3`. npm scripts expect `python`. |
| `No module named app` | Run from the project root, not inside `app/` or `frontend/`. |
| Port already in use | Use the running demo, stop its terminal, or choose `--port 8766`. |
| Connection refused | Start Python, keep its terminal open, and use the printed port. |
| UI changes do not appear | Rebuild, then refresh or Ctrl+F5. Restart Python after backend edits. |
| `npm` not recognized | Install Node/npm and reopen the terminal. Not needed to run included assets. |
| PowerShell blocks `npm.ps1` | Use `npm.cmd ci` / `npm.cmd run build`, or Command Prompt. No global policy change is required. |
| Missing Node modules/jsdom | Run `npm ci` from the project root. Do not edit the lockfile manually. |
| Action returns 403 | Check persona, ownership and independent-approval requirements. |
| Invalid transition | Follow the allowed next states and provide required comments/evidence. |
| KPI validation fails | Check positive baseline, unit, date span and observation window. |
| Upload rejected | Check file type/size, record status, ownership, and scan result or acknowledgement. |
| Video/camera unavailable | Try a supported browser/codec, grant permission, or upload/download the original file. |
| QR fails on a phone | Localhost points to the phone itself; use a secured reachable deployment. |
| Backup destination exists | Choose a new archive filename or restore directory. Overwrites are intentionally blocked. |

## Limitations and documentation

This demo does not provide OIDC/SSO/MFA, complete tenant isolation, TLS termination, encrypted storage, high availability or an enterprise deployment. It does not connect pretrained embeddings, automatic transcription/translation, MES/ERP ingestion, a durable message queue, or external notification delivery. Synthetic values do not establish industrial benefit, certification, or AI-quality targets.

Further guides:

- [Presenter walkthrough](docs/DEMO.md)
- [Core API reference](docs/API.md)
- [Collaboration features and APIs](docs/COLLABORATION.md)
- [Current POC coverage and remaining work](docs/COVERAGE.md)
- [Verification and cleanup record](docs/VERIFICATION.md)
