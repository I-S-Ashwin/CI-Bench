# Local API v1

Base: `http://127.0.0.1:8765/api/v1`. JSON requests/responses. All endpoints except health, demo-users and session require `Authorization: Bearer <token>`.

| Method | Route | Purpose |
|---|---|---|
| GET | /health | Local status and schema version |
| GET | /demo-users | Available evaluation personas |
| POST | /session | `{ "user_id": 5 }` returns token and persona |
| GET | /meta | Controlled sites, equipment, KPI definitions and HD transitions |
| GET | /kaizens | Approved knowledge plus role-visible drafts |
| POST | /kaizens | Create draft: title, problem, root, change, plant, shop, equipment, kpi, baseline, evidence; optional lessons |
| PATCH | /kaizens/{id} | Owner-only draft/returned edits: title, problem, root, change, evidence, optional lessons |
| POST | /kaizens/{id}/submit | Owner submission; comment required |
| POST | /kaizens/{id}/review | Reviewer or OpEx; comment required |
| POST | /kaizens/{id}/approve | Shop Head or independent OpEx; comment required |
| POST | /kaizens/{id}/reject | Reviewed record decision; comment required |
| POST | /kaizens/{id}/return | Return reviewed record; comment required |
| GET | /search?q=...&plant=... | Top 20 approved text matches |
| GET | /recommendations/{id} | Ranked sites, factor scores, weights and model version |
| GET | /hd | Deployment records and histories |
| POST | /hd | kaizen_id, plant, shop, owner, due (ISO date) |
| PATCH | /hd/{id} | status, comment; validation: baseline, post, unit, window, evidence; closure: lessons |
| GET | /benchmark?kpi=Scrap%20Rate | Synthetic shop measurements and best benchmark |
| GET | /notifications | Active deployment work queue |
| GET | /audit | Last 500 events; Auditor or OpEx |

401 means no valid demo session, 403 role/ownership denial, 400 invalid input or transition, 404 unknown route. There is no deletion API. Record mutations and audit insertion are one transaction. Requests are serialized in this single-process demo to prevent lost transition updates. Audit includes full changed record snapshots. It is not a cryptographically immutable enterprise audit store.
