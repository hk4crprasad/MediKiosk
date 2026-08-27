# MediKiosk

> A safety-first, evidence-aware pre-consultation intake system for the SIH 26047 Patient Case-Taking Software challenge.

MediKiosk helps a patient or caregiver capture a structured history before consultation. It supports controlled touch-first intake, optional speech assistance, document evidence, physician review, AYUSH Dashavidha intake, deterministic triage, and a local FHIR export. It is **not** a diagnostic, prescribing, or autonomous clinical decision system.

## The core flow

```text
Consent → guided intake → evidence-linked facts → deterministic safety rule
       → documents / PDF extraction → physician review → verified summary → FHIR export
```

The trusted core is server-controlled. AI may assist with transcription, document extraction, and draft summaries, but cannot create verified clinical truth or suppress a deterministic safety rule.

## Current status

| Area | Status | Notes |
| --- | --- | --- |
| Foundation, auth, consent, encounters | Accepted | Staff RBAC and encounter-scoped kiosk access are in place. |
| Controlled intake | Accepted for chest discomfort and AYUSH | Fever, headache, and abdominal-pain pathways are implemented and await Postman acceptance. |
| Triage | Accepted for one chest-discomfort + breathlessness rule | No diagnosis wording; new pathways have no automated rule until clinically approved. |
| Documents | Accepted for private Azure Blob upload/download | PDF → PyMuPDF → Luna processing and clinician review await Postman acceptance. |
| Summaries and FHIR | Accepted | Physician edit/accept/reject and local FHIR structural export are available. |
| Speech and image extraction | Implemented, awaiting Postman acceptance | Direct OpenAI-compatible adapters with safe disabled/mock fallback modes. |
| Frontend and production hardening | Planned | See [the frontend plan](FRONTEND_IMPLEMENTATION_PLAN.md). |

An implementation is not accepted until the user has run its matching Postman checks and recorded the result in [task.md](task.md).

## Capabilities

- Patient/kiosk encounter creation, consent, guided intake, facts, submit, and scoped document access.
- Versioned complaint pathways: `chest-discomfort-v1`, `fever-v1`, `headache-v1`, `abdominal-pain-v1`, and `ayush-dashavidha-v1`.
- Evidence-linked `ClinicalFact` records with explicit verification states.
- Deterministic chest-discomfort/breathlessness urgent-review rule with traceable fact IDs.
- Private Azure Blob document storage; no public blob URLs are returned.
- PDF processing: native text through PyMuPDF, page-by-page PNG rendering, then Luna vision extraction.
- Physician document extraction accept/correct/reject and an evidence timeline.
- Direct OpenAI-compatible SDK adapters for `gpt-5.6-luna`, `gpt-4o-mini-transcribe`, and `gpt-4o-mini-tts`.
- Versioned prompt registry with prompt IDs, versions, SHA-256 hashes, and evaluation fixtures.
- Physician-controlled summary lifecycle and local FHIR export of verified facts.

## Safety boundaries

| The system does | The system does not do |
| --- | --- |
| Captures patient-reported answers and source evidence | Diagnose, prescribe, or recommend treatment |
| Runs reviewed deterministic rules | Allow an LLM to suppress or downgrade a rule |
| Stores AI/document output as unverified evidence | Turn transcription or OCR directly into verified facts |
| Lets a physician explicitly correct and promote facts | Treat a confidence score as clinical truth |
| Falls back to touch/manual review when adapters fail | Claim live ABDM or production clinical compliance |

Only a physician/admin review action can promote a selected document item to `clinician_verified`. Fever, headache, and abdominal-pain intake currently capture structured history only; their future red-flag rules require clinical-owner approval and positive/negative synthetic fixtures.

## Architecture

```text
Patient / caregiver kiosk              Physician / triage workspace
             │                                      │
             └────────────── FastAPI API ───────────┘
                                │        │
                     PostgreSQL │        │ Azure Blob Storage
                                │        │
                    OpenAI-compatible adapters
           (Luna vision/summary, speech transcription, TTS)
```

The current application is a modular FastAPI monolith. PostgreSQL owns structured workflow data and audits; Azure Blob owns binary documents. External providers sit behind adapters so the touch/manual path remains usable when a provider is unavailable.

## Role-based API surface

| Role | Main API capabilities |
| --- | --- |
| Patient/kiosk | Create one encounter, record consent, answer own pathway, read own facts/documents, upload evidence, submit intake, request safe speech/document assistance. |
| Physician/admin | Read clinician encounter view, generate/edit/verify summaries, review document extraction, view document timeline, and create FHIR exports. |
| Triage/admin/physician | Read triage queue and acknowledge a red flag without deleting or downgrading it. |

Kiosk tokens are scoped to a single encounter and cannot access staff routes. The detailed UI route and API mapping is in [FRONTEND_IMPLEMENTATION_PLAN.md](FRONTEND_IMPLEMENTATION_PLAN.md).

## Quick start

### Prerequisites

- Docker and Docker Compose
- An Azure Blob Storage private container for document testing
- Optional OpenAI-compatible provider configuration for Luna/speech features
- Synthetic data only

### Configure

1. Create a root `.env` with a strong `POSTGRES_PASSWORD`.
2. Copy `backend/.env.example` to `backend/.env` and replace every placeholder.
3. Keep provider keys in `backend/.env`; never place them in Postman or a browser bundle.
4. Configure private Azure Blob storage before using document upload.

Useful adapter settings:

```env
LLM_BASE_URL=https://YOUR_OPENAI_COMPATIBLE_PROVIDER/openai/v1
LLM_API_KEY=REPLACE_ME
LLM_MODEL=gpt-5.6-luna
SPEECH_ADAPTER_MODE=openai_compatible
OCR_ADAPTER_MODE=openai_compatible
AZURE_OPENAI_STT_DEPLOYMENT=gpt-4o-mini-transcribe
AZURE_OPENAI_TTS_DEPLOYMENT=gpt-4o-mini-tts
PDF_MAX_PAGES=10
PDF_RENDER_DPI=144
```

### Start the API

```bash
docker compose up --build
```

```text
GET  http://localhost:8000/health
GET  http://localhost:8000/ready
GET  http://localhost:8000/api/v1/docs
GET  http://localhost:8000/api/v1/openapi.json
```

The API container does not source-mount the repository. Rebuild after backend changes.

## Manual verification

Import both Postman files:

- [Collection](postman/MediKiosk.postman_collection.json)
- [Safe local environment template](postman/MediKiosk.local.postman_environment.json)

Run the requests in order and record the HTTP status plus `X-Request-ID`. Do not put Blob or LLM credentials in Postman. Current priority gates are:

1. `PTH-01`–`PTH-05` — fever, headache, abdominal-pain pathways and role boundaries.
2. `INT-01`–`INT-08` — speech, image/PDF extraction, physician review, and timeline.

The complete acceptance record is maintained in [task.md](task.md).

## Repository guide

```text
backend/                         FastAPI application and Docker image
  app/clinical_config/           Versioned pathways and deterministic rules
  app/routers/                   HTTP contracts and role boundaries
  app/services/                  Workflow, storage, AI, summary, and FHIR services
  app/prompting/                 Versioned prompt registry and prompt files
  evals/                         Synthetic grounding/evaluation fixtures
postman/                         User-operated acceptance collection
PRD/                             MVP requirement documents
00_... through 05_...            Product, design, safety, testing, and demo plans
task.md                          Living delivery tracker and acceptance history
FRONTEND_IMPLEMENTATION_PLAN.md  Build plan for patient, physician, and triage UI
```

## Documentation map

- [FastAPI-first delivery plan](00_MediKiosk_Pre_Development_FastAPI_Plan.md)
- [Product requirements and lean SRS](01_MediKiosk_Product_Requirements_and_Lean_SRS.md)
- [Technical architecture](02_MediKiosk_Technical_Architecture_and_System_Design.md)
- [AI, clinical safety, and data design](03_MediKiosk_AI_Clinical_Safety_and_Data_Design.md)
- [Testing and acceptance strategy](04_MediKiosk_Testing_and_Acceptance_Strategy.md)
- [Hackathon demo plan](05_MediKiosk_Hackathon_Build_Demo_and_Execution_Plan.md)
- [Complete engineering handbook](MediKiosk_COMPLETE_Technology_Architecture_Deployment_Handbook.md)
- [AYUSH requirements](PRD/06_MediKiosk_AYUSH_Dashavidha_MVP_Requirements.md)
- [Assistive adapter requirements](PRD/07_MediKiosk_Assistive_Adapters_MVP_Requirements.md)
- [Prompt-system requirements](PRD/08_MediKiosk_Prompt_System_and_Evaluation_Requirements.md)

## What remains

For the hackathon demo, the immediate work is frontend implementation, completion of the pending Postman gates, Hindi/read-back validation, and a full regression run. Before any public or production-like deployment, add Alembic migrations, rate limiting, token cleanup, HTTPS/Nginx, backups, monitoring, a tested restore procedure, and secure secret management.

## Demo data and security

Use synthetic patients, synthetic documents, and synthetic audio only. Rotate any key that has ever been committed or shared, restrict the Azure Blob container to private access, and never expose provider credentials to the frontend.
