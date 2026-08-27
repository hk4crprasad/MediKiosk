# MediKiosk Assistive Adapter MVP Requirements

**Status:** Implemented; user-operated Postman verification required
**Scope:** Hackathon MVP safe contracts for speech transcription and document extraction
**Requirement prefix:** INT

## Product intent

Provide replaceable API boundaries for speech-to-text and OCR/document extraction while preserving touch intake as the trusted fallback. The MVP must work without any external speech or OCR provider and must never treat adapter output as verified clinical truth.

## Functional requirements

| ID | Requirement | MVP acceptance |
| --- | --- | --- |
| INT-01 | Speech transcriptions are encounter-scoped and require active clinical-intake consent. | Authorised callers can request a configured OpenAI-compatible transcription; missing/revoked consent and other encounter tokens are denied. |
| INT-02 | Speech output is evidence only. | A transcription returns transcript, language, confidence, provider, and status, but creates no patient response or clinical fact. |
| INT-03 | OCR extraction is document-scoped and preserves provenance. | A configured mock extraction persists raw extracted text, structured entities, provider, confidence, and document reference. |
| INT-04 | OCR output is unverified and cannot directly enter a summary or FHIR export. | No `ClinicalFact` is created from an extraction; clinician verification remains a separate workflow. |
| INT-05 | Provider state is explicit and safe. | `disabled` returns a clear 503 fallback message without persisting made-up output; `mock` returns only deterministic synthetic fixture data. |
| INT-06 | Text-to-speech may only render a server-configured next question. | The TTS endpoint returns audio for the current configured question and accepts no arbitrary/generated text. |

## Safety and data rules

- Only synthetic audio/documents are used for demo verification.
- Raw audio is not stored by this MVP. A provider integration must have a separate retention, consent, and deletion design before production use.
- Mock fixtures are deterministic and visibly labelled `mock`; they are not a claim about a supplied audio file or document.
- The API does not diagnose, infer medications, map a transcript/extraction into clinical facts, or mark data clinician-verified.
- Production ASR/OCR providers must be implemented behind the same adapter interfaces, with provider-specific privacy/security review and new acceptance gates.

## Configuration

- `SPEECH_ADAPTER_MODE=disabled|mock|openai_compatible` (default `disabled`)
- `OCR_ADAPTER_MODE=disabled|mock` (default `disabled`)
- In `openai_compatible` mode, STT/TTS reuse `LLM_BASE_URL` and `LLM_API_KEY` through the official `AsyncOpenAI` SDK. Azure deployment names are passed as the SDK `model` values.

The `mock` mode exists solely for a deterministic synthetic hackathon demo. Provider credentials never belong in Postman.

## Verification protocol

The `INT — Assistive adapter contracts` Postman folder will contain the exact manual checks. The user records HTTP status and `X-Request-ID` for every request. Codex does not execute these API requests.
