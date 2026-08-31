"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  ApiError,
  CurrentPatient,
  PatientHistorySummary,
  PatientRecord,
  extractPatientRecord,
  generatePatientSummary,
  getPatientMe,
  getPatientSummary,
  listPatientRecords,
  logoutPatient,
  uploadPatientRecord,
} from "@/lib/api";

const DOCUMENT_TYPE_LABEL: Record<string, string> = {
  prescription: "Prescription",
  lab_report: "Lab / diagnostic report",
  discharge_summary: "Discharge summary",
  other: "Other medical record",
};

export default function PatientDashboardPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [account, setAccount] = useState<CurrentPatient | null>(null);
  const [records, setRecords] = useState<PatientRecord[]>([]);
  const [summary, setSummary] = useState<PatientHistorySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState("prescription");
  const [visitDate, setVisitDate] = useState("");
  const [hospitalOrClinic, setHospitalOrClinic] = useState("");
  const [visitReason, setVisitReason] = useState("");

  const loadAll = useCallback(async (activeToken: string) => {
    setLoading(true);
    setError("");
    try {
      const [me, myRecords, mySummary] = await Promise.all([
        getPatientMe(activeToken),
        listPatientRecords(activeToken),
        getPatientSummary(activeToken).catch(() => null),
      ]);
      setAccount(me);
      setRecords(myRecords);
      setSummary(mySummary);
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.status === 401
          ? "Your session has expired. Please sign in again."
          : "Your dashboard could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = sessionStorage.getItem("medikiosk.patient_token");
      setToken(saved);
      if (saved) void loadAll(saved);
      else setLoading(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadAll]);

  async function handleUpload(event: FormEvent) {
    event.preventDefault();
    if (!token || !file) return;
    setActionLoading("upload");
    setError("");
    setNotice("");
    try {
      const uploaded = await uploadPatientRecord(token, file, {
        documentType,
        visitDate: visitDate || undefined,
        hospitalOrClinic: hospitalOrClinic.trim() || undefined,
        visitReason: visitReason.trim() || undefined,
      });
      setNotice(`"${uploaded.original_filename}" uploaded to your archive.`);
      setFile(null);
      setVisitDate("");
      setHospitalOrClinic("");
      setVisitReason("");
      try {
        await extractPatientRecord(uploaded.id, token);
      } catch {
        // Extraction is best-effort; the record is still saved and viewable.
      }
      await loadAll(token);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The upload failed. Please try again.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleGenerateSummary() {
    if (!token) return;
    setActionLoading("summary");
    setError("");
    setNotice("");
    try {
      const generated = await generatePatientSummary(token);
      setSummary(generated);
      setNotice("Your history overview has been updated.");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The overview could not be generated.");
    } finally {
      setActionLoading(null);
    }
  }

  async function signOut() {
    if (token) {
      try {
        await logoutPatient(token);
      } catch {
        // Continue clearing session regardless.
      }
    }
    sessionStorage.removeItem("medikiosk.patient_token");
    router.push("/patient/login");
  }

  return (
    <main className="page-wrap patient-page">
      <div className="shell">
        <header className="site-header">
          <Link className="brand" href="/"><span className="brand-mark"><span>✦</span></span>MediKiosk</Link>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            {account && <span className="nav-link">{account.display_name || account.email}</span>}
            <button className="button-secondary" onClick={signOut} type="button">Sign out</button>
          </div>
        </header>
      </div>

      {!token && !loading && (
        <section className="form-shell">
          <div className="panel">
            <p className="notice error">Sign in to view your records.</p>
            <div className="button-row"><Link className="button-primary" href="/patient/login">Patient sign in</Link></div>
          </div>
        </section>
      )}

      {token && (
        <>
          <section className="form-shell">
            <div className="panel">
              <p className="eyebrow">Your medical record archive</p>
              <h1 className="display">Your history, in one place.</h1>
              <p className="panel-copy">
                Upload prior prescriptions, lab reports, and discharge summaries. This is your own personal record —
                it is not a diagnosis, and a physician will still review the originals during your visit.
              </p>
              {loading && <p className="notice">Loading your dashboard…</p>}
              {notice && <p className="notice success">{notice}</p>}
              {error && <p className="notice error" role="alert">{error}</p>}

              {!loading && (
                <form className="upload-card" onSubmit={handleUpload} style={{ marginTop: "1.5rem" }}>
                  <h2 className="display">Upload a report</h2>
                  <div className="upload-row">
                    <label className="field" htmlFor="documentType">
                      <span>Document kind</span>
                      <select id="documentType" onChange={(e) => setDocumentType(e.target.value)} value={documentType}>
                        <option value="prescription">Prescription</option>
                        <option value="lab_report">Lab / diagnostic report</option>
                        <option value="discharge_summary">Discharge summary</option>
                        <option value="other">Other medical record</option>
                      </select>
                    </label>
                    <label className="field" htmlFor="visitDate">
                      <span>Visit date (optional)</span>
                      <input id="visitDate" onChange={(e) => setVisitDate(e.target.value)} type="date" value={visitDate} />
                    </label>
                    <label className="field" htmlFor="hospitalOrClinic">
                      <span>Hospital / clinic (optional)</span>
                      <input id="hospitalOrClinic" onChange={(e) => setHospitalOrClinic(e.target.value)} type="text" value={hospitalOrClinic} />
                    </label>
                  </div>
                  <div className="upload-row">
                    <label className="field" htmlFor="visitReason" style={{ flex: 1, minWidth: "200px" }}>
                      <span>Reason for visit (optional)</span>
                      <input id="visitReason" onChange={(e) => setVisitReason(e.target.value)} type="text" value={visitReason} />
                    </label>
                    <label className="field" htmlFor="recordFile" style={{ flex: 1, minWidth: "200px" }}>
                      <span>Select file (PDF, JPG, or PNG)</span>
                      <input
                        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                        id="recordFile"
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                        type="file"
                      />
                    </label>
                    <button className="button-primary" disabled={actionLoading === "upload" || !file} type="submit">
                      {actionLoading === "upload" ? "Uploading…" : "Upload & scan"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </section>

          <section className="form-shell" style={{ marginTop: "1.5rem" }}>
            <div className="panel">
              <div className="split-title">
                <div><p className="eyebrow">AI overview</p><h2 className="display" style={{ fontSize: "1.6rem" }}>Your history, summarized.</h2></div>
                <button className="button-primary" disabled={actionLoading === "summary"} onClick={handleGenerateSummary} type="button">
                  {actionLoading === "summary" ? "Summarizing…" : summary ? "🔄 Regenerate overview" : "✨ Generate overview"}
                </button>
              </div>
              <p className="panel-copy">
                Generated from your uploaded records only. This is a summary for your and your doctor&apos;s convenience —
                never a diagnosis.
              </p>
              {summary ? (
                <p className="panel-copy" style={{ marginTop: "0.75rem", lineHeight: 1.6 }}>{summary.text}</p>
              ) : (
                <p className="notice">No overview yet. Upload a record and generate one above.</p>
              )}
            </div>
          </section>

          <section className="form-shell" style={{ marginTop: "1.5rem" }}>
            <div className="panel">
              <div className="split-title">
                <div><p className="eyebrow">Your uploads</p><h2 className="display" style={{ fontSize: "1.6rem" }}>Records on file.</h2></div>
                <small>{records.length} total</small>
              </div>
              {!loading && records.length === 0 && <p className="notice">You haven&apos;t uploaded any records yet.</p>}
              {records.length > 0 && (
                <div className="data-list">
                  {records.map((record) => (
                    <div className="data-card upload-doc-row" key={record.id}>
                      <div>
                        <strong>{record.original_filename}</strong>
                        <p style={{ margin: "0.2rem 0 0" }}>
                          <small>
                            {DOCUMENT_TYPE_LABEL[record.document_type] ?? record.document_type}
                            {record.visit_date ? ` · ${record.visit_date}` : ""}
                            {record.hospital_or_clinic ? ` · ${record.hospital_or_clinic}` : ""}
                          </small>
                        </p>
                      </div>
                      <span className="tag">{record.processing_status.replaceAll("_", " ")}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
