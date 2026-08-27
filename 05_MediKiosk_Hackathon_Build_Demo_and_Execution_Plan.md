Hackathon Build, Demo & Execution Plan

What the team should build first, how to present it, and how to stay aligned with SIH26047

**Design principle:** Build the smallest trustworthy end-to-end clinical intake flow that proves the problem statement. Prefer clear workflows over extra infrastructure.

# 1\. Winning product story

**Positioning:** "Patient speaks and scans; MediKiosk structures the story; the doctor verifies it before consultation."

The demo should prove throughput, accessibility, AYUSH specificity, document intelligence, safety, and physician control. Architecture is supporting evidence, not the opening act.

# 2\. Build sequence — no over-engineering

**Backend gate:** Before Phase A, approve `00_MediKiosk_Pre_Development_FastAPI_Plan.md`. After every backend slice, the user tests all requests for that slice using `postman/MediKiosk.postman_collection.json`. Do not move to the next slice or claim completion from an AI-run test; Codex does not execute API tests.

| **Phase**             | **Build only this**                                       | **Exit condition**                                  |
| --------------------- | --------------------------------------------------------- | --------------------------------------------------- |
| A — Skeleton          | Patient UI, doctor UI, one API, database, encounter state | Patient answer appears on doctor screen             |
| B — Structured intake | One complaint pathway + required history + touch          | Complete structured history without AI              |
| C — Speech            | ASR/TTS adapter + Hindi/English                           | Same flow works by voice; touch fallback remains    |
| D — Safety            | One reviewed red-flag rule + triage alert                 | Positive/negative test cases pass                   |
| E — Documents         | Upload/scan + printed OCR/extraction + timeline           | One lab/prescription visible with source            |
| F — Summary           | Template-bound draft + physician edit/accept              | Doctor can correct and finalize                     |
| G — AYUSH             | Dedicated Dashavidha flow/section                         | AYUSH scenario is visibly real, not a label         |
| H — Interop           | FHIR mapping + validator + optional ABDM sandbox adapter  | Demo export validates                               |
| I — Polish            | Evidence Trace, recovery modes, metrics, demo fixtures    | Full demo runs twice without developer intervention |

# 3\. Team workstreams

| **Workstream**   | **Owns**                                                      | **Avoid**                                 |
| ---------------- | ------------------------------------------------------------- | ----------------------------------------- |
| Product/Clinical | flows, field definitions, red-flag rules, synthetic scenarios | coding unreviewed clinical rules ad hoc   |
| Frontend         | patient accessibility + doctor/triage views                   | excessive animations / design system work |
| Backend          | encounter state, facts, consent, audit, adapters              | splitting services prematurely            |
| AI/Document      | ASR/OCR/extraction/summary adapters and evals                 | one giant prompt that does everything     |
| Interop/QA       | FHIR mapping/validation, automated tests, demo recovery       | claiming untested production compliance   |

# 4\. Suggested repository structure

apps/  
patient-web/  
clinician-web/  
backend/  
api/  
modules/  
workflow/  
safety/  
documents/  
summary/  
interoperability/  
tests/  
configs/  
pathways/  
red_flags/  
ayush/  
fixtures/  
patients/  
documents/  
audio/  
docs/

# 5\. Traceability matrix — PS to demo

| **Problem-statement objective** | **Feature**                        | **Proof in demo/test**                            |
| ------------------------------- | ---------------------------------- | ------------------------------------------------- |
| Multilingual voice capture      | ASR + TTS + language selector      | Hindi spoken intake                               |
| Voice + touch                   | Dual-mode question UI              | Disable voice and continue by touch               |
| Adaptive clinical history       | Controlled complaint pathway       | Chest-pain follow-ups adapt to answers            |
| Low-literacy/elderly access     | Audio, large targets, simple steps | First-time usability test                         |
| AYUSH case-taking               | Dedicated Dashavidha flow          | Separate Ayurveda scenario/doctor section         |
| Document digitization           | OCR + entity extraction            | Scan lab/prescription and open source             |
| Chronological records           | Document timeline                  | Older/newer records ordered                       |
| Red-flag handling               | Rules engine + triage alert        | Urgent-review scenario                            |
| Physician-ready summary         | Structured draft + edit/accept     | Doctor corrects AI output                         |
| Privacy/consent                 | Consent state + logout/cleanup     | New patient cannot see prior session              |
| ABDM/HIS interoperability       | FHIR adapter/validator             | Validated export; sandbox only if truly connected |

# 6\. Demo script (5–7 minutes)

1. Problem (30–45 sec): show the bottleneck — short consultation, deep history, scattered paper records.
2. Patient starts in Hindi: consent and simple voice/touch onboarding.
3. Patient reports chest discomfort + breathlessness; system asks controlled follow-ups and raises "urgent clinical review," not a diagnosis.
4. Scan a synthetic lab report/prescription; extracted values and source appear in a timeline.
5. Switch to doctor view: show concise HPI, medication/allergy section, red flag, prior investigations, and evidence chips.
6. Doctor opens one source, corrects one AI-extracted detail, and accepts the draft.
7. Show AYUSH mode/section so judges see direct alignment with Ministry of Ayush context.
8. Show FHIR export/validation. If real sandbox integration exists, show it; otherwise say clearly that this is the adapter/validation step.
9. Finish with measured prototype metrics and one sentence on scale: more kiosks share the same backend; clinical pathways/languages are configurable.

# 7\. Presentation structure

| **Slide** | **Message**                                                   |
| --------- | ------------------------------------------------------------- |
| 1         | The OPD history bottleneck                                    |
| 2         | Why registration apps/chatbots/scanners alone do not solve it |
| 3         | MediKiosk in one sentence                                     |
| 4         | Live patient flow                                             |
| 5         | Evidence Trace + safety boundary                              |
| 6         | AYUSH-specific flow                                           |
| 7         | Lean architecture + ABDM/FHIR path                            |
| 8         | Measured tests/metrics                                        |
| 9         | Impact and scale                                              |
| 10        | Known limits + next step                                      |

# 8\. Judge questions the team should be ready for

| **Likely question**                   | **Strong answer direction**                                                                                                                             |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| How is this different from a chatbot? | The clinical workflow controls required data; AI is bounded to language/extraction/summary, with evidence and physician verification.                   |
| What if the AI hallucinates?          | Schema validation, structured-fact-only summaries, source trace, confidence, and physician acceptance; critical red flags use deterministic rules.      |
| What about low-literacy patients?     | Audio-first prompts, simple touch fallback, assisted mode, and patient read-back confirmation.                                                          |
| Why a kiosk instead of an app?        | No advance enrollment/smartphone literacy required; the same software can also run on tablets/web where appropriate.                                    |
| Can it scale to many patients?        | Stateless web clients + one shared backend; add workers/instances only when measured load requires it.                                                  |
| Is it ABDM compliant?                 | We use a versioned FHIR/ABDM adapter and validate demo artifacts; production onboarding/compliance is a separate deployment step.                       |
| How reliable is handwriting OCR?      | We expose confidence and require verification; the MVP demonstrates strongest performance on printed records and does not hide handwriting limitations. |

# 9\. Risk register

| **Risk**                | **Impact**                | **Mitigation**                                                            |
| ----------------------- | ------------------------- | ------------------------------------------------------------------------- |
| Internet/API outage     | Demo stops                | Adapters + touch/template fallbacks + local fixtures                      |
| Noisy venue             | Voice accuracy falls      | Close microphone, short answers, touch confirmation                       |
| OCR error               | Wrong medication/lab fact | Confidence + source + human verification                                  |
| Unsafe claim            | Judge trust drops         | No diagnosis/prescription; rules + evidence + physician review            |
| Too much scope          | Nothing stable            | Freeze P0; P1 only after two successful full demo runs                    |
| FHIR/ABDM demo fails    | Interop story weak        | Local validated export always available; sandbox is a bonus               |
| AYUSH feels superficial | Poor PS alignment         | Dedicated flow, data model, and doctor section built early enough to test |

# 10\. Final readiness checklist

- ☐ Full demo completed twice from a clean start.
- ☐ Backup demo path tested with internet disabled.
- ☐ All names/records shown are synthetic.
- ☐ No API keys/secrets visible in repository or screen recording.
- ☐ Red-flag wording says clinical review/triage, not diagnosis.
- ☐ AYUSH mode is functional, not a mock screenshot.
- ☐ Doctor edit/accept works and persists.
- ☐ At least one document fact opens its source evidence.
- ☐ Metrics shown in pitch are measured and reproducible.
- ☐ Team can explain limitations without overclaiming.

# 11\. One-page terminology guide for the team

## Terms in plain English

| **Term**             | **Plain-English meaning**                                                                    |
| -------------------- | -------------------------------------------------------------------------------------------- |
| MVP                  | Minimum Viable Product — the smallest version that proves the core problem can be solved.    |
| P0 / P1              | Priority 0 = must work; Priority 1 = valuable after the core is stable.                      |
| Vertical slice       | One complete user journey from front end through backend to visible result.                  |
| Graceful degradation | When one feature fails, the product continues with a simpler fallback instead of crashing.   |
| Evidence Trace       | Project term for linking a clinical fact back to its source and verification state.          |
| Interoperability     | Different health systems can exchange and understand structured data.                        |
| FHIR validation      | Checking whether an exported healthcare record follows the expected FHIR rules/profile.      |
| Sandbox              | A safe test environment provided by a platform such as ABDM; not the live production system. |

## Source basis

**Primary basis:** SIH26047 Patient Case-Taking Software problem statement supplied for this project. [Official SIH 2026 problem-statement portal](https://sih.gov.in/sih2026PS)

**Interoperability/security references:** [ABDM](https://abdm.gov.in/) | [ABDM FHIR Implementation Guide](https://www.nrces.in/ndhm/fhir/r4/) | [Digital Personal Data Protection Act / Rules (MeitY)](https://www.meity.gov.in/)
