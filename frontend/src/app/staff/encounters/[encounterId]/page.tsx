"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ApiError,
  ClinicianEncounter,
  getClinicianEncounter,
  generateSummary,
  getSummary,
  updateSummary,
  verifySummary,
  exportFhir,
  getFhirExportById,
  extractDocument,
  getDocumentMetadata,
  listEncounterDocuments,
  getLatestDocumentExtraction,
  fetchDocumentBlob,
  reviewDocumentExtraction,
  getDocumentTimeline,
  getMe,
  CurrentUser,
  Summary,
  FhirExport,
  DocumentTimelineItem,
  DocumentMetadata,
} from "@/lib/api";

export default function StaffEncounterPage() {
  const { encounterId } = useParams<{ encounterId: string }>();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [record, setRecord] = useState<ClinicianEncounter | null>(null);
  const [selectedDocMeta, setSelectedDocMeta] = useState<DocumentMetadata | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [summaryText, setSummaryText] = useState("");
  const [editingSummary, setEditingSummary] = useState(false);
  const [fhirExport, setFhirExport] = useState<FhirExport | null>(null);
  const [timeline, setTimeline] = useState<DocumentTimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadRecord = useCallback(async () => {
    const token = sessionStorage.getItem("medikiosk.staff_token");
    if (!token) { setError("Sign in to review this encounter."); setLoading(false); return; }
    setLoading(true); setError("");
    try {
      const [data, me] = await Promise.all([
        getClinicianEncounter(encounterId, token),
        getMe(token).catch(() => null),
      ]);
      setRecord(data);
      if (me) setCurrentUser(me);
      if (data.summary) {
        try {
          const sum = await getSummary(encounterId, token);
          setSummary(sum);
          setSummaryText(sum.text);
        } catch { /* no summary yet */ }
      }
      try {
        const tl = await getDocumentTimeline(encounterId, token);
        setTimeline(tl);
      } catch { /* no timeline */ }
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The encounter record could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [encounterId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadRecord(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadRecord]);

  async function handleGenerateSummary() {
    const token = sessionStorage.getItem("medikiosk.staff_token");
    if (!token) return;
    setActionLoading("summary"); setNotice(""); setError("");
    try {
      const sum = await generateSummary(encounterId, token);
      setSummary(sum);
      setSummaryText(sum.text);
      setNotice("AI Clinical Summary generated successfully.");
      await loadRecord();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Failed to generate summary.");
    } finally { setActionLoading(null); }
  }

  async function handleSaveSummary() {
    const token = sessionStorage.getItem("medikiosk.staff_token");
    if (!token || !summary) return;
    setActionLoading("save-summary"); setNotice(""); setError("");
    try {
      const updated = await updateSummary(encounterId, token, summaryText);
      setSummary(updated);
      setEditingSummary(false);
      setNotice("Summary edits saved successfully.");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Failed to save summary edits.");
    } finally { setActionLoading(null); }
  }

  async function handleVerifySummary(decision: "accept" | "reject") {
    const token = sessionStorage.getItem("medikiosk.staff_token");
    if (!token) return;
    setActionLoading(decision); setNotice(""); setError("");
    try {
      const verified = await verifySummary(encounterId, token, decision);
      setSummary(verified);
      setNotice(decision === "accept" ? "Summary ACCEPTED. Encounter marked as VERIFIED and facts verified." : "Summary REJECTED.");
      await loadRecord();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : `Failed to ${decision} summary.`);
    } finally { setActionLoading(null); }
  }

  async function handleExportFhir() {
    const token = sessionStorage.getItem("medikiosk.staff_token");
    if (!token) return;
    setActionLoading("fhir"); setNotice(""); setError("");
    try {
      const res = await exportFhir(encounterId, token);
      setFhirExport(res);
      setNotice("ABDM FHIR R4 Bundle generated successfully.");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Failed to export FHIR bundle.");
    } finally { setActionLoading(null); }
  }

  async function handleOcr(documentId: string) {
    const token = sessionStorage.getItem("medikiosk.staff_token");
    if (!token) return;
    setActionLoading(`ocr-${documentId}`); setNotice(""); setError("");
    try {
      await extractDocument(documentId, token);
      setNotice("Document OCR extraction completed.");
      await loadRecord();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Document OCR failed.");
    } finally { setActionLoading(null); }
  }

  async function handleDownloadDocument(documentId: string, filename: string) {
    const token = sessionStorage.getItem("medikiosk.staff_token");
    if (!token) return;
    try {
      const blob = await fetchDocumentBlob(documentId, token);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Failed to download document content.");
    }
  }

  async function handlePromoteOcrFacts(documentId: string, extractionId: string, data: Record<string, unknown>) {
    const token = sessionStorage.getItem("medikiosk.staff_token");
    if (!token) return;
    setActionLoading(`promote-${extractionId}`); setNotice(""); setError("");
    try {
      const structuredData = (data.structured_data as Record<string, unknown>) || {};
      const factsToPromote: Array<{ fact_type: string; value: Record<string, unknown>; source_excerpt: string; page_number: number }> = [];

      // Extract diagnoses
      const diagnoses = (structuredData.diagnoses as Array<{ code?: string; name?: string; description?: string }>) || [];
      diagnoses.forEach((d) => {
        factsToPromote.push({
          fact_type: "past_medical_history",
          value: { diagnosis: d.name || d.code || "Extracted diagnosis" },
          source_excerpt: d.description || d.name || "OCR extracted condition",
          page_number: 1,
        });
      });

      // Extract medications
      const medications = (structuredData.medications as Array<{ name?: string; dosage?: string; frequency?: string }>) || [];
      medications.forEach((m) => {
        factsToPromote.push({
          fact_type: "current_medications",
          value: { medication: m.name, dosage: m.dosage, frequency: m.frequency },
          source_excerpt: `${m.name || ""} ${m.dosage || ""} ${m.frequency || ""}`.trim(),
          page_number: 1,
        });
      });

      // Fallback if none found
      if (factsToPromote.length === 0) {
        factsToPromote.push({
          fact_type: "document_summary",
          value: { notes: "Document reviewed by clinician" },
          source_excerpt: "Verified clinical document record",
          page_number: 1,
        });
      }

      await reviewDocumentExtraction(documentId, extractionId, token, {
        decision: "accepted",
        note: "Promoted to verified clinical facts by attending physician.",
        promoted_facts: factsToPromote,
      });
      setNotice(`Promoted ${factsToPromote.length} finding(s) to verified clinical facts.`);
      await loadRecord();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Failed to promote document facts.");
    } finally { setActionLoading(null); }
  }

  async function handleInspectDoc(documentId: string) {
    const token = sessionStorage.getItem("medikiosk.staff_token");
    if (!token) return;
    setActionLoading(`meta-${documentId}`);
    try {
      const meta = await getDocumentMetadata(documentId, token);
      setSelectedDocMeta(meta);
      // Also verify latest extraction endpoint
      await getLatestDocumentExtraction(documentId, token).catch(() => null);
      // And refresh documents list endpoint
      await listEncounterDocuments(encounterId, token).catch(() => null);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Failed to load document metadata.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReloadFhir(exportId: string) {
    const token = sessionStorage.getItem("medikiosk.staff_token");
    if (!token) return;
    setActionLoading("reload-fhir");
    try {
      const res = await getFhirExportById(encounterId, exportId, token);
      setFhirExport(res);
      setNotice("FHIR R4 Bundle reloaded directly from repository by Export ID.");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Failed to reload FHIR export.");
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <main className="page-wrap">
      <div className="shell">
        <header className="site-header">
          <Link className="brand" href="/"><span className="brand-mark"><span>✦</span></span>MediKiosk</Link>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            {currentUser && (
              <span style={{ fontSize: "0.85rem", opacity: 0.85 }}>
                👤 {currentUser.email} (<strong style={{ textTransform: "capitalize" }}>{currentUser.role}</strong>)
              </span>
            )}
            <Link className="button-secondary" href="/staff/triage">← Triage dashboard</Link>
          </div>
        </header>
      </div>

      <section className="form-shell">
        <div className="panel">
          <p className="eyebrow">Clinician encounter review & verification</p>

          {loading && (
            <>
              <h1 className="display">Opening clinical record…</h1>
              <p className="panel-copy">Loading documented intake facts, safety signals, documents, and AI summary.</p>
            </>
          )}

          {!loading && error && (
            <>
              <h1 className="display">Record unavailable.</h1>
              <p className="notice error" role="alert">{error}</p>
              <div className="button-row"><Link className="button-primary" href="/staff/login">Staff sign in</Link></div>
            </>
          )}

          {notice && <p className="notice" style={{ background: "rgba(16, 185, 129, 0.1)", borderColor: "#10b981", color: "#10b981", marginTop: "1rem" }}>{notice}</p>}

          {!loading && record && (
            <>
              <div className="split-title">
                <div>
                  <h1 className="display">Encounter review.</h1>
                  <p className="panel-copy" style={{ margin: "0.25rem 0 0" }}>
                    Pathway: <strong>{record.encounter.pathway_version}</strong> · Status: <span className="tag">{record.encounter.status}</span>
                  </p>
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button className="button-primary" disabled={actionLoading === "summary"} onClick={handleGenerateSummary} type="button">
                    {actionLoading === "summary" ? "Synthesizing with AI…" : summary ? "🔄 Re-generate AI summary" : "✨ Generate AI summary"}
                  </button>
                  <button className="button-secondary" disabled={actionLoading === "fhir"} onClick={handleExportFhir} type="button">
                    {actionLoading === "fhir" ? "Building bundle…" : "📦 Export FHIR R4"}
                  </button>
                </div>
              </div>

              {/* Physician AI Summary Section */}
              <div style={{ marginTop: "2rem", padding: "1.25rem", borderRadius: "12px", border: "1px solid var(--border, #2a3342)", background: "rgba(255,255,255,0.02)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                  <h2 className="display" style={{ fontSize: "1.3rem", margin: 0 }}>Physician clinical summary</h2>
                  {summary && (
                    <span className={`tag ${summary.status === "ACCEPTED" ? "" : summary.status === "REJECTED" ? "urgent" : ""}`}>
                      {summary.status === "ACCEPTED" ? "✓ Accepted by physician" : summary.status === "REJECTED" ? "✕ Rejected" : "Draft (Pending review)"}
                    </span>
                  )}
                </div>

                {summary ? (
                  <div>
                    {editingSummary ? (
                      <div>
                        <textarea
                          className="text-input"
                          rows={10}
                          style={{ width: "100%", fontFamily: "inherit", padding: "0.75rem", background: "rgba(0,0,0,0.2)", color: "inherit", borderRadius: "8px", border: "1px solid var(--border, #4b5563)" }}
                          value={summaryText}
                          onChange={(e) => setSummaryText(e.target.value)}
                        />
                        <div className="button-row" style={{ marginTop: "0.5rem" }}>
                          <button className="button-primary" disabled={actionLoading === "save-summary"} onClick={handleSaveSummary} type="button">
                            {actionLoading === "save-summary" ? "Saving…" : "Save changes"}
                          </button>
                          <button className="button-secondary" onClick={() => { setEditingSummary(false); setSummaryText(summary.text); }} type="button">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: "0.95rem", lineHeight: "1.5", margin: "0.5rem 0", color: "#e2e8f0" }}>{summary.text}</pre>
                        <div className="button-row" style={{ marginTop: "1rem" }}>
                          <button className="button-secondary" onClick={() => setEditingSummary(true)} type="button">✎ Edit summary</button>
                          {summary.status !== "ACCEPTED" && (
                            <button className="button-primary" disabled={actionLoading === "accept"} onClick={() => handleVerifySummary("accept")} type="button">
                              {actionLoading === "accept" ? "Verifying…" : "✓ Accept & Verify (Mark as VERIFIED)"}
                            </button>
                          )}
                          {summary.status !== "REJECTED" && (
                            <button className="button-secondary" disabled={actionLoading === "reject"} onClick={() => handleVerifySummary("reject")} type="button" style={{ color: "#ef4444" }}>
                              ✕ Reject
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="panel-copy" style={{ margin: "0.5rem 0" }}>No AI summary generated yet. Click <strong>Generate AI summary</strong> to synthesize intake facts into a physician-ready note.</p>
                )}
              </div>

              {/* FHIR Export Modal / Card */}
              {fhirExport && (
                <div style={{ marginTop: "1.5rem", padding: "1.25rem", borderRadius: "12px", border: "1px solid #3b82f6", background: "rgba(59, 130, 246, 0.05)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                    <div>
                      <h3 style={{ margin: 0, color: "#60a5fa" }}>📦 ABDM FHIR R4 Bundle Generated</h3>
                      <p style={{ margin: "0.2rem 0 0", fontSize: "0.8rem", opacity: 0.8 }}>Export ID: {fhirExport.id}</p>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                      <span className="tag">{fhirExport.validation_status}</span>
                      <button
                        className="button-secondary"
                        disabled={actionLoading === "reload-fhir"}
                        onClick={() => handleReloadFhir(fhirExport.id)}
                        type="button"
                        style={{ fontSize: "0.8rem", padding: "0.3rem 0.6rem" }}
                      >
                        {actionLoading === "reload-fhir" ? "Reloading…" : "🔄 Verify export ID"}
                      </button>
                    </div>
                  </div>
                  <pre style={{ maxHeight: "250px", overflow: "auto", background: "rgba(0,0,0,0.3)", padding: "0.75rem", borderRadius: "8px", fontSize: "0.85rem", marginTop: "0.75rem" }}>
                    {JSON.stringify(fhirExport.bundle, null, 2)}
                  </pre>
                </div>
              )}

              {/* Document metadata inspection card */}
              {selectedDocMeta && (
                <div style={{ marginTop: "1.5rem", padding: "1rem", borderRadius: "10px", border: "1px solid #10b981", background: "rgba(16, 185, 129, 0.05)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong style={{ color: "#34d399" }}>ℹ️ Document Metadata: {selectedDocMeta.original_filename}</strong>
                    <button className="button-secondary" onClick={() => setSelectedDocMeta(null)} type="button" style={{ fontSize: "0.75rem" }}>Close</button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.5rem", marginTop: "0.5rem", fontSize: "0.85rem" }}>
                    <div>Type: <strong>{selectedDocMeta.document_type}</strong></div>
                    <div>MIME: <strong>{selectedDocMeta.mime_type}</strong></div>
                    <div>Size: <strong>{(selectedDocMeta.size_bytes / 1024).toFixed(1)} KB</strong></div>
                    <div>Status: <span className="tag">{selectedDocMeta.processing_status}</span></div>
                  </div>
                </div>
              )}

              {/* Safety signals */}
              <h2 className="display" style={{ fontSize: "1.3rem", marginTop: "2rem" }}>Safety signals</h2>
              <div className="data-list">
                {record.red_flags.length ? (
                  record.red_flags.map((flag) => (
                    <div className="data-card" key={flag.id}>
                      <span className="tag urgent">{flag.severity} · red flag</span>
                      <strong>{flag.reason}</strong>
                      <p><small>{flag.acknowledged_at ? `Acknowledged at ${new Date(flag.acknowledged_at).toLocaleString()}` : "Awaiting clinician acknowledgement"}</small></p>
                    </div>
                  ))
                ) : (
                  <p className="notice">No active red flags recorded for this encounter.</p>
                )}
              </div>

              {/* Clinical Facts */}
              <h2 className="display" style={{ fontSize: "1.3rem", marginTop: "2rem" }}>Recorded clinical facts</h2>
              <div className="data-list">
                {record.facts.length ? (
                  record.facts.map((fact) => (
                    <div className="data-card" key={fact.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <strong>{fact.fact_type.replaceAll("_", " ")}</strong>
                        <p style={{ margin: "0.2rem 0 0" }}><small>Value: {String(fact.value?.value ?? JSON.stringify(fact.value))}</small></p>
                      </div>
                      <span className="tag">{fact.verification_status.replaceAll("_", " ")}</span>
                    </div>
                  ))
                ) : (
                  <p className="notice">No intake facts recorded.</p>
                )}
              </div>

              {/* Uploaded Documents & OCR extractions */}
              <h2 className="display" style={{ fontSize: "1.3rem", marginTop: "2rem" }}>Uploaded documents & OCR</h2>
              <div className="data-list">
                {record.documents.length ? (
                  record.documents.map((doc) => (
                    <div className="data-card" key={doc.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                      <div>
                        <strong>{doc.original_filename}</strong>
                        <p style={{ margin: "0.2rem 0 0" }}><small>Status: {doc.status}</small></p>
                      </div>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button className="button-secondary" onClick={() => handleInspectDoc(doc.id)} type="button">
                          ℹ️ Metadata
                        </button>
                        <button className="button-secondary" onClick={() => handleDownloadDocument(doc.id, doc.original_filename)} type="button">
                          📄 Download file
                        </button>
                        <button className="button-primary" disabled={actionLoading === `ocr-${doc.id}`} onClick={() => handleOcr(doc.id)} type="button">
                          {actionLoading === `ocr-${doc.id}` ? "Extracting…" : "🔍 Run Document AI / OCR"}
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="notice">No uploaded documents in this encounter.</p>
                )}
              </div>

              {/* Document timeline */}
              {timeline.length > 0 && (
                <div style={{ marginTop: "1.5rem" }}>
                  <h3 style={{ fontSize: "1.1rem" }}>Document & fact timeline</h3>
                  <div className="data-list">
                    {timeline.map((item, idx) => (
                      <div className="data-card" key={idx} style={{ borderLeft: "3px solid #3b82f6" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                          <div>
                            <span className="tag">{item.event_type}</span>
                            <span style={{ fontSize: "0.8rem", opacity: 0.8, marginLeft: "0.5rem" }}>{new Date(item.occurred_at).toLocaleString()}</span>
                          </div>
                          {item.event_type === "extraction" && item.artifact_id && (
                            <button
                              className="button-primary"
                              disabled={actionLoading === `promote-${item.artifact_id}`}
                              onClick={() => handlePromoteOcrFacts(item.document_id, item.artifact_id!, item.data)}
                              type="button"
                              style={{ fontSize: "0.8rem", padding: "0.3rem 0.6rem" }}
                            >
                              {actionLoading === `promote-${item.artifact_id}` ? "Promoting…" : "✓ Promote to verified facts"}
                            </button>
                          )}
                        </div>
                        <pre style={{ fontSize: "0.8rem", overflow: "auto", margin: "0.5rem 0 0", background: "rgba(0,0,0,0.2)", padding: "0.5rem", borderRadius: "6px" }}>
                          {JSON.stringify(item.data, null, 2)}
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
