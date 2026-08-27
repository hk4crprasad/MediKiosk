Testing & Acceptance Strategy

A risk-based test plan focused on patient usability, clinical safety, extraction quality, and demo resilience

**API verification policy:** `postman/MediKiosk.postman_collection.json` is maintained with every API contract change. The user, not Codex/AI, executes API requests in Postman and accepts or rejects each backend slice. Codex may prepare the collection and diagnose user-provided results, but must not run requests, automated API tests, or claim a test outcome without the user's report.

**Design principle:** Build the smallest trustworthy end-to-end clinical intake flow that proves the problem statement. Prefer clear workflows over extra infrastructure.

# 1\. Testing philosophy

Do not chase code coverage for its own sake. Test the failures that would embarrass or endanger the demo: missed required history, missed red flag, wrong medication/lab extraction, unsupported summary fact, unusable kiosk flow, data leakage, and external-service outage.

For the pre-development and backend-delivery phase, testing is a gated human verification activity. Each endpoint must have a named request in the Postman collection, a documented expected outcome, and a user-recorded result before the next backend slice starts. Automated test execution is out of scope unless the user explicitly authorizes it later.

# 2\. Test layers

| **Layer**    | **What to test**                       | **Examples**                                                     |
| ------------ | -------------------------------------- | ---------------------------------------------------------------- |
| Unit         | Pure rules and transformations         | branching, red-flag rules, date/unit normalization, FHIR mapping |
| API/contract | Request/response and schema validation | invalid AI JSON rejected, consent required before submit         |
| Integration  | Database + adapters + worker           | OCR result stored with evidence; summary uses saved facts        |
| End-to-end   | Real user flows                        | patient intake → doctor edit → export                            |
| AI quality   | Accuracy on fixed evaluation set       | medical entity extraction, summary factuality                    |
| Safety       | High-severity failure cases            | red-flag recall, hallucinated allergy/dose, service failure      |
| Usability    | Can a first-time user finish?          | language, audio, touch, scan, correction, submit                 |

# 3\. Curated test data

- Use synthetic patient personas only.
- Create 4 complaint-pathway packs with expected required fields and branch decisions.
- Create positive and negative red-flag cases reviewed by an appropriate clinical mentor.
- Document set: clean printed prescriptions, lab reports, discharge summaries, plus a smaller difficult/handwritten set.
- Include Hindi, English, and mixed-language voice samples; include background-noise variants if possible.
- Version test fixtures in the repository so the entire team evaluates against the same inputs.

# 4\. Minimum acceptance metrics

| **Metric**                       | **Hackathon acceptance target**                                       | **Why it matters**                    |
| -------------------------------- | --------------------------------------------------------------------- | ------------------------------------- |
| Happy-path completion            | \>90% of internal usability runs without team coaching                | Proves zero/low-training usability    |
| Required field coverage          | \>95% on scripted pathway test cases                                  | History completeness                  |
| Red-flag recall                  | 100% on the curated clinician-reviewed positive set                   | Safety gate for the prototype         |
| Unsupported summary facts        | 0 in the golden demo/evaluation set                                   | Trust and hallucination control       |
| Printed document entity accuracy | Target >90% on clean test documents                                   | Shows practical document intelligence |
| FHIR validation                  | 100% of displayed demo exports pass the configured validator          | Avoids fake "FHIR compatible" claims  |
| Session cleanup                  | 100% of tested kiosk logout/submit flows clear prior patient UI state | Privacy                               |

**Important:** These are engineering acceptance targets for the prototype, not claims about clinical performance. Only present measured results after running the tests.

# 5\. High-priority test cases

| **ID**  | **Scenario**                           | **Expected result**                                              |
| ------- | -------------------------------------- | ---------------------------------------------------------------- |
| SAFE-01 | Chest discomfort + breathlessness      | Urgent-review alert appears with evidence; no diagnosis text     |
| SAFE-02 | Non-red-flag chest discomfort fixture  | No urgent alert from that rule; interview continues              |
| PATH-01 | Fever, headache, abdominal-pain pathway packs | Each returns only its configured questions, rejects out-of-sequence answers, creates patient-confirmed facts, and submits only after required fields are complete |
| AI-01   | Model returns invalid JSON             | Output rejected/retried; session remains usable                  |
| AI-02   | Summary asks for missing fact          | Summary marks it not captured; does not invent it                |
| DOC-01  | Lab report with value/unit/range       | Value, unit, range, source, confidence captured                  |
| DOC-02  | Low-quality or ambiguous medicine text | Low-confidence item is not silently treated as verified          |
| UX-01   | Voice service disabled                 | User completes essential flow by touch                           |
| UX-02   | First-time user in Hindi               | Can choose language, answer, review, and submit without coaching |
| SEC-01  | Previous kiosk session completed       | Next user cannot see prior patient data                          |
| SEC-02  | Patient session tries doctor endpoint  | Access denied                                                    |
| PHY-01  | Doctor corrects medicine detail        | Correction persists and appears in verified summary/audit        |
| FHIR-01 | Verified encounter export              | Bundle/resource set passes chosen validator/profile checks       |

# 6\. Speech testing

| **Dimension**  | **Test**                                                               |
| -------------- | ---------------------------------------------------------------------- |
| Language       | Hindi, English, Hinglish; regional language if supported               |
| Speaker        | Younger/older voices; different accents represented by volunteers      |
| Environment    | Quiet vs recorded OPD-like background noise                            |
| Critical terms | Medicine names, duration, negation ("no allergy"), quantities          |
| Measure        | Word error rate if practical + medical-entity accuracy + reprompt rate |

# 7\. Document/OCR testing

- For a synthetic PDF, verify native text is retained, every rendered page has a page number, and Luna output is page-scoped.
- Verify malformed/over-page-limit PDFs fail safely and the original source remains downloadable for manual review.
- Measure field-level accuracy, not just "OCR looked good."
- For medicines: name, strength, route/frequency where present.
- For labs: test name, value, unit, reference range, abnormal flag when supported.
- For dates: document date and normalization accuracy.
- For timeline: confirm ordering and uncertain-date handling.
- Verify an extraction creates no clinical fact; only a physician review may explicitly promote a selected item, with document/page evidence preserved.
- For difficult handwriting: report limitations; never hide low confidence.

# 8\. Summary factuality test

1. Create a gold set of structured facts for each synthetic patient.
2. Generate the summary.
3. Mark every factual statement as supported, contradicted, or unsupported.
4. Fail the build/demo candidate if any critical unsupported medication, allergy, diagnosis, or red-flag statement appears.
5. Repeat after any prompt/model/provider change.

# 9\. Demo resilience drill

| **Failure injected**     | **Expected fallback**                                                      |
| ------------------------ | -------------------------------------------------------------------------- |
| Internet disconnected    | Local app/database and touch flow continue; prerecorded fixtures available |
| ASR unavailable          | Touch input                                                                |
| LLM unavailable          | Rule/template-only history and summary fallback                            |
| OCR unavailable          | Precomputed fixture result or manual document note for demo recovery       |
| ABDM sandbox unavailable | Local FHIR generation + validation report                                  |
| Doctor browser refreshed | Encounter reloads from backend state                                       |

# 10\. Release gate before judging

- P0 requirements pass.
- All curated red-flag positives pass.
- No known unsupported medication/allergy statements in golden scenarios.
- Kiosk privacy cleanup passes.
- Demo works in offline/degraded mode.
- FHIR demo artifacts validate.
- Known limitations slide/document is updated to match reality.

## Terms in plain English

| **Term**        | **Plain-English meaning**                                                                 |
| --------------- | ----------------------------------------------------------------------------------------- |
| Golden test set | A fixed group of known inputs and expected outputs used for repeatable evaluation.        |
| Recall          | Of all true positive cases, the percentage the system successfully catches.               |
| Precision       | Of all cases the system flags, the percentage that are actually correct in the test set.  |
| Contract test   | Checks that two components agree on the exact data format they exchange.                  |
| End-to-end test | Tests the entire user journey through multiple components, not one function in isolation. |
| Regression      | A previously working behavior breaks after a change.                                      |
| Fixture         | Saved test input, such as a synthetic patient record, audio clip, or document.            |

## Source basis

**Primary basis:** SIH26047 Patient Case-Taking Software problem statement supplied for this project. [Official SIH 2026 problem-statement portal](https://sih.gov.in/sih2026PS)

**Interoperability/security references:** [ABDM](https://abdm.gov.in/) | [ABDM FHIR Implementation Guide](https://www.nrces.in/ndhm/fhir/r4/) | [Digital Personal Data Protection Act / Rules (MeitY)](https://www.meity.gov.in/)
