# MediKiosk AYUSH Dashavidha MVP Requirements

**Status:** Implemented; awaiting user-operated Postman acceptance
**Scope:** Hackathon MVP only
**Requirement prefix:** AYU

## Product intent

Offer a structured, patient-reported AYUSH pre-consultation intake that preserves Dashavidha and lifestyle context for clinician review. It is a documentation aid, not an automated assessment, diagnosis, prescription, or treatment recommendation.

## Included MVP scope

The server-controlled pathway version is `ayush-dashavidha-v1`. It collects these patient-reported fields as evidence-linked clinical facts:

- Dashavidha: Prakriti, Vikriti, Sara, Samhanana, Pramana, Satmya, Sattva, Ahara Shakti, Vyayama Shakti, and Vaya.
- Lifestyle/context: Ahara, Vihara, Agni, Koshtha, and Nidana.

The pathway uses the existing encounter, consent, sequential-intake, clinical-fact, submission, clinician-review, and summary APIs. It adds no separate identity store or clinical decision engine.

## Functional requirements

| ID | Requirement | MVP acceptance |
| --- | --- | --- |
| AYU-01 | The API accepts only registered pathway versions at encounter creation. | `ayush-dashavidha-v1` creates an encounter; an unknown version returns a safe 422 error. |
| AYU-02 | Active `clinical_intake` consent is required before a response is stored. | Missing/revoked consent is rejected without a new response or fact. |
| AYU-03 | Questions are server-controlled and answered in sequence. | The next question exposes the configured key/prompt/input type; an out-of-sequence key is rejected. |
| AYU-04 | Each accepted response creates a patient-confirmed, evidence-linked `ayush_*` fact. | Facts retain value, response source, language, and verification state. |
| AYU-05 | Required AYUSH fields block submission until complete. | Submit reports required missing keys, then succeeds after completion. |
| AYU-06 | Chest-discomfort rules do not run for an AYUSH encounter. | AYUSH answers cannot create the chest/breathlessness red flag. |
| AYU-07 | A generated AYUSH-only draft is grounded solely in captured AYUSH facts. | Summary content contains `ayush_assessment`; it does not add uncaptured chest fields, diagnosis, treatment, or prescription. |

## Data and safety boundary

- All examples and manual tests use synthetic data only.
- All values are patient-reported until a permitted clinician explicitly verifies downstream material.
- `Prakriti`, `Vikriti`, `Agni`, and other field names are stored as intake labels; the backend does not infer a constitution, condition, risk score, or treatment.
- The deterministic chest safety rule is deliberately scoped to `chest-discomfort-v1`. No AYUSH triage rule is implied by this MVP.
- Any future AYUSH clinical rule, symptom escalation, terminology mapping, or recommendation must be clinically approved, versioned, separately documented, and accompanied by a new Postman acceptance gate.

## Out of scope

- Automated dosha determination or diagnostic classification.
- Prescription, remedy, diet, lifestyle, or treatment recommendations.
- OCR/speech extraction, translation, or live ABDM integration.
- Clinical terminology mapping beyond local fact keys.
- Provider-generated text being treated as verified clinical evidence.

## Verification protocol

The canonical manual API contract is the `AYUSH — Dashavidha intake` folder in `postman/MediKiosk.postman_collection.json`. The user must run `AYU-01` through `AYU-05`, record the status and `X-Request-ID`, and report the outcome. Codex does not execute these API requests.
