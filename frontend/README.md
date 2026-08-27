# MediKiosk frontend

The patient and clinical-web interface for the MediKiosk FastAPI service. It is a separate Next.js application; the API remains responsible for clinical rules, access control, and persistence.

## What is available now

- Tablet-first patient welcome, encounter creation, explicit consent, large controlled-choice intake, review, and submission.
- Protected next-question audio playback with a visible text/touch fallback.
- Staff sign-in, red-flag triage queue, acknowledgement, and clinician encounter review.
- Live API integration through `NEXT_PUBLIC_API_BASE_URL`; no clinical logic is duplicated in the browser.

## Run locally

1. Start the FastAPI service using the repository's documented Docker workflow.
2. Copy `.env.example` to `.env` and set `NEXT_PUBLIC_API_BASE_URL` if the API is not at `http://localhost:8000/api/v1`.
3. Install and run the frontend:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. The browser needs to reach the API and the API CORS settings already include this origin.

## Verify

```bash
npm run lint
npm run build -- --webpack
```

`--webpack` is the reliable build mode in the current local execution environment. The app is intentionally API-first: use the backend's test suite/Postman collection to validate actual clinical responses, red-flag rules, staff roles, and document workflows.

## Route map

| Audience | Route | Purpose |
| --- | --- | --- |
| Patient / caregiver | `/kiosk/start` | Starts a scoped kiosk session. |
| Patient / caregiver | `/kiosk/[encounterId]/consent` | Records intake consent. |
| Patient / caregiver | `/kiosk/[encounterId]/intake` | Completes and submits controlled intake. |
| Staff | `/staff/login` | Exchanges staff credentials for a browser-session token. |
| Triage / physician | `/staff/triage` | Reviews and acknowledges active flags. |
| Triage / physician | `/staff/encounters/[encounterId]` | Reviews facts, flags, and documents. |

For the full staged roadmap—including document upload/OCR review, timeline views, and expanded physician workbench—see the repository-level `FRONTEND_IMPLEMENTATION_PLAN.md`.

The selected kiosk choice is the clinical intake answer. The optional **Your input** field is a separate response excerpt for a caregiver/staff demo; it is not AI-verified and cannot replace the touch answer.
