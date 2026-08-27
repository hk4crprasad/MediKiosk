"use client";

import { useState } from "react";
import { ApiError, extractDocument, uploadDocument } from "@/lib/api";

type DocumentUploadSectionProps = {
  encounterId: string;
  token: string;
};

type UploadedDoc = {
  id: string;
  filename: string;
  type: string;
  status: string;
  extracted?: boolean;
};

export function DocumentUploadSection({ encounterId, token }: DocumentUploadSectionProps) {
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState("prescription");
  const [uploading, setUploading] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !token) return;
    setUploading(true);
    setError("");
    setSuccess("");
    try {
      const uploaded = await uploadDocument(encounterId, token, file, docType);
      const newDoc: UploadedDoc = {
        id: uploaded.id,
        filename: uploaded.original_filename,
        type: docType,
        status: uploaded.processing_status,
      };
      setUploadedDocs((prev) => [...prev, newDoc]);
      setSuccess(`"${uploaded.original_filename}" uploaded successfully to private storage.`);
      setFile(null);

      // Trigger automatic extraction
      try {
        await extractDocument(uploaded.id, token);
        setUploadedDocs((prev) =>
          prev.map((d) => (d.id === uploaded.id ? { ...d, extracted: true, status: "PROCESSED" } : d))
        );
      } catch {
        // Extraction non-blocking for upload
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Document upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div style={{ marginTop: "2rem", padding: "1.25rem", borderRadius: "12px", border: "1px solid var(--border, #2a3342)", background: "rgba(255,255,255,0.02)" }}>
      <h2 className="display" style={{ fontSize: "1.25rem", margin: "0 0 0.5rem" }}>
        📁 Upload prior medical documents (Optional)
      </h2>
      <p className="panel-copy kiosk-copy" style={{ margin: "0 0 1rem" }}>
        Carry prior prescriptions, lab reports, or discharge summaries? Upload them here so your doctor can review digitized medical records during your consultation. (PDF, JPG, PNG up to 15MB)
      </p>

      <form onSubmit={handleUpload} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <label htmlFor="kioskDocType" style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.25rem", fontWeight: 600 }}>Document kind</label>
            <select
              id="kioskDocType"
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              style={{ padding: "0.5rem 0.75rem", borderRadius: "8px", background: "rgba(0,0,0,0.3)", color: "inherit", border: "1px solid var(--border, #4b5563)" }}
            >
              <option value="prescription">Prescription</option>
              <option value="lab_report">Lab / Diagnostic Report</option>
              <option value="discharge_summary">Discharge Summary</option>
              <option value="other">Other Medical Record</option>
            </select>
          </div>

          <div style={{ flex: 1, minWidth: "200px" }}>
            <label htmlFor="kioskDocFile" style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.25rem", fontWeight: 600 }}>Select file</label>
            <input
              id="kioskDocFile"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              style={{ padding: "0.4rem", borderRadius: "8px", background: "rgba(0,0,0,0.2)", width: "100%" }}
            />
          </div>

          <div style={{ alignSelf: "flex-end" }}>
            <button
              className="button-primary kiosk-primary"
              disabled={uploading || !file}
              type="submit"
              style={{ marginTop: "1rem" }}
            >
              {uploading ? "Uploading & OCR…" : "Upload & scan"}
            </button>
          </div>
        </div>
      </form>

      {success && <p className="notice" style={{ background: "rgba(16, 185, 129, 0.1)", borderColor: "#10b981", color: "#10b981", marginTop: "0.75rem" }}>{success}</p>}
      {error && <p className="notice error" style={{ marginTop: "0.75rem" }}>{error}</p>}

      {uploadedDocs.length > 0 && (
        <div style={{ marginTop: "1rem" }}>
          <p style={{ fontSize: "0.9rem", fontWeight: 600, margin: "0 0 0.5rem" }}>Uploaded documents for this visit ({uploadedDocs.length}):</p>
          <div className="data-list">
            {uploadedDocs.map((doc) => (
              <div className="data-card" key={doc.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.6rem 1rem" }}>
                <div>
                  <strong>{doc.filename}</strong>
                  <span style={{ fontSize: "0.8rem", opacity: 0.8, marginLeft: "0.5rem" }}>({doc.type})</span>
                </div>
                <span className="tag">{doc.extracted ? "✓ OCR processed" : "Uploaded"}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
