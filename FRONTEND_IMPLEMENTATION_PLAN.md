# MediKiosk Frontend Implementation Plan

## 1. Outcome

Build one responsive Next.js + TypeScript application with three role-aware experiences:

1. **Patient/kiosk** — clear, touch-first, low-literacy-friendly intake.
2. **Physician** — concise clinical review, evidence access, correction, and verification.
3. **Triage** — rapid urgent-review queue and acknowledgement.

The frontend renders server data and sends controlled commands. It never chooses a clinical pathway, writes a red-flag rule, turns AI output into a clinical fact, or decides verification status by itself.

## 2. Design principles

- One application, three route groups; do not maintain three separate frontend codebases.
- API-driven state: a page can reload from FastAPI without browser-only clinical truth.
- Touch-first kiosk flow with large targets, plain language, progress indication, and an obvious manual fallback.
- Evidence before assertion: doctors can open source document/page and see verification status.
- Role boundaries are enforced by the API; route guards improve usability but are not security.
- Never put provider, Blob, or database credentials in `NEXT_PUBLIC_*` variables.

## 3. Recommended structure

```text
frontend/
  app/
    (public)/kiosk/start/page.tsx
    (kiosk)/kiosk/[encounterId]/consent/page.tsx
    (kiosk)/kiosk/[encounterId]/intake/page.tsx
    (kiosk)/kiosk/[encounterId]/documents/page.tsx
    (kiosk)/kiosk/[encounterId]/review/page.tsx
    (staff)/staff/login/page.tsx
    (staff)/staff/triage/page.tsx
    (staff)/staff/encounters/[encounterId]/page.tsx
    (staff)/staff/encounters/[encounterId]/documents/page.tsx
    (staff)/staff/encounters/[encounterId]/summary/page.tsx
  components/
    kiosk/ staff/ evidence/ ui/
  lib/
    api-client.ts auth.ts query-keys.ts schemas.ts
  tests/
    e2e/ component/
```

Generate TypeScript types from `/api/v1/openapi.json` where practical. Keep a small hand-written API wrapper for multipart upload, audio streaming, and bearer-token attachment.

## 4. API integration map

| Frontend action | API | Rules |
| --- | --- | --- |
| Start kiosk session | `POST /encounters` | Save returned encounter ID and kiosk token only for the active session. |
| Give/review consent | `POST` / `GET /encounters/{id}/consents` | Block intake until active consent exists. |
| Run guided intake | `GET next-question`, `POST intake/responses`, `GET facts`, `POST submit` | Render only the API-supplied next question. |
| Upload source | `POST /encounters/{id}/documents` | Use the API; never upload directly to Blob from the browser. |
| Speech assist | Transcription + next-question audio endpoints | Patient confirms manually; a transcript never auto-submits a fact. |
| Document extraction | `POST /documents/{id}/extractions` | Show “pending clinician verification,” never a diagnosis. |
| Staff login | `POST /auth/login`, `GET /auth/me`, `POST /auth/logout` | Role determines staff landing page. |
| Triage | `GET /triage/queue`, `POST red-flags/{id}/acknowledgements` | Never hide/deactivate the source rule from the UI. |
| Physician overview | `GET /clinician/encounters/{id}` | Fetch timeline separately. |
| Evidence timeline | `GET /encounters/{id}/document-timeline` | Display server history, not an AI narrative. |
| Document review | `POST /documents/{doc}/extractions/{artifact}/reviews` | Require explicit accept/correct/reject choice. |
| Summary | Generate, read, patch, verify endpoints | Edit/verify controls are physician/admin-only. |
| FHIR | `POST` / `GET /fhir/exports` | Label as local structural validation, not live ABDM export. |

## 5. Patient/kiosk experience

### Route flow

```text
/kiosk/start
  → create encounter and select pathway
  → consent
  → guided intake
  → optional document / speech assistance
  → facts recap
  → submit confirmation
  → local session reset
```

### Screens

| Screen | Must show | API behavior |
| --- | --- | --- |
| Start | Language, mode, pathway cards, privacy statement | Create an encounter only after explicit start. |
| Consent | Plain-language purpose and grant/decline | Intake remains disabled without active consent. |
| Intake | One API-supplied question, suitable input control, progress, help | Fetch next question after every success. |
| Voice assist | Record/select audio, transcript preview, “use touch answer” | Do not automatically submit returned transcript. |
| Documents | Upload, validation hint, processing state | Keep provider/storage implementation hidden. |
| Review | Patient facts with source and verification labels | Corrections return to structured questions. |
| Completion | Submitted state, clear next step, reset button | Clear kiosk token and patient identifiers. |

### Accessibility baseline

- Minimum 48px touch targets, clear focus, keyboard support, and no time-critical auto-advance.
- High contrast and readable defaults; use plain language, not clinical jargon.
- Hindi/English copy catalog from day one; enable speech only after language validation.
- Visible text fallback for every audio action.
- Display exact server prompts without adding frontend clinical interpretation.

## 6. Physician workspace

```text
Header: patient synthetic label | encounter status | red-flag banner | actions
Left:   structured history and facts
Center: physician draft summary and edit/verify controls
Right:  documents, extraction review, evidence timeline, FHIR export
```

Required components:

- `EncounterHeader`: status, pathway version, submitted/verified timestamps.
- `RedFlagBanner`: reason and evidence links; never diagnostic wording.
- `FactList`: value, source type, verification badge, document/page link.
- `DocumentPanel`: original source, extraction data, page selector, provider/status.
- `ExtractionReviewDialog`: accept, correct, reject, and explicitly selected-fact promotion.
- `Timeline`: upload → extraction → review → verified-fact events from the API.
- `SummaryEditor`: draft source/prompt metadata, edit audit indication, accept/reject confirmation.
- `FHIRExportPanel`: generate/read result with a non-production label.

Every final verification action needs a confirmation dialog that says it is clinician-owned.

## 7. Triage workspace

- Refresh `GET /triage/queue` manually first; add 15–30 second polling only after load testing.
- Sort active alerts by creation time and show severity, encounter ID, reason, and evidence count.
- Acknowledge with an optional note using the current API.
- Link to the clinician encounter view; never change severity or deactivate a rule from the frontend.
- Empty state: “No active alerts,” never “All patients safe.”

## 8. Client state, auth, and errors

### Token handling

- Keep the kiosk token in memory for the active session; clear it on submit, reset, and inactivity.
- Keep staff token in memory or session-only storage. The current API uses bearer tokens; do not put them in `localStorage`.
- On `401`, return to staff login. On kiosk `403`, clear session and show a privacy-safe message.
- Treat the API as the authority for role and encounter access.

| API response | Patient UI | Staff UI |
| --- | --- | --- |
| `409` | Explain next valid step; provide reset/help | Refresh state and explain conflict. |
| `422` | Highlight invalid input; retain safe values | Show validation issue without raw server details. |
| `503` | Continue with touch/manual document review | Show adapter fallback status. |
| `500` | Preserve no extra patient data; show request ID | Show request ID and safe retry. |

## 9. Delivery phases

| Phase | Deliverable | Acceptance |
| --- | --- | --- |
| F0 | Next.js shell, API client, route groups, design tokens | Build and API health page work. |
| F1 | Kiosk start, consent, chest intake, facts, submit | Synthetic patient completes touch flow. |
| F2 | Staff login, physician view, summary edit/verify | One edit persists and is visible after reload. |
| F3 | Triage queue and acknowledgement | Chest safety fixture is visible and traceable. |
| F4 | Documents, PDF/image extraction, review, timeline | One source opens and its review history is clear. |
| F5 | AYUSH and all four complaint-pathway UX | No frontend-defined clinical questions. |
| F6 | Speech, Hindi/read-back, degraded states | Touch fallback survives unavailable adapter. |
| F7 | Accessibility, security review, demo rehearsal | Two clean demo runs without developer intervention. |

## 10. Backend gaps to keep visible

These are not frontend workarounds:

- New red-flag rules for fever, headache, and abdominal pain need clinical approval.
- The document timeline is evidence-event order; normalized clinical-date ordering is future work.
- The API currently uses bearer tokens, not HttpOnly cookie sessions.
- Hindi copy/read-back and broad speech validation are not yet accepted.
- Production needs Alembic migrations, rate limiting, cleanup, HTTPS, backups, monitoring, and a restore test.

## 11. Frontend test plan

- Component tests for question renderer, validation controls, verification badges, and failure states.
- Contract checks against the committed OpenAPI schema.
- Playwright flows using synthetic fixtures: chest safety, an additional pathway, document review, summary edit, and triage acknowledgement.
- Accessibility checks: keyboard flow, labels, focus, contrast, and 200% zoom.
- Manual usability: a first-time patient/caregiver completes touch flow without developer coaching.

The frontend is not complete until these checks pass against the user-accepted backend APIs.
