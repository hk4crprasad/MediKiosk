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
export type Question = { key: string; prompt: string; input_type: "single_choice"; required: boolean; choices: string[]; pathway_version: string };
export type Fact = { id: string; fact_type: string; value: { value?: unknown }; verification_status: string };
export type StaffToken = { access_token: string; expires_in_seconds: number };
export type TriageQueueItem = { encounter_id: string; encounter_status: string; patient_display_name: string | null; red_flag: { id: string; severity: string; reason: string; rule_id: string; acknowledged_at: string | null } };
export type ClinicianEncounter = {
  encounter: { id: string; status: string; pathway_version: string; created_at?: string };
  facts: Fact[];
  red_flags: Array<{ id: string; severity: string; reason: string; active: boolean; acknowledged_at: string | null }>;
  documents: Array<{ id: string; original_filename: string; status: string; created_at?: string }>;
  summary: { id: string; content?: string; status?: string } | null;
};

export const createEncounter = (payload: { displayName?: string; birthYear?: number; sex?: string; language: string; pathway: Pathway }) => request<EncounterCreated>("/encounters", { method: "POST", body: { patient: { display_name: payload.displayName || null, birth_year: payload.birthYear || null, sex: payload.sex || null, preferred_language: payload.language }, mode: "kiosk", pathway_version: payload.pathway } });
export const recordConsent = (id: string, token: string, language: string) => request(`/encounters/${id}/consents`, { method: "POST", token, body: { consent_type: "clinical_intake", version: "v1", language, granted: true } });
export const getNextQuestion = (id: string, token: string) => request<Question | null>(`/encounters/${id}/intake/next-question`, { token });
export const submitAnswer = (id: string, token: string, question: Question, value: string, rawText?: string) => request(`/encounters/${id}/intake/responses`, { method: "POST", token, body: { question_key: question.key, value, input_mode: "touch", language: "en", raw_text: rawText?.trim() || null } });
export const getFacts = (id: string, token: string) => request<Fact[]>(`/encounters/${id}/facts`, { token });
export const submitIntake = (id: string, token: string) => request(`/encounters/${id}/submit`, { method: "POST", token });
export const login = (email: string, password: string) => request<StaffToken>("/auth/login", { method: "POST", body: { email, password } });
export const getTriageQueue = (token: string) => request<TriageQueueItem[]>("/triage/queue", { token });
export const acknowledgeFlag = (id: string, token: string) => request(`/red-flags/${id}/acknowledgements`, { method: "POST", token, body: { note: "Acknowledged from triage workspace" } });
export const getClinicianEncounter = (id: string, token: string) => request<ClinicianEncounter>(`/clinician/encounters/${id}`, { token });
export async function getNextQuestionAudio(id: string, token: string, expectedQuestionKey: string): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/encounters/${id}/audio/prompts/next-question`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: { message?: string }; detail?: string } | null;
    throw new ApiError(response.status, payload?.error?.message ?? payload?.detail ?? "Audio is unavailable.", response.headers.get("X-Request-ID") ?? undefined);
  }
  if (response.headers.get("X-MediKiosk-Question-Key") !== expectedQuestionKey) throw new ApiError(409, "The audio prompt no longer matches this question.");
  return response.blob();
}
