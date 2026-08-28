# MediKiosk Product Requirements Document (PRD) & Lean SRS

SIH26047 — Patient Case-Taking Software | What to build, what not to build, and how to know it is done

**Document status:** Product baseline for planning. Backend implementation is governed by `00_MediKiosk_Pre_Development_FastAPI_Plan.md`; no feature enters development until its acceptance, safety, and user-operated Postman test gate are defined.

**Design principle:** Build the smallest trustworthy end-to-end clinical intake flow that proves the problem statement. Prefer clear workflows over extra infrastructure.

# 1\. Executive summary

MediKiosk is a pre-consultation clinical-intake platform. A patient uses voice or touch to provide history, scans previous medical documents, and receives a confirmation step. The system structures the information, highlights defined red flags, and prepares an editable physician summary. It supports AYUSH-specific case-taking and a standards-based path to HIS/ABDM interoperability.

**Product boundary:** The product assists history collection and document organization. It does not diagnose, prescribe, or replace clinical judgment.

# 2\. Problem and objectives

| **Problem**                                | **Objective**                                       | **How the MVP proves it**                          |
| ------------------------------------------ | --------------------------------------------------- | -------------------------------------------------- |
| Very short OPD consultation time           | Move routine history collection before consultation | Patient completes guided intake before doctor view |
| History is incomplete or repeatedly asked  | Capture a reusable structured history               | Required fields + adaptive complaint pathway       |
| Paper records are fragmented               | Digitize and organize prior records                 | Scan 3 common document types + timeline            |
| AYUSH history is deeper and time-consuming | Support Dashavidha/related assessment               | Dedicated AYUSH flow and doctor view               |
| Low literacy / elderly users               | Make intake usable without training                 | Voice prompts, large touch choices, assisted mode  |
| AI can be unsafe or opaque                 | Keep humans in control and show evidence            | Source trace + confidence + doctor edit/accept     |

# 3\. Users and jobs-to-be-done

| **User**               | **What they need**                                                                       |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| Patient                | Finish intake quickly in a preferred language without needing medical vocabulary.        |
| Caregiver/attendant    | Help answer while clearly marking which answers came from the caregiver.                 |
| Triage staff           | See urgent-review alerts without reading the full history.                               |
| Physician              | Read a concise, editable, evidence-linked summary and open source details when needed.   |
| Hospital administrator | Configure departments, languages, users, and audit access.                               |
| HIS/ABDM systems       | Receive validated structured data through an adapter rather than custom screen scraping. |

# 4\. MVP scope

## Must have (P0)

- English + Hindi intake; one regional language only if the core flow is already stable.
- Voice input plus touch fallback for every essential question.
- Structured general clinical history: chief complaint, HPI, past medical/surgical history, medications, allergies, family/personal history, and review of systems.
- Four server-controlled complaint pathways: chest discomfort, abdominal pain, fever, and headache. Each stores evidence-linked answers and required completion fields; only the clinician-reviewed chest rule currently creates urgent-review status.
- One deterministic red-flag demonstration that immediately requests clinical review.
- AYUSH mode covering the Dashavidha parameters named in the problem statement plus Ahara-Vihara.
- Document capture for printed prescription, lab report, and discharge summary; extracted facts shown with confidence/source.
- Chronological document timeline.
- Physician summary with edit, accept, and reject controls.
- Consent before collection/sharing, automatic kiosk logout, and synthetic demo patients.

## Should have (P1)

- Clinical Evidence Trace: every displayed fact links back to patient response or document evidence.
- Patient read-back/confirmation in the selected language.
- FHIR export preview and validator-backed demo adapter.
- Triage mini-dashboard.
- Graceful fallback when speech or AI service is unavailable.

## Not in the hackathon MVP

- Autonomous diagnosis, treatment recommendation, or prescription.
- Full hospital ERP, billing, insurance, pharmacy, or appointment platform.
- Dozens of languages or diseases.
- Custom model training unless it is necessary for a measured gap.
- Complex microservice topology, Kubernetes, event streaming, or blockchain.
- Claims of production ABDM integration unless real sandbox integration has been tested.

# 5\. Core user journey

1. Start: choose language and accessibility mode.
2. Consent and identify: authenticate or create a temporary/sandbox patient identity.
3. Converse: explain the main problem by voice or touch; system asks pathway-guided follow-ups.
4. Safety: defined red-flag combinations create an urgent-review alert; the interview can continue only if the clinical workflow allows.
5. Scan: capture previous records; show extraction and low-confidence items for verification.
6. Confirm: patient hears/sees a short recap and corrects obvious errors.
7. Submit: structured facts and evidence are stored for the encounter.
8. Consult: physician sees summary, evidence, timeline, flags, and AYUSH section; physician edits/accepts.
9. Export: validated data can be mapped through an HIS/FHIR/ABDM adapter.

# 6\. Functional requirements

| **ID** | **Area**          | **Requirement**                                                                              | **Priority** |
| ------ | ----------------- | -------------------------------------------------------------------------------------------- | ------------ |
| FR-001 | Language          | Patient can complete the kiosk in English or Hindi; API questions and controlled answer labels use the selected language while persisted values remain stable. | P0 |
| FR-002 | Accessibility     | Essential questions support touch; audio prompts are available.                              | P0           |
| FR-003 | Voice             | System captures voice and displays transcript/understanding for confirmation when uncertain. | P0           |
| FR-004 | History           | System stores required general clinical-history sections in structured form.                 | P0           |
| FR-005 | Adaptive pathway  | Next questions depend on complaint and prior answers using a controlled pathway.             | P0           |
| FR-006 | AYUSH             | Dedicated flow captures required Dashavidha parameters and Ahara-Vihara.                     | P0           |
| FR-007 | Red flag          | Clinician-reviewed rules can trigger urgent-review status.                                   | P0           |
| FR-008 | Document capture  | Patient can scan/upload prescription, lab report, discharge summary.                         | P0           |
| FR-009 | Extraction        | System extracts available dates, medications, diagnoses, tests, values, units, and ranges.   | P0           |
| FR-010 | Timeline          | Documents are ordered by normalized clinical date with source retained.                      | P0           |
| FR-011 | Summary           | System generates a concise physician draft from structured facts.                            | P0           |
| FR-012 | Evidence          | Important summary facts can link to patient response/document source.                        | P1           |
| FR-013 | Physician control | Doctor can edit, accept, or reject the generated draft.                                      | P0           |
| FR-014 | Consent           | Collection/sharing is gated by explicit consent state.                                       | P0           |
| FR-015 | Audit             | Key clinical edits, consent changes, exports, and access are recorded.                       | P1           |
| FR-016 | Interoperability  | Internal data can be transformed into FHIR-compatible export through an adapter.             | P1           |
| FR-017 | Kiosk privacy     | The kiosk clears its local session after submission or inactivity; revoking consent ends device access but does not claim to delete already recorded clinical/audit evidence. | P0 |
| FR-017 | Fallback          | If voice/LLM is unavailable, touch-based structured intake continues.                        | P1           |
| FR-018 | Pathway coverage  | Chest discomfort, abdominal pain, fever, and headache use independently versioned, controlled pathways. | P0 |
| FR-019 | Role APIs         | Kiosk/patient, physician, and triage operations enforce separate access boundaries. | P0 |
| FR-020 | Tablet kiosk      | Essential kiosk answers are server-configured single-choice touch targets; no keyboard is required to complete intake. Any optional typed context is visibly non-authoritative and cannot replace the selected answer. | P0 |

# 7\. Non-functional requirements and acceptance targets

| **Area**         | **Prototype target / rule**                                                                                    |
| ---------------- | -------------------------------------------------------------------------------------------------------------- |
| Usability        | A first-time user can complete the happy path without verbal coaching from the team.                           |
| Performance      | Normal UI interactions feel immediate; summary generation target <10 seconds after final submission.           |
| Safety           | No autonomous diagnosis/prescription; deterministic red flags cannot be silently downgraded by an LLM.         |
| Reliability      | Voice/AI failure falls back to touch rather than losing the encounter.                                         |
| Security         | TLS in transit, role-based access, auto logout, no secrets in source code.                                     |
| Privacy          | Collect minimum required data; consent recorded; temporary kiosk/session data cleared after submission/logout. |
| Traceability     | AI-extracted/summary facts retain source and confidence where available.                                       |
| Interoperability | Demo exports are validated against the chosen FHIR profile/version before being shown as valid.                |

# 8\. Definition of done for the hackathon

- One patient can complete intake end-to-end without a developer touching the backend.
- A red-flag test case raises the expected alert every time in the curated demo test set.
- A printed lab/prescription/discharge document can be processed and the source can be opened from the doctor view.
- AYUSH mode is visible and complete enough to show that the solution is not a generic allopathic chatbot.
- The doctor can correct the AI summary and the correction is retained.
- The same demo still works if speech is intentionally disabled and touch fallback is used.
- The team can explain what data is stored, why it is stored, and where AI is allowed/not allowed to decide.

## Terms in plain English

| **Term**                  | **Plain-English meaning**                                                                          |
| ------------------------- | -------------------------------------------------------------------------------------------------- |
| HPI                       | History of Present Illness — the detailed story of the current complaint.                          |
| ROS                       | Review of Systems — structured questions about symptoms across body systems.                       |
| Red flag                  | A symptom pattern that warrants faster clinical assessment; it is not itself a diagnosis.          |
| Human-in-the-loop         | A person, here the clinician/patient, verifies or corrects AI output before it becomes trusted.    |
| Provenance / source trace | A record of where a fact came from: patient speech, caregiver, document, or doctor.                |
| FHIR                      | A healthcare data-exchange standard. Think "common structured format for health systems."          |
| ABDM                      | Ayushman Bharat Digital Mission — India's digital-health ecosystem and interoperability framework. |
| ABHA                      | Ayushman Bharat Health Account — a health account/identifier used within ABDM workflows.           |

## Source basis

**Primary basis:** SIH26047 Patient Case-Taking Software problem statement supplied for this project. [Official SIH 2026 problem-statement portal](https://sih.gov.in/sih2026PS)

**Interoperability/security references:** [ABDM](https://abdm.gov.in/) | [ABDM FHIR Implementation Guide](https://www.nrces.in/ndhm/fhir/r4/) | [Digital Personal Data Protection Act / Rules (MeitY)](https://www.meity.gov.in/)
