Technical Architecture & System Design

Lean architecture for a reliable hackathon prototype — modular monolith first, replaceable adapters at the edges

**Implementation governance:** FastAPI is the first build target. The canonical delivery order, endpoint contract rules, and Postman/user-testing gate are in `00_MediKiosk_Pre_Development_FastAPI_Plan.md`. This document defines architecture; it does not authorize implementation before that plan is approved.

**Design principle:** Build the smallest trustworthy end-to-end clinical intake flow that proves the problem statement. Prefer clear workflows over extra infrastructure.

# 1\. Architecture goals

- Deliver one reliable vertical slice rather than many independently deployed services.
- Keep clinical rules explicit and testable; use AI inside bounded tasks.
- Make every external dependency replaceable through adapters.
- Preserve source and confidence for extracted clinical facts.
- Fail safely: touch mode must continue if voice or generative AI fails.

# 2\. Lean system shape

**Recommended topology:** Two web interfaces + one backend application + one background worker + PostgreSQL. Redis/object storage are optional helpers, not architectural requirements.

| **Component**      | **Responsibility**                                                  | **Hackathon implementation**            |
| ------------------ | ------------------------------------------------------------------- | --------------------------------------- |
| Patient PWA        | Language, consent, voice/touch interview, scan/upload, confirmation | Next.js/React                           |
| Doctor/Triage Web  | Summary, evidence, flags, timeline, edit/accept                     | Next.js/React                           |
| Backend API        | Auth/session, workflow, facts, documents, summary, audit, adapters  | FastAPI modular monolith                |
| AI/Document Worker | ASR calls, OCR, extraction, summary tasks                           | Python worker or in-process async job   |
| Database           | Encounter, facts, consent, audit, configuration                     | PostgreSQL                              |
| Object store       | Document images/audio only when required                            | MinIO/S3-compatible; local dev fallback |
| External adapters  | Bhashini/ASR, OCR, LLM, HIS/FHIR/ABDM                               | Small interface modules with mocks      |

# 3\. Context diagram

Patient / Caregiver → MediKiosk → Doctor / Triage  
↓  
ASR • OCR • LLM adapters  
↓  
HIS / FHIR / ABDM

# 4\. Backend modules inside the monolith

| **Module**            | **What it owns**                                             | **Does not own**           |
| --------------------- | ------------------------------------------------------------ | -------------------------- |
| Session & Consent     | Session state, consent receipt, kiosk logout                 | Clinical interpretation    |
| Clinical Workflow     | Question pathways, required fields, interview state          | Free-form diagnosis        |
| Safety Rules          | Clinician-approved red-flag rules                            | Autonomous treatment       |
| Document Intelligence | Quality checks, OCR, extraction, source links                | Final clinical truth       |
| Clinical Facts        | Normalized facts + source + confidence + verification status | Raw UI rendering           |
| Summary               | Template-bound draft from structured facts                   | Creating unsupported facts |
| Physician Review      | Edits, accept/reject, audit                                  | Patient-side questioning   |
| Interoperability      | FHIR mapping/validation and HIS/ABDM adapters                | Internal business logic    |

# 5\. Main data flow

1. Patient starts an encounter and consent state is recorded.
2. Workflow engine selects the next required question from a clinical pathway.
3. Voice adapter turns speech into text; touch responses bypass speech entirely.
4. Extraction converts responses into schema-valid clinical facts.
5. Safety rules evaluate normalized facts and can raise urgent-review flags.
6. Document worker processes scans and creates extracted facts with source references/confidence.
7. Summary engine receives structured facts only and fills a controlled clinical-summary template.
8. Physician edits/accepts; edits are stored as verified facts or review events.
9. Interoperability adapter transforms verified records to FHIR for validation/export.

# 6\. Core data model

| **Entity**      | **Purpose**                            | **Key fields**                                          |
| --------------- | -------------------------------------- | ------------------------------------------------------- |
| Encounter       | One intake/consultation episode        | encounter_id, patient_ref, status, department           |
| Consent         | Why and what was permitted             | purpose, scopes, status, timestamp                      |
| Response        | Raw patient/caregiver response         | question_id, text/value, response_source                |
| ClinicalFact    | Normalized reusable fact               | type, value, source_id, confidence, verification_status |
| RedFlag         | Safety alert                           | rule_id, severity, evidence_fact_ids, status            |
| Document        | Uploaded/scanned record                | type, date, object_ref, processing_status               |
| ExtractedEntity | OCR/document fact before verification  | entity_type, value, source_bbox, confidence             |
| ClinicalSummary | Generated and physician-reviewed draft | version, sections, status                               |
| AuditEvent      | Important access/change event          | actor, action, resource, timestamp                      |
| FHIRExport      | Generated interoperability artifact    | profile/version, validation_status, payload_ref         |

# 7\. API surface — enough for the MVP

| **Method / path**                        | **Purpose**                                |
| ---------------------------------------- | ------------------------------------------ |
| POST /encounters                         | Start intake session                       |
| POST /encounters/{id}/consent            | Record consent                             |
| GET /encounters/{id}/next-question       | Return controlled next question            |
| POST /encounters/{id}/responses          | Submit touch/transcribed response          |
| POST /encounters/{id}/documents          | Upload document                            |
| GET /encounters/{id}/status              | Processing + red-flag state                |
| POST /encounters/{id}/finalize           | Generate patient recap and physician draft |
| GET /doctor/encounters/{id}              | Doctor summary/evidence/timeline           |
| PATCH /doctor/encounters/{id}/summary    | Save physician edits/decision              |
| POST /doctor/encounters/{id}/fhir-export | Generate + validate FHIR output            |

# 8\. External-service adapters

**Why adapters matter:** Hackathon internet/API access is unpredictable. Each external service should have a small interface plus a local mock so the demo can still run.

| **Adapter** | **Interface example**       | **Fallback**                                     |
| ----------- | --------------------------- | ------------------------------------------------ |
| Speech      | transcribe(audio, language) | Manual/touch response or prerecorded transcript  |
| TTS         | speak(text, language)       | On-screen text                                   |
| OCR         | extract(document)           | Precomputed fixture extraction for demo recovery |
| LLM         | extract_json / summarize    | Rule/template-only fallback                      |
| FHIR/ABDM   | map_and_validate(record)    | Generate local FHIR bundle + validation report   |

# 9\. Security and privacy by design

- Use HTTPS/TLS; store credentials in environment/secret storage, never source code.
- Separate patient/kiosk session from doctor accounts; apply role-based permissions.
- Auto-lock/log out kiosk after submission or inactivity; clear local state before the next patient.
- Store the minimum data necessary for the demo; use synthetic patients and documents.
- Audit consent, doctor edits, exports, and privileged access.
- Do not retain raw voice by default after transcription unless the demo explicitly needs it and consent covers it.

# 10\. Deployment plan

| **Environment**  | **Recommended shape**                                                                                                         |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Developer laptop | Docker Compose: frontend(s), API, PostgreSQL; optional worker/MinIO.                                                          |
| Hackathon LAN    | One server laptop/VM hosts API/database; kiosk and doctor devices access over local network.                                  |
| Demo backup      | Single-machine mode with prerecorded/synthetic fixtures; no external service is allowed to be a single point of demo failure. |

# 11\. Architecture decisions (short ADR log)

| **ADR** | **Decision**                                             | **Reason**                                                           |
| ------- | -------------------------------------------------------- | -------------------------------------------------------------------- |
| ADR-01  | Modular monolith, not microservices                      | Faster development, easier debugging, still keeps module boundaries. |
| ADR-02  | Clinical workflow controls required questions            | Predictable coverage and testing.                                    |
| ADR-03  | LLM output must match JSON schemas                       | Reduces uncontrolled free text and makes failures detectable.        |
| ADR-04  | Deterministic red-flag rules cannot be downgraded by LLM | Safety-critical behavior must be predictable.                        |
| ADR-05  | Internal model first; FHIR at adapter boundary           | Avoids coupling the whole app to interoperability details.           |
| ADR-06  | Store source + confidence with AI-derived facts          | Supports verification and Evidence Trace.                            |

# 12\. What not to add unless a real need appears

- Kubernetes
- Kafka/event streaming
- Vector database for the basic intake flow
- Graph database
- Separate service per module
- Blockchain
- Custom identity system
- Premature multi-region/high-availability design

## Terms in plain English

| **Term**         | **Plain-English meaning**                                                                                 |
| ---------------- | --------------------------------------------------------------------------------------------------------- |
| Modular monolith | One deployable backend organized into clear modules. Simpler than microservices but not "spaghetti code." |
| Adapter          | A small layer that isolates an external API so it can be replaced or mocked.                              |
| Schema           | A strict description of the fields and data types an output must contain.                                 |
| PWA              | Progressive Web App — a web app that can behave like an installable kiosk/tablet app.                     |
| API              | A defined way for software components to request data/actions from each other.                            |
| RBAC             | Role-Based Access Control — permissions depend on whether the user is a patient, doctor, admin, etc.      |
| FHIR adapter     | Code that translates internal records into a healthcare-standard FHIR representation.                     |

## Source basis

**Primary basis:** SIH26047 Patient Case-Taking Software problem statement supplied for this project. [Official SIH 2026 problem-statement portal](https://sih.gov.in/sih2026PS)

**Interoperability/security references:** [ABDM](https://abdm.gov.in/) | [ABDM FHIR Implementation Guide](https://www.nrces.in/ndhm/fhir/r4/) | [Digital Personal Data Protection Act / Rules (MeitY)](https://www.meity.gov.in/)
