# MediKiosk FastAPI-First Pre-Development Plan

**Status:** Backend implementation underway — API testing remains user-operated through Postman  
**Primary technical source:** `MediKiosk_COMPLETE_Technology_Architecture_Deployment_Handbook.md`  
**Companion documents:** PRD/SRS (`01`), architecture (`02`), safety/data (`03`), acceptance (`04`), and demo execution (`05`).

## 1. Purpose and delivery rule

This is the authoritative implementation plan for the MediKiosk backend. The backend is built **before** patient, clinician, and triage UI integration so that the product has a stable, reviewable API and clinical-data lifecycle.

No application development starts until the planning gate in section 13 is accepted. No API is considered complete until:

1. its OpenAPI contract is updated;
2. the maintained Postman collection is updated; and
3. the user has tested that API in Postman and reported the result.

**Testing authority:** Codex/AI must not send test requests, run API test suites, or claim that an endpoint works. The user performs all API verification in Postman. This plan does not prohibit the team from adding automated tests later, but they must not be run without explicit user permission.

## 2. Product boundary

MediKiosk collects and organizes pre-consultation history. It creates clinician-reviewable structured facts, safety alerts, document evidence, and draft summaries. It never diagnoses, prescribes, or turns an AI output into verified clinical truth.

The first implementation target is a **touch-only, no-AI vertical slice**:

`consent → encounter → controlled intake → normalized facts → deterministic red flag → clinician review`

Speech, OCR, LLM summarisation, AYUSH extensions, and FHIR export are later adapters around this trusted core.

## 3. Fixed architecture decisions

| Decision | Plan |
| --- | --- |
| Backend style | One FastAPI modular monolith, one deployable API, one PostgreSQL database. |
| API prefix | `/api/v1`; no unversioned business endpoints. |
| Data ownership | PostgreSQL owns structured clinical data and audit events; object storage owns uploaded binary files only. |
| Clinical workflow | Versioned, clinician-reviewed configuration drives questions and required fields. |
| Safety | Deterministic red-flag rules run server-side after every normalized response; an LLM cannot suppress them. |
| AI | Adapter-only; structured output is validated before persistence; all providers have a fallback. |
| Authentication | Kiosk encounter capability/session is separate from staff login and RBAC. |
| Interoperability | Map internal verified data to FHIR at the boundary; do not make the database a FHIR mirror. |
| Async work | In-process background task only for the first vertical slice; introduce a durable worker only when document/AI work needs retry and visibility. |
| Demo data | Synthetic patients/documents only; no production health data. |

## 4. Backend scope and release slices

| Slice | Backend deliverable | Explicitly excluded until the slice is accepted |
| --- | --- | --- |
| B0 — foundation | FastAPI app, config validation, health/readiness endpoints, database migrations, request ID, error envelope | Auth, clinical records, UI |
| B1 — identity and consent | Staff RBAC, kiosk encounter session, patient/encounter creation, consent receipt, audit records | Speech, AI, documents |
| B2 — controlled intake | Versioned pathway loader, next-question selection, response validation, clinical facts, completion checks | Free-form chatbot behavior |
| B3 — safety and review | Server-side rules, explainable red flags, triage queue, acknowledgement, clinician review state | Diagnosis/treatment recommendations |
| B4 — documents | Upload validation, object storage abstraction, processing state, evidence references, local fixture fallback | Treating OCR extraction as verified truth |
| B5 — summaries and AI | Schema-validated extraction/summarisation adapters, template fallback, physician edit/verify | Unbounded prompts or autonomous decisions |
| B6 — AYUSH and FHIR | AYUSH pathway/data extensions, FHIR mapper, local validation/export | Claiming live ABDM production integration |
| B7 — hardening | backup/restore runbook, Docker deployment, observability, rate limits, retention cleanup | Premature microservices/Kubernetes |

The next slice cannot start until the user accepts the prior slice through the Postman gate in section 10.

## 5. Proposed FastAPI application shape

```text
backend/
├── app/
│   ├── main.py                 # app factory, router registration, middleware
│   ├── core/                   # settings, database, errors, logging, security
│   ├── api/v1/                 # thin HTTP routers and request/response schemas
│   ├── auth/                   # staff identity, roles, kiosk session capability
│   ├── patients/               # minimal patient identity
│   ├── encounters/             # encounter lifecycle and access checks
│   ├── consent/                # versioned consent receipts
│   ├── intake/                 # pathway engine and response commands
│   ├── clinical/               # facts, evidence, verification state
│   ├── red_flags/              # deterministic rules and triage operations
│   ├── documents/              # uploads, storage references, processing lifecycle
│   ├── summaries/              # draft/physician review lifecycle
│   ├── integrations/           # speech, OCR, LLM, FHIR provider adapters
│   ├── audit/                  # append-only audit writer
│   └── jobs/                   # durable job boundary when introduced
├── migrations/                 # Alembic migrations
├── clinical_config/            # pathways, rules, AYUSH definitions, all versioned
├── tests/                      # added later; not executed without user approval
├── pyproject.toml
└── Dockerfile
```

Routers contain HTTP concerns only. Business services own state transitions. Repositories own database queries. Provider adapters never write clinical records directly.

## 6. Core model and lifecycle

### Encounter state machine

```text
DRAFT → IN_PROGRESS → SUBMITTED → IN_REVIEW → VERIFIED
                    └→ URGENT_REVIEW ───────────────┘
Any non-final state → CANCELLED
```

- `DRAFT`: encounter created, consent not yet complete.
- `IN_PROGRESS`: required consent exists and intake may proceed.
- `URGENT_REVIEW`: one or more active red flags; intake may be limited by rule configuration and triage is visible.
- `SUBMITTED`: patient completes required intake and recap.
- `IN_REVIEW`: clinician opens/reviews the case.
- `VERIFIED`: clinician accepts the final summary; only verified material is eligible for default FHIR export.

All transitions are validated on the server, audited, and return a conflict response when the current state does not permit the action.

### Minimum persistent records

| Record | Required implementation rule |
| --- | --- |
| `patients` | Minimal identity; synthetic reference permitted in demo mode. |
| `encounters` | Status, pathway version, patient link, timestamps, mode, concurrency/version field. |
| `consents` | Consent type/version/language/granted/revoked timestamps; never overwrite a receipt. |
| `patient_responses` | Raw answer, input mode, question key, language, normalized value, actor/source. |
| `clinical_facts` | Typed value, source pointer/excerpt, confidence if applicable, verification status. |
| `red_flags` | Rule/version, severity, evidence fact IDs, active and acknowledgement state. |
| `documents` / `document_extractions` | Metadata/blob reference is separate from OCR/extraction output. |
| `summaries` / `physician_revisions` | Immutable generated versions plus field-level review history. |
| `audit_events` | Append-only actor/action/resource/request ID/timestamp/metadata. |
| `fhir_exports` | Versioned bundle, validation result, actor, timestamp. |

Use UUID primary keys, UTC timestamps, foreign keys, database constraints, and Alembic migrations. Clinical fact values may use JSONB, but searchable identity/status/date columns stay relational and indexed.

## 7. API contract rules

- FastAPI-generated OpenAPI is the API contract; every released endpoint has request/response models and examples.
- JSON uses `snake_case`; timestamps are ISO-8601 UTC; IDs are UUIDs; pagination uses a cursor or documented limit/offset consistently.
- Successful writes return the current server representation and `ETag`/version where a concurrent update matters.
- Idempotency receipts for create/upload/export are a hardening item before any shared or unreliable-network deployment; the initial local MVP has no idempotency store and must not claim retry safety.
- Every request receives an `X-Request-ID`; errors return it for support/audit correlation.
- Standard error shape: `{"error":{"code":"...","message":"...","details":[]},"request_id":"..."}`. Never return stack traces or clinical data in unexpected errors.
- HTTP status semantics are fixed: `400` invalid input, `401` unauthenticated, `403` unauthorized, `404` not found/not visible, `409` invalid state or version conflict, `422` schema validation, `429` rate limit, `503` unavailable dependency.
- A patient/kiosk session can access only its encounter. Staff endpoints require a role; triage and physician operations cannot be reached from the kiosk capability.

## 8. Canonical endpoint backlog

These are contracts to implement in order, not endpoints that exist today.

| Slice | Method and path | Purpose | User Postman gate |
| --- | --- | --- | --- |
| B0 | `GET /health` | Process liveness only; no external calls | H-01 |
| B0 | `GET /ready` | Database/migration readiness | H-02 |
| B1 | `POST /api/v1/auth/login` | Staff authentication | A-01 |
| B1 | `POST /api/v1/auth/logout` | Invalidate staff session | A-02 |
| B1 | `GET /api/v1/auth/me` | Current staff identity/roles | A-03 |
| B1 | `POST /api/v1/admin/users` | Admin-only staff-role provisioning | A-04 |
| B1 | `POST /api/v1/encounters` | Create encounter and kiosk session | E-01 |
| B1 | `GET /api/v1/encounters/{encounter_id}` | Read permitted encounter | E-02 |
| B1 | `POST /api/v1/encounters/{encounter_id}/consents` | Record versioned consent | C-01 |
| B1 | `GET /api/v1/encounters/{encounter_id}/consents` | Read current/history of consent | C-02 |
| B1 | `POST /api/v1/encounters/{encounter_id}/consents/{consent_id}/revocations` | Revoke a consent receipt without deleting its record | C-03 |
| B2 | `GET /api/v1/encounters/{encounter_id}/intake/next-question` | Controlled next question | I-01 |
| B2 | `POST /api/v1/encounters/{encounter_id}/intake/responses` | Validate/save response and evaluate rules | I-02 |
| B2 | `GET /api/v1/encounters/{encounter_id}/facts` | Facts with evidence/verification status | I-03 |
| B2 | `POST /api/v1/encounters/{encounter_id}/submit` | Complete only if rules/required fields permit | I-04 |
| B3 | `GET /api/v1/triage/queue` | Staff triage list | T-01 |
| B3 | `POST /api/v1/red-flags/{red_flag_id}/acknowledgements` | Record acknowledgement, never erase rule result | T-02 |
| B3 | `GET /api/v1/clinician/encounters/{encounter_id}` | Clinician case/review view | R-01 |
| B4 | `POST /api/v1/encounters/{encounter_id}/documents` | Validate/initiate document upload | D-01 |
| B4 | `GET /api/v1/encounters/{encounter_id}/documents` | Document metadata/status | D-02 |
| B4 | `GET /api/v1/documents/{document_id}` | Authorized document metadata/evidence link | D-03 |
| B5 | `POST /api/v1/encounters/{encounter_id}/summary/generations` | Create tracked summary generation | S-01 |
| B5 | `GET /api/v1/encounters/{encounter_id}/summary` | Read latest applicable draft | S-02 |
| B5 | `PATCH /api/v1/encounters/{encounter_id}/summary` | Clinician edit with version conflict protection | S-03 |
| B5 | `POST /api/v1/encounters/{encounter_id}/summary/verifications` | Explicit clinician acceptance/rejection | S-04 |
| B6 | `POST /api/v1/encounters/{encounter_id}/fhir/exports` | Build and locally validate export | F-01 |
| B6 | `GET /api/v1/encounters/{encounter_id}/fhir/exports/{export_id}` | Retrieve validation/report | F-02 |

## 9. Clinical, AI, and document safeguards

1. Pathways and red-flag rules are versioned configuration reviewed by the clinical owner. A response stores the version that governed it.
2. Every red flag stores the exact triggering fact IDs and rule ID/version. Acknowledgement is a separate event, not deletion or downgrade.
3. Only server-normalized facts may enter a summary generation payload. Raw transcripts/documents are evidence, not permission to invent facts.
4. AI/OCR output must validate against a Pydantic schema before storage. Invalid provider output becomes a processing failure with a fallback; it never becomes a partially trusted fact.
5. Verification state is explicit: `unverified`, `patient_confirmed`, `clinician_verified`, or `rejected`. No adapter may write `clinician_verified`.
6. Files are size/type checked, malware-scanned if available, private by default, and served only through short-lived authorised access. Persist a storage key, not a public URL.
7. Demo fallback is part of the adapter contract: touch intake, template summary, and seeded document results remain available when a provider fails.

## 10. Required Postman maintenance and user test gate

`postman/MediKiosk.postman_collection.json` is a repository artifact, not a one-time export. It is deliberately created before the backend so the contract and manual test sequence evolve together.

For every endpoint change, the developer must update all of the following in the same change:

1. FastAPI request/response model and OpenAPI description;
2. a Postman request in the correct collection folder;
3. variables, example payloads, authorization headers, and expected outcome in that request description;
4. `04_MediKiosk_Testing_and_Acceptance_Strategy.md` if the acceptance condition changed.

### Mandatory manual verification protocol

1. The developer announces the completed API slice and provides the updated collection.
2. The user imports/updates the collection in Postman, sets `base_url` and approved credentials/tokens, and executes every request in the slice in order.
3. The user records each request ID, HTTP status, response/result, and any defect in a Postman run/export or shared checklist.
4. The user explicitly accepts the slice or reports a defect.
5. Only accepted slices are eligible for frontend integration or the next backend slice.

Codex will prepare requests and diagnose user-provided results, but will not execute the collection, issue requests, simulate results, or declare test success.

## 11. Delivery milestones and exit criteria

| Milestone | Work to complete | User must verify in Postman before moving on |
| --- | --- | --- |
| M0 — architecture baseline | Confirm this plan, role matrix, data retention, first pathways/rules, environment choices | Plan sign-off; no API call yet |
| M1 — foundation | App boots, migration workflow documented, health/readiness contract and error envelope defined | H-01, H-02 |
| M2 — consented encounter | Staff auth/RBAC, encounter, consent, audit, access boundaries | A-01–A-03, E-01–E-02, C-01–C-02 plus denied access cases |
| M3 — controlled intake | Pathway versioning, response/fact persistence, required field enforcement, submit transition | I-01–I-04 |
| M4 — safety/review | Deterministic rule engine, evidence-backed triage, acknowledgement, clinician retrieval | T-01–T-02, R-01; positive and negative rule fixtures |
| M5 — documents | Secure upload lifecycle and evidence metadata, degraded fixture behavior | D-01–D-03 |
| M6 — summary | Controlled generation lifecycle, template fallback, edit/verification/audit | S-01–S-04 |
| M7 — interop/hardening | FHIR mapping/local validation, deploy/backup/observability docs | F-01–F-02 plus manual recovery runbook |

## 12. Work ownership and sequencing

| Owner | Must provide before related backend work starts |
| --- | --- |
| Product/clinical | Approved P0 pathways, all required fields, rule wording/evidence, positive/negative synthetic cases, AYUSH data fields. |
| Backend | Database migration plan, endpoint schemas, authorisation matrix, Postman collection update, audit events. |
| AI/document | Provider contracts, Pydantic schemas, confidence/verification policy, fixture fallback. |
| DevOps | Environment inventory, secret injection approach, private database/storage topology, backup/restore runbook. |
| User/test owner | Postman environment values, all manual API results, acceptance/rejection decision per slice. |

Frontend work can begin against mock/OpenAPI responses after M1, but it must not drive unreviewed changes to the backend contract. Live frontend integration starts after M3 is accepted.

## 13. Pre-development approval checklist

Development remains paused until the following are answered or explicitly approved:

- [ ] Confirm the first P0 complaint pathway (recommended: chest discomfort) and clinician-reviewed red-flag wording/rules.
- [ ] Confirm the exact staff roles for MVP (`admin`, `triage`, `physician`) and who can create/edit/verify/export.
- [ ] Confirm kiosk identity strategy for the demo (anonymous synthetic patient, token/QR, or assisted staff start).
- [ ] Confirm consent text, languages, version, and retention/deletion expectation for the demo.
- [ ] Confirm local-only versus VPS-first development environment and object-storage choice.
- [ ] Confirm external services that are truly available versus mocks (speech, OCR, LLM, FHIR validator/ABDM sandbox).
- [ ] Confirm the user will be the Postman test owner and provide a safe test base URL/credentials only when M1 is ready.
- [ ] Approve the endpoint order and the rule that a slice cannot advance without user Postman sign-off.

## 14. Risks that must stay visible

| Risk | Control |
| --- | --- |
| Clinical rule is unreviewed | Do not ship/enable it; use a labelled synthetic demo rule only with approval. |
| API contract drifts from UI | OpenAPI and Postman collection update are mandatory in the same change. |
| User cannot reproduce a result | Record Postman variables (excluding secrets), request ID, collection version, and response. |
| External provider outage | Adapter fallback is mandatory before a provider-dependent feature is demo-ready. |
| Sensitive data leak | Synthetic fixtures, least privilege, redacted logs, private storage, no secrets in collection export. |
| Scope growth | B0–B3 are the critical path; later slices only begin after the previous user gate passes. |

## 15. Next action

The next action is **approval of this planning baseline**, not coding. After approval, work begins only with M1 and its matching Postman collection requests. At the end of M1, the user is asked to test H-01 and H-02 in Postman before further backend development.
