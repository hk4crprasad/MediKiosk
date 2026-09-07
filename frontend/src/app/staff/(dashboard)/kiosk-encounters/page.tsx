"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiError, EncounterListItem, getAllEncounters } from "@/lib/api";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft", IN_PROGRESS: "In progress", URGENT_REVIEW: "Urgent review",
  SUBMITTED: "Submitted", IN_REVIEW: "In review", VERIFIED: "Verified", CANCELLED: "Cancelled",
};

const PATHWAY_LABEL: Record<string, string> = {
  "chest-discomfort-v1": "Chest discomfort", "fever-v1": "Fever", "headache-v1": "Headache",
  "abdominal-pain-v1": "Abdominal pain", "ayush-dashavidha-v1": "AYUSH",
};

export default function KioskEncountersPage() {
  const [encounters, setEncounters] = useState<EncounterListItem[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      const token = sessionStorage.getItem("medikiosk.staff_token");
      if (!token) return;
      setLoading(true);
      setError("");
      try {
        setEncounters(await getAllEncounters(token));
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.message : "The encounter list could not be loaded.");
      } finally {
        setLoading(false);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const filtered = filter.trim()
    ? encounters.filter((enc) => {
        const haystack = `${enc.patient_display_name ?? ""} ${STATUS_LABEL[enc.encounter_status] ?? enc.encounter_status} ${PATHWAY_LABEL[enc.pathway_version] ?? enc.pathway_version}`.toLowerCase();
        return haystack.includes(filter.trim().toLowerCase());
      })
    : encounters;

  return (
    <div className="panel">
      <div className="split-title">
        <div><p className="eyebrow">Kiosk walk-ins</p><h1 className="display">Recent kiosk encounters.</h1></div>
        <small>{filtered.length} of {encounters.length}</small>
      </div>
      <p className="panel-copy">Anonymous, short-lived kiosk intake sessions — one per visit, not a persistent account.</p>
      <label className="field full" htmlFor="kioskFilter" style={{ maxWidth: "26rem" }}>
        <span>Filter by name, status, or complaint</span>
        <input id="kioskFilter" onChange={(e) => setFilter(e.target.value)} placeholder="e.g. chest discomfort, urgent review…" type="text" value={filter} />
      </label>
      {loading && <p className="notice">Loading encounters…</p>}
      {!loading && encounters.length === 0 && <p className="notice">No encounters recorded yet. Start a kiosk session to see patients here.</p>}
      {!loading && encounters.length > 0 && filtered.length === 0 && <p className="notice">No kiosk encounters match &ldquo;{filter}&rdquo;.</p>}
      {!loading && filtered.length > 0 && (
        <div className="data-list">
          {filtered.map((enc) => (
            <article className="data-card" key={enc.encounter_id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
              <div>
                {enc.has_active_red_flag && <span className="tag urgent" style={{ marginBottom: "0.25rem", display: "inline-block" }}>⚠ Active red flag</span>}
                <strong style={{ display: "block" }}>{enc.patient_display_name ?? "Anonymous patient"}</strong>
                <p style={{ margin: "0.15rem 0 0" }}>
                  <small>
                    {PATHWAY_LABEL[enc.pathway_version] ?? enc.pathway_version}
                    {enc.patient_birth_year ? ` · b. ${enc.patient_birth_year}` : ""}
                    {enc.patient_sex ? ` · ${enc.patient_sex}` : ""}
                    {" · "}{STATUS_LABEL[enc.encounter_status] ?? enc.encounter_status}
                    {" · "}{new Date(enc.created_at).toLocaleString()}
                  </small>
                </p>
              </div>
              <Link className="button-secondary" href={`/staff/encounters/${enc.encounter_id}`} style={{ whiteSpace: "nowrap" }}>Open record</Link>
            </article>
          ))}
        </div>
      )}
      {error && <p className="notice error" role="alert">{error}</p>}
    </div>
  );
}
