"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  acknowledgeFlag,
  getAllEncounters,
  logout,
  ApiError,
  getTriageQueue,
  searchStaffPatients,
  TriageQueueItem,
  EncounterListItem,
  PatientSearchResult,
} from "@/lib/api";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft", IN_PROGRESS: "In progress", URGENT_REVIEW: "Urgent review",
  SUBMITTED: "Submitted", IN_REVIEW: "In review", VERIFIED: "Verified", CANCELLED: "Cancelled",
};

const PATHWAY_LABEL: Record<string, string> = {
  "chest-discomfort-v1": "Chest discomfort", "fever-v1": "Fever", "headache-v1": "Headache",
  "abdominal-pain-v1": "Abdominal pain", "ayush-dashavidha-v1": "AYUSH",
};

export default function TriagePage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [items, setItems] = useState<TriageQueueItem[]>([]);
  const [encounters, setEncounters] = useState<EncounterListItem[]>([]);
  const [kioskFilter, setKioskFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState("");

  const [patientQuery, setPatientQuery] = useState("");
  const [patientResults, setPatientResults] = useState<PatientSearchResult[]>([]);
  const [patientSearchLoading, setPatientSearchLoading] = useState(false);
  const [patientSearched, setPatientSearched] = useState(false);

  const loadData = useCallback(async (activeToken: string) => {
    setLoading(true); setError("");
    try {
      const [queue, all] = await Promise.all([getTriageQueue(activeToken), getAllEncounters(activeToken)]);
      setItems(queue); setEncounters(all);
    } catch (caught) {
      setError(caught instanceof ApiError && caught.status === 401
        ? "Your staff session has expired. Please sign in again."
        : "The dashboard could not be loaded.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = sessionStorage.getItem("medikiosk.staff_token");
      setToken(saved);
      if (saved) void loadData(saved); else setLoading(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  async function acknowledge(item: TriageQueueItem) {
    if (!token) return;
    setWorking(item.red_flag.id);
    try { await acknowledgeFlag(item.red_flag.id, token); await loadData(token); }
    catch (caught) { setError(caught instanceof ApiError ? caught.message : "The flag could not be acknowledged."); }
    finally { setWorking(null); }
  }

  async function searchPatients() {
    if (!token) return;
    setPatientSearchLoading(true);
    setPatientSearched(true);
    try {
      setPatientResults(await searchStaffPatients(token, patientQuery));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The patient search could not be completed.");
    } finally {
      setPatientSearchLoading(false);
    }
  }

  async function signOut() {
    if (token) {
      try { await logout(token); } catch { /* ignore */ }
    }
    sessionStorage.removeItem("medikiosk.staff_token");
    router.push("/staff/login");
  }

  const filteredEncounters = kioskFilter.trim()
    ? encounters.filter((enc) => {
        const haystack = `${enc.patient_display_name ?? ""} ${STATUS_LABEL[enc.encounter_status] ?? enc.encounter_status} ${PATHWAY_LABEL[enc.pathway_version] ?? enc.pathway_version}`.toLowerCase();
        return haystack.includes(kioskFilter.trim().toLowerCase());
      })
    : encounters;

  return (
    <main className="page-wrap">
      <div className="shell">
        <header className="site-header">
          <Link className="brand" href="/"><span className="brand-mark"><span>✦</span></span>MediKiosk</Link>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <Link className="button-secondary" href="/staff/admin/users">Staff admin</Link>
            <button className="button-secondary" onClick={signOut} type="button">Sign out</button>
          </div>
        </header>
      </div>
      {!token && <section className="form-shell"><div className="panel"><p className="notice error">Sign in to view the dashboard.</p><div className="button-row"><Link className="button-primary" href="/staff/login">Staff sign in</Link></div></div></section>}
      {token && <>
        <section className="form-shell">
          <div className="panel">
            <div className="split-title"><div><p className="eyebrow">Clinical priority queue</p><h1 className="display">Triage signals.</h1></div><small>{items.length} active</small></div>
            <p className="panel-copy">Review safety flags promptly. Acknowledging a flag records the staff action; it does not remove the clinical evidence.</p>
            {loading && <p className="notice">Loading triage signals…</p>}
            {!loading && items.length === 0 && <p className="notice">No active red flags are waiting for review.</p>}
            {!loading && items.length > 0 && <div className="data-list">{items.map((item) => <article className="data-card" key={item.red_flag.id}><span className="tag urgent">{item.red_flag.severity} · safety flag</span><strong>{item.patient_display_name ?? "Unlabelled patient"}</strong><p>{item.red_flag.reason}</p><p><small>Encounter {item.encounter_id.slice(0, 8)} · {item.encounter_status}</small></p><div className="button-row"><Link className="button-secondary" href={`/staff/encounters/${item.encounter_id}`}>Open record</Link><button className="button-primary" disabled={working === item.red_flag.id} onClick={() => acknowledge(item)} type="button">{working === item.red_flag.id ? "Recording…" : "Acknowledge"}</button></div></article>)}</div>}
            {error && <p className="notice error" role="alert">{error}</p>}
          </div>
        </section>

        <section className="form-shell" style={{ marginTop: "1.5rem" }}>
          <div className="panel">
            <div className="split-title"><div><p className="eyebrow">Kiosk walk-ins</p><h2 className="display" style={{ fontSize: "1.6rem" }}>Recent kiosk encounters.</h2></div><small>{filteredEncounters.length} of {encounters.length}</small></div>
            <p className="panel-copy">Anonymous, short-lived kiosk intake sessions — one per visit, not a persistent account.</p>
            <label className="field full" htmlFor="kioskFilter" style={{ maxWidth: "26rem" }}>
              <span>Filter by name, status, or complaint</span>
              <input id="kioskFilter" onChange={(e) => setKioskFilter(e.target.value)} placeholder="e.g. chest discomfort, urgent review…" type="text" value={kioskFilter} />
            </label>
            {loading && <p className="notice">Loading encounters…</p>}
            {!loading && encounters.length === 0 && <p className="notice">No encounters recorded yet. Start a kiosk session to see patients here.</p>}
            {!loading && encounters.length > 0 && filteredEncounters.length === 0 && <p className="notice">No kiosk encounters match &ldquo;{kioskFilter}&rdquo;.</p>}
            {!loading && filteredEncounters.length > 0 && <div className="data-list">{filteredEncounters.map((enc) => <article className="data-card" key={enc.encounter_id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}><div>{enc.has_active_red_flag && <span className="tag urgent" style={{ marginBottom: "0.25rem", display: "inline-block" }}>⚠ Active red flag</span>}<strong style={{ display: "block" }}>{enc.patient_display_name ?? "Anonymous patient"}</strong><p style={{ margin: "0.15rem 0 0" }}><small>{PATHWAY_LABEL[enc.pathway_version] ?? enc.pathway_version}{enc.patient_birth_year ? ` · b. ${enc.patient_birth_year}` : ""}{enc.patient_sex ? ` · ${enc.patient_sex}` : ""}{" · "}{STATUS_LABEL[enc.encounter_status] ?? enc.encounter_status}{" · "}{new Date(enc.created_at).toLocaleString()}</small></p></div><Link className="button-secondary" href={`/staff/encounters/${enc.encounter_id}`} style={{ whiteSpace: "nowrap" }}>Open record</Link></article>)}</div>}
          </div>
        </section>

        <section className="form-shell" style={{ marginTop: "1.5rem" }}>
          <div className="panel">
            <div className="split-title"><div><p className="eyebrow">Registered patients</p><h2 className="display" style={{ fontSize: "1.6rem" }}>Search patient accounts.</h2></div></div>
            <p className="panel-copy">Patients who registered their own portal account and built a personal document history over time — separate from anonymous kiosk visits above.</p>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "flex-end" }}>
              <label className="field" htmlFor="patientQuery" style={{ flex: 1, minWidth: "220px" }}>
                <span>Name, email, or ABHA ID</span>
                <input id="patientQuery" onChange={(e) => setPatientQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void searchPatients(); }} type="text" value={patientQuery} />
              </label>
              <button className="button-primary" disabled={patientSearchLoading} onClick={searchPatients} type="button">
                {patientSearchLoading ? "Searching…" : "Search"}
              </button>
            </div>
            {patientSearched && !patientSearchLoading && patientResults.length === 0 && (
              <p className="notice" style={{ marginTop: "1rem" }}>No registered patients matched that search.</p>
            )}
            {patientResults.length > 0 && (
              <div className="data-list" style={{ marginTop: "1rem" }}>
                {patientResults.map((patient) => (
                  <article className="data-card" key={patient.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
                    <div>
                      <strong style={{ display: "block" }}>{patient.display_name ?? patient.email}</strong>
                      <p style={{ margin: "0.15rem 0 0" }}>
                        <small>
                          {patient.email}
                          {patient.abha_identifier ? ` · ${patient.abha_identifier}` : ""}
                          {" · "}{patient.record_count} record{patient.record_count === 1 ? "" : "s"}
                          {patient.last_activity_at ? ` · last activity ${new Date(patient.last_activity_at).toLocaleDateString()}` : ""}
                        </small>
                      </p>
                    </div>
                    <Link className="button-secondary" href={`/staff/patients/${patient.id}`}>Open record</Link>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </>}
    </main>
  );
}
