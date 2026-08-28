"use client";

import { useState } from "react";
import { ApiError, extractDocument, KioskLanguage, uploadDocument } from "@/lib/api";

type DocumentUploadSectionProps = {
  encounterId: string;
  token: string;
  language: KioskLanguage;
};

type UploadedDoc = {
  id: string;
  filename: string;
  type: string;
  status: string;
  extracted?: boolean;
};

export function DocumentUploadSection({ encounterId, token, language }: DocumentUploadSectionProps) {
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState("prescription");
  const [uploading, setUploading] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const text = (english: string, hindi: string) => (language === "hi" ? hindi : english);

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
      setSuccess(text(`"${uploaded.original_filename}" uploaded successfully to private storage.`, `"${uploaded.original_filename}" निजी संग्रह में अपलोड हो गई।`));
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
      setError(caught instanceof ApiError ? caught.message : text("Document upload failed.", "दस्तावेज़ अपलोड नहीं हो सका।"));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div style={{ marginTop: "2rem", padding: "1.25rem", borderRadius: "12px", border: "1px solid var(--border, #2a3342)", background: "rgba(255,255,255,0.02)" }}>
      <h2 className="display" style={{ fontSize: "1.25rem", margin: "0 0 0.5rem" }}>
        📁 {text("Upload prior medical documents (optional)", "पुराने चिकित्सा दस्तावेज़ अपलोड करें (वैकल्पिक)")}
      </h2>
      <p className="panel-copy kiosk-copy" style={{ margin: "0 0 1rem" }}>
        {text("Carry prior prescriptions, lab reports, or discharge summaries? Upload them for your doctor to review during this consultation. PDF, JPG, or PNG up to 15 MB.", "क्या आपके पास पुरानी पर्ची, लैब रिपोर्ट या डिस्चार्ज सारांश है? इन्हें अपलोड करें ताकि डॉक्टर इस परामर्श में देख सकें। PDF, JPG या PNG, अधिकतम 15 MB।")}
      </p>

      <form onSubmit={handleUpload} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <label htmlFor="kioskDocType" style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.25rem", fontWeight: 600 }}>{text("Document kind", "दस्तावेज़ का प्रकार")}</label>
            <select
              id="kioskDocType"
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              style={{ padding: "0.5rem 0.75rem", borderRadius: "8px", background: "rgba(0,0,0,0.3)", color: "inherit", border: "1px solid var(--border, #4b5563)" }}
            >
              <option value="prescription">{text("Prescription", "पर्ची")}</option>
              <option value="lab_report">{text("Lab / Diagnostic Report", "लैब / जाँच रिपोर्ट")}</option>
              <option value="discharge_summary">{text("Discharge Summary", "डिस्चार्ज सारांश")}</option>
              <option value="other">{text("Other medical record", "अन्य चिकित्सा रिकॉर्ड")}</option>
            </select>
          </div>

          <div style={{ flex: 1, minWidth: "200px" }}>
            <label htmlFor="kioskDocFile" style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.25rem", fontWeight: 600 }}>{text("Select file", "फ़ाइल चुनें")}</label>
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
              {uploading ? text("Uploading & OCR…", "अपलोड और OCR हो रहा है…") : text("Upload & scan", "अपलोड और स्कैन करें")}
            </button>
          </div>
        </div>
      </form>

      {success && <p className="notice" style={{ background: "rgba(16, 185, 129, 0.1)", borderColor: "#10b981", color: "#10b981", marginTop: "0.75rem" }}>{success}</p>}
      {error && <p className="notice error" style={{ marginTop: "0.75rem" }}>{error}</p>}

      {uploadedDocs.length > 0 && (
        <div style={{ marginTop: "1rem" }}>
          <p style={{ fontSize: "0.9rem", fontWeight: 600, margin: "0 0 0.5rem" }}>{text(`Uploaded documents for this visit (${uploadedDocs.length}):`, `इस मुलाकात के लिए अपलोड दस्तावेज़ (${uploadedDocs.length}):`)}</p>
          <div className="data-list">
            {uploadedDocs.map((doc) => (
              <div className="data-card" key={doc.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.6rem 1rem" }}>
                <div>
                  <strong>{doc.filename}</strong>
                  <span style={{ fontSize: "0.8rem", opacity: 0.8, marginLeft: "0.5rem" }}>({doc.type})</span>
                </div>
                <span className="tag">{doc.extracted ? text("✓ OCR processed", "✓ OCR पूरा") : text("Uploaded", "अपलोड हुआ")}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
