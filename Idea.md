# MediKiosk — Problems We Solve, and How We Solve Them

> **One-line idea:** Patient speaks, taps, and scans before consultation; MediKiosk turns that into a structured, reviewable case history so the clinician can spend consultation time on care—not repeated data collection.

## The core problem

In busy Indian OPDs, especially where patients have language, literacy, mobility, or caregiver-assistance needs, clinical history is often collected under severe time pressure. Important details may be incomplete, paper records are hard to use quickly, and a doctor begins every consultation by reconstructing the story from scratch.

MediKiosk is a **pre-consultation clinical history assistant**. It does not diagnose, prescribe, or replace the clinician. It prepares a structured and traceable starting point for the clinician to review.

## Problems vs our solution

| What happens today | Why it matters | Our MediKiosk solution | What a judge can see in the demo |
| --- | --- | --- | --- |
| Patients describe symptoms in an unstructured way, and the doctor has little time to ask every follow-up question. | Important HPI details can be missed and consultation time is consumed by basic history-taking. | Server-controlled symptom pathways ask one guided question at a time. The flagship chest-discomfort pathway captures onset, character, radiation, severity, timing, and associated symptoms. | Complete a chest-discomfort intake and view the structured HPI in the clinician workspace. |
| Elderly, low-literacy, or non-English-speaking patients struggle with keyboard-heavy forms. | Digital systems can exclude the people who need assistance most. | Large touch-first MCQ choices, English/Hindi labels, question read-aloud, audio-guided consent, and caregiver mode. A keyboard note remains optional. | Switch to Hindi, hear a question, and complete intake without opening a keyboard. |
| Voice capture can be unreliable or opaque. Patients may not know what was recorded. | A wrong transcript can misrepresent a patient’s words. | The kiosk records a real browser-supported audio format, shows a voice-note waveform that stays flat in silence and reacts to sound, offers playback, then runs an AI transcription check before putting wording into the editable note field. | Record a short note, replay it, tap **Check spoken wording**, and review the transcript. |
| Free-text AI chat can turn patient statements into uncontrolled clinical data. | It can produce ambiguity or false confidence. | A spoken note is contextual only. The patient must still choose a controlled touch answer; the note cannot submit or override the clinical value. | Show that **Save and continue** remains disabled until an MCQ answer is selected. |
| Prior prescriptions, lab reports, and discharge documents are paper-based and difficult to review during a short OPD visit. | History, medicines, and earlier investigations are scattered. | Upload PDF/JPEG/PNG documents; extract native PDF text with PyMuPDF and use vision extraction for page images. Preserve the original source and a chronological document timeline. | Upload a synthetic report, show extraction, source access, and the document timeline. |
| OCR can make mistakes, especially for handwriting or clinical values. | Incorrect extracted information must not become clinical truth automatically. | OCR output is marked for clinician verification. A physician can accept, correct, reject, or promote only reviewed facts. | Show an extracted item and the physician review/promote action. |
| Urgent symptoms may wait in the same queue as routine cases. | Triage staff need a visible, defensible escalation signal. | Deterministic, evidence-linked safety rules create an urgent-review flag. The current reviewed rule is chest discomfort with breathlessness; it does not make a diagnosis. | Choose chest discomfort plus breathlessness and show the triage priority queue. |
| Clinicians receive a long list of answers instead of a usable consultation summary. | The clinician must reconstruct the story again. | Generate a structured draft summary from saved facts, then allow the physician to edit, accept, or reject it. | Generate a summary, edit one line, and accept it as clinician-verified. |
| AYUSH assessment is often reduced to a label in generic digital products. | It does not reflect AYUSH-specific case-taking. | A dedicated Dashavidha pathway captures AYUSH parameters and displays a separate assessment in the clinician view. | Start the AYUSH pathway and show the Dashavidha assessment section. |
| A caregiver may answer on behalf of the patient. | The source of the history needs to be clear to the care team. | Check-in supports patient-self or attendant-assisted mode with relationship capture and provenance in the local FHIR export. | Select attendant-assisted mode during kiosk check-in. |
| Shared kiosk devices can expose one patient’s information to the next patient. | Privacy risk in public waiting areas. | Explicit consent, consent revocation, short-lived kiosk session tokens, automatic inactivity reset, and reset after submission. | Leave a session idle or submit an intake and show return to the start screen. |
| Hospital records need a structured path to future interoperability. | Data should not be trapped in a kiosk screen. | Generate a local FHIR R4 bundle for the reviewed record and show a clearly labelled ABDM sandbox handoff preview. | Export the FHIR bundle and explain the sandbox status honestly. |

## Why this is different from a chatbot

| Generic chatbot | MediKiosk |
| --- | --- |
| Open-ended conversation may vary each time. | Versioned, controlled clinical pathways require the right follow-up fields. |
| AI can appear to make clinical decisions. | AI assists transcription, document extraction, and draft summaries; clinician and deterministic rules retain control. |
| Patient text may become the final record directly. | Controlled choices become patient-confirmed facts; optional notes remain contextual. |
| Often designed for a personal smartphone. | Designed for a shared, large-button tablet kiosk with privacy reset and caregiver assistance. |
| May not expose evidence or provenance. | Facts, documents, OCR outputs, safety flags, and clinician verification remain traceable. |

## Safety and honesty boundaries

MediKiosk is a local hackathon MVP. We will present it accurately:

- It is **not** a diagnosis, prescription, or autonomous triage system.
- The displayed urgent signal means **urgent clinical review**, not a disease diagnosis.
- AI-generated transcription, OCR, and summaries require human review where appropriate.
- Current deterministic urgent-rule coverage is intentionally limited to the reviewed chest-discomfort-with-breathlessness scenario.
- The FHIR export is local structural output. The ABDM panel is a **sandbox simulation — no live ABDM gateway exchange**.
- Synthetic data is used for the hackathon demonstration.

## The demo promise

In one patient-to-physician flow, MediKiosk demonstrates accessibility, structured history-taking, document intelligence, safety escalation, AYUSH relevance, physician control, privacy, and a future-ready interoperability path—without pretending that AI replaces clinical judgment.
