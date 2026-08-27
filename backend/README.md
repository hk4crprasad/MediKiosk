# MediKiosk Backend

FastAPI modular-monolith backend for the hackathon MVP. It implements the API contract for:

- staff login and roles;
- kiosk-scoped encounters and consent;
- a controlled chest-discomfort intake pathway;
- evidence-linked clinical facts and deterministic red-flag triage;
- clinician review, document metadata/upload, template summaries, and local FHIR bundle export.

It deliberately does **not** diagnose, prescribe, or let an AI provider mark a clinical fact verified.

## Run preparation

1. Copy `.env.example` to `.env` and replace every `CHANGE`/`REPLACE` value with a non-demo secret. Add the Azure Blob connection string and private container from `.env.azure.example`.
2. At repository root, set `POSTGRES_PASSWORD` in the root `.env`.
3. Use Docker Compose to start the API and PostgreSQL.
4. Import `postman/MediKiosk.postman_collection.json` and set its environment variables.

## Verification rule

No API request has been executed by Codex. The user must run every request in the Postman collection, in slice order, and report results before the next backend change is accepted. The first required checks are `H-01 GET /health` and `H-02 GET /ready`.

## Important MVP limits

- `AUTO_CREATE_SCHEMA=true` is a development/demo bootstrap convenience. Production needs reviewed Alembic migrations and a migration job.
- Document binaries use a private Azure Blob Storage container. PostgreSQL stores only document metadata and the blob key; neither API response exposes the Azure URL/connection string.
- Create the private Azure container before deployment (`AZURE_BLOB_CREATE_CONTAINER=false`); enable auto-create only for a disposable Azure development account.
- Summary generation uses the official OpenAI Python SDK with a base-URL-compatible Chat Completions endpoint. The configured/default model is `gpt-5.6-luna`. Set `LLM_BASE_URL` and `LLM_API_KEY` in `backend/.env`; the adapter deliberately sends neither `temperature` nor `max_tokens`. Without credentials, the API uses the deterministic template fallback.
- Staff JWT logout writes a token-revocation receipt. Add refresh-token rotation and periodic revocation-record cleanup before multi-user production use.
- The FHIR export has local structural validation status only; it is not an ABDM production claim.
