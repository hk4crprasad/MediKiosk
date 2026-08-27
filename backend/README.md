# MediKiosk Backend

FastAPI modular-monolith backend for the hackathon MVP. It implements the API contract for:

- staff login and roles;
- kiosk-scoped encounters and consent;
- a controlled chest-discomfort intake pathway;
- evidence-linked clinical facts and deterministic red-flag triage;
- clinician review, document metadata/upload, template summaries, and local FHIR bundle export.

It deliberately does **not** diagnose, prescribe, or let an AI provider mark a clinical fact verified.

## Run preparation

1. Copy `.env.example` to `.env` and replace every `CHANGE`/`REPLACE` value with a non-demo secret.
2. At repository root, set `POSTGRES_PASSWORD` in the root `.env`.
3. Use Docker Compose to start the API and PostgreSQL.
4. Import `postman/MediKiosk.postman_collection.json` and set its environment variables.

## Verification rule

No API request has been executed by Codex. The user must run every request in the Postman collection, in slice order, and report results before the next backend change is accepted. The first required checks are `H-01 GET /health` and `H-02 GET /ready`.

## Important MVP limits

- `AUTO_CREATE_SCHEMA=true` is a development/demo bootstrap convenience. Production needs reviewed Alembic migrations and a migration job.
- Local upload storage is a development adapter. VPS deployment should use private object storage.
- Staff JWT logout writes a token-revocation receipt. Add refresh-token rotation and periodic revocation-record cleanup before multi-user production use.
- The FHIR export has local structural validation status only; it is not an ABDM production claim.
