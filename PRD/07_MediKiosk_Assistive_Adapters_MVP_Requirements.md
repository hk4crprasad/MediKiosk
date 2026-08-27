# MediKiosk Assistive Adapter MVP Requirements

**Status:** Implemented; user-operated Postman verification required
**Scope:** Hackathon MVP safe contracts for speech transcription, PDF/image extraction, clinician review, and document evidence timeline
**Requirement prefix:** INT

## Product intent

Provide replaceable API boundaries for speech-to-text and OCR/document extraction while preserving touch intake as the trusted fallback. The MVP must work without any external speech or OCR provider and must never treat adapter output as verified clinical truth.

## Functional requirements

| ID | Requirement | MVP acceptance |
| --- | --- | --- |
| INT-01 | Speech transcriptions are encounter-scoped and require active clinical-intake consent. | Authorised callers can request a configured OpenAI-compatible transcription; missing/revoked consent and other encounter tokens are denied. |
| INT-02 | Speech output is evidence only. | A transcription returns transcript, language, confidence, provider, and status, but creates no patient response or clinical fact. |
| INT-03 | Vision extraction is document-scoped and preserves provenance. | Luna receives only a private JPEG/PNG image through the OpenAI-compatible adapter; raw extracted text, entities, provider, and document reference are persisted as unverified evidence. |
| INT-04 | OCR output is unverified and cannot directly enter a summary or FHIR export. | No `ClinicalFact` is created from an extraction; clinician verification remains a separate workflow. |
| INT-05 | Provider state is explicit and safe. | `disabled` returns a clear 503 fallback message without persisting made-up output; `mock` returns only deterministic synthetic fixture data. |
| INT-06 | Text-to-speech may only render a server-configured next question. | The TTS endpoint returns audio for the current configured question and accepts no arbitrary/generated text. |
| INT-07 | PDF processing extracts native text then renders each page for Luna vision extraction. | A private PDF is read by PyMuPDF, each page is passed separately to Luna as PNG, and the saved artifact retains page numbers, native text, and page-scoped vision output. |
| INT-08 | Document extraction requires explicit clinician review before fact promotion. | A physician can accept, correct, or reject the extraction; only facts explicitly submitted in that review are created as `clinician_verified`. |
| INT-09 | The clinician can view an encounter-scoped evidence timeline. | Timeline shows upload, extraction, review, and verified-fact events in timestamp order; it is never an AI-generated clinical narrative. |

## Safety and data rules

- Only synthetic audio/documents are used for demo verification.
- Raw audio is not stored by this MVP. A provider integration must have a separate retention, consent, and deletion design before production use.
- Mock fixtures are deterministic and visibly labelled `mock`; they are not a claim about a supplied audio file or document.
- The API does not diagnose or infer medications. An extraction never creates a clinical fact. A physician may explicitly promote a selected, reviewed extraction item into a `clinician_verified` fact; the audit event and original document/extraction remain linked.
- Production ASR/OCR providers must be implemented behind the same adapter interfaces, with provider-specific privacy/security review and new acceptance gates.

## Configuration

- `SPEECH_ADAPTER_MODE=disabled|mock|openai_compatible` (default `disabled`)
- `OCR_ADAPTER_MODE=disabled|mock|openai_compatible` (default `disabled`)
- In `openai_compatible` mode, STT/TTS reuse `LLM_BASE_URL` and `LLM_API_KEY` through the official `AsyncOpenAI` SDK. Azure deployment names are passed as the SDK `model` values.
- Vision extraction uses the same `AsyncOpenAI` client and `LLM_MODEL` (`gpt-5.6-luna`). JPEG/PNG bytes are supplied as an image data URL. PDFs are first read and rendered page-by-page with PyMuPDF, then each rendered PNG is supplied to Luna. `PDF_MAX_PAGES` and `PDF_RENDER_DPI` bound cost and processing time.

The `mock` mode exists solely for a deterministic synthetic hackathon demo. Provider credentials never belong in Postman.

## Verification protocol

The `INT — Assistive adapter contracts` Postman folder will contain the exact manual checks. The user records HTTP status and `X-Request-ID` for every request. Codex does not execute these API requests.
