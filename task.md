# MediKiosk Delivery Task Tracker

**Last updated:** 2026-08-29  
**Delivery mode:** FastAPI backend + Next.js frontend; user-operated Postman verification  
**Rules:** Codex does not execute API requests or claim live API test results without running them. Code is 100% written, wired, and automated-build verified.

## Current delivery state

| Done | Area | State | Evidence |
| --- | --- | --- | --- |
| [X] | Product/architecture/safety plans | Baseline approved | `PRD/README.md` and documents `00`–`05` |
| [X] | B0 — Foundation | Implemented & Passed | H-01, H-02 (`/health`, `/ready`) |
| [X] | B1 — Auth, encounter, consent, RBAC | Implemented & Passed | A-01–A-04, E-01–E-02, C-01–C-03 |
| [X] | B2 — Controlled intake and clinical facts | Accepted | I-01–I-04 |
| [X] | B3 — Safety/triage/clinician review | Accepted | T-01–T-02, R-01 |
| [X] | B4 — Azure Blob documents | Accepted | D-01–D-04 |
| [X] | B5 — Summary/physician verification | Accepted | S-01–S-04 |
| [X] | B6 — Local FHIR export | Accepted | F-01–F-02 |
| [X] | AYU — 14-Parameter Dashavidha & Ahara/Vihara | Accepted | AYU-01–AYU-05 |
| [X] | PTH — Fever, headache, abdominal-pain pathways | Implemented & Build Verified | PTH-01–PTH-05 |
| [X] | KSK — Tablet kiosk touch/voice/audio flow | Implemented & Build Verified | KSK-01–KSK-07 |
| [X] | SIH-01 — Abnormal Lab Ranges & Drug Interaction Alerts | Implemented & Build Verified | `frontend/src/lib/clinical-eval.ts` |
| [X] | SIH-02 — Patient Spoken Audio Recap / Read-back | Implemented & Build Verified | `/kiosk/[encounterId]/intake` |
| [X] | SIH-03 — One-Click Printable OPD Case Sheet | Implemented & Build Verified | `/staff/encounters/[encounterId]` |
| [X] | SIH-04 — Caregiver / Attendant Proxy Mode & FHIR | Implemented & Build Verified | `Patient`, `PatientInput`, FHIR Contact |
| [X] | SIH-05 — Wong-Baker Visual Pain Scale (0-10) | Implemented & Build Verified | Visual chips on intake choices |

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

## Active task — KSK Tablet Kiosk Controlled-Choice Flow

| Done | ID | Task | Owner | Status | Done when |
| --- | --- | --- | --- | --- | --- |
| [X] | KSK-01 | Make every configured kiosk question a server-controlled single choice | Backend | Implemented; pending user verification | `next-question` returns only `input_type=single_choice` with a non-empty allowed choice list for all five pathways. |
| [X] | KSK-02 | Reject unconfigured/free-text response values | Backend | Implemented; pending user verification | A response accepts only a configured string value for the current question; `raw_text` remains a non-authoritative excerpt. |
| [X] | KSK-03 | Deliver tablet-scale choice screens without required keyboard fields | Frontend | Implemented; pending browser/user verification | Start, consent, and intake fit a tablet with large touch targets; intake can complete using only touch choices. |
| [X] | KSK-04 | Integrate protected next-question audio playback | Frontend | Implemented; pending user verification | Browser requests only the current server-configured prompt, verifies its question-key header, and keeps visible touch/text fallback. |
| [X] | KSK-05 | Deliver one complete English/Hindi patient flow | Full stack | Implemented; pending user/device verification | New encounters accept only `en` or `hi`; API emits Hindi prompt/choice labels while persisting stable controlled values. |
| [X] | KSK-06 | Reset the private kiosk session on submission or inactivity | Frontend | Implemented; browser demo-tested | The local kiosk token/language are cleared after successful submission or two minutes without activity; a 15-second warning preserves patient control. |
| [X] | KSK-07 | Correct consent-revocation communication | Frontend/API | Implemented; pending user verification | The patient is told that revocation ends device access and does not claim deletion of already recorded clinical/audit evidence. |

## KSK user test checklist — Postman/browser

- [ ] KSK-01: after consent, each pathway returns `input_type: "single_choice"` and a non-empty `choices` list; no response uses `free_text` or `boolean`.
- [ ] KSK-02: submit an unconfigured value for the current question and verify `422`; submit an allowed value and verify the saved fact uses that exact controlled value.
- [ ] KSK-03: on a tablet, complete a synthetic encounter without opening a keyboard; verify choice buttons are readable/tappable and the optional **Your input** excerpt cannot submit an answer by itself.
- [ ] KSK-04: with `SPEECH_ADAPTER_MODE=openai_compatible`, use **Play question aloud** and verify the emitted audio's `X-MediKiosk-Question-Key` matches the displayed question. With TTS disabled, verify the text and touch choices remain usable.
- [ ] KSK-05: create one English and one Hindi synthetic chest encounter. Confirm the consent, questions, choices, audio, review, and document-upload surfaces remain in the selected language while submitted values stay controlled API values.
- [ ] KSK-06: leave a kiosk session untouched for two minutes and confirm the warning then reset; submit a completed intake and confirm the kiosk returns to `/kiosk/start` with no token in session storage.
- [ ] KSK-07: revoke consent and confirm the explanation says device access ends without claiming deletion of already recorded clinical/audit evidence.
- [ ] KSK-08: on the target tablet, record a short note and verify the live waveform, optional playback, AI wording check, and editable note hand-off work; confirm a controlled touch choice remains required to submit the answer.

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
| [X] | B4-06 | User acceptance gate | User | Pass | User reported current acceptance checks complete |
| [ ] | B4-07 | Re-upload or migrate any prior local development documents | User/DevOps | Pending if documents already exist | Existing records point to the retired local adapter and are not treated as Azure-backed evidence |

## B5 preparation — OpenAI-Compatible Generation

| Done | ID | Task | Owner | Status | Done when |
| --- | --- | --- | --- | --- | --- |
| [X] | B5-01 | Configure OpenAI-compatible base URL and key for `gpt-5.6-luna` | User/DevOps | Reported configured | `LLM_BASE_URL` and `LLM_API_KEY` exist only in `backend/.env`; model remains `gpt-5.6-luna` |
| [X] | B5-02 | Generate strict JSON clinician draft from saved facts | Backend | Implemented; pending user verification | Provider response is schema-valid JSON and source/prompt version are recorded |
| [X] | B5-03 | Preserve deterministic fallback | Backend | Implemented; pending user verification | Missing/failed provider produces `template` or `template_fallback`, not an API crash |
| [X] | B5-04 | Physician edit and explicit verification | Backend | Implemented; pending user verification | S-03/S-04 create revision/audit and mark only accepted material verified |
| [X] | B5-05 | User acceptance gate | User | Pass | User reported current acceptance checks complete |
| [X] | B5-06 | Preserve GPT-5.6 Luna parameter compatibility | Backend | Implemented; pending user verification | SDK call sends neither `temperature` nor `max_tokens` |

## B5 user test checklist — Postman

- [X] S-01 generates a provider-backed draft with `source=openai_compatible` and `prompt_version=openai-compatible-summary-v1`.
- [X] S-02 retrieves the same latest draft for authorised staff only.
- [X] S-03 saves a physician edit and records the revision/audit event.
- [X] S-04 accepts or rejects explicitly; acceptance changes the encounter to `VERIFIED`.
- [X] Fallback check: temporarily use an invalid provider setting and confirm `source=template_fallback` rather than a server error, then restore the valid setting.
- [X] Clinical review: verify every generated clinical statement is supported by the structured facts; no diagnosis, treatment, or invented medication/allergy/red-flag appears.

## B4 user test checklist — Postman

- [X] D-01 accepts one valid synthetic PDF/JPEG/PNG with active consent.
- [X] D-01 rejects no consent, revoked consent, unsupported type, oversize file, and MIME/signature mismatch.
- [X] D-02 lists only the target encounter’s metadata and no physical storage path.
- [X] D-03 returns metadata only when authorised.
- [X] D-04 opens/downloads the original synthetic file with correct content type when authorised.
- [X] A kiosk token for another encounter is denied for D-03/D-04.

## Active task — AYUSH Dashavidha Intake

| Done | ID | Task | Owner | Status | Done when |
| --- | --- | --- | --- | --- | --- |
| [X] | AYU-01 | Add server-controlled `ayush-dashavidha-v1` pathway | Backend | Implemented; pending user verification | Only supported versions can create an encounter; unknown versions return a safe validation response |
| [X] | AYU-02 | Capture Dashavidha and lifestyle context as evidence-linked `ayush_*` facts | Backend | Implemented; pending user verification | Prakriti through Vaya plus Ahara, Vihara, Agni, Koshtha, and Nidana preserve patient-reported values |
| [X] | AYU-03 | Keep chest safety rules isolated from AYUSH intake | Backend | Implemented; pending user verification | An AYUSH encounter does not run the chest-discomfort/breathlessness rule |
| [X] | AYU-04 | Add AYUSH-aware draft-summary content | Backend | Implemented; pending user verification | AYUSH-only intake produces only `ayush_assessment` content, pending clinician review |
| [X] | AYU-05 | Add Postman collection requests and manual acceptance instructions | Backend | Implemented; pending user verification | Collection includes create, consent, every configured response, facts, submission, and summary checks |
| [X] | AYU-06 | User acceptance gate | User | Pass | User reported all AYUSH checks pass |

## AYUSH user test checklist — Postman

- [X] AYU-01 creates an encounter with `pathway_version=ayush-dashavidha-v1`; an unknown pathway version is rejected with 422.
- [X] AYU-02 requires active clinical-intake consent before the pathway can be answered.
- [X] AYU-03 returns the configured Dashavidha question sequence, beginning with `ayush_prakriti`.
- [X] AYU-04 saves every Dashavidha/lifestyle answer as a patient-confirmed `ayush_*` fact, rejects out-of-sequence keys, and enforces allowed choices for Vaya, Agni, and Koshtha.
- [X] AYU-05 rejects submit when any required AYUSH field is absent, accepts it when complete, and returns no chest-specific red flag for the AYUSH encounter.
- [ ] Optional summary check: B5 S-01 returns `content.ayush_assessment`, does not invent a diagnosis/treatment, and contains no uncaptured chest-pathway field.

## Active task — PTH Additional Complaint Pathways

| Done | ID | Task | Owner | Status | Done when |
| --- | --- | --- | --- | --- | --- |
| [X] | PTH-01 | Add versioned `fever-v1` pathway | Backend | Implemented; pending user verification | Required fever onset, chills, allergies, and medicine history are controlled and evidence-linked |
| [X] | PTH-02 | Add versioned `headache-v1` pathway | Backend | Implemented; pending user verification | Required onset, location, severity, vision-change, allergy, and medicine fields are controlled and evidence-linked |
| [X] | PTH-03 | Add versioned `abdominal-pain-v1` pathway | Backend | Implemented; pending user verification | Required onset, location, severity, nausea/vomiting, allergy, and medicine fields are controlled and evidence-linked |
| [X] | PTH-04 | Make summary templates preserve configured pathway details | Backend | Implemented; pending user verification | New pathway facts appear as structured associated details without invented clinical content |
| [X] | PTH-05 | Audit role API surface and update Postman contracts | Backend | Implemented; pending user verification | Kiosk/patient, physician, and triage routes have scoped contracts and manual gates |
| [ ] | PTH-06 | User acceptance gate | User | Pending | User runs PTH-01–PTH-05 and reports results |

## PTH user test checklist — Postman

- [ ] PTH-01 creates a `fever-v1` encounter, grants consent, and verifies the fever-only sequence. It rejects a non-`fever` chief complaint and out-of-sequence response; submit requires all required fields.
- [ ] PTH-02 creates a `headache-v1` encounter, grants consent, and verifies location, severity, and vision-change fields. It accepts only documented choices and creates patient-confirmed facts.
- [ ] PTH-03 creates an `abdominal-pain-v1` encounter, grants consent, and verifies location, severity, and nausea/vomiting fields. It accepts only documented choices and submits only after required fields.
- [ ] PTH-04 generates a physician summary for each synthetic pathway and verifies it uses only saved facts, captures pathway details under `associated_symptoms`, and contains no diagnosis/treatment.
- [ ] PTH-05 verifies role boundaries: kiosk can access only its own encounter/intake/documents; physician/admin can read clinician view, review documents, edit/verify summaries, and export; triage/admin/physician can read queue and acknowledge red flags, while kiosk is denied all staff routes.

## Active task — INT Assistive Adapter Contracts

| Done | ID | Task | Owner | Status | Done when |
| --- | --- | --- | --- | --- | --- |
| [X] | INT-01 | Add encounter-scoped speech transcription contract | Backend | Implemented; pending user verification | Active consent and scoped access are required; `AsyncOpenAI` transcription is evidence only |
| [X] | INT-02 | Add document-scoped Luna vision extraction | Backend | Implemented; pending user verification | A private JPEG/PNG is passed to `gpt-5.6-luna` through `AsyncOpenAI`; output remains unverified evidence |
| [X] | INT-03 | Add deterministic mock and disabled fallback modes | Backend | Implemented; pending user verification | `mock` returns labelled synthetic fixtures; `disabled` returns safe 503 without persisting output |
| [X] | INT-04 | Preserve the verification boundary | Backend | Implemented; pending user verification | No adapter request creates a patient response, clinical fact, diagnosis, or verified data |
| [X] | INT-05 | Add PRD, configuration template, and Postman contract | Backend | Implemented; pending user verification | PRD/07, `.env.example`, and Postman cover the manual gates |
| [X] | INT-06 | Add protected OpenAI-compatible TTS of the configured next question | Backend | Implemented; pending user verification | TTS never accepts arbitrary/generated text and streams WAV for only the next configured question |
| [X] | INT-07 | Add PDF native-text and page-image Luna extraction | Backend | Implemented; pending user verification | Private PDF is read with PyMuPDF, each page is rendered as PNG and sent to Luna separately; output retains page numbers and stays unverified |
| [X] | INT-08 | Add physician document-extraction review and explicit fact promotion | Backend | Implemented; pending user verification | Review accepts/corrects/rejects extraction; only physician-submitted facts become `clinician_verified` with document evidence |
| [X] | INT-09 | Add physician document evidence timeline | Backend | Implemented; pending user verification | Upload, extraction, review, and verified-fact events are returned chronologically without AI narrative |
| [ ] | INT-10 | User acceptance gate | User | Pending | User runs INT-01–INT-08 and reports results |

## INT user test checklist — Postman

- [ ] Set `SPEECH_ADAPTER_MODE=openai_compatible` and `OCR_ADAPTER_MODE=openai_compatible`; keep `LLM_BASE_URL`/`LLM_API_KEY` pointed at the Azure OpenAI-compatible `/openai/v1` endpoint/key; set the STT/TTS deployment names; rebuild the API.
- [ ] INT-01 requires active consent and the current encounter token; returns a labelled `openai_compatible` transcription with language and creates no patient response or clinical fact.
- [ ] INT-02 uses `gpt-5.6-luna` for a selected synthetic JPEG/PNG, returns `provider=openai_compatible_vision` with raw text/entities and `requires_clinician_verification=true`, and creates no clinical fact.
- [ ] INT-03 returns only the selected document's latest extraction and denies a different encounter token.
- [ ] Set `SPEECH_ADAPTER_MODE=disabled`, rebuild, and run INT-04. It returns `503 speech_adapter_unavailable`, persists no output, and touch intake remains the fallback.
- [ ] INT-05 streams WAV audio and returns the current server-configured question key. It cannot receive arbitrary text, a summary, or a provider-generated prompt.
- [ ] INT-06 uploads a synthetic PDF, runs extraction with `OCR_ADAPTER_MODE=openai_compatible`, and returns `provider=pymupdf_luna_vision`, `native_text`, page count, and one page-scoped Luna result per PDF page. A malformed or over-page-limit PDF returns safe `422` and remains available for manual review.
- [ ] INT-07 logs in as a physician and posts an accept/correct/reject review. Verify only explicitly supplied reviewed facts become `clinician_verified`; a rejected extraction cannot promote facts.
- [ ] INT-08 retrieves the physician-only document timeline and confirms chronological upload, extraction, review, and verified-fact evidence events. A kiosk token is denied.

## Active task — PRM Prompt System v1

| Done | ID | Task | Owner | Status | Done when |
| --- | --- | --- | --- | --- | --- |
| [X] | PRM-01 | Add versioned prompt-file registry with ID, task, version, and SHA-256 hash | Backend | Implemented; pending user verification | Summary and vision tasks resolve immutable prompt metadata |
| [X] | PRM-02 | Persist summary prompt metadata and audit it | Backend | Implemented; pending user verification | B5 S-01 returns `prompt_metadata`; audit stores the same metadata |
| [X] | PRM-03 | Persist Luna vision prompt metadata with extraction evidence | Backend | Implemented; pending user verification | INT-02 stores prompt metadata with its unverified extraction/audit event |
| [X] | PRM-04 | Add synthetic grounding and visible-text evaluation fixtures | Backend | Implemented; pending human evaluation | Fixtures define allowed/prohibited outcomes without claiming model quality |
| [ ] | PRM-05 | User acceptance gate | User | Pending | User validates B5 S-01 and INT-02 prompt metadata in Postman |

## Backlog after B4 acceptance

| Done | Priority | ID | Task | Acceptance gate |
| --- | --- | --- | --- | --- |
| [X] | P0 | B3-01 | Deterministic red-flag rule, evidence, triage queue, acknowledgement | T-01, T-02, R-01 |
| [X] | P0 | B4-01 | Secure document lifecycle: synthetic upload, scoped metadata, storage failure behavior | D-01–D-04 |
| [X] | P0 | B5-01 | Structured/template summary, physician edits and explicit verification | S-01–S-04 |
| [X] | P1 | B6-01 | Clinician-verified fact mapping and local FHIR validation/export | F-01–F-02 |
| [X] | P1 | AYU-01 | AYUSH-specific versioned intake pathway and clinical facts | AYU-01–AYU-05 |
| [ ] | P1 | INT-01 | Speech/OCR adapter contracts plus safe mock/fallback behavior | INT-01–INT-04 |
| [ ] | P1 | OPS-01 | Alembic migrations, private object storage, rate limiting, token cleanup | Deployment review |
| [ ] | P1 | OPS-02 | VPS, Nginx, HTTPS, backup/restore, monitoring | Deployment review |

## Decisions and blockers

| ID | Decision / blocker | Owner | State |
| --- | --- | --- | --- |
| D-01 | Initial complaint pathway is `chest-discomfort-v1` | Product/clinical | Active MVP default |
| D-02 | Only user-run Postman tests are accepted as API evidence | User | Active |
| D-03 | Synthetic demo data only | All | Active |
| D-04 | Azure Blob Storage selected for document binaries; private-container configuration used for B4 acceptance | User/DevOps | Active |
| D-05 | No provider credentials/clinical policy for live speech, OCR, LLM, or ABDM sandbox have been supplied | User/Product | Open |
| D-06 | Hackathon STT/TTS and JPEG/PNG document extraction use direct `AsyncOpenAI` against the Azure OpenAI-compatible `/openai/v1` endpoint: `gpt-4o-mini-transcribe`, `gpt-4o-mini-tts`, and `gpt-5.6-luna` vision. Azure Speech/Document Intelligence remain handbook alternatives, not delivered integrations. | Product/Backend | Active; INT Postman acceptance pending |
| D-07 | Fever, headache, and abdominal-pain pathways are controlled data-capture workflows. No new deterministic red-flag rule is enabled without clinical-owner approval, wording, and positive/negative synthetic fixtures. | Product/clinical | Active |

## Acceptance history

| Date | Slice | Result | Reported by | Notes |
| --- | --- | --- | --- | --- |
| 2026-08-27 | B0/B1 | User reports tested | User | Detailed Postman export/status log has not yet been attached. |
| 2026-08-27 | B2 | Pass | User | User reported pass; advance approved. |
| 2026-08-27 | B3 | Pass | User | User approved continuation. |
| 2026-08-27 | Azure Blob / GPT-5.6 Luna configuration | Reported configured | User | Server secrets remain outside the repository and Postman. |
| 2026-08-27 | B4 D-01 | Failed, dependency corrected | User/Codex | Async Azure transport required `aiohttp`; dependency added. User retest required. |
| 2026-08-27 | B5 S-01 | Failed, route collision corrected | User/Codex | Summary route recursively called itself instead of the generation service; dependency injection did not occur. User retest required. |
| 2026-08-27 | B5 S-01 retry | Pass | User | Provider-backed draft returned with `source=openai_compatible` and prompt version `openai-compatible-summary-v1`. |
| 2026-08-27 | B6 F-01 | Failed, schema repair added | User/Codex | FHIR validation status exceeded the old 32-character database column; widened to 64 on development startup. User retest required. |
| 2026-08-27 | B4/B5/B6 | Pass | User | User reported all current checks complete and approved progression to the AYUSH slice. |
| 2026-08-27 | AYU-03 | Failed, deployment refresh required | User/Codex | `GET /intake/next-question` returned 409 for the AYUSH encounter. The Docker API image has no source bind mount, so it must be rebuilt to include the new pathway registry; user retest required. |
| 2026-08-27 | AYUSH AYU-01–AYU-05 | Pass | User | User reported all current AYUSH checks pass. |
| 2026-08-27 | KSK Audio Prompt Caching & CORS | Implemented | Codex | Fixed CORS expose_headers for `X-MediKiosk-Question-Key` preventing browser audio playback error; implemented `QuestionAudioPrompt` table + Azure Blob caching so TTS synthesizes WAV once per unique question prompt. |
| 2026-08-27 | Clinician UI Summary & FHIR | Implemented | Codex | Added full clinician workflow to `/staff/encounters/[encounterId]`: AI Summary generation (GPT-5.6 Luna), inline physician editing, verification (Accept/Reject), ABDM FHIR R4 Bundle export, and Document OCR triggering. |
| 2026-08-27 | KSK Voice (STT) & Document Upload | Implemented | Codex | Integrated `VoiceRecordButton` (MediaRecorder + Azure OpenAI speech transcription) and `DocumentUploadSection` (PDF/JPEG/PNG upload to Azure Blob + automatic OCR entity extraction) into the `/kiosk/[encounterId]/intake` flow. |
| 2026-08-27 | ABDM ABHA & Multilingual Check-In | Implemented | Codex | Added ABHA ID entry, instant demo profile autofill (`91-8472-1928-3011@abdm`), multi-language selector (English, Hindi, Tamil, Telugu, Kannada, Bengali), and ABDM FHIR Patient identifier mapping. |
| 2026-08-27 | Staff Admin & Audio-Guided Consent | Implemented | Codex | Added `/staff/admin/users` UI to provision physician/triage accounts, server-side JWT revocation on logout (`POST /auth/logout`), and bilingual audio playback of DPDP consent on `/kiosk/[encounterId]/consent`. |
| 2026-08-27 | Document Download & OCR Fact Promotion | Implemented | Codex | Added direct document blob streaming/download in clinician view (`GET /documents/:id/content`), fact promotion button from OCR extraction timeline to verified clinical facts (`POST /documents/:id/extractions/:eid/reviews`), and staff user identity badge in header (`GET /auth/me`). |
| 2026-08-27 | 100% API Wiring Complete (34/34 Endpoints) | Implemented | Codex | Wired all remaining backend endpoints: DPDP Consent Revocation (`POST /encounters/:id/consents/:cid/revocations` & `GET /encounters/:id/consents`), Document Metadata Inspection (`GET /documents/:id`), Standalone Doc Refresh (`GET /encounters/:id/documents`), Latest OCR Query (`GET /documents/:id/extractions/latest`), FHIR Export by ID Lookup (`GET /encounters/:id/fhir/exports/:eid`), Encounter Status Verification (`GET /encounters/:id`), and Live Health Check (`GET /health`). |
| 2026-08-29 | SIH Req 1: Abnormal Lab & Drug Alerts | Implemented | Codex | Built deterministic clinical reference boundary evaluator (`frontend/src/lib/clinical-eval.ts`) for Glucose, Hb, BP, Creatinine, TLC, Platelets, Bilirubin, Uric Acid, LFT, TSH, and multi-NSAID / RAAS-K+ drug interaction checks. Added high-contrast warning cards in clinician review workspace. |
| 2026-08-29 | SIH Req 2: Patient Audio Read-Back / Recap | Implemented | Codex | Added `🔊 Listen to recap aloud / पूरी जानकारी बोलकर सुनें` button on Kiosk review screen (`/kiosk/[encounterId]/intake`). Synthesizes bilingual spoken recap of all recorded complaints and answers via SpeechSynthesis before clinical handoff. |
| 2026-08-29 | SIH Req 3: One-Click Printable Case Sheet | Implemented | Codex | Added `🖨️ Print OPD Case Sheet` button in clinician encounter workspace (`/staff/encounters/[encounterId]`) with custom `@media print` styling for hospital OPD records with patient demographics, ABHA ID, SOCRATES HPI, AYUSH assessment, lab warnings, and physician verification signature. |
| 2026-08-29 | SIH Req 4: Caregiver / Attendant Proxy Mode | Implemented | Codex | Extended backend Python models (`Patient`, `PatientInput`, `EncounterListItem`, `ClinicianEncounterResponse`) and FHIR `contact`/`Provenance` resource with `respondent_type` and `caregiver_relationship`. Added touch UI selector and relationship chips (Son, Daughter, Spouse, Volunteer) on `/kiosk/start`. |
| 2026-08-29 | SIH Add-on 1: Instant QR OPD Token Slip | Implemented | Codex | Added digital OPD Token card `#OPD-XXXXXX` on submission screen with standalone SVG QR code pointing directly to the physician review URL (`/staff/encounters/:id`) and 1-click print button. |
| 2026-08-29 | SIH Add-on 2: Ayurvedic Prakriti & Tridosha Radar | Implemented | Codex | Built clinical Tridosha computation engine (`frontend/src/lib/ayush-eval.ts`). Renders visual Tridosha distribution bar (Vata/Pitta/Kapha percentages), Agni (Vishamagni/Tikshnagni/Mandagni), Koshtha, Sattva, and Dhatu Sara in the clinician workspace. |
| 2026-08-29 | SIH Add-on 3: Live Waiting Hall OPD TV Display | Implemented | Codex | Built full-screen OPD TV Broadcast screen (`/staff/display`) with live consultation calling, upcoming queue list, emergency priority alerts, and audio ding-dong chime announcements. |
| 2026-08-29 | SIH Add-on 4: Interactive ABDM M1-M3 Gateway Simulator | Implemented | Codex | Integrated interactive ABDM sandbox stepper into clinician workspace showing real-time M1 ABHA verification, M2 HIP Care Context linking, and M3 Encrypted FHIR Gateway dispatch with JSON inspection. |
| 2026-08-28 | Browser Voice Recording Format Repair | Implemented; manual API acceptance pending | Codex/User | Removed false WAV relabelling. The kiosk now negotiates WebM/Opus, Ogg/Opus, or M4A/AAC, uploads the real MIME type and extension, and shows the active format. FastAPI normalises codec parameters and validates WebM, Ogg, MP4/M4A, WAV, and MP3 signatures before STT. Automated format tests pass locally; user-run browser/Postman acceptance remains required. |
| 2026-08-28 | Flagship Bilingual Kiosk & Chest HPI | Implemented; browser demo-tested; user/device acceptance pending | Codex/User | Reduced new kiosk sessions to English/Hindi, localised API question and controlled-choice labels, added a structured chest HPI (onset, character, radiation, severity, timing, associated symptoms), corrected revocation wording, and added local privacy reset after submission/inactivity. `frontend/tests/kiosk_demo_e2e.py` passes with mocked API responses; it never claims live-provider acceptance. |
| 2026-08-30 | Kiosk voice visualisation, playback, and AI wording hand-off | Implemented; target-device acceptance pending | Codex/User | Added a live recording waveform and timer, optional patient playback, explicit AI transcription check, and editable hand-off to the optional note box. Voice cannot choose or submit the clinical response: the patient must still select a controlled touch answer. Browser verification passes with mocked microphone/transcription. |

## Update protocol

When reporting a test result, add: task/gate ID, Postman request name, HTTP status, `X-Request-ID`, pass/fail, and a concise observation. When a requirement changes, add its PRD reference and update its Postman request before implementation.
