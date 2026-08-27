# MediKiosk — Complete Technology, Architecture, Deployment & Engineering Handbook
## SIH 26047 — Patient Case-Taking Software
### Hackathon Edition — VPS-First, Azure-AI-Assisted

**Document purpose:** This is the single technical source of truth for the MediKiosk hackathon build. A developer should be able to understand the system, create the repository, configure the VPS, implement the main flows, integrate the AI services, test the solution, deploy it, and run the judging demo from this document.

**Primary deployment URLs**

- **Frontend:** `https://hack.cynerza.in`
- **Backend API:** `https://hack-api.cynerza.in`

**Primary design principle**

> Build one reliable end-to-end clinical intake flow before adding more infrastructure, more AI, more languages, or more features.

**Hackathon architecture principle**

> Use the VPS for compute and PostgreSQL. Use Azure only where it gives a capability that is difficult or wasteful to reproduce locally: GPT-5.6-luna, speech, document OCR/intelligence, and Blob Storage.

---

# Table of Contents

1. Project Context
2. Technical Goals
3. Non-Goals
4. Final Technology Stack
5. Architecture Overview
6. Runtime Responsibilities
7. Frontend Architecture
8. Backend Architecture
9. PostgreSQL Data Layer
10. Azure Blob Storage
11. GPT-5.6-luna Integration
12. Speech Architecture
13. Medical Document OCR Pipeline
14. Clinical Workflow Engine
15. Red-Flag Safety Engine
16. AYUSH Case-Taking Module
17. Evidence Trace and Provenance
18. Doctor Review Workflow
19. Authentication and Authorization
20. Consent and Privacy
21. API Design
22. FHIR and ABDM Integration
23. Repository Structure
24. Configuration and Environment Variables
25. Docker Compose
26. VPS Operating Model
27. DNS and Domains
28. Nginx Configuration
29. HTTPS with Certbot
30. Firewall and Network Exposure
31. Database Backup and Recovery
32. Logging and Observability
33. Failure Handling
34. CI/CD
35. Testing Strategy
36. AI Evaluation Strategy
37. Security Checklist
38. Performance Targets
39. Hackathon Demo Dataset
40. Demo Runbook
41. Build Order
42. Team Workstream Split
43. Release Checklist
44. Troubleshooting
45. Cost-Conscious Decisions
46. Future Production Migration
47. Technologies Deliberately Avoided
48. Terminology and Jargon
49. Final Engineering Rules
50. Reference Links

---

# 1. Project Context

MediKiosk is a **pre-consultation patient case-taking system**.

It should allow a patient to:

1. select language;
2. provide consent;
3. identify themselves or begin a demo encounter;
4. describe their problem using speech or touch;
5. answer structured follow-up questions;
6. upload or scan previous medical documents;
7. verify the information collected;
8. submit the encounter.

It should allow clinical staff to:

1. see red-flag alerts;
2. review the patient history;
3. inspect source evidence;
4. review extracted medications and lab values;
5. edit or reject AI-generated information;
6. approve the final clinical summary;
7. export structured data through an ABDM/FHIR adapter.

The product is **not** intended to diagnose the patient autonomously.

---

# 2. Technical Goals

The technical implementation must satisfy the following goals.

## TG-01 — End-to-end completion

A patient encounter must travel through the complete system:

```text
Patient
→ Intake
→ Clinical facts
→ Documents
→ Safety checks
→ Summary
→ Doctor review
→ Approved record
```

## TG-02 — Multimodal intake

The system must support:

```text
Voice
Touch
Text
Document image/PDF
```

## TG-03 — AI must be constrained

AI should return structured data that is validated before saving.

```text
AI output
→ schema validation
→ domain validation
→ safety validation
→ database
```

## TG-04 — Safety does not depend only on AI

Potential emergency/red-flag escalation must use deterministic clinical rules.

## TG-05 — Traceability

Every important clinical fact should retain its origin.

## TG-06 — Physician control

The physician can:

```text
accept
edit
reject
verify
```

AI remains a drafting/structuring assistant.

## TG-07 — Hackathon simplicity

The live application should run on one VPS using:

```text
Nginx
Docker Compose
Next.js
FastAPI
PostgreSQL
```

## TG-08 — External AI capabilities

Azure services provide:

```text
GPT-5.6-luna
Speech
Document Intelligence
Blob Storage
```

---

# 3. Non-Goals

The hackathon MVP does **not** need:

- autonomous diagnosis;
- autonomous prescriptions;
- an AI doctor;
- Kubernetes;
- AKS;
- Kafka;
- Event Hubs;
- Service Bus;
- Cosmos DB;
- a vector database;
- a graph database;
- a data lake;
- a multi-agent system;
- LangChain-style orchestration unless the team already uses it successfully;
- custom fine-tuning;
- full production ABDM certification;
- a hospital billing system;
- a pharmacy management system;
- a complete EMR;
- production-scale identity infrastructure;
- dozens of language integrations;
- perfect handwritten-prescription recognition;
- zero-downtime infrastructure.

The purpose of the hackathon system is to **prove the clinical intake concept safely and convincingly**.

---

# 4. Final Technology Stack

| Layer | Technology | Hackathon Decision |
|---|---|---|
| Frontend | Next.js + TypeScript | Use |
| UI | Tailwind CSS + accessible components | Use |
| Icons | Lucide | Use |
| Server state | TanStack Query | Use |
| Optional client state | Zustand | Only if needed |
| Backend | FastAPI + Python | Use |
| Validation | Pydantic | Use |
| ORM | SQLAlchemy | Use |
| Migrations | Alembic | Use |
| Database | PostgreSQL on VPS | Use |
| File storage | Azure Blob Storage | Use |
| Primary LLM | Azure OpenAI / Foundry GPT-5.6-luna | Use |
| Speech-to-text | Azure Speech | Use |
| Text-to-speech | Azure Speech | Use |
| Document OCR | Azure AI Document Intelligence v4 | Use |
| Clinical safety | Python deterministic rules | Use |
| Reverse proxy | Nginx | Use |
| HTTPS | Let's Encrypt + Certbot | Use |
| Deployment | Docker Compose on VPS | Use |
| Logs | Docker + Nginx + structured API logs | Use |
| Source control | Git + GitHub | Use |
| CI/CD | GitHub Actions or manual deploy | Use |
| Backend tests | pytest | Use |
| Frontend tests | Vitest + React Testing Library | Use |
| E2E tests | Playwright | Use |
| FHIR | Internal mapper to FHIR R4 | Use |
| Queue | None initially | Skip |
| Redis | None initially | Skip |
| Kubernetes | None | Skip |
| Managed Azure DB | None | Skip |

---

## 4.1 Specified vs used — current FastAPI-first MVP

This table is the implementation reconciliation for the current repository. The surrounding handbook remains the target architecture; an item marked **planned** is not to be represented as delivered.

| Capability | Handbook specified | Currently used / status | Deliberate MVP variance or remaining work |
|---|---|---|---|
| Backend core | FastAPI, Pydantic, SQLAlchemy, PostgreSQL | **Used and user-accepted**: auth/RBAC, consent, encounter lifecycle, controlled intake, clinical facts, red-flag triage, physician review, audit, summary and local FHIR export | Production migrations, rate limits, cleanup jobs, and automated test suite remain open. |
| Object storage | Azure Blob Storage | **Used and user-accepted** for private document upload/download and metadata | Existing local-development documents, if any, must be migrated/re-uploaded. |
| Primary LLM | GPT-5.6-luna through Azure OpenAI/Foundry | **Used** through the official `AsyncOpenAI` SDK against the configured OpenAI-compatible `/openai/v1` base URL | Versioned prompt registry, evaluation corpus, and prompt hashes remain open. |
| STT | Azure Speech | **Implemented; pending user Postman acceptance** with `gpt-4o-mini-transcribe` through the same direct `AsyncOpenAI` client | This intentionally replaces the original Azure Speech adapter for the hackathon. It still requires synthetic-audio quality checks, read-back UI, and Hindi validation. |
| TTS | Azure Speech TTS | **Implemented; pending user Postman acceptance** with `gpt-4o-mini-tts` through `AsyncOpenAI` | TTS is constrained to the server-configured next question; it cannot speak arbitrary or generated clinical content. |
| Document extraction | Azure Document Intelligence v4 then Luna semantic extraction | **Implemented; pending user Postman acceptance** with `gpt-5.6-luna` vision for private JPEG/PNG documents | This intentionally replaces Document Intelligence for the MVP. PDF OCR, layout/bounding boxes, OCR confidence, entity normalization, and timeline placement remain open. |
| Clinical workflow | Multiple complaint pathways plus safety rules | **Partially used**: controlled chest-discomfort pathway, one deterministic urgent rule, and AYUSH Dashavidha pathway are accepted | Broader general history and the abdominal-pain, fever, and headache pathways remain open. |
| Frontend | Next.js patient, physician, and triage applications | **Not present in this repository** | Required for the complete product/demo experience, language selection, accessibility, read-back, and timeline display. |
| Deployment | VPS, Nginx, HTTPS, Certbot, backups, observability, CI/CD | **Not implemented**; local Docker Compose exists | Required before a public demo or production-like deployment. |
| Interoperability | FHIR R4 mapper, validation, optional ABDM/HIS sandbox adapter | **Partially used**: local FHIR bundle and local structural validation are accepted | Verified-only mapping policy refinement and real ABDM/HIS sandbox connection remain open. |

### MVP adapter decision

The active MVP uses the official OpenAI Python SDK directly:

```text
AsyncOpenAI(base_url=LLM_BASE_URL, api_key=LLM_API_KEY)
```

`LLM_BASE_URL` is the Azure OpenAI-compatible `/openai/v1` endpoint. The model/deployment names are `gpt-5.6-luna`, `gpt-4o-mini-transcribe`, and `gpt-4o-mini-tts`. This is an intentional hackathon decision, not a claim that Azure Speech or Azure Document Intelligence has been deployed.

---

# 5. Architecture Overview

```mermaid
flowchart TB
    USER[Patient / Doctor / Triage Browser]

    USER --> HTTPS[HTTPS]
    HTTPS --> NGINX[Nginx on VPS]

    NGINX -->|hack.cynerza.in| WEB[Next.js Web]
    NGINX -->|hack-api.cynerza.in| API[FastAPI API]

    API --> DB[(PostgreSQL on VPS)]
    API --> RULES[Clinical Rules Engine]
    API --> FHIR[FHIR / ABDM Adapter]

    API --> BLOB[Azure Blob Storage]
    API --> SPEECH[Azure Speech]
    API --> DOCINT[Azure Document Intelligence]
    API --> LUNA[Azure OpenAI GPT-5.6-luna]

    WEB --> API
```

## 5.1 Plain-English view

### Nginx

Receives public web traffic and sends it to the correct internal application.

### Next.js

Displays patient, doctor, and triage interfaces.

### FastAPI

Acts as the central brain of the software application.

It controls:

- sessions;
- patients;
- encounters;
- consent;
- question flow;
- database writes;
- AI calls;
- safety rules;
- document processing;
- summary creation;
- FHIR export.

### PostgreSQL

Stores structured application data.

### Blob Storage

Stores large files.

### GPT-5.6-luna

Handles bounded language/image understanding tasks.

### Azure Speech

Handles actual microphone speech recognition and spoken prompts.

### Document Intelligence

Performs document OCR/layout extraction.

---

# 6. Runtime Responsibilities

## 6.1 Frontend owns

- screen rendering;
- accessibility;
- language display;
- microphone controls;
- image/document selection;
- API requests;
- loading states;
- retry actions;
- patient confirmation;
- doctor editing interface.

The frontend must **not** contain clinical red-flag logic.

## 6.2 Backend owns

- authorization;
- patient/encounter state;
- business rules;
- clinical question state;
- red flags;
- consent enforcement;
- AI orchestration;
- document processing;
- Blob access;
- database access;
- summary generation;
- physician approval;
- audit events;
- FHIR export.

## 6.3 AI owns

AI can:

- convert natural language into structured facts;
- normalize symptom wording;
- generate patient-friendly wording;
- interpret OCR text;
- draft summaries;
- identify ambiguity.

AI must not own:

- final diagnosis;
- prescribing;
- final clinical truth;
- red-flag suppression;
- authorization;
- consent;
- database permissions.

---

# 7. Frontend Architecture

## 7.1 One web application

Use one Next.js application.

Recommended route groups:

```text
/
├── patient
│   ├── start
│   ├── language
│   ├── consent
│   ├── intake
│   ├── documents
│   ├── review
│   └── complete
│
├── triage
│   └── queue
│
├── doctor
│   ├── queue
│   └── encounters/[id]
│
└── login
```

Do not create independent patient, doctor, and triage repositories.

---

## 7.2 Patient screen flow

```text
Welcome
↓
Language
↓
Consent
↓
Patient/Encounter identification
↓
Chief complaint
↓
Adaptive history
↓
Documents
↓
Patient confirmation
↓
Submit
```

---

## 7.3 Doctor screen flow

```text
Login
↓
Encounter queue
↓
Open patient
↓
Summary
↓
Clinical facts
↓
Evidence/source
↓
Documents
↓
Red flags
↓
Edit / Reject / Verify
↓
Approve
```

---

## 7.4 Triage screen flow

Keep triage minimal.

Display:

```text
Token
Time
Priority
Reason
Status
```

Example:

```text
#A102
09:42
URGENT REVIEW
Chest pain + breathlessness
NEW
```

Do not display an AI diagnosis.

---

## 7.5 Accessibility requirements

Patient interface:

- large buttons;
- clear Hindi/English labels;
- visible audio replay;
- obvious microphone button;
- high contrast;
- one main question at a time;
- touch alternatives;
- readable error messages;
- no technical jargon;
- minimal keyboard input.

Recommended touch target:

```text
48px or larger
```

---

# 8. Backend Architecture

Use a modular monolith.

```text
backend/
└── app/
    ├── main.py
    ├── api/
    ├── auth/
    ├── patients/
    ├── encounters/
    ├── consent/
    ├── intake/
    ├── clinical/
    ├── red_flags/
    ├── documents/
    ├── ai/
    ├── speech/
    ├── summaries/
    ├── storage/
    ├── fhir/
    ├── audit/
    └── core/
```

## 8.1 Why not microservices?

A hackathon team benefits more from:

- one deployment;
- one API;
- one database;
- one log stream;
- one debugging path.

The logical modules above still allow future separation.

---

# 9. PostgreSQL Data Layer

Run PostgreSQL on the same VPS.

## 9.1 Database network rule

PostgreSQL must never be publicly reachable.

Allowed:

```text
FastAPI container → postgres container
```

Not allowed:

```text
Internet → :5432
```

---

## 9.2 Minimum tables

### patients

```text
id
abha_identifier_nullable
display_name_nullable
birth_year_nullable
sex_nullable
preferred_language
created_at
```

For demo mode, patient identity may be synthetic.

### encounters

```text
id
patient_id
token_number
status
mode
started_at
submitted_at
physician_verified_at
```

Possible status:

```text
DRAFT
IN_PROGRESS
SUBMITTED
URGENT_REVIEW
IN_REVIEW
VERIFIED
CANCELLED
```

### consents

```text
id
encounter_id
consent_type
version
granted
language
granted_at
revoked_at_nullable
```

### interview_sessions

```text
id
encounter_id
started_at
completed_at
current_pathway
current_question_key
```

### patient_responses

```text
id
encounter_id
question_key
input_mode
raw_text
normalized_value_json
language
created_at
```

### clinical_facts

```text
id
encounter_id
fact_type
value_json
normalized_code_nullable
source_type
source_id
source_excerpt_nullable
confidence_nullable
verification_status
created_at
updated_at
```

### red_flags

```text
id
encounter_id
rule_id
severity
reason
triggered_by_fact_ids
active
acknowledged_by_nullable
created_at
acknowledged_at_nullable
```

### documents

```text
id
encounter_id
document_type
blob_path
original_filename
mime_type
document_date_nullable
processing_status
created_at
```

### document_extractions

```text
id
document_id
ocr_text
ocr_metadata_json
extracted_entities_json
created_at
```

### summaries

```text
id
encounter_id
summary_json
summary_text
model_deployment
prompt_version
status
created_at
```

### physician_revisions

```text
id
encounter_id
summary_id
field_path
old_value
new_value
doctor_id
created_at
```

### users

```text
id
email_or_username
password_hash
role
active
created_at
```

### audit_events

```text
id
actor_id_nullable
encounter_id_nullable
event_type
metadata_json
created_at
```

### fhir_exports

```text
id
encounter_id
bundle_json
validation_status
external_status
created_at
```

---

## 9.3 Verification status

Use a fixed enum.

```text
UNVERIFIED
PATIENT_CONFIRMED
DOCTOR_VERIFIED
REJECTED
```

Do not use random strings.

---

## 9.4 Why JSONB?

Some medical facts have different structures.

Example medication:

```json
{
  "name": "Metformin",
  "strength": "500 mg",
  "frequency": "BD"
}
```

Example duration:

```json
{
  "value": 3,
  "unit": "day"
}
```

PostgreSQL `JSONB` is useful for these flexible values.

Do not store everything in JSONB. IDs, timestamps, statuses, and relationships should remain normal columns.

---

# 10. Azure Blob Storage

Use Blob Storage for files, not PostgreSQL.

## 10.1 Containers

Recommended:

```text
patient-documents
temporary-audio
generated-exports
```

You can reduce this to one container during the hackathon if permissions are simpler.

---

## 10.2 Naming convention

```text
encounters/{encounter_id}/documents/{document_id}/original.pdf

encounters/{encounter_id}/documents/{document_id}/original.jpg

encounters/{encounter_id}/documents/{document_id}/ocr.json

encounters/{encounter_id}/exports/fhir-bundle.json
```

Do not include:

```text
patient_name
phone_number
aadhaar_number
```

inside Blob object names.

---

## 10.3 Recommended file flow

```text
Browser selects file
↓
Backend validates type/size
↓
Backend uploads to Blob
↓
Document row created
↓
OCR request starts
↓
Extraction result saved
```

For hackathon simplicity, upload through the API.

A direct browser-to-Blob SAS upload can be added later.

---

# 11. GPT-5.6-luna Integration

GPT-5.6-luna is the default reasoning/multimodal model for the project.

Use it as a **bounded intelligence service**.

## 11.1 Responsibilities

Luna can perform:

1. clinical fact extraction;
2. symptom normalization;
3. question wording;
4. ambiguity detection;
5. document entity extraction;
6. image understanding where helpful;
7. summary drafting;
8. bilingual phrasing assistance.

---

## 11.2 Do not use one giant prompt

Use dedicated operations.

```python
class LLMClient:
    async def extract_clinical_facts(...)
    async def naturalize_question(...)
    async def extract_document_entities(...)
    async def generate_summary(...)
    async def translate_or_rephrase(...)
```

---

## 11.3 Structured output rule

Prefer:

```text
JSON Schema
or
strict typed structured output
```

over prose parsing.

Example output:

```json
{
  "chief_complaint": "chest pain",
  "onset": "this morning",
  "associated_symptoms": [
    "breathlessness"
  ],
  "uncertain_items": []
}
```

---

## 11.4 Clinical extraction pipeline

```text
Patient transcript
↓
Luna
↓
Structured candidate facts
↓
Pydantic validation
↓
Domain normalization
↓
Red-flag rules
↓
Store as UNVERIFIED/PATIENT_CONFIRMED
```

---

## 11.5 Summary pipeline

Do not send random unfiltered context.

Use:

```text
structured encounter facts
+
verified document entities
+
red flags
+
known uncertainty
↓
Luna
↓
structured summary draft
↓
doctor review
```

---

## 11.6 Model abstraction

Configuration:

```env
AZURE_OPENAI_DEFAULT_DEPLOYMENT=gpt-5.6-luna
AZURE_OPENAI_FALLBACK_DEPLOYMENT=
```

The rest of the application should call internal functions, not deployment names.

---

## 11.7 Prompt storage

```text
backend/app/ai/prompts/
├── clinical_extraction.md
├── document_extraction.md
├── summary.md
├── question_wording.md
└── patient_confirmation.md
```

Each prompt includes:

```text
prompt_id
version
task
allowed behavior
forbidden behavior
expected schema
examples
```

---

# 12. Speech Architecture

GPT-5.6-luna should not be treated as the microphone ASR layer.

Use Azure Speech.

## 12.1 Speech-to-text flow

```text
Microphone
↓
browser audio capture
↓
Azure Speech integration
↓
transcript
↓
patient sees transcript
↓
Luna extracts facts
```

For the hackathon, either:

1. call Azure Speech from backend; or
2. use the browser/client SDK securely if configured appropriately.

Backend-mediated credentials are usually easier to control.

---

## 12.2 Text-to-speech flow

```text
Question text
↓
Azure Speech TTS
↓
audio
↓
patient hears prompt
```

---

## 12.3 MVP languages

Start with:

```text
English
Hindi
```

Only add a third language after the first two flows work end to end.

Verify exact locale/voice support before committing to a language.

---

## 12.4 Speech failure fallback

If voice fails:

```text
Show question
↓
Enable touch choices
↓
Enable text input if required
↓
Continue encounter
```

Voice failure must not kill the session.

---

# 13. Medical Document OCR Pipeline

## 13.1 Input types

MVP should support:

- printed prescription;
- lab report;
- discharge summary;
- image;
- PDF.

Handwriting should be shown as confidence-sensitive/experimental unless your test set proves reliable.

---

## 13.2 Processing

```text
Upload
↓
Blob Storage
↓
Azure Document Intelligence
↓
OCR text/layout
↓
confidence metadata
↓
GPT-5.6-luna semantic extraction
↓
clinical entity validation
↓
timeline placement
↓
doctor verification
```

---

## 13.3 Extractable entities

For prescriptions:

```text
medicine
strength
dose
frequency
duration
instructions
```

For lab reports:

```text
test name
value
unit
reference range
abnormal indicator
date
```

For discharge summaries:

```text
admission date
discharge date
diagnosis text
procedure
medication
follow-up instruction
```

---

## 13.4 Confidence

Preserve:

```text
OCR confidence
AI extraction status
doctor verification
```

Do not merge them into one fake universal confidence number.

---

# 14. Clinical Workflow Engine

The workflow determines **what information is required**.

The LLM helps with natural language.

## 14.1 Generic history sections

```text
Chief Complaint
History of Present Illness
Past Medical History
Past Surgical History
Drug History
Allergy History
Family History
Personal History
Review of Systems
```

---

## 14.2 Complaint pathways

For the demo, implement a small number strongly.

Recommended:

```text
chest_pain
abdominal_pain
fever
headache
```

Example:

```yaml
id: chest_pain
required_fields:
  - onset
  - location
  - character
  - severity
  - radiation
  - duration
  - aggravating_factors
  - relieving_factors
  - breathlessness
  - sweating
  - syncope
```

---

## 14.3 Next-question algorithm

```text
Load pathway
↓
Read known clinical facts
↓
Find missing required fields
↓
Check red-flag questions
↓
Select next field
↓
Generate patient-friendly question
↓
Collect answer
↓
Extract facts
↓
Repeat
```

---

# 15. Red-Flag Safety Engine

Red flags should be normal code/rules.

Example concept:

```python
if facts.has("chest_pain") and facts.has("breathlessness"):
    activate_red_flag(
        rule_id="RF-CHEST-001",
        severity="URGENT_REVIEW",
        reason="Chest pain with breathlessness"
    )
```

The rules shown during the hackathon should be reviewed by an appropriate clinical mentor/domain expert.

---

## 15.1 Severity states

Recommended:

```text
ROUTINE
PRIORITY_REVIEW
URGENT_REVIEW
```

Avoid claiming automated emergency diagnosis.

---

## 15.2 Safety hard rule

> Once deterministic logic activates a red flag, an LLM response cannot remove it.

Only an authorized human workflow should acknowledge/close it.

---

# 16. AYUSH Case-Taking Module

AYUSH is not a decorative add-on.

Create a structured section.

Minimum Dashavidha-related fields:

```text
Prakriti
Vikriti
Sara
Samhanana
Pramana
Satmya
Sattva
Ahara Shakti
Vyayama Shakti
Vaya
```

Additional:

```text
Ahara
Vihara
Agni
Koshtha
Nidana
```

Use configuration-driven questions where possible.

```text
clinical/ayush/questions.yaml
```

This prevents AYUSH logic from being buried in frontend code.

---

# 17. Evidence Trace and Provenance

Every important fact should answer:

> Where did this come from?

Possible `source_type`:

```text
PATIENT_STATEMENT
CAREGIVER_STATEMENT
DOCUMENT
DOCTOR
SYSTEM_RULE
```

Example:

```json
{
  "fact_type": "medication",
  "value_json": {
    "name": "Metformin",
    "strength": "500 mg",
    "frequency": "BD"
  },
  "source_type": "DOCUMENT",
  "source_id": "doc_42",
  "source_excerpt": "Tab Metformin 500 mg BD",
  "confidence": 0.94,
  "verification_status": "UNVERIFIED"
}
```

Doctor UI:

```text
Metformin 500 mg BD
[Prescription #2] [Review]
```

Clicking evidence opens the source.

This is one of the strongest demo differentiators.

---

# 18. Doctor Review Workflow

The summary is a **draft**.

Doctor actions:

```text
Accept field
Edit field
Reject field
View source
Verify encounter
```

The system should retain revisions.

Example:

```text
AI:
Duration = 5 days

Doctor:
Duration = 3 days
```

Audit event:

```json
{
  "event": "SUMMARY_FIELD_EDITED",
  "field": "hpi.duration",
  "old": "5 days",
  "new": "3 days"
}
```

---

# 19. Authentication and Authorization

## 19.1 Patient

Do not force complex authentication for the demo.

Use:

```text
short-lived encounter session
```

Optionally show ABHA identifier entry/mock/sandbox integration.

---

## 19.2 Staff

Use simple login.

Roles:

```text
TRIAGE
DOCTOR
ADMIN
```

Hash passwords.

Never store plaintext passwords.

Use secure session cookies or short-lived JWTs.

For a hackathon, session-cookie auth is often easier to revoke and reason about.

---

## 19.3 Authorization examples

```text
Patient:
can modify own active encounter

Triage:
can read red flags and queue status

Doctor:
can read encounter and verify clinical summary

Admin:
can manage demo accounts/configuration
```

---

# 20. Consent and Privacy

Consent must happen before sensitive processing.

Store:

```text
consent version
language
purpose
timestamp
granted/rejected
```

For low-literacy patients:

- show short text;
- play audio explanation;
- require clear action.

Do not bury consent inside terms and conditions.

---

## 20.1 Demo privacy rule

Prefer synthetic patient records.

Do not use:

- teammate real medical reports;
- real Aadhaar;
- real prescriptions containing private identities;
- actual patient information.

---

# 21. API Design

Base URL:

```text
https://hack-api.cynerza.in
```

Suggested version prefix:

```text
/api/v1
```

---

## 21.1 Health endpoints

```http
GET /health
GET /ready
```

Example:

```json
{
  "status": "ok",
  "database": "ok"
}
```

Do not call expensive AI services in `/health`.

---

## 21.2 Authentication

```http
POST /api/v1/auth/login
POST /api/v1/auth/logout
GET  /api/v1/auth/me
```

---

## 21.3 Encounter endpoints

```http
POST /api/v1/encounters
GET  /api/v1/encounters/{id}
PATCH /api/v1/encounters/{id}
POST /api/v1/encounters/{id}/submit
```

---

## 21.4 Consent

```http
POST /api/v1/encounters/{id}/consent
GET  /api/v1/encounters/{id}/consent
```

---

## 21.5 Intake

```http
GET  /api/v1/encounters/{id}/intake/next-question
POST /api/v1/encounters/{id}/intake/responses
GET  /api/v1/encounters/{id}/facts
```

---

## 21.6 Documents

```http
POST /api/v1/encounters/{id}/documents
GET  /api/v1/encounters/{id}/documents
GET  /api/v1/documents/{document_id}
POST /api/v1/documents/{document_id}/process
```

---

## 21.7 Summary

```http
POST /api/v1/encounters/{id}/summary/generate
GET  /api/v1/encounters/{id}/summary
PATCH /api/v1/encounters/{id}/summary
POST /api/v1/encounters/{id}/summary/verify
```

---

## 21.8 Triage

```http
GET  /api/v1/triage/queue
POST /api/v1/red-flags/{id}/acknowledge
```

---

## 21.9 FHIR

```http
POST /api/v1/encounters/{id}/fhir/export
GET  /api/v1/encounters/{id}/fhir
```

---

# 22. FHIR and ABDM Integration

Do not model the entire internal database directly as FHIR resources.

Use a mapper.

```text
Internal model
↓
FHIR mapping
↓
FHIR validation
↓
ABDM/HIS adapter
```

Likely resources:

```text
Patient
Encounter
Observation
Condition
AllergyIntolerance
MedicationStatement / MedicationRequest
DiagnosticReport
DocumentReference
Composition
Bundle
```

Only export information that meets your verification policy.

---

# 23. Repository Structure

```text
medikiosk/
│
├── apps/
│   └── web/
│       ├── app/
│       ├── components/
│       ├── features/
│       ├── lib/
│       ├── public/
│       └── tests/
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── auth/
│   │   ├── patients/
│   │   ├── encounters/
│   │   ├── consent/
│   │   ├── intake/
│   │   ├── clinical/
│   │   ├── red_flags/
│   │   ├── documents/
│   │   ├── ai/
│   │   ├── speech/
│   │   ├── summaries/
│   │   ├── fhir/
│   │   ├── storage/
│   │   ├── audit/
│   │   └── core/
│   ├── migrations/
│   └── tests/
│
├── clinical/
│   ├── complaint_flows/
│   ├── red_flags/
│   └── ayush/
│
├── schemas/
│   ├── ai/
│   ├── api/
│   └── fhir/
│
├── evals/
│   ├── transcripts/
│   ├── documents/
│   ├── safety/
│   └── summaries/
│
├── deploy/
│   ├── nginx/
│   ├── scripts/
│   └── docker/
│
├── docker-compose.yml
├── .env.example
├── Makefile
└── README.md
```

Do not add directories that nobody owns.

---

# 24. Configuration and Environment Variables

Example `.env.example`:

```env
APP_ENV=development
APP_NAME=MediKiosk
LOG_LEVEL=INFO

FRONTEND_URL=http://localhost:3000
API_PUBLIC_URL=http://localhost:8000

POSTGRES_DB=medikiosk
POSTGRES_USER=medikiosk
POSTGRES_PASSWORD=change-me
DATABASE_URL=postgresql+psycopg://medikiosk:change-me@postgres:5432/medikiosk

SESSION_SECRET=change-me
ACCESS_TOKEN_TTL_MINUTES=60

AZURE_OPENAI_ENDPOINT=
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_DEFAULT_DEPLOYMENT=gpt-5.6-luna
AZURE_OPENAI_FALLBACK_DEPLOYMENT=

AZURE_SPEECH_KEY=
AZURE_SPEECH_REGION=
AZURE_SPEECH_DEFAULT_LANGUAGE=en-IN

AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=
AZURE_DOCUMENT_INTELLIGENCE_KEY=

AZURE_STORAGE_CONNECTION_STRING=
AZURE_STORAGE_CONTAINER_DOCUMENTS=patient-documents
AZURE_STORAGE_CONTAINER_AUDIO=temporary-audio
AZURE_STORAGE_CONTAINER_EXPORTS=generated-exports

MAX_UPLOAD_MB=25
RAW_AUDIO_RETENTION=false

ABDM_MODE=mock
ABDM_BASE_URL=
ABDM_CLIENT_ID=
ABDM_CLIENT_SECRET=
```

Production VPS:

```text
/opt/medikiosk/.env
```

Permissions:

```bash
sudo chown root:root /opt/medikiosk/.env
sudo chmod 600 /opt/medikiosk/.env
```

---

# 25. Docker Compose

Recommended baseline:

```yaml
services:
  web:
    build:
      context: ./apps/web
    restart: unless-stopped
    env_file:
      - .env
    ports:
      - "127.0.0.1:3000:3000"
    depends_on:
      - api

  api:
    build:
      context: ./backend
    restart: unless-stopped
    env_file:
      - .env
    ports:
      - "127.0.0.1:8000:8000"
    depends_on:
      postgres:
        condition: service_healthy

  postgres:
    image: postgres:17
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    healthcheck:
      test:
        [
          "CMD-SHELL",
          "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"
        ]
      interval: 5s
      timeout: 5s
      retries: 10
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

Notice:

```text
127.0.0.1:3000
127.0.0.1:8000
```

The application ports are accessible locally to Nginx, not directly from the internet.

PostgreSQL has **no published host port**.

---

# 26. VPS Operating Model

Recommended VPS:

```text
Ubuntu LTS
Nginx installed on host
Docker Engine
Docker Compose plugin
Certbot
Git
```

Deployment directory:

```text
/opt/medikiosk/
```

Suggested layout:

```text
/opt/medikiosk/
├── repo/
├── .env
├── backups/
└── deploy/
```

---

# 27. DNS and Domains

Create DNS `A` records:

```text
hack.cynerza.in      → VPS_PUBLIC_IP
hack-api.cynerza.in  → VPS_PUBLIC_IP
```

Optional IPv6:

```text
AAAA
```

If Cloudflare is used, verify WebSocket/proxy behavior during speech interactions and API streaming.

For judging stability, unnecessary proxy layers can be avoided.

---

# 28. Nginx Configuration

## 28.1 Frontend

```nginx
server {
    listen 80;
    server_name hack.cynerza.in;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

---

## 28.2 API

```nginx
server {
    listen 80;
    server_name hack-api.cynerza.in;

    client_max_body_size 25M;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_connect_timeout 30s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
    }
}
```

Validate:

```bash
sudo nginx -t
```

Reload:

```bash
sudo systemctl reload nginx
```

---

# 29. HTTPS with Certbot

Install:

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
```

Issue certificate:

```bash
sudo certbot --nginx \
  -d hack.cynerza.in \
  -d hack-api.cynerza.in
```

Test renewal:

```bash
sudo certbot renew --dry-run
```

Do not demo over HTTP.

Microphone permissions in modern browsers also work more reliably in secure contexts.

---

# 30. Firewall and Network Exposure

If using UFW:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

Public:

```text
22
80
443
```

Private:

```text
3000
8000
5432
```

SSH:

- use key authentication;
- disable password login where possible;
- restrict by IP if practical.

---

# 31. Database Backup and Recovery

## 31.1 Manual backup

```bash
mkdir -p /opt/medikiosk/backups

docker compose exec -T postgres \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" \
  > "/opt/medikiosk/backups/medikiosk_$(date +%F_%H-%M-%S).sql"
```

Before judging, create one verified backup.

---

## 31.2 Restore test

A backup is not useful until restoration is tested.

Typical restore into a clean database:

```bash
cat backup.sql | \
docker compose exec -T postgres \
psql -U medikiosk -d medikiosk
```

Adapt the command if restoring to another temporary database.

---

## 31.3 Hackathon backup policy

Backup:

- after stable seed data;
- before major schema migrations;
- before final judging session.

No need for an enterprise backup platform.

---

# 32. Logging and Observability

For the hackathon:

```text
docker compose logs
Nginx access logs
Nginx error logs
FastAPI structured logs
request_id / trace_id
```

Example application log:

```json
{
  "event": "SUMMARY_GENERATED",
  "request_id": "req_...",
  "encounter_id": "enc_...",
  "latency_ms": 2840,
  "model": "gpt-5.6-luna"
}
```

Avoid logging:

- raw medical document contents;
- entire transcripts;
- passwords;
- Azure credentials;
- Aadhaar numbers;
- unnecessary patient identifiers.

---

# 33. Failure Handling

A hackathon demo must survive external service failure.

## 33.1 Luna fails

```text
AI call fails
↓
show retry
↓
keep structured manual intake available
```

Do not lose encounter state.

---

## 33.2 Speech fails

```text
microphone/STT fails
↓
touch/text fallback
```

---

## 33.3 OCR fails

```text
document remains uploaded
↓
status = PROCESSING_FAILED
↓
doctor can still open original
```

---

## 33.4 Blob fails

If upload cannot complete:

```text
show upload error
allow retry
continue clinical intake
```

---

## 33.5 ABDM fails

```text
local verified encounter remains valid
FHIR export status = PENDING / FAILED
```

Do not block the doctor workflow.

---

## 33.6 Database fails

API should return clear `503` rather than corrupting state.

Health endpoint should indicate database failure.

---

# 34. CI/CD

Do not automate deployment so aggressively that a teammate can break the demo minutes before judging.

Recommended:

```text
feature branch
↓
pull request
↓
tests
↓
merge to main
↓
manual/protected deploy
```

Example GitHub Actions jobs:

```text
frontend-test
backend-test
lint
ai-contract-tests
docker-build
```

Deployment can initially remain:

```bash
ssh VPS
cd /opt/medikiosk/repo
git pull
docker compose build
docker compose up -d
docker compose exec api alembic upgrade head
```

For hackathon reliability, a controlled manual deploy is acceptable.

---

# 35. Testing Strategy

## 35.1 Unit tests

Backend:

```text
pytest
```

Test:

- complaint branching;
- normalization;
- red flags;
- permissions;
- validators;
- summary state;
- FHIR mapping.

---

## 35.2 API tests

Use:

```text
pytest
HTTPX
```

Test:

```text
create encounter
consent
submit response
upload document metadata
generate summary
doctor edit
verify
```

---

## 35.3 Frontend tests

Use:

```text
Vitest
React Testing Library
```

Focus on:

- language selection;
- consent;
- input fallback;
- error state;
- evidence display.

---

## 35.4 E2E

Use Playwright.

Critical path:

```text
patient starts
↓
consents
↓
reports chest pain + breathlessness
↓
red flag appears
↓
patient uploads report
↓
summary generated
↓
doctor opens encounter
↓
doctor edits
↓
doctor verifies
```

---

# 36. AI Evaluation Strategy

Do not evaluate AI by saying:

> "It looked good."

Create a test corpus.

```text
evals/
├── transcripts/
├── documents/
├── safety/
└── summaries/
```

---

## 36.1 Clinical extraction cases

Example:

```json
{
  "id": "clinical-001",
  "input": "My chest has been hurting since morning and I am short of breath.",
  "expected": {
    "chief_complaint": "chest pain",
    "breathlessness": true
  }
}
```

---

## 36.2 Document cases

Use synthetic:

- printed prescriptions;
- lab reports;
- discharge summaries.

Expected:

```text
medication extraction
lab value extraction
document date
document type
```

---

## 36.3 Safety evaluation

Important measure:

```text
red-flag recall on reviewed test cases
```

For your tiny curated demo safety suite, target:

```text
100%
```

Do not claim real-world clinical sensitivity from a tiny test set.

---

# 37. Security Checklist

Before demo:

- [ ] HTTPS enabled
- [ ] PostgreSQL not public
- [ ] `.env` not committed
- [ ] Azure credentials only server-side
- [ ] `.env` permission restricted
- [ ] demo accounts use strong passwords
- [ ] authorization checks active
- [ ] CORS restricted
- [ ] file size limit active
- [ ] file MIME/type checks active
- [ ] consent required before clinical submission
- [ ] session expiry active
- [ ] kiosk logout/reset implemented
- [ ] no real patient sensitive data
- [ ] logs do not contain secrets
- [ ] backup exists
- [ ] health endpoint works

---

# 38. Performance Targets

These are prototype engineering targets, not official medical guarantees.

| Area | Target |
|---|---:|
| Main page load on decent network | < 3 seconds |
| Normal API response excluding AI | < 500 ms typical |
| Question transition | < 1 second after data available |
| AI extraction | ideally < 8 seconds |
| Summary generation | ideally < 10 seconds |
| Clean document OCR pipeline | ideally < 15 seconds |
| Doctor queue refresh | < 3 seconds |
| Red-flag rule evaluation | near-instant |
| Session state persistence | every completed answer |

If an AI request takes longer, show progress rather than a frozen screen.

---

# 39. Hackathon Demo Dataset

Prepare synthetic data before judging.

Recommended patients:

## Patient A — Red flag

```text
Chest pain
Breathlessness
Example previous prescription
```

Purpose:

```text
adaptive questions
red-flag alert
doctor review
```

## Patient B — Document intelligence

```text
Diabetes history
Printed prescription
Lab report
```

Purpose:

```text
OCR
medication extraction
lab value extraction
timeline
evidence trace
```

## Patient C — AYUSH

```text
Non-emergency chronic complaint
Dashavidha assessment
Ahara-Vihara
```

Purpose:

```text
show problem-statement alignment
```

---

# 40. Demo Runbook

Recommended 5–7 minute technical demo.

## Scene 1 — Problem

Show:

```text
Patient has history
Patient has paper documents
Doctor has limited time
```

## Scene 2 — Patient UI

Open:

```text
https://hack.cynerza.in
```

Select Hindi or English.

Grant consent.

---

## Scene 3 — Voice

Patient says:

```text
"My chest has been hurting since morning and I feel short of breath."
```

Show transcription.

Show structured follow-up.

---

## Scene 4 — Red flag

Triage dashboard displays:

```text
URGENT REVIEW
Chest pain + breathlessness
```

Say clearly:

> This is escalation, not an AI diagnosis.

---

## Scene 5 — Document

Upload synthetic lab report or prescription.

Show:

```text
original
OCR result
extracted fields
confidence/evidence
```

---

## Scene 6 — Summary

Open doctor console.

Show:

```text
chief complaint
HPI
medications
allergies
red flags
previous investigations
source chips
```

---

## Scene 7 — Evidence

Click:

```text
[Prescription #2]
```

Show where the medication came from.

---

## Scene 8 — Physician control

Edit one field.

Verify the encounter.

Show audit/revision.

---

## Scene 9 — FHIR

Show:

```text
Export FHIR
```

Display a valid structured bundle or mock/sandbox status.

Do not pretend a mock connection is production ABDM.

---

# 41. Build Order

## Milestone 1 — No AI

Build:

```text
Next.js
FastAPI
PostgreSQL
encounter creation
patient answers
doctor screen
```

This gives a complete skeleton.

---

## Milestone 2 — Clinical workflow

Add:

```text
question pathways
clinical facts
red flags
```

---

## Milestone 3 — Luna

Add:

```text
structured extraction
question wording
summary generation
```

---

## Milestone 4 — Documents

Add:

```text
Blob
Document Intelligence
extraction
Evidence Trace
```

---

## Milestone 5 — Voice

Add:

```text
Speech-to-text
Text-to-speech
fallback
```

---

## Milestone 6 — AYUSH

Add:

```text
Dashavidha
Ahara-Vihara
doctor view
```

---

## Milestone 7 — FHIR

Add:

```text
mapper
validation
export
```

---

## Milestone 8 — VPS hardening

Add:

```text
Nginx
HTTPS
backup
health checks
demo seed
```

---

# 42. Team Workstream Split

For a 4–6 person hackathon team:

## Frontend owner

Owns:

```text
patient UI
doctor UI
triage UI
accessibility
```

## Backend owner

Owns:

```text
FastAPI
database
auth
encounters
```

## AI/Document owner

Owns:

```text
Luna
Document Intelligence
structured schemas
evals
```

## Clinical/Safety owner

Owns:

```text
question flows
red flags
AYUSH structure
acceptance cases
```

## Integration/DevOps owner

Owns:

```text
Azure services
Blob
VPS
Nginx
HTTPS
Docker
demo reliability
```

People can overlap, but each critical area should have a clear owner.

---

# 43. Release Checklist

Before calling a build “demo-ready”:

## Product

- [ ] patient can complete intake
- [ ] doctor can open encounter
- [ ] red flag appears correctly
- [ ] document can upload
- [ ] summary can generate
- [ ] doctor can edit
- [ ] doctor can verify
- [ ] AYUSH flow works

## Infrastructure

- [ ] `hack.cynerza.in` resolves
- [ ] `hack-api.cynerza.in` resolves
- [ ] HTTPS valid
- [ ] containers restart automatically
- [ ] database volume persists
- [ ] Blob upload works
- [ ] no public DB
- [ ] backup created

## AI

- [ ] Luna deployment reachable
- [ ] schemas validate
- [ ] failure message works
- [ ] no AI-created diagnosis presented as truth

## Demo

- [ ] synthetic patient loaded
- [ ] documents ready
- [ ] microphone permission tested
- [ ] backup browser available
- [ ] backup manual touch flow tested
- [ ] network hotspot available if venue Wi-Fi fails

---

# 44. Troubleshooting

## Frontend returns 502

Check:

```bash
docker compose ps
docker compose logs web
curl http://127.0.0.1:3000
sudo tail -f /var/log/nginx/error.log
```

---

## API returns 502

```bash
docker compose logs api
curl http://127.0.0.1:8000/health
```

---

## Database connection fails

```bash
docker compose ps postgres
docker compose logs postgres
docker compose exec postgres pg_isready -U medikiosk -d medikiosk
```

---

## Nginx configuration problem

```bash
sudo nginx -t
sudo systemctl status nginx
```

---

## Certificate issue

```bash
sudo certbot certificates
sudo certbot renew --dry-run
```

---

## Azure OpenAI failure

Log:

```text
HTTP status
request ID
deployment
latency
```

Do not log the full sensitive prompt in production-style logs.

Check:

```text
endpoint
API key
deployment name
quota/rate limit
```

---

## OCR failure

Check:

```text
Blob upload completed?
supported file?
file readable?
Document Intelligence endpoint correct?
```

---

# 45. Cost-Conscious Decisions

## Use VPS for

```text
Next.js
FastAPI
PostgreSQL
Nginx
logs
```

Reason:

> already available and sufficient for hackathon load.

## Use Azure for

```text
GPT-5.6-luna
Speech
Document Intelligence
Blob Storage
```

Reason:

> these are capability services that would consume unnecessary hackathon time to reproduce.

## Do not use managed PostgreSQL now

Reason:

```text
extra cost
extra configuration
little demo value
```

## Do not use Container Apps now

Reason:

```text
VPS already solves compute
```

---

# 46. Future Production Migration

The hackathon architecture should not pretend to be final hospital infrastructure.

If the project moves forward:

## Stage 1

Keep the modular application but improve:

```text
privacy review
security hardening
clinical validation
monitoring
backups
```

## Stage 2

Move selected components if needed:

```text
managed database
managed secrets
private networking
central monitoring
staff SSO
```

## Stage 3

Separate services only when scale proves necessary:

```text
document worker
AI worker
FHIR integration worker
```

Do not split services because a diagram looks more impressive.

---

# 47. Technologies Deliberately Avoided

| Technology | Why skipped in hackathon |
|---|---|
| Kubernetes / AKS | Operations overhead |
| Kafka | No streaming requirement |
| Service Bus | No complex messaging requirement |
| Redis | No proven caching/session bottleneck |
| Cosmos DB | PostgreSQL fits relational clinical data |
| Vector database | No core RAG requirement |
| Graph database | Provenance works relationally |
| Multi-agent AI | Increases complexity and unpredictability |
| Custom fine-tuning | Prompt + schema + eval sufficient for MVP |
| Data Lake | No analytics-scale requirement |
| Azure managed Postgres | VPS DB already available |
| Azure Container Apps | VPS compute already available |
| API Management | Nginx sufficient |
| Full Entra integration | Not required for demo |

---

# 48. Terminology and Jargon

## API

**Application Programming Interface.**

A defined way for one software component to request something from another.

Example:

```text
Frontend calls FastAPI.
```

---

## REST

A common API style using HTTP methods such as:

```text
GET
POST
PATCH
DELETE
```

---

## ASR / STT

**Automatic Speech Recognition / Speech-to-Text.**

Converts spoken audio into written text.

---

## TTS

**Text-to-Speech.**

Converts written text into audio.

---

## OCR

**Optical Character Recognition.**

Extracts readable text from an image or scanned document.

---

## LLM

**Large Language Model.**

A model capable of understanding and generating language.

---

## Multimodal

A model capable of working with more than one data type.

For Luna in this architecture:

```text
text
images
```

Audio is handled separately by Azure Speech.

---

## Structured Output

AI output constrained into known fields.

Example:

```json
{
  "symptom": "fever",
  "duration_days": 2
}
```

This is safer to process than an unrestricted paragraph.

---

## JSON Schema

A formal definition of what a JSON object is allowed to contain.

---

## Pydantic

A Python validation library.

It checks whether API/AI data matches required field types.

---

## ORM

**Object-Relational Mapper.**

Allows backend code to work with database tables through Python objects.

SQLAlchemy is the ORM in this stack.

---

## Alembic

Database migration tool used with SQLAlchemy.

Example:

```text
add new column
change table
upgrade database schema
```

---

## PostgreSQL

Relational database used for structured MediKiosk data.

---

## JSONB

A PostgreSQL data type for indexed JSON.

Useful for flexible clinical-value structures.

---

## Blob Storage

Cloud object/file storage.

Use for:

```text
images
PDFs
audio
exports
```

---

## Provenance

The origin of information.

Example:

> “Metformin 500 mg” came from page 1 of Prescription #2.

---

## Evidence Trace

The product feature that makes provenance visible to doctors.

---

## Red Flag

A symptom/pattern that may indicate the patient needs priority clinical assessment.

A red flag is not itself a diagnosis.

---

## Deterministic Rule

A rule that always gives the same result from the same input.

Example:

```text
A AND B → alert
```

---

## Hallucination

When AI generates unsupported information.

---

## Confidence

An estimate of extraction certainty.

Confidence is not the same as medical truth.

---

## FHIR

**Fast Healthcare Interoperability Resources.**

A standard for exchanging structured healthcare information.

---

## ABDM

**Ayushman Bharat Digital Mission.**

India's digital health ecosystem.

---

## ABHA

**Ayushman Bharat Health Account.**

A health identifier within ABDM.

---

## HIS

**Hospital Information System.**

Hospital software for patient/administrative/clinical workflows.

---

## EMR

**Electronic Medical Record.**

Digital clinical patient records.

---

## PWA

**Progressive Web App.**

A web app that can behave more like an installed app.

---

## Reverse Proxy

A server placed in front of the application.

Nginx receives the public request and forwards it internally.

---

## Nginx

The reverse proxy/web server in this deployment.

---

## TLS / HTTPS

Encryption between the browser and web server.

---

## Certbot

Tool used to request and renew Let's Encrypt HTTPS certificates.

---

## Container

A packaged application environment.

---

## Docker

Runs containers.

---

## Docker Compose

Defines and starts several related containers together.

In MediKiosk:

```text
web
api
postgres
```

---

## Volume

Persistent Docker storage.

Used so PostgreSQL data survives container recreation.

---

## CORS

**Cross-Origin Resource Sharing.**

Controls which browser websites are allowed to call the API.

MediKiosk API should allow:

```text
https://hack.cynerza.in
```

---

## RBAC

**Role-Based Access Control.**

Permissions based on role.

Example:

```text
doctor
triage
admin
```

---

## Audit Log

A history of important actions.

Example:

```text
doctor edited allergy
doctor verified encounter
```

---

## Trace ID / Request ID

A unique identifier used to follow one API request through logs.

---

## Modular Monolith

One backend application separated into internal modules.

This is intentionally simpler than microservices.

---

## Adapter

A layer hiding an external dependency.

Example:

```text
SpeechProvider
BlobProvider
LLMClient
FHIRExporter
```

Adapters make future provider changes easier.

---

## Model Deployment

The configured model endpoint name in Azure.

Example:

```text
gpt-5.6-luna
```

---

## Migration

A controlled database schema change.

---

## E2E Test

**End-to-End Test.**

Simulates a full user workflow across frontend/backend/database.

---

## CI/CD

**Continuous Integration / Continuous Delivery.**

Automated testing/build/deployment workflows.

---

# 49. Final Engineering Rules

1. **One reliable flow beats ten unfinished features.**
2. **Do not turn MediKiosk into an autonomous diagnosis system.**
3. **The clinical workflow determines what must be collected.**
4. **GPT-5.6-luna helps interpret and communicate; it does not become the source of truth.**
5. **Red flags use deterministic reviewed rules.**
6. **Every important fact should retain its source.**
7. **Doctors must be able to edit/reject AI output.**
8. **PostgreSQL stays private on the VPS.**
9. **Only Nginx exposes the application publicly.**
10. **Use HTTPS before the demo.**
11. **Azure is for capability services, not unnecessary infrastructure.**
12. **Keep the system usable when AI/speech/OCR is temporarily unavailable.**
13. **Use synthetic clinical data during judging.**
14. **Do not add a technology unless it solves a demonstrated problem.**
15. **Before judging, stop changing architecture and stabilize the demo.**

---

# 50. Reference Links

Current official references used for the technical choices:

- Microsoft Foundry model catalog:  
  https://learn.microsoft.com/en-in/azure/ai-foundry/foundry-models/concepts/models-sold-directly-by-azure

- Azure AI Document Intelligence Read OCR:  
  https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/prebuilt/read?view=doc-intel-4.0.0

- Azure Speech language/voice support:  
  https://learn.microsoft.com/azure/ai-services/speech-service/language-support

- Azure Blob Storage:  
  https://learn.microsoft.com/azure/storage/blobs/

- Docker Compose:  
  https://docs.docker.com/compose/

- Nginx documentation:  
  https://nginx.org/en/docs/

- PostgreSQL documentation:  
  https://www.postgresql.org/docs/

- Let's Encrypt / Certbot:  
  https://certbot.eff.org/

---

# Document Status

**Status:** Hackathon technical baseline  
**Deployment:** VPS-first  
**Frontend:** `hack.cynerza.in`  
**API:** `hack-api.cynerza.in`  
**Database:** PostgreSQL on VPS  
**AI:** Azure OpenAI / GPT-5.6-luna  
**Files:** Azure Blob Storage  
**Speech:** Azure Speech  
**OCR:** Azure AI Document Intelligence  
**Reverse Proxy:** Nginx  
**Runtime:** Docker Compose

> This document should be updated only when a technical decision actually changes. It is intended to prevent architecture drift during the hackathon.
