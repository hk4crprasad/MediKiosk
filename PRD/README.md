# MediKiosk PRD Workspace

This folder is the entry point for product and delivery decisions. It avoids having requirements scattered across implementation notes and API code.

## Canonical product documents

| Document | Purpose | Status |
| --- | --- | --- |
| [`01_MediKiosk_Product_Requirements_and_Lean_SRS.md`](../01_MediKiosk_Product_Requirements_and_Lean_SRS.md) | Product Requirements Document (PRD) and Lean SRS; scope, personas, requirements, and definition of done | Approved planning baseline |
| [`02_MediKiosk_Technical_Architecture_and_System_Design.md`](../02_MediKiosk_Technical_Architecture_and_System_Design.md) | System boundaries and architecture decisions | Approved planning baseline |
| [`03_MediKiosk_AI_Clinical_Safety_and_Data_Design.md`](../03_MediKiosk_AI_Clinical_Safety_and_Data_Design.md) | Safety boundary, evidence policy, and AI constraints | Approved planning baseline |
| [`04_MediKiosk_Testing_and_Acceptance_Strategy.md`](../04_MediKiosk_Testing_and_Acceptance_Strategy.md) | Acceptance criteria and user-operated API test policy | Active |
| [`05_MediKiosk_Hackathon_Build_Demo_and_Execution_Plan.md`](../05_MediKiosk_Hackathon_Build_Demo_and_Execution_Plan.md) | Build/demo delivery plan | Active |
| [`00_MediKiosk_Pre_Development_FastAPI_Plan.md`](../00_MediKiosk_Pre_Development_FastAPI_Plan.md) | FastAPI delivery slices, API contract, and Postman gates | Active |
| [`06_MediKiosk_AYUSH_Dashavidha_MVP_Requirements.md`](06_MediKiosk_AYUSH_Dashavidha_MVP_Requirements.md) | Versioned AYUSH Dashavidha intake scope, safety boundary, and acceptance criteria | Implemented; user acceptance pending |
| [`07_MediKiosk_Assistive_Adapters_MVP_Requirements.md`](07_MediKiosk_Assistive_Adapters_MVP_Requirements.md) | Speech/OCR adapter contracts, mock fallback, provenance, and safety boundary | Implemented; user acceptance pending |

## Operating rules

1. `task.md` is the single delivery tracker: every implementation task, acceptance gate, defect, and decision is recorded there.
2. A backend slice is **accepted** only after the user has tested all its Postman requests and reported the outcome.
3. `postman/MediKiosk.postman_collection.json` changes with every API contract change.
   Import `postman/MediKiosk.local.postman_environment.json` for non-secret request variables. Azure and LLM credentials stay in `backend/.env`, never in Postman.
4. Requirements changes are made in the canonical document above first, then reflected in architecture, task, API, and Postman artifacts.
5. Synthetic data only is used for the hackathon demo and verification.

## Change procedure

For each feature: update the PRD requirement → record the task → implement the API contract → update Postman → ask the user to test → record acceptance/defect in `task.md`.
