AI, Clinical Safety & Data Design

How to use AI without turning the system into an unsafe diagnosis chatbot

**Design principle:** Build the smallest trustworthy end-to-end clinical intake flow that proves the problem statement. Prefer clear workflows over extra infrastructure.

# 1\. Safety stance

**One-sentence rule:** Clinical policy decides what must be collected and when to escalate; AI helps understand language, structure data, and draft summaries.

| **AI may do**                                   | **AI must not do**                                |
| ----------------------------------------------- | ------------------------------------------------- |
| Transcribe speech                               | Declare a final diagnosis                         |
| Translate/rephrase questions                    | Prescribe medicine or treatment                   |
| Extract structured facts                        | Suppress a deterministic safety alert             |
| Classify document type                          | Invent missing medical history                    |
| Extract medication/lab entities with confidence | Turn uncertain OCR into a confident fact          |
| Draft a summary from provided facts             | Save a draft as physician-verified without review |

# 2\. Controlled interview engine

Each complaint pathway is a small, clinician-reviewable configuration. The workflow engine selects a required question; the language layer can render it naturally in the patient's selected language.

| **Pathway element** | **Example: chest discomfort**                                             |
| ------------------- | ------------------------------------------------------------------------- |
| Required detail     | Onset / duration                                                          |
| Required detail     | Character / severity                                                      |
| Required detail     | Radiation                                                                 |
| Associated symptoms | Breathlessness, sweating, syncope                                         |
| Safety check        | Clinician-defined combinations that request urgent review                 |
| Stop/skip rule      | Do not repeatedly ask a field already answered with sufficient confidence |

# 3\. Speech pipeline

1. Capture short voice answer; noise handling/voice activity detection if available.
2. ASR returns transcript plus confidence when supported.
3. Medical-entity extraction maps transcript to the expected schema.
4. If a critical field is uncertain, show/read back what was understood and ask for confirmation.
5. Store normalized fact and preserve the original response reference.

# 4\. Document intelligence pipeline

1. Capture/upload and run quality checks (cropping, blur, rotation).
2. Classify document type.
3. For PDFs, extract native text with PyMuPDF and render each page to PNG; run Luna extraction one page at a time. For source images, run Luna against the original image.
4. Extract clinical entities such as medicines, dose/frequency, diagnosis, test, value, unit, reference range, and date.
5. Normalize units/dates only when safe; keep original text beside normalized value.
6. Attach confidence and source location to each entity.
7. Low-confidence or clinically important items require patient/physician verification.
8. Preserve upload, page extraction, review, and verified-fact events on the evidence timeline. Place the document on the clinical timeline using the best supported clinical date only after clinician review; show uncertainty if the date is unclear.

# 5\. Evidence Trace model

**Differentiator:** Every important fact should answer: "Who/what said this, how certain are we, and has a human verified it?"

| **Field**           | **Example**                                      |
| ------------------- | ------------------------------------------------ |
| Fact                | Metformin 500 mg twice daily                     |
| Source type         | Prescription                                     |
| Source              | Document D-102, page 1                           |
| AI confidence       | 0.94                                             |
| Verification status | Patient confirmed / Doctor verified / Unverified |
| Original text       | "Tab Metformin 500 mg BD"                        |

# 6\. Red-flag design

- Rules must be written/reviewed with appropriate clinical supervision; the project team should not invent clinical thresholds ad hoc.
- Normalize input to symptoms/facts first, then evaluate rules.
- Alert wording should request clinical assessment, not assert a diagnosis.
- Store which facts triggered the rule so the alert is explainable.
- Test every rule with positive and negative cases; prioritize recall in the curated safety test set.
- If the safety engine fails, do not silently mark the patient as normal; surface a system error and use manual triage fallback.

# 7\. Summary-generation contract

| **Input**           | **Rule**                                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Structured facts    | Primary source for the summary                                                                                           |
| Document entities   | Only include with source/confidence                                                                                      |
| Raw transcript      | Use only for evidence/clarification, not as permission to invent details                                                 |
| Template            | Fixed headings: complaint, HPI, past history, medicines/allergies, family/personal, ROS, investigations, AYUSH when used |
| Missing information | State "not captured / not reported" rather than filling gaps                                                             |
| Output              | Draft for physician review; never labelled final diagnosis                                                               |

# 8\. Verification states

| **State**          | **Meaning**                                    | **UI treatment**                      |
| ------------------ | ---------------------------------------------- | ------------------------------------- |
| Unverified         | AI extracted but no human confirmed            | Subtle warning / confidence shown     |
| Patient confirmed  | Patient/caregiver confirmed the interpretation | Marked confirmed, still editable      |
| Physician verified | Clinician reviewed/accepted or corrected       | Highest trust state for export        |
| Rejected           | Clinician marked incorrect                     | Excluded from verified summary/export |

# 9\. AYUSH data section

Create a dedicated AYUSH assessment object rather than stuffing all responses into free text. The specific clinical interpretation of these parameters should be reviewed with an Ayurveda clinician; the software's role is reliable capture and presentation.

| **Field group**  | **Examples from the problem statement**                                                         |
| ---------------- | ----------------------------------------------------------------------------------------------- |
| Dashavidha       | Prakriti, Vikriti, Sara, Samhanana, Pramana, Satmya, Sattva, Ahara Shakti, Vyayama Shakti, Vaya |
| Lifestyle        | Ahara-Vihara                                                                                    |
| Capture metadata | response source, language, confidence, verification status                                      |

# 10\. Interoperability mapping approach

**Keep it simple:** Do not make the internal database "FHIR-shaped." Store useful domain objects, then map verified data into FHIR at export time.

| **Internal concept**   | **Possible FHIR representation (verify against chosen ABDM profile)** |
| ---------------------- | --------------------------------------------------------------------- |
| Patient identity       | Patient                                                               |
| Visit/intake           | Encounter                                                             |
| Problem/condition      | Condition                                                             |
| Observation/lab result | Observation / DiagnosticReport                                        |
| Allergy                | AllergyIntolerance                                                    |
| Medication information | MedicationStatement and/or MedicationRequest depending on context     |
| Scanned record         | DocumentReference                                                     |
| Clinical summary       | Composition / document Bundle as required by profile                  |

# 11\. Privacy and consent checklist

- Explain purpose in simple text/audio before capture.
- Record explicit consent state and scope.
- Use synthetic patients for hackathon demonstration.
- Minimize storage of raw audio and temporary document copies.
- Separate authentication/authorization from clinical AI prompts.
- Do not send more patient data to an external AI provider than the task requires.
- Log important access and export actions without logging sensitive content unnecessarily.

# 12\. Known limitations to state openly

- Speech accuracy varies with language, accent, noise, microphone quality, and medical vocabulary.
- Handwritten-document OCR is less reliable than clean printed text.
- Clinical red-flag coverage is limited to the reviewed rules included in the prototype.
- Fever, headache, and abdominal-pain pathways capture structured history but do not create new automated urgent-review flags until a clinical owner approves their rule wording and synthetic positive/negative fixtures.
- FHIR export demonstrates interoperability engineering; production ABDM onboarding/operational certification is separate.
- The summary is an assistive draft, not a medical diagnosis or substitute for examination.

## Terms in plain English

| **Term**              | **Plain-English meaning**                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------- |
| ASR                   | Automatic Speech Recognition — converts spoken audio into text.                                         |
| TTS                   | Text-to-Speech — reads text aloud to the patient.                                                       |
| OCR                   | Optical Character Recognition — extracts text from images/scanned documents.                            |
| Confidence score      | A model/system estimate of how certain it is. It is not the same as clinical truth.                     |
| Normalization         | Converting equivalent forms into a consistent form, e.g., dates or units, while retaining the original. |
| Schema-constrained AI | AI output must fit predefined fields/types instead of returning unrestricted prose.                     |
| Deterministic rule    | A rule that gives the same result for the same inputs; useful for predictable safety behavior.          |
| Clinical provenance   | Evidence showing where a clinical fact came from and who verified it.                                   |

## Source basis

**Primary basis:** SIH26047 Patient Case-Taking Software problem statement supplied for this project. [Official SIH 2026 problem-statement portal](https://sih.gov.in/sih2026PS)

**Interoperability/security references:** [ABDM](https://abdm.gov.in/) | [ABDM FHIR Implementation Guide](https://www.nrces.in/ndhm/fhir/r4/) | [Digital Personal Data Protection Act / Rules (MeitY)](https://www.meity.gov.in/)
