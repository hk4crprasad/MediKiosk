# MediKiosk Delivery Task Tracker

**Last updated:** 2026-08-27  
**Delivery mode:** FastAPI backend first; user-operated Postman verification  
**Rules:** Codex does not execute API requests or claim API test results. A task is accepted only after user Postman confirmation.

## Current delivery state

| Done | Area | State | User acceptance | Evidence |
| --- | --- | --- | --- | --- |
| [X] | Product/architecture/safety plans | Baseline approved | Not an API gate | `PRD/README.md` and documents `00`–`05` |
| [X] | B0 — Foundation | Implemented | User reports tested | H-01, H-02 |
| [X] | B1 — Auth, encounter, consent, RBAC | Implemented | User reports tested | A-01–A-04, E-01–E-02, C-01–C-03 |
| [X] | B2 — Controlled intake and clinical facts | Accepted | User reports pass | I-01–I-04 |
| [X] | B3 — Safety/triage/clinician review | Accepted | User approved continuation | T-01–T-02, R-01 |
| [ ] | B4 — Azure Blob documents | Azure configured; user acceptance pending | Pending | D-01–D-04 |
| [ ] | B5 — Summary/physician verification | GPT-5.6 Luna configuration reported; user acceptance pending | Pending | S-01–S-04 |
| [ ] | B6 — Local FHIR export | Scaffolded; not accepted | Pending | F-01–F-02 |

**Meaning of `scaffolded`:** endpoint code exists but it has not passed its slice’s user-operated Postman acceptance gate and must not be described as complete.

## Active task — B2 Controlled Intake

| Done | ID | Task | Owner | Status | Done when |
| --- | --- | --- | --- | --- | --- |
| [X] | B2-01 | Confirm pathway configuration is server-controlled and versioned | Backend | Accepted | `chest-discomfort-v1` only returns valid configured questions |
| [X] | B2-02 | Enforce consent and encounter-state checks before answers | Backend | Accepted | Missing/revoked consent is rejected; final/cancelled encounter rejects responses |
| [X] | B2-03 | Persist patient responses and evidence-linked clinical facts | Backend | Accepted | Each accepted answer creates traceable response/fact records |
| [X] | B2-04 | Enforce required fields before submission | Backend | Accepted | Submit reports required missing fields and succeeds only after completion |
| [X] | B2-05 | Complete B2 Postman requests and test instructions | Backend | Accepted | Collection covers every configured question, invalid/forbidden paths, and submit flow |
| [X] | B2-06 | User acceptance gate | User | Pass | User ran I-01–I-04 |

## B2 user test checklist — Postman

- [ ] I-01 rejects a request before consent, then returns `chief_complaint` after active consent.
- [ ] I-02 accepts only the currently available question and stores a response/fact source.
- [ ] I-02 rejects an out-of-order or unknown question without adding data.
- [ ] I-03 lists facts with value, source, and verification state.
- [ ] I-04 returns the required-missing response before all mandatory fields are answered.
- [ ] I-04 succeeds after all required questions in the active pathway are answered.
- [ ] Every response has `X-Request-ID`; no response reveals unrelated encounter data.

## Active task — B3 Safety, Triage, and Clinician Review

| Done | ID | Task | Owner | Status | Done when |
| --- | --- | --- | --- | --- | --- |
| [X] | B3-01 | Run the clinician-approved deterministic chest-discomfort/breathlessness rule after normalized response persistence | Backend | Accepted | Positive fixture enters `URGENT_REVIEW`; non-diagnostic reason and rule version are recorded |
| [X] | B3-02 | Preserve triggering fact IDs as alert evidence | Backend | Accepted | Triage and clinician views show the fact IDs that caused the alert |
| [X] | B3-03 | Provide staff-only triage queue and acknowledgement | Backend | Accepted | Acknowledgement records actor/time/note and never deletes/downgrades the rule result |
| [X] | B3-04 | Provide staff-only clinician encounter review | Backend | Accepted | Clinician view returns encounter, facts, flags, documents, and summary while kiosk access is denied |
| [X] | B3-05 | User acceptance gate | User | Pass | User approved continuation |

## B3 user test checklist — Postman

- [ ] Positive fixture: `chief_complaint=chest_discomfort` and `breathlessness=yes` makes the encounter `URGENT_REVIEW`.
- [ ] T-01 returns one active alert with the reviewed rule ID, urgent severity, evidence fact IDs, and no diagnosis wording.
- [ ] Negative fixture: a fresh encounter with `breathlessness=no` does not create this rule’s alert.
- [ ] T-02 writes acknowledgement actor/time and preserves the underlying rule/evidence.
- [ ] R-01 returns the clinician view for staff, while the kiosk token is denied.
- [ ] A patient/kiosk caller cannot access the triage queue or acknowledge an alert.

## Active task — B4 Secure Document Evidence

| Done | ID | Task | Owner | Status | Done when |
| --- | --- | --- | --- | --- | --- |
| [X] | B4-01 | Require active consent and encounter-scoped access for document operations | Backend | Implemented; pending user verification | Missing/revoked consent and unrelated kiosk session are denied |
| [X] | B4-02 | Validate synthetic document type, size, and magic signature | Backend | Implemented; pending user verification | Only valid PDF/JPEG/PNG files and approved document types persist |
| [X] | B4-03 | Persist a private Azure Blob key and document metadata | Backend | Implemented; Azure configuration and user verification pending | API returns no filesystem path/public Azure URL |
| [X] | B4-04 | Stream source evidence from private Azure Blob storage after authorisation | Backend | Implemented; Azure configuration and user verification pending | D-04 opens/downloads only the current encounter’s original synthetic file |
| [X] | B4-05 | Configure Azure Blob Storage | User/DevOps | Reported configured | Private container exists and `backend/.env` has a valid connection string; no secret is committed |
| [ ] | B4-06 | User acceptance gate | User | Pending | User runs D-01–D-04 and negative access/content tests against Azure Blob Storage |
| [ ] | B4-07 | Re-upload or migrate any prior local development documents | User/DevOps | Pending if documents already exist | Existing records point to the retired local adapter and are not treated as Azure-backed evidence |

## B5 preparation — OpenAI-Compatible Generation

| Done | ID | Task | Owner | Status | Done when |
| --- | --- | --- | --- | --- | --- |
| [X] | B5-01 | Configure OpenAI-compatible base URL and key for `gpt-5.6-luna` | User/DevOps | Reported configured | `LLM_BASE_URL` and `LLM_API_KEY` exist only in `backend/.env`; model remains `gpt-5.6-luna` |
| [X] | B5-02 | Generate strict JSON clinician draft from saved facts | Backend | Implemented; pending user verification | Provider response is schema-valid JSON and source/prompt version are recorded |
| [X] | B5-03 | Preserve deterministic fallback | Backend | Implemented; pending user verification | Missing/failed provider produces `template` or `template_fallback`, not an API crash |
| [X] | B5-04 | Physician edit and explicit verification | Backend | Implemented; pending user verification | S-03/S-04 create revision/audit and mark only accepted material verified |
| [ ] | B5-05 | User acceptance gate | User | Pending | User runs S-01–S-04 with configured provider and fallback scenario |
| [X] | B5-06 | Preserve GPT-5.6 Luna parameter compatibility | Backend | Implemented; pending user verification | SDK call sends neither `temperature` nor `max_tokens` |

## B4 user test checklist — Postman

- [ ] D-01 accepts one valid synthetic PDF/JPEG/PNG with active consent.
- [ ] D-01 rejects no consent, revoked consent, unsupported type, oversize file, and MIME/signature mismatch.
- [ ] D-02 lists only the target encounter’s metadata and no physical storage path.
- [ ] D-03 returns metadata only when authorised.
- [ ] D-04 opens/downloads the original synthetic file with correct content type when authorised.
- [ ] A kiosk token for another encounter is denied for D-03/D-04.

## Backlog after B4 acceptance

| Done | Priority | ID | Task | Acceptance gate |
| --- | --- | --- | --- | --- |
| [X] | P0 | B3-01 | Deterministic red-flag rule, evidence, triage queue, acknowledgement | T-01, T-02, R-01 |
| [ ] | P0 | B4-01 | Secure document lifecycle: synthetic upload, scoped metadata, storage failure behavior | D-01–D-04 |
| [ ] | P0 | B5-01 | Structured/template summary, physician edits and explicit verification | S-01–S-04 |
| [ ] | P1 | B6-01 | Clinician-verified fact mapping and local FHIR validation/export | F-01–F-02 |
| [ ] | P1 | AYU-01 | AYUSH-specific versioned intake pathway and clinical facts | New Postman folder and user gate required |
| [ ] | P1 | INT-01 | Speech/OCR/LLM adapter contracts plus safe mock/fallback behavior | New Postman folder and user gate required |
| [ ] | P1 | OPS-01 | Alembic migrations, private object storage, rate limiting, token cleanup | Deployment review |
| [ ] | P1 | OPS-02 | VPS, Nginx, HTTPS, backup/restore, monitoring | Deployment review |

## Decisions and blockers

| ID | Decision / blocker | Owner | State |
| --- | --- | --- | --- |
| D-01 | Initial complaint pathway is `chest-discomfort-v1` | Product/clinical | Active MVP default |
| D-02 | Only user-run Postman tests are accepted as API evidence | User | Active |
| D-03 | Synthetic demo data only | All | Active |
| D-04 | Azure Blob Storage selected for document binaries; connection string and private container configuration are required before B4 testing | User/DevOps | Open |
| D-05 | No provider credentials/clinical policy for live speech, OCR, LLM, or ABDM sandbox have been supplied | User/Product | Open |

## Acceptance history

| Date | Slice | Result | Reported by | Notes |
| --- | --- | --- | --- | --- |
| 2026-08-27 | B0/B1 | User reports tested | User | Detailed Postman export/status log has not yet been attached. |
| 2026-08-27 | B2 | Pass | User | User reported pass; advance approved. |
| 2026-08-27 | B3 | Pass | User | User approved continuation. |
| 2026-08-27 | Azure Blob / GPT-5.6 Luna configuration | Reported configured | User | Server secrets remain outside the repository and Postman. |

## Update protocol

When reporting a test result, add: task/gate ID, Postman request name, HTTP status, `X-Request-ID`, pass/fail, and a concise observation. When a requirement changes, add its PRD reference and update its Postman request before implementation.
