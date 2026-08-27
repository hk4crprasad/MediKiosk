# MediKiosk Prompt Evaluation Fixtures

These synthetic fixtures define review cases for versioned prompts. They are not automated test evidence and must be exercised through a human-approved evaluation run before claims about model quality are made.

- `summary_grounding_cases.json`: checks fact grounding, missing-data handling, and no diagnosis/treatment invention.
- `vision_extraction_cases.json`: checks visible-text-only extraction from synthetic images.
