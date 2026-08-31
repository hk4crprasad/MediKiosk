import { audioFilename } from "@/lib/audio-recording";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

export class ApiError extends Error {
  constructor(public readonly status: number, message: string, public readonly requestId?: string) { super(message); }
}

type RequestOptions = Omit<RequestInit, "body" | "headers"> & { body?: unknown; token?: string };

async function request<T>(path: string, { body, token, ...options }: RequestOptions = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: { message?: string }; detail?: string } | null;
    throw new ApiError(response.status, payload?.error?.message ?? payload?.detail ?? "The request could not be completed.", response.headers.get("X-Request-ID") ?? undefined);
  }
  return response.status === 204 ? (undefined as T) : response.json() as Promise<T>;
}

export type Pathway = "chest-discomfort-v1" | "fever-v1" | "headache-v1" | "abdominal-pain-v1" | "ayush-dashavidha-v1";
export type EncounterCreated = { encounter: { id: string; pathway_version: Pathway; status: string }; kiosk_session_token: string };
export type KioskLanguage = "en" | "hi";
export type Question = { key: string; prompt: string; input_type: "single_choice"; required: boolean; choices: string[]; choice_labels?: Record<string, string>; pathway_version: string; question_index: number; question_total: number };
export type Fact = { id: string; fact_type: string; value: { value?: unknown }; verification_status: string; display_label?: string | null; display_value?: string | null };
export type StaffToken = { access_token: string; expires_in_seconds: number };
export type TriageQueueItem = { encounter_id: string; encounter_status: string; patient_display_name: string | null; red_flag: { id: string; severity: string; reason: string; rule_id: string; acknowledged_at: string | null } };
export type PatientInfo = {
  display_name: string | null;
  birth_year: number | null;
  sex: string | null;
  preferred_language: KioskLanguage;
  abha_identifier?: string | null;
  respondent_type: "patient" | "caregiver";
  caregiver_relationship?: string | null;
};

export type ClinicianEncounter = {
  encounter: { id: string; status: string; pathway_version: string; created_at?: string };
  patient?: PatientInfo | null;
  facts: Fact[];
  red_flags: Array<{ id: string; severity: string; reason: string; active: boolean; acknowledged_at: string | null }>;
  documents: Array<{ id: string; original_filename: string; status: string; created_at?: string }>;
  summary: { id: string; content?: string; status?: string } | null;
};

export type Summary = {
  id: string;
  encounter_id: string;
  content: Record<string, unknown>;
  text: string;
  source: string;
  prompt_version: string | null;
  prompt_metadata: Record<string, unknown>;
  status: "DRAFT" | "ACCEPTED" | "REJECTED";
  created_at: string;
};

export type FhirExport = {
  id: string;
  encounter_id: string;
  validation_status: string;
  bundle: Record<string, unknown>;
  created_at: string;
};

export type DocumentTimelineItem = {
  event_type: "uploaded" | "extraction" | "review" | "verified_fact";
  occurred_at: string;
  document_id: string;
  artifact_id?: string | null;
  page_number?: number | null;
  data: Record<string, unknown>;
};

export type AssistiveArtifact = {
  id: string;
  encounter_id: string;
  document_id?: string | null;
  artifact_type: string;
  provider: string;
  status: string;
  language?: string | null;
  raw_text: string;
  structured_data: Record<string, unknown>;
  confidence?: number | null;
  created_at: string;
};

export const createEncounter = (payload: {
  displayName?: string;
  birthYear?: number;
  sex?: string;
  language: KioskLanguage;
  pathway: Pathway;
  abhaIdentifier?: string;
  respondentType?: "patient" | "caregiver";
  caregiverRelationship?: string;
}) =>
  request<EncounterCreated>("/encounters", {
    method: "POST",
    body: {
      patient: {
        display_name: payload.displayName || null,
        birth_year: payload.birthYear || null,
        sex: payload.sex || null,
        preferred_language: payload.language,
        abha_identifier: payload.abhaIdentifier || null,
        respondent_type: payload.respondentType || "patient",
        caregiver_relationship: payload.caregiverRelationship || null,
      },
      mode: "kiosk",
      pathway_version: payload.pathway,
    },
  });
export const recordConsent = (id: string, token: string, language: KioskLanguage) => request(`/encounters/${id}/consents`, { method: "POST", token, body: { consent_type: "clinical_intake", version: "v1", language, granted: true } });
export const getNextQuestion = (id: string, token: string) => request<Question | null>(`/encounters/${id}/intake/next-question`, { token });
export const submitAnswer = (id: string, token: string, question: Question, value: string, language: KioskLanguage, rawText?: string) => request(`/encounters/${id}/intake/responses`, { method: "POST", token, body: { question_key: question.key, value, input_mode: "touch", language, raw_text: rawText?.trim() || null } });
export const getFacts = (id: string, token: string) => request<Fact[]>(`/encounters/${id}/facts`, { token });
export const submitIntake = (id: string, token: string) => request(`/encounters/${id}/submit`, { method: "POST", token });
export const login = (email: string, password: string) => request<StaffToken>("/auth/login", { method: "POST", body: { email, password } });
export const logout = (token: string) => request<void>("/auth/logout", { method: "POST", token });
export const createStaffUser = (token: string, payload: { email: string; password: string; role: "admin" | "triage" | "physician" }) =>
  request<{ id: string; email: string; role: string; active: boolean }>("/admin/users", { method: "POST", token, body: payload });
export const getTriageQueue = (token: string) => request<TriageQueueItem[]>("/triage/queue", { token });
export type EncounterListItem = {
  encounter_id: string;
  encounter_status: string;
  pathway_version: string;
  patient_display_name: string | null;
  patient_birth_year: number | null;
  patient_sex: string | null;
  patient_abha_identifier?: string | null;
  has_active_red_flag: boolean;
  created_at: string;
  submitted_at: string | null;
};
export const getAllEncounters = (token: string) => request<EncounterListItem[]>("/triage/encounters", { token });
export const acknowledgeFlag = (id: string, token: string) => request(`/red-flags/${id}/acknowledgements`, { method: "POST", token, body: { note: "Acknowledged from triage workspace" } });
export const getClinicianEncounter = (id: string, token: string) => request<ClinicianEncounter>(`/clinician/encounters/${id}`, { token });

// Summary management
export const generateSummary = (encounterId: string, token: string) =>
  request<Summary>(`/encounters/${encounterId}/summary/generations`, { method: "POST", token });
export const getSummary = (encounterId: string, token: string) =>
  request<Summary>(`/encounters/${encounterId}/summary`, { token });
export const updateSummary = (encounterId: string, token: string, text: string) =>
  request<Summary>(`/encounters/${encounterId}/summary`, { method: "PATCH", token, body: { text } });
export const verifySummary = (encounterId: string, token: string, decision: "accept" | "reject") =>
  request<Summary>(`/encounters/${encounterId}/summary/verifications`, { method: "POST", token, body: { decision } });

// FHIR R4 export
export const exportFhir = (encounterId: string, token: string) =>
  request<FhirExport>(`/encounters/${encounterId}/fhir/exports`, { method: "POST", token });

// Document upload, timeline & OCR
export async function uploadDocument(encounterId: string, token: string, file: File, documentType: string = "other") {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("document_type", documentType);
  const response = await fetch(`${API_BASE_URL}/encounters/${encounterId}/documents`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: { message?: string }; detail?: string } | null;
    throw new ApiError(response.status, payload?.error?.message ?? payload?.detail ?? "Document upload failed.", response.headers.get("X-Request-ID") ?? undefined);
  }
  return response.json() as Promise<{ id: string; original_filename: string; mime_type: string; size_bytes: number; processing_status: string }>;
}

export const extractDocument = (documentId: string, token: string, fixtureId: string = "printed_lab_report_v1") =>
  request<AssistiveArtifact>(`/documents/${documentId}/extractions`, { method: "POST", token, body: { fixture_id: fixtureId } });

export const getLatestDocumentExtraction = (documentId: string, token: string) =>
  request<AssistiveArtifact>(`/documents/${documentId}/extractions/latest`, { token });

export const reviewDocumentExtraction = (
  documentId: string,
  extractionId: string,
  token: string,
  payload: {
    decision: "accepted" | "corrected" | "rejected";
    note?: string;
    promoted_facts?: Array<{ fact_type: string; value: Record<string, unknown>; source_excerpt: string; page_number: number }>;
  }
) =>
  request<{ review: AssistiveArtifact; promoted_fact_ids: string[] }>(
    `/documents/${documentId}/extractions/${extractionId}/reviews`,
    { method: "POST", token, body: payload }
  );

export async function fetchDocumentBlob(documentId: string, token: string): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/documents/${documentId}/content`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new ApiError(response.status, "Document download failed.");
  }
  return response.blob();
}

export const getDocumentTimeline = (encounterId: string, token: string) =>
  request<DocumentTimelineItem[]>(`/encounters/${encounterId}/document-timeline`, { token });

// Staff user profile
export type CurrentUser = { id: string; email: string; role: string; active: boolean };
export const getMe = (token: string) => request<CurrentUser>("/auth/me", { token });

// Consent management
export type ConsentRecord = { id: string; encounter_id: string; consent_type: string; version: string; language: KioskLanguage; granted: boolean; created_at: string; revoked_at?: string | null };
export const listConsents = (encounterId: string, token: string) =>
  request<ConsentRecord[]>(`/encounters/${encounterId}/consents`, { token });
export const revokeConsent = (encounterId: string, consentId: string, token: string) =>
  request<{ id: string; revoked_at: string }>(`/encounters/${encounterId}/consents/${consentId}/revocations`, { method: "POST", token });

// Speech ASR
export async function transcribeAudio(encounterId: string, token: string, audioBlob: Blob, language: string = "en", fixtureId: string = "en_general_v1"): Promise<AssistiveArtifact> {
  const formData = new FormData();
  formData.append("audio", audioBlob, audioFilename(audioBlob.type));
  formData.append("language", language);
  formData.append("fixture_id", fixtureId);
  const response = await fetch(`${API_BASE_URL}/encounters/${encounterId}/speech/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: { message?: string }; detail?: string } | null;
    throw new ApiError(response.status, payload?.error?.message ?? payload?.detail ?? "Audio transcription failed.", response.headers.get("X-Request-ID") ?? undefined);
  }
  return response.json() as Promise<AssistiveArtifact>;
}

// Additional helpers for 100% endpoint wiring
export type EncounterState = { id: string; status: string; pathway_version: string; created_at: string; submitted_at?: string | null };
export const getEncounter = (id: string, token: string) => request<EncounterState>(`/encounters/${id}`, { token });

export type DocumentMetadata = { id: string; encounter_id: string; document_type: string; original_filename: string; mime_type: string; size_bytes: number; processing_status: string; created_at: string };
export const getDocumentMetadata = (documentId: string, token: string) => request<DocumentMetadata>(`/documents/${documentId}`, { token });
export const listEncounterDocuments = (encounterId: string, token: string) => request<DocumentMetadata[]>(`/encounters/${encounterId}/documents`, { token });

export const getFhirExportById = (encounterId: string, exportId: string, token: string) =>
  request<FhirExport>(`/encounters/${encounterId}/fhir/exports/${exportId}`, { token });

export const getHealth = async (): Promise<{ status: string; app?: string }> => {
  const rootUrl = API_BASE_URL.replace(/\/api\/v1\/?$/, "");
  const response = await fetch(`${rootUrl}/health`);
  return response.json() as Promise<{ status: string; app?: string }>;
};

// Next question audio
export async function getNextQuestionAudio(id: string, token: string, expectedQuestionKey: string): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/encounters/${id}/audio/prompts/next-question`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: { message?: string }; detail?: string } | null;
    throw new ApiError(response.status, payload?.error?.message ?? payload?.detail ?? "Audio is unavailable.", response.headers.get("X-Request-ID") ?? undefined);
  }
  const returnedKey = response.headers.get("X-MediKiosk-Question-Key");
  if (returnedKey && returnedKey !== expectedQuestionKey) {
    throw new ApiError(409, "The audio prompt no longer matches this question.");
  }
  return response.blob();
}

// --- Patient portal ---------------------------------------------------
// A registered patient's own document archive. Deliberately separate from
// the kiosk/staff types above: a portal account never creates or joins a
// kiosk Encounter (see backend app/models/entities.py's "Patient portal" section).

export type PatientToken = { access_token: string; expires_in_seconds: number };
export type CurrentPatient = {
  id: string;
  email: string;
  display_name: string | null;
  birth_year: number | null;
  sex: string | null;
  abha_identifier: string | null;
  active: boolean;
  created_at: string;
};
export type PatientRecord = {
  id: string;
  patient_account_id: string;
  document_type: string;
  visit_date: string | null;
  hospital_or_clinic: string | null;
  visit_reason: string | null;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  processing_status: string;
  created_at: string;
};
export type PatientHistorySummary = {
  id: string;
  patient_account_id: string;
  content: Record<string, unknown>;
  text: string;
  source: string;
  prompt_version: string | null;
  prompt_metadata: Record<string, unknown>;
  created_at: string;
};
export type PatientSearchResult = {
  id: string;
  email: string;
  display_name: string | null;
  abha_identifier: string | null;
  record_count: number;
  last_activity_at: string | null;
};
export type PatientProfile = {
  account: CurrentPatient;
  records: PatientRecord[];
  summary: PatientHistorySummary | null;
};

export const registerPatient = (payload: {
  email: string;
  password: string;
  displayName?: string;
  birthYear?: number;
  sex?: string;
  abhaIdentifier?: string;
}) =>
  request<PatientToken>("/patients/register", {
    method: "POST",
    body: {
      email: payload.email,
      password: payload.password,
      display_name: payload.displayName || null,
      birth_year: payload.birthYear || null,
      sex: payload.sex || null,
      abha_identifier: payload.abhaIdentifier || null,
    },
  });
export const loginPatient = (email: string, password: string) =>
  request<PatientToken>("/patients/login", { method: "POST", body: { email, password } });
export const logoutPatient = (token: string) => request<void>("/patients/logout", { method: "POST", token });
export const getPatientMe = (token: string) => request<CurrentPatient>("/patients/me", { token });

export async function uploadPatientRecord(
  token: string,
  file: File,
  fields: { documentType: string; visitDate?: string; hospitalOrClinic?: string; visitReason?: string }
): Promise<PatientRecord> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("document_type", fields.documentType);
  if (fields.visitDate) formData.append("visit_date", fields.visitDate);
  if (fields.hospitalOrClinic) formData.append("hospital_or_clinic", fields.hospitalOrClinic);
  if (fields.visitReason) formData.append("visit_reason", fields.visitReason);
  const response = await fetch(`${API_BASE_URL}/patients/records`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: { message?: string }; detail?: string } | null;
    throw new ApiError(response.status, payload?.error?.message ?? payload?.detail ?? "Record upload failed.", response.headers.get("X-Request-ID") ?? undefined);
  }
  return response.json() as Promise<PatientRecord>;
}

export const listPatientRecords = (token: string) => request<PatientRecord[]>("/patients/records", { token });
export const extractPatientRecord = (recordId: string, token: string, fixtureId: string = "printed_lab_report_v1") =>
  request<AssistiveArtifact>(`/patients/records/${recordId}/extractions`, { method: "POST", token, body: { fixture_id: fixtureId } });
export const generatePatientSummary = (token: string) =>
  request<PatientHistorySummary>("/patients/summary/generate", { method: "POST", token });
export const getPatientSummary = (token: string) =>
  request<PatientHistorySummary | null>("/patients/summary", { token });

export async function fetchPatientRecordBlob(recordId: string, token: string): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/patients/records/${recordId}/content`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new ApiError(response.status, "Record download failed.");
  return response.blob();
}

// Staff search over registered patient accounts (separate from kiosk encounters)
export const searchStaffPatients = (token: string, query: string) =>
  request<PatientSearchResult[]>(`/staff/patients?query=${encodeURIComponent(query)}`, { token });
export const getStaffPatientProfile = (token: string, patientAccountId: string) =>
  request<PatientProfile>(`/staff/patients/${patientAccountId}`, { token });
export const generateStaffPatientSummary = (token: string, patientAccountId: string) =>
  request<PatientHistorySummary>(`/staff/patients/${patientAccountId}/summary/generate`, { method: "POST", token });
