"use client";

import Link from "next/link";
import { useState } from "react";
import { ApiError, PatientSearchResult, searchStaffPatients } from "@/lib/api";

export default function StaffPatientsSearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PatientSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");

  async function search() {
    const token = sessionStorage.getItem("medikiosk.staff_token");
    if (!token) return;
    setLoading(true);
    setSearched(true);
    setError("");
    try {
      setResults(await searchStaffPatients(token, query));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The patient search could not be completed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel">
      <div className="split-title">
        <div><p className="eyebrow">Registered patients</p><h1 className="display">Search patient accounts.</h1></div>
      </div>
      <p className="panel-copy">Patients who registered their own portal account and built a personal document history over time — separate from anonymous kiosk visits.</p>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "flex-end" }}>
        <label className="field" htmlFor="patientQuery" style={{ flex: 1, minWidth: "220px" }}>
          <span>Name, email, or ABHA ID</span>
          <input id="patientQuery" onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void search(); }} type="text" value={query} />
        </label>
        <button className="button-primary" disabled={loading} onClick={search} type="button">
          {loading ? "Searching…" : "Search"}
        </button>
      </div>
      {searched && !loading && results.length === 0 && (
        <p className="notice" style={{ marginTop: "1rem" }}>No registered patients matched that search.</p>
      )}
      {results.length > 0 && (
        <div className="data-list" style={{ marginTop: "1rem" }}>
          {results.map((patient) => (
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
      {error && <p className="notice error" role="alert">{error}</p>}
    </div>
  );
}
