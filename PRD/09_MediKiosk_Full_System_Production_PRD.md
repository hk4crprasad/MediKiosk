# MediKiosk Full System Product Requirements Document (PRD)

**Problem Statement:** SIH26047 — Patient Case-Taking Software (Ministry of Ayush)  
**Document Version:** 2.0 (Post-Development Finalized)  
**System Status:** 100% Core Flows Implemented, 34/34 APIs Wired, ~95% SIH26047 Requirement Coverage  

---

## 1. Executive Summary & Problem Context

In Indian public hospital Outpatient Departments (OPDs), physicians often face 100–150 patients in a 3-hour shift (averaging under 2 minutes per patient). Crucial clinical history taking (Chief Complaints, History of Present Illness, Past Medical History, Allergies, Family History, and Review of Systems) collapses under this throughput constraint.

**MediKiosk** solves this by shifting structured history elicitation to a pre-consultation patient kiosk:
* **Patients** complete an adaptive, multimodal (touch, voice, audio-guided) intake in their regional language and upload past paper prescriptions/lab reports.
* **The Deterministic Safety Engine** continuously checks for clinical red flags (e.g. chest discomfort + breathlessness) and raises immediate triage alerts.
* **The AI Clinical Engine (GPT-5.6 Luna)** synthesizes structured facts into a physician-ready clinical note.
* **The Physician** reviews, edits inline, and formally verifies (`VERIFIED`) the record before consultation, retaining 100% clinical authority.
* **ABDM Interoperability Engine** generates standard FHIR R4 Bundles mapped to the patient's ABHA ID (`https://healthid.abdm.gov.in`).

---

## 2. Personas & Core User Journeys

### 2.1 Persona 1: Rural / Low-Literacy Patient or Elderly Caregiver (Ramesh)
* **Goal**: Share health concerns in Hindi/Tamil/Bengali without struggling with smartphone apps or English medical jargon.
* **Journey**:
  1. Arrives at OPD waiting area, approaches kiosk.
  2. Selects preferred language (Hindi) and enters/autofills ABHA ID.
  3. Listens to DPDP Act audio-guided consent and taps "Accept".
  4. Answers 5–7 adaptive questions by tapping large buttons or pressing the **🎙️ Speak Answer** button.
  5. Takes a photo or uploads past paper prescription.
  6. Reviews summary with audio read-aloud and submits to clinical team.

### 2.2 Persona 2: Triage Staff / Nurse (Sister Anjali)
* **Goal**: Spot high-risk patients instantly in a crowded waiting hall.
* **Journey**:
  1. Monitors `/staff/triage` dashboard on tablet/desktop.
  2. Notices urgent red-flag banner ("Chest discomfort with radiation/breathlessness").
  3. Immediately acknowledges the alert, locates the patient, and routes them to emergency triage.

### 2.3 Persona 3: Attending Physician (Dr. Verma — General / AYUSH)
* **Goal**: Conduct a thorough consultation in 2 minutes with structured, pre-verified clinical facts.
* **Journey**:
  1. Opens `/staff/encounters/[encounterId]` from triage directory.
  2. Reviews structured facts, red-flag history, and uploaded prescription documents.
  3. Runs Vision OCR on prescription, clicks `✓ Promote to verified facts`.
  4. Clicks `✨ Generate AI summary` to synthesize HPI, ROS, and Past Medical History.
  5. Performs inline edits to correct nuances, clicks `✓ Accept & Verify`.
  6. Exports standard ABDM FHIR R4 Bundle for hospital EMR integration.

---

## 3. Product Scope & Functional Modules (SIH26047)

### Module A — Conversational Multimodal History Engine
* **Adaptive Clinical Decision Trees**: 5 production pathways (`chest-discomfort-v1`, `fever-v1`, `headache-v1`, `abdominal-pain-v1`, and `ayush-dashavidha-v1`).
* **Dual-Mode Input**: Touch single-choice selection + Voice ASR recording (Web `MediaRecorder` + Azure OpenAI STT).
* **Audio Accessibility (TTS)**: Server-synthesized WAV prompts cached in Azure Blob storage (`QuestionAudioPrompt`), eliminating repeated LLM synthesis.
* **Regional Language Selector**: 6 Indian languages (English, Hindi, Tamil, Telugu, Kannada, Bengali).
* **Deterministic Safety Boundaries**: Hardcoded red-flag rules (e.g., severe headache + neck stiffness) evaluate immediately upon every submitted response.

### Module B — Document Digitization & Intelligence
* **Multi-Format Upload**: PDF, JPEG, PNG upload up to 15MB direct to private Azure Blob storage.
* **Vision Document AI (GPT-5.6 Luna)**: Extracts clinical entities (diagnoses, medications, dosages, frequencies, lab values).
* **Chronological Document Timeline**: Orders document uploads, OCR events, and verified facts chronologically.
* **Clinician Fact Promotion**: Physician can review extracted OCR items and click `✓ Promote to verified facts` to make them formal clinical facts.
* **Secure Document Streaming**: Direct authenticated binary streaming (`GET /documents/:id/content`) for in-browser PDF/image viewing and downloading.

### Module C — Structured History Summary Generator
* **Standard Medical Architecture**: AI summarizes facts into Chief Complaint (CC), History of Present Illness (HPI), Past Medical History (PMH), Current Medications, Allergies, and Review of Systems (ROS).
* **Deterministic Fact Anchoring**: Prompt strictly forbids generating unanchored facts; all statements cite evidence IDs.
* **Human-in-the-Loop Revisions**: In-place physician text editor with revision logging (`PhysicianRevision`).
* **Formal Verification Lifecycle**: Explicit `Accept` (marks encounter `VERIFIED`) or `Reject` actions.

### Module D — Consent, Privacy & ABDM Interoperability
* **DPDP Act 2023 Compliance**: Explicit consent receipt recording (`POST /consents`), audio explanation in regional languages, and instant in-intake revocation (`POST /consents/:cid/revocations`).
* **Ephemeral Session Isolation**: Single-use Kiosk JWT tokens with automatic session wipe upon submission or revocation.
* **ABDM ABHA Identifier Integration**: Links 14-digit ABHA ID / ABHA Address (`name@abdm`) to patient records.
* **ABDM FHIR R4 Bundle Export**: Generates compliant FHIR R4 JSON bundles containing `Patient`, `Encounter`, `Condition`, `Observation`, and `DocumentReference` resources.

---

## 4. Complete 34/34 API Endpoint Specification

All 34 backend endpoints are implemented and wired into the Next.js frontend:

1. `POST /api/v1/encounters` — Create patient & encounter session.
2. `GET /api/v1/encounters/:id` — Query encounter state and pathway.
3. `POST /api/v1/encounters/:id/consents` — Record DPDP consent receipt.
4. `GET /api/v1/encounters/:id/consents` — List encounter consent receipts.
5. `POST /api/v1/encounters/:id/consents/:cid/revocations` — Revoke consent & abort.
6. `GET /api/v1/encounters/:id/intake/next-question` — Adaptive question selector.
7. `POST /api/v1/encounters/:id/intake/responses` — Submit answer & evaluate red flags.
8. `GET /api/v1/encounters/:id/facts` — List extracted clinical facts.
9. `POST /api/v1/encounters/:id/submit` — Finalize patient intake.
10. `POST /api/v1/encounters/:id/audio/prompts/next-question` — Fetch cached question TTS WAV.
11. `POST /api/v1/encounters/:id/speech/transcriptions` — Transcribe voice recording (ASR).
12. `POST /api/v1/encounters/:id/documents` — Upload document to Azure Blob.
13. `GET /api/v1/encounters/:id/documents` — List encounter documents.
14. `GET /api/v1/documents/:id` — Get document metadata.
15. `GET /api/v1/documents/:id/content` — Stream binary document bytes.
16. `GET /api/v1/encounters/:id/document-timeline` — Chronological document & fact timeline.
17. `POST /api/v1/documents/:id/extractions` — Vision OCR extraction via GPT-5.6 Luna.
18. `POST /api/v1/documents/:id/extractions/:eid/reviews` — Promote OCR items to verified facts.
19. `GET /api/v1/documents/:id/extractions/latest` — Query latest extraction artifact.
20. `POST /api/v1/auth/login` — Staff authentication → JWT.
21. `POST /api/v1/auth/logout` — Server-side token revocation.
22. `GET /api/v1/auth/me` — Current logged-in staff identity.
23. `POST /api/v1/admin/users` — Provision staff users (`physician`, `triage`, `admin`).
24. `GET /api/v1/triage/queue` — Active red-flag emergency queue.
25. `GET /api/v1/triage/encounters` — All encounters directory.
26. `POST /api/v1/red-flags/:id/acknowledgements` — Triage staff flag acknowledgment.
27. `GET /api/v1/clinician/encounters/:id` — Full clinician encounter bundle.
28. `POST /api/v1/encounters/:id/summary/generations` — Synthesize AI summary.
29. `GET /api/v1/encounters/:id/summary` — Retrieve latest summary.
30. `PATCH /api/v1/encounters/:id/summary` — Physician inline summary edit.
31. `POST /api/v1/encounters/:id/summary/verifications` — Verify/Reject summary → `VERIFIED`.
32. `POST /api/v1/encounters/:id/fhir/exports` — Generate ABDM FHIR R4 Bundle.
33. `GET /api/v1/encounters/:id/fhir/exports/:eid` — Query stored FHIR export by ID.
34. `GET /health` — Real-time infrastructure health probe.

---

## 5. Non-Functional & Regulatory Requirements

1. **Safety First**: AI never provides direct diagnosis or prescriptions. Clinical decision-making remains exclusively with licensed physicians.
2. **Audit Logging**: Every login, consent, question answer, document upload, OCR extraction, summary edit, and verification is permanently logged to `AuditLog`.
3. **Data Security**: Private Azure Blob containers, ephemeral kiosk tokens, and server-side JWT revocation ensure patient data isolation.
4. **Performance**: Static page generation + Next.js Turbopack build (<400ms compiled); question audio prompts cached in Azure Blob with sub-50ms response times.
