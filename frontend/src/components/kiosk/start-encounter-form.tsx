"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, createEncounter, KioskLanguage, Pathway } from "@/lib/api";

const pathways: Array<{ value: Pathway; label: string; labelHi: string; note: string; noteHi: string }> = [
  { value: "chest-discomfort-v1", label: "Chest discomfort", labelHi: "सीने में तकलीफ़", note: "A guided history for chest pain, pressure, tightness, or discomfort.", noteHi: "सीने के दर्द, दबाव, जकड़न या तकलीफ़ के लिए निर्देशित जानकारी।" },
  { value: "fever-v1", label: "Fever", labelHi: "बुखार", note: "Feeling feverish or a measured high temperature.", noteHi: "बुखार जैसा महसूस होना या तापमान बढ़ना।" },
  { value: "headache-v1", label: "Headache", labelHi: "सिरदर्द", note: "Pain, pressure, or discomfort in the head.", noteHi: "सिर में दर्द, दबाव या तकलीफ़।" },
  { value: "abdominal-pain-v1", label: "Abdominal pain", labelHi: "पेट में दर्द", note: "Pain or discomfort in the stomach or belly.", noteHi: "पेट या उदर में दर्द या तकलीफ़।" },
  { value: "ayush-dashavidha-v1", label: "AYUSH consultation", labelHi: "आयुष परामर्श", note: "Dashavidha and lifestyle context for an AYUSH consultation.", noteHi: "आयुष परामर्श के लिए दशविध परीक्षा और जीवनशैली की जानकारी।" },
];

const languages: Array<{ code: KioskLanguage; label: string }> = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिंदी" },
];

export function StartEncounterForm() {
  const router = useRouter();
  const [pathway, setPathway] = useState<Pathway>("chest-discomfort-v1");
  const [language, setLanguage] = useState<KioskLanguage>("en");
  const [respondentType, setRespondentType] = useState<"patient" | "caregiver">("patient");
  const [caregiverRelationship, setCaregiverRelationship] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [sex, setSex] = useState("");
  const [abhaId, setAbhaId] = useState("");
  const [showAbhaScan, setShowAbhaScan] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const hindi = language === "hi";
  const text = (english: string, hindiText: string) => (hindi ? hindiText : english);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  function autofillDemoAbha() {
    setDisplayName("Ramesh Sharma");
    setBirthYear("1984");
    setSex("male");
    setAbhaId("91-8472-1928-3011@abdm");
    setLanguage("hi");
    setRespondentType("patient");
    setShowAbhaScan(false);
  }

  async function start() {
    setLoading(true);
    setError("");
    try {
      const result = await createEncounter({
        language,
        pathway,
        displayName: displayName.trim() || undefined,
        birthYear: birthYear ? Number.parseInt(birthYear, 10) : undefined,
        sex: sex || undefined,
        abhaIdentifier: abhaId.trim() || undefined,
        respondentType,
        caregiverRelationship: respondentType === "caregiver" ? (caregiverRelationship || "Attendant") : undefined,
      });
      sessionStorage.setItem("medikiosk.kiosk_token", result.kiosk_session_token);
      sessionStorage.setItem("medikiosk.language", language);
      router.push(`/kiosk/${result.encounter.id}/consent`);
    } catch (caught) {
      const issue = caught instanceof ApiError
        ? `${caught.message}${caught.requestId ? ` (Request ID: ${caught.requestId})` : ""}`
        : text("Unable to begin this encounter. Please ask a staff member for help.", "यह सत्र शुरू नहीं हो सका। कृपया कर्मचारी से सहायता लें।");
      setError(issue);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page-wrap kiosk-page">
      <div className="shell">
        <header className="site-header">
          <Link className="brand" href="/"><span className="brand-mark"><span>✦</span></span>MediKiosk</Link>
          <span className="nav-link">{text("Private touch intake", "निजी टच इंटेक")}</span>
        </header>
      </div>

      <section className="form-shell kiosk-shell">
        <div className="panel kiosk-panel">
          <p className="eyebrow">{text("Step 1 of 3 · private check-in", "चरण 1 / 3 · निजी पंजीकरण")}</p>
          <div className="step-line"><span className="active" /><span /><span /></div>

          <div className="language-switch" aria-label={text("Choose language", "भाषा चुनें")}>
            <p>{text("Choose your language", "अपनी भाषा चुनें")}</p>
            <div>
              {languages.map((item) => (
                <button aria-pressed={language === item.code} className={`choice ${language === item.code ? "selected" : ""}`} key={item.code} onClick={() => setLanguage(item.code)} type="button">{item.label}</button>
              ))}
            </div>
          </div>

          <div className="kiosk-privacy-strip">
            <strong>{text("English + Hindi patient flow", "अंग्रेज़ी + हिंदी मरीज प्रवाह")}</strong>
            <span>{text("Large touch choices, spoken guidance, and a private auto-reset.", "बड़े टच विकल्प, बोलकर मार्गदर्शन और निजी ऑटो-रीसेट।")}</span>
          </div>

          {/* Caregiver / Attendant Proxy Mode Selection */}
          <div style={{ margin: "1.25rem 0", padding: "1rem", borderRadius: "12px", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
            <p style={{ margin: "0 0 0.5rem", fontSize: "0.95rem", fontWeight: "600" }}>
              {text("Who is completing this intake?", "यह जानकारी कौन दर्ज कर रहा है?")}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
              <button
                type="button"
                className={`choice ${respondentType === "patient" ? "selected" : ""}`}
                onClick={() => { setRespondentType("patient"); setCaregiverRelationship(""); }}
                style={{ padding: "0.75rem", textAlign: "center" }}
              >
                <strong>👤 {text("Patient (Self)", "मरीज (स्वयं)")}</strong>
              </button>
              <button
                type="button"
                className={`choice ${respondentType === "caregiver" ? "selected" : ""}`}
                onClick={() => { setRespondentType("caregiver"); if (!caregiverRelationship) setCaregiverRelationship("Son / Daughter"); }}
                style={{ padding: "0.75rem", textAlign: "center" }}
              >
                <strong>👥 {text("Attendant / Relative", "परिचारक / परिजन")}</strong>
              </button>
            </div>

            {respondentType === "caregiver" && (
              <div style={{ marginTop: "0.75rem" }}>
                <small style={{ display: "block", marginBottom: "0.4rem", opacity: 0.85 }}>
                  {text("Relationship to patient:", "मरीज से संबंध:")}
                </small>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                  {["Son / Daughter", "Spouse", "Parent", "Sibling", "Relative", "Hospital Volunteer"].map((rel) => (
                    <button
                      key={rel}
                      type="button"
                      className={`choice ${caregiverRelationship === rel ? "selected" : ""}`}
                      onClick={() => setCaregiverRelationship(rel)}
                      style={{ padding: "0.3rem 0.6rem", fontSize: "0.8rem" }}
                    >
                      {rel}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="abha-card">
            <div>
              <strong>🆔 {text("ABHA / QR (optional)", "ABHA / QR (वैकल्पिक)")}</strong>
              <p>{abhaId ? text(`Linked ABHA: ${abhaId}`, `लिंक किया गया ABHA: ${abhaId}`) : text("Enter an ABHA ID if available, or continue without it.", "यदि ABHA ID उपलब्ध हो तो दर्ज करें, या इसके बिना आगे बढ़ें।")}</p>
            </div>
            <div className="abha-actions">
              <button className="button-secondary" onClick={() => setShowAbhaScan((visible) => !visible)} type="button">{showAbhaScan ? text("Hide entry", "छिपाएँ") : text("Enter ABHA", "ABHA दर्ज करें")}</button>
              <button className="button-primary" onClick={autofillDemoAbha} type="button">⚡ {text("Demo fill", "डेमो भरें")}</button>
            </div>
            {showAbhaScan && (
              <label className="kiosk-inline-field" htmlFor="abhaId">
                <span>{text("ABHA ID", "ABHA ID")}</span>
                <input id="abhaId" onChange={(event) => setAbhaId(event.target.value)} placeholder="91-1234-5678-9012@abdm" type="text" value={abhaId} />
              </label>
            )}
          </div>

          <details className="kiosk-optional-details">
            <summary>{text("Optional patient details", "वैकल्पिक मरीज जानकारी")}</summary>
            <p>{text("These are optional. You can complete the kiosk using only the touch choices below.", "ये जानकारी वैकल्पिक है। आप नीचे दिए टच विकल्पों से ही इंटेक पूरा कर सकते हैं।")}</p>
            <div className="field-grid">
              <label className="field"><span>{text("Patient name", "मरीज का नाम")}</span><input onChange={(event) => setDisplayName(event.target.value)} placeholder={text("e.g. Ramesh Sharma", "जैसे, रमेश शर्मा")} type="text" value={displayName} /></label>
              <label className="field"><span>{text("Birth year", "जन्म वर्ष")}</span><input onChange={(event) => setBirthYear(event.target.value)} placeholder="YYYY" type="number" value={birthYear} /></label>
              <label className="field"><span>{text("Sex", "लिंग")}</span><select onChange={(event) => setSex(event.target.value)} value={sex}><option value="">{text("Select", "चुनें")}</option><option value="male">{text("Male", "पुरुष")}</option><option value="female">{text("Female", "महिला")}</option><option value="other">{text("Other", "अन्य")}</option></select></label>
            </div>
          </details>

          <h1 className="display">{text("What brings you here today?", "आज आप किस तकलीफ़ के लिए आए हैं?")}</h1>
          <p className="panel-copy kiosk-copy">{text("Tap one reason to begin. The chest-discomfort flow records a structured history for the clinical team; it does not diagnose you.", "शुरू करने के लिए एक विकल्प चुनें। सीने की तकलीफ़ वाला प्रवाह क्लिनिकल टीम के लिए व्यवस्थित जानकारी दर्ज करता है; यह निदान नहीं करता।")}</p>

          <div aria-label={text("Choose the reason for today’s visit", "आज आने का कारण चुनें")} className="kiosk-choice-grid">
            {pathways.map((item) => (
              <button aria-pressed={pathway === item.value} className={`choice kiosk-choice ${pathway === item.value ? "selected" : ""}`} key={item.value} onClick={() => setPathway(item.value)} type="button">
                <strong>{hindi ? item.labelHi : item.label}</strong>
                <small>{hindi ? item.noteHi : item.note}</small>
              </button>
            ))}
          </div>

          {error && <p className="notice error" role="alert">{error}</p>}

          <div className="button-row kiosk-action-row">
            <button className="button-primary kiosk-primary" disabled={loading} onClick={start} type="button">{loading ? text("Starting private session…", "निजी सत्र शुरू हो रहा है…") : text("Continue to consent →", "सहमति के लिए आगे बढ़ें →")}</button>
            <Link className="button-secondary kiosk-secondary" href="/">{text("Return to welcome", "स्वागत पृष्ठ पर जाएँ")}</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
