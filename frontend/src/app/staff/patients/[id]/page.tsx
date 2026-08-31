"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ApiError, PatientProfile, generateStaffPatientSummary, getStaffPatientProfile } from "@/lib/api";

const DOCUMENT_TYPE_LABEL: Record<string, string> = {
  prescription: "Prescription",
  lab_report: "Lab / diagnostic report",
  discharge_summary: "Discharge summary",
  other: "Other medical record",
};

export default function StaffPatientProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    const token = sessionStorage.getItem("medikiosk.staff_token");
    if (!token) {
      setError("Sign in to view this patient's record.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      setProfile(await getStaffPatientProfile(token, id));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "This patient's record could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function regenerateSummary() {
    const token = sessionStorage.getItem("medikiosk.staff_token");
    if (!token) return;
    setGenerating(true);
    try {
      const summary = await generateStaffPatientSummary(token, id);
      setProfile((prev) => (prev ? { ...prev, summary } : prev));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The overview could not be generated.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <main className="page-wrap">
      <div className="shell">
        <header className="site-header">
          <Link className="brand" href="/"><span className="brand-mark"><span>✦</span></span>MediKiosk</Link>
          <Link className="button-secondary" href="/staff/triage">← Dashboard</Link>
        </header>
      </div>
      <section className="form-shell">
        <div className="panel">
          <p className="eyebrow">Registered patient · self-archived history</p>
          {loading && <h1 className="display">Opening record…</h1>}
          {!loading && error && (
            <>
              <h1 className="display">Record unavailable.</h1>
              <p className="notice error" role="alert">{error}</p>
              <div className="button-row"><Link className="button-primary" href="/staff/login">Staff sign in</Link></div>
            </>
          )}
          {!loading && profile && (
            <>
              <h1 className="display">{profile.account.display_name || profile.account.email}</h1>
              <div className="encounter-banner">
                <div><small>Email</small><strong>{profile.account.email}</strong></div>
                <div><small>Demographics</small><span>{profile.account.birth_year ? `Born ${profile.account.birth_year}` : "Not captured"}{profile.account.sex ? ` · ${profile.account.sex}` : ""}</span></div>
                {profile.account.abha_identifier && (
                  <div><small>ABHA Address</small><code style={{ fontSize: "0.85rem", color: "var(--info)" }}>{profile.account.abha_identifier}</code></div>
                )}
                <div><small>Records on file</small><strong>{profile.records.length}</strong></div>
              </div>

              <div className="workspace-card">
                <div className="split-title">
                  <div><h2 className="display" style={{ fontSize: "1.3rem", margin: 0 }}>AI history overview</h2></div>
                  <button className="button-primary" disabled={generating} onClick={regenerateSummary} type="button">
                    {generating ? "Summarizing…" : profile.summary ? "🔄 Regenerate overview" : "✨ Generate overview"}
                  </button>
                </div>
                <p className="panel-copy" style={{ marginTop: "0.5rem" }}>
                  Synthesized only from this patient&apos;s own uploaded records. Not a diagnosis.
                </p>
                {profile.summary ? (
                  <p className="panel-copy" style={{ marginTop: "0.75rem", lineHeight: 1.6 }}>{profile.summary.text}</p>
                ) : (
                  <p className="notice">No overview generated yet.</p>
                )}
              </div>

              <h2 className="display" style={{ fontSize: "1.3rem", marginTop: "2rem" }}>Uploaded records</h2>
              <div className="data-list">
                {profile.records.length ? (
                  profile.records.map((record) => (
                    <div className="data-card upload-doc-row" key={record.id}>
                      <div>
                        <strong>{record.original_filename}</strong>
                        <p style={{ margin: "0.2rem 0 0" }}>
                          <small>
                            {DOCUMENT_TYPE_LABEL[record.document_type] ?? record.document_type}
                            {record.visit_date ? ` · ${record.visit_date}` : ""}
                            {record.hospital_or_clinic ? ` · ${record.hospital_or_clinic}` : ""}
                            {record.visit_reason ? ` · ${record.visit_reason}` : ""}
                          </small>
                        </p>
                      </div>
                      <span className="tag">{record.processing_status.replaceAll("_", " ")}</span>
                    </div>
                  ))
                ) : (
                  <p className="notice">This patient has not uploaded any records yet.</p>
                )}
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
