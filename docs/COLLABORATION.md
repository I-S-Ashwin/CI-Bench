# Collaboration release — 13 September 2026

## Where to find the new functions

Open a Kaizen or deployment to enter its record workspace. Tabs: **Evidence, Discussion, Tasks, Measurements, Languages, Versions**. Use **Details & approval** or **Lifecycle & sign-off** for the original governed workflow.

### Edit and revise

Owners can edit draft/returned text, manufacturing context, equipment, KPI, baseline and observation window. Approved records expose **Create draft revision** to their owner or OpEx. The original remains intact; the new record is a draft with an explicit source ID and revision number. Existing media and translations are copied as references to immutable file content. The revision follows submission, review and independent approval. Versions shows recorded snapshots, actor and timestamp. Multiple approved versions may remain searchable; this demo does not automatically retire a prior revision.

### Upload photos, videos and documents

Use **Evidence → Add photos, video or PDF** on a draft/returned Kaizen or unvalidated deployment you own. Supported types: PNG, JPEG, WebP, MP4, WebM, PDF, WebVTT. Maximum 24 MB per file. Drag-and-drop and file selection are supported. Enter title, category (Before, After, Root Cause, Implementation, Validation), description, and optional language/transcript. Upload progress, processing state, cancel, failure and retry are available.

Camera recording is initiated only by the user's Record button and browser permission; it records WebM where MediaRecorder is supported. Upload is the fallback when recording or a codec is unavailable. Recorded video stays in memory until uploaded. Closing the evidence workspace stops camera tracks.

Files are stored under the database directory's `evidence/` with random names, SHA-256 hashes, original filename, uploader and timestamps. API access checks parent-record permissions. Files are not served from the public static directory. Approved Kaizen evidence and validated/closed deployment evidence cannot be modified in place. Caption edits follow the same freeze rule.

**Scanning:** if `clamscan` is on PATH, upload must return a clean ClamAV result. Scanner errors/timeouts reject upload. This workstation currently has no configured scanner; upload therefore requires explicit acknowledgement and displays **Not scanned — local demo only**. Signature/type checks do not establish that a file is malware-free. Production should fail closed without a scanner and use isolated object storage/transcoding. Videos are original browser-supported files, not automatically transcoded. Large-scale/resumable storage is not implemented.

### Playback and comparison

Open a video for native playback, speed controls, transcript display and caption tracks. **Captions** accepts language-tagged WebVTT and transcript text; multiple languages can be added. Timestamp comments can be posted from the current playback position. Photo comparison lets the user choose any two attached images side by side. PDFs open in the browser viewer, with an original-file download alternative.

### Discussion and mentions

Start discussions, reply, attach a discussion to an evidence ID or video timestamp, mention accessible colleagues, and resolve/reopen threads. The author, record owner or OpEx can resolve. Mentions cannot disclose private drafts to colleagues lacking access. Discussion writes are unavailable to read-only roles.

### Tasks, checklists, milestones and feasibility

Owners and OpEx create tasks for existing users who can access the record. Task owners, assignees, record owners and OpEx can update task status, completion percentage, priority, due date, milestone, checklist and blockers. Checklists are editable text using `[ ]` / `[x]` marks. Tasks are not autonomous process controls.

Deployment **Update plan** captures tooling, skills, safety review, downtime, cost, feasibility, milestones, blockers and a reason for due-date changes. Updates are audited. Existing lifecycle transitions remain separate from task progress; completing a task does not approve a deployment.

### Measurements and language versions

Capture baseline/post observations with source, evidence, matching units/window and inclusive observation dates. Values must be finite, non-negative, and have a positive baseline. Date spans must match the declared day window. New measurements are provisional. A different Shop Head or OpEx user can verify them. Observation verification does not automatically close or validate a deployment.

Languages stores human-supplied translated titles/content on draft revisions. Unicode text is preserved. Captions use human-supplied language tracks. There is no automatic translation service.

### Templates, duplicate checks, collections and feedback

**Work hub** contains Quality, Safety, Maintenance, Energy and Delivery templates, team tasks and personal named collections. A Kaizen can be bookmarked into multiple collections and removed later. The capture form checks title/problem text against approved improvements while typing and on demand, showing the top three text matches. Existing offline retrieval limitations still apply.

Recommendations has **Give feedback** for Accepted, Rejected, or Needs assessment with a required reason. Feedback is persisted and audited; it does not retrain or recalibrate the ranking automatically.

**Transcript to draft** accepts an author-supplied video transcript and proposes title/problem/root/countermeasure/evidence using local sentence extraction. It does not listen to uploaded video or call an AI model. The user must verify all fields before saving. Automatic speech transcription is a remaining external/local-model integration.

### QR labels and mobile layout

**Equipment library** lists every plant/shop, matching work instructions and a downloadable SVG QR label. QR links open the equipment-filtered application. Generated locally using the vendored qrcode 8.2 package. By default they point to localhost, usable on this computer only. `CI_PUBLIC_URL` can specify a future trusted origin for the labels; it does not publish the app or open a network port. A phone requires a separately secured, reachable deployment. The local UI has responsive form, navigation and media layouts, but no offline synchronization or native mobile app.

### Notifications

The bell opens mentions, workflow updates and task events, plus review queues, due-soon reminders and overdue task escalation to OpEx. Personal preferences control mentions, updates and reminders; persisted event notifications support mark-as-read. Reminder/review entries are derived from current state and disappear when addressed. They are evaluated when the inbox is opened, not through a scheduled background worker. No email, SMS or external chat is sent.

### Export and recovery

**Evidence pack** downloads ZIP containing the selected record, its record audit snapshots, discussions, tasks, observations, translations, file metadata and original attachments. This is not a combined export of every related deployment or a certification report.

For complete database-plus-media recovery:

```powershell
python -m app.archive backup data/demo.sqlite3 backups/collaboration.zip
python -m app.archive restore backups/collaboration.zip data/restored-collaboration
python -m app.server --db data/restored-collaboration/demo.sqlite3 --port 8766
```

Destinations must be new. Restoration rejects unexpected paths and checks database integrity and media hashes. Archives are unencrypted local files. The older `app.backup` utility copies the database only; use `app.archive` for media.

## Added API routes

Prefix `/api/v1/collab/`, existing bearer session required:

| Method | Route | Capability |
|---|---|---|
| GET | workspace | Accessible records, tasks, templates, personal collections/preferences |
| GET | record?kind=kaizens&id=1 | Record, evidence, discussions, tasks, measurements, translations and snapshots |
| POST | revision | Create separate draft revision |
| POST | media | Base64 upload and metadata; 24 MB decoded limit |
| GET | file?id=1 | Authorized original media bytes |
| POST | caption | Language WebVTT track and transcript |
| POST | comment, resolve | Discussion / reply / mentions / resolution |
| POST/PATCH | task | Assignment / progress / checklist / blockers |
| POST | plan | Deployment feasibility and planning updates |
| POST | bookmark, feedback, translation | Collections / recommendation feedback / language content |
| POST | observation, verify-observation | Provisional capture / independent verification |
| GET | notifications | Event inbox and derived reminders |
| POST | preferences, read | Inbox preferences / read state |
| POST | transcript-draft | Local extractive draft suggestions |
| GET | qr?id=1 | Equipment label SVG |
| GET | pack?kind=kaizens&id=1 | Record evidence ZIP |

## Boundaries

This remains a localhost synthetic demo, with freely switchable personas rather than production identity. Automatic speech recognition, automatic translation, external notification delivery, production SSO, and secure network deployment have not been configured. Video capture/playback depends on browser device permissions and supported codecs. The implementation does not claim to satisfy the original document's full industrial security or availability requirements.
