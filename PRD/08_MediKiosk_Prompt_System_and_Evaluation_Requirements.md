# MediKiosk Prompt System and Evaluation Requirements

**Status:** Implemented; user-operated Postman acceptance pending
**Scope:** Versioned safety prompts for summary and Luna vision extraction
**Requirement prefix:** PRM

## Objective

Make each LLM task reviewable and traceable. Prompts are versioned application assets, not untracked strings embedded in request code.

## Requirements

| ID | Requirement | Acceptance |
| --- | --- | --- |
| PRM-01 | Summary and document-extraction prompts are stored as versioned files in a registry. | Each task resolves a prompt ID, version, task name, and SHA-256 hash. |
| PRM-02 | Generated summary records prompt metadata. | Summary response and `summary.generated` audit event contain prompt ID/version/hash. |
| PRM-03 | Luna vision extraction records prompt metadata. | Extraction artifact/audit metadata contains prompt ID/version/hash. |
| PRM-04 | Prompt text constrains model behaviour. | Prompts prohibit diagnosis, treatment, unsupported inference, and verification-state changes. |
| PRM-05 | Synthetic evaluation fixtures exist. | Fixtures cover summary grounding and visible-text-only vision extraction, including prohibited output. |

## Current prompt coverage

- `summary.clinician_draft` / `openai-compatible-summary-v1`
- `document_extraction.visible_text` / `luna-vision-v1`

Question wording, multilingual patient read-back, fact extraction, and translation prompts are deliberately deferred until their API workflows exist. They must use this same registry when added.

## Verification

Run B5 S-01 and INT-02 with synthetic data. Verify returned/audited prompt metadata matches the prompt registry. Review the fixture files before any manual evaluation. Codex does not execute provider calls or claim evaluation outcomes.
