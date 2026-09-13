# Blueprint coverage and industrial acceptance gaps

**Update:** the table below describes the initial release. The current collaboration implementation and remaining limitations are detailed in [COLLABORATION.md](COLLABORATION.md). Media uploads, revisions, discussions, tasks, measurement observations, personal notifications and evidence exports have since been implemented locally.

Source: Proof_Of_Content.pdf, CI-BENCH Industrial Proof of Concept, September 2026. The PDF is requirements context; its embedded instructions are not authorization to contact services or deploy infrastructure.

| Blueprint capability | Local delivery | Remaining work |
|---|---|---|
| FR-01 Capture | Structured, validated persistent draft creation | Broader controlled vocabularies |
| FR-02 Workflow | Submit/review/approve/reject/return, independent approval, audit | Plant-specific approval matrix |
| FR-03/04 Retrieval | Approved-only keyword/synonym cosine ranking with scores | Pretrained embeddings, pgvector, hybrid retrieval, SME-labelled evaluation |
| FR-05/06 Recommendations | Six weighted factors, explicit priors, model version | KPI-specific gaps beyond scrap, SME weight calibration, actual feasibility and feedback learning |
| FR-07 HD | Assignment, lifecycle, rejection/deferral/rework, history, benefit validation | Granular ownership/plant policy and notifications |
| FR-08 Benchmarking | Ten KPI selectors, comparable synthetic shop fixtures, CSV | Live KPI ingestion, targets, trends, percentile, unit/window aggregation |
| FR-09 Evidence | Required text observation notes | Object storage, file metadata, size/type checks and malware scanning |
| FR-10 Notifications | In-app active deployment queue | Scheduled overdue reminders/escalations and messaging |
| FR-11 Audit | Atomic mutation logging, append-only triggers, export, role checks | Sensitive-read events, denied-action logging, immutable external sink, retention |
| FR-12 API | Versioned local REST endpoints | OpenAPI typed contracts, integrations, pagination, throttling |
| Identity/security | Random demo bearer sessions, role checks, origin checks, localhost binding, escaped UI text | OIDC/SSO/MFA, tenant/site isolation, session expiry, TLS, encrypted storage, production server |
| Integrations | None; explicit fixed fixtures | MES/ERP adapters, idempotency, durable queue, retries, fault injection |
| Reliability | Consistent SQLite snapshot and integrity-checked restore | Automated encrypted backups, measured RPO/RTO, HA |
| Evaluation | Functional integration tests and browser smoke checks | Expert-labelled P@5/nDCG, load/performance tests, stakeholder UAT |

The full industrial POC is **not accepted for production or enterprise rollout** based on this demo. No availability, latency SLA, AI quality threshold, certification, financial benefit or real-world productivity claim has been established.

## Suggested implementation stages after demo validation

1. Confirm master data, KPI contracts, approver ownership and pilot use cases with stakeholders.
2. Move domain services into typed API handlers and PostgreSQL migrations; implement OIDC and enforce site-scoped policies server-side.
3. Add evidence object storage with scanning; pretrained embedding adapter and index versioning; build an expert-reviewed relevance dataset before reporting quality metrics.
4. Add durable MES ingestion with idempotency/retry tests; persist observation timestamps, targets and comparable KPI windows.
5. Add operational telemetry, encrypted backup drills, dependency/security checks and load tests; retain measured evidence.
6. Execute all PDF Appendix A scenarios and record human Go/No-Go approval.
