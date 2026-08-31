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
    <div className="upload-card">
      <h2 className="display">
        📁 {text("Upload prior medical documents (optional)", "पुराने चिकित्सा दस्तावेज़ अपलोड करें (वैकल्पिक)")}
      </h2>
      <p className="panel-copy kiosk-copy" style={{ margin: 0 }}>
        {text("Carry prior prescriptions, lab reports, or discharge summaries? Upload them for your doctor to review during this consultation. PDF, JPG, or PNG up to 15 MB.", "क्या आपके पास पुरानी पर्ची, लैब रिपोर्ट या डिस्चार्ज सारांश है? इन्हें अपलोड करें ताकि डॉक्टर इस परामर्श में देख सकें। PDF, JPG या PNG, अधिकतम 15 MB।")}
      </p>

      <form onSubmit={handleUpload}>
        <div className="upload-row">
          <label className="field" htmlFor="kioskDocType">
            <span>{text("Document kind", "दस्तावेज़ का प्रकार")}</span>
            <select id="kioskDocType" onChange={(e) => setDocType(e.target.value)} value={docType}>
              <option value="prescription">{text("Prescription", "पर्ची")}</option>
              <option value="lab_report">{text("Lab / Diagnostic Report", "लैब / जाँच रिपोर्ट")}</option>
              <option value="discharge_summary">{text("Discharge Summary", "डिस्चार्ज सारांश")}</option>
              <option value="other">{text("Other medical record", "अन्य चिकित्सा रिकॉर्ड")}</option>
            </select>
          </label>

          <label className="field" htmlFor="kioskDocFile" style={{ flex: 1, minWidth: "200px" }}>
            <span>{text("Select file", "फ़ाइल चुनें")}</span>
            <input
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              id="kioskDocFile"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              type="file"
            />
          </label>

          <button className="button-primary kiosk-primary" disabled={uploading || !file} type="submit">
            {uploading ? text("Uploading & OCR…", "अपलोड और OCR हो रहा है…") : text("Upload & scan", "अपलोड और स्कैन करें")}
          </button>
        </div>
      </form>

      {success && <p className="notice success" style={{ marginTop: "0.75rem" }}>{success}</p>}
      {error && <p className="notice error" style={{ marginTop: "0.75rem" }}>{error}</p>}

      {uploadedDocs.length > 0 && (
        <div style={{ marginTop: "1rem" }}>
          <p style={{ fontSize: "0.9rem", fontWeight: 600, margin: "0 0 0.5rem" }}>{text(`Uploaded documents for this visit (${uploadedDocs.length}):`, `इस मुलाकात के लिए अपलोड दस्तावेज़ (${uploadedDocs.length}):`)}</p>
          <div className="data-list">
            {uploadedDocs.map((doc) => (
              <div className="data-card upload-doc-row" key={doc.id}>
                <div>
                  <strong>{doc.filename}</strong>
                  <span className="upload-doc-meta">({doc.type})</span>
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
