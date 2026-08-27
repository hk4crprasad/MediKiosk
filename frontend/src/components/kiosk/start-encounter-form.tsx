"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, createEncounter, Pathway } from "@/lib/api";

const pathways: Array<{ value: Pathway; label: string; labelHi: string; note: string }> = [
  { value: "chest-discomfort-v1", label: "Chest discomfort", labelHi: "सीने में तकलीफ / दर्द", note: "Pain, pressure, tightness, or discomfort in the chest." },
  { value: "fever-v1", label: "Fever", labelHi: "बुखार", note: "Feeling feverish or a measured high temperature." },
  { value: "headache-v1", label: "Headache", labelHi: "सिरदर्द", note: "Pain, pressure, or discomfort in the head." },
  { value: "abdominal-pain-v1", label: "Abdominal pain", labelHi: "पेट में दर्द / परेशानी", note: "Pain or discomfort in the stomach or belly." },
  { value: "ayush-dashavidha-v1", label: "AYUSH consultation", labelHi: "आयुष परामर्श (दशविध परीक्षा)", note: "Dashavidha Pariksha, Prakriti, and lifestyle context for an AYUSH consultation." },
];

const languages = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिंदी (Hindi)" },
  { code: "ta", label: "தமிழ் (Tamil)" },
  { code: "te", label: "తెలుగు (Telugu)" },
  { code: "kn", label: "ಕನ್ನಡ (Kannada)" },
  { code: "bn", label: "বাংলা (Bengali)" },
];

export function StartEncounterForm() {
  const router = useRouter();
  const [pathway, setPathway] = useState<Pathway>("chest-discomfort-v1");
  const [language, setLanguage] = useState("en");
  const [displayName, setDisplayName] = useState("");
  const [birthYear, setBirthYear] = useState<string>("");
  const [sex, setSex] = useState<string>("");
  const [abhaId, setAbhaId] = useState("");
  const [showAbhaScan, setShowAbhaScan] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function autofillDemoAbha() {
    setDisplayName("Ramesh Sharma");
    setBirthYear("1984");
    setSex("male");
    setAbhaId("91-8472-1928-3011@abdm");
    setLanguage("hi");
    setShowAbhaScan(false);
  }

  async function start() {
    setLoading(true); setError("");
    try {
      const result = await createEncounter({
        language,
        pathway,
        displayName: displayName.trim() || undefined,
        birthYear: birthYear ? parseInt(birthYear, 10) : undefined,
        sex: sex || undefined,
        abhaIdentifier: abhaId.trim() || undefined,
      });
      sessionStorage.setItem("medikiosk.kiosk_token", result.kiosk_session_token);
      sessionStorage.setItem("medikiosk.language", language);
      router.push(`/kiosk/${result.encounter.id}/consent`);
    } catch (caught) {
      const issue = caught instanceof ApiError ? `${caught.message}${caught.requestId ? ` (Request ID: ${caught.requestId})` : ""}` : "Unable to begin this encounter. Please ask a staff member for help.";
      setError(issue);
    } finally { setLoading(false); }
  }

  return (
    <main className="page-wrap kiosk-page">
      <div className="shell">
        <header className="site-header">
          <Link className="brand" href="/"><span className="brand-mark"><span>✦</span></span>MediKiosk</Link>
          <span className="nav-link">Touch & Voice Intake</span>
        </header>
      </div>

      <section className="form-shell kiosk-shell">
        <div className="panel kiosk-panel">
          <p className="eyebrow">Step 1 of 3 · touch check-in</p>
          <div className="step-line"><span className="active" /><span /><span /></div>

          {/* Language selector */}
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "0.4rem" }}>
              🌐 Select Language / भाषा चुनें
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => setLanguage(lang.code)}
                  className={`choice ${language === lang.code ? "selected" : ""}`}
                  style={{ padding: "0.4rem 0.8rem", borderRadius: "8px", fontSize: "0.85rem" }}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>

          {/* ABHA ID / QR Identification Card */}
          <div style={{ marginBottom: "1.5rem", padding: "1rem", borderRadius: "10px", border: "1px solid #3b82f6", background: "rgba(59, 130, 246, 0.04)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
              <div>
                <strong style={{ color: "#60a5fa" }}>🆔 Ayushman Bharat Health Account (ABHA / QR)</strong>
                <p style={{ margin: "0.2rem 0 0", fontSize: "0.85rem", opacity: 0.85 }}>
                  {abhaId ? `Linked ABHA: ${abhaId}` : "Scan ABHA card or enter ABHA ID for instant profile lookup"}
                </p>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  type="button"
                  className="button-secondary"
                  style={{ fontSize: "0.8rem", padding: "0.3rem 0.6rem" }}
                  onClick={() => setShowAbhaScan(!showAbhaScan)}
                >
                  {showAbhaScan ? "Hide entry" : "Enter ABHA"}
                </button>
                <button
                  type="button"
                  className="button-primary"
                  style={{ fontSize: "0.8rem", padding: "0.3rem 0.6rem", background: "#3b82f6", borderColor: "#2563eb" }}
                  onClick={autofillDemoAbha}
                >
                  ⚡ Demo ABHA Fill
                </button>
              </div>
            </div>

            {showAbhaScan && (
              <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem" }}>
                <input
                  type="text"
                  placeholder="e.g. 91-1234-5678-9012@abdm"
                  value={abhaId}
                  onChange={(e) => setAbhaId(e.target.value)}
                  style={{ flex: 1, padding: "0.5rem", borderRadius: "6px", background: "rgba(0,0,0,0.3)", color: "inherit", border: "1px solid #4b5563" }}
                />
              </div>
            )}
          </div>

          {/* Optional demographics */}
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
            <div style={{ flex: 2, minWidth: "180px" }}>
              <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "0.3rem" }}>Patient Name (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Ramesh Sharma"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", background: "rgba(0,0,0,0.2)", color: "inherit", border: "1px solid var(--border, #4b5563)" }}
              />
            </div>
            <div style={{ flex: 1, minWidth: "110px" }}>
              <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "0.3rem" }}>Birth Year</label>
              <input
                type="number"
                placeholder="YYYY"
                value={birthYear}
                onChange={(e) => setBirthYear(e.target.value)}
                style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", background: "rgba(0,0,0,0.2)", color: "inherit", border: "1px solid var(--border, #4b5563)" }}
              />
            </div>
            <div style={{ flex: 1, minWidth: "120px" }}>
              <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "0.3rem" }}>Sex</label>
              <select
                value={sex}
                onChange={(e) => setSex(e.target.value)}
                style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", background: "rgba(0,0,0,0.2)", color: "inherit", border: "1px solid var(--border, #4b5563)" }}
              >
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <h1 className="display" style={{ marginTop: "1rem" }}>
            {language === "hi" ? "आज अस्पताल आने का मुख्य कारण?" : "What brings you here today?"}
          </h1>
          <p className="panel-copy kiosk-copy">
            {language === "hi" ? "नीचे दिए गए विकल्पों में से एक चुनें। कोई भी कठिनाई होने पर कर्मचारी सहायता कर सकते हैं।" : "Tap one answer. You do not need to type anything. A staff member can help at any time."}
          </p>

          <div aria-label="Choose the reason for today’s visit" className="kiosk-choice-grid">
            {pathways.map((item) => (
              <button
                aria-pressed={pathway === item.value}
                className={`choice kiosk-choice ${pathway === item.value ? "selected" : ""}`}
                key={item.value}
                onClick={() => setPathway(item.value)}
                type="button"
              >
                <strong>{language === "hi" ? item.labelHi : item.label}</strong>
                <small>{item.note}</small>
              </button>
            ))}
          </div>

          {error && <p className="notice error" role="alert">{error}</p>}

          <div className="button-row kiosk-action-row" style={{ marginTop: "2rem" }}>
            <button className="button-primary kiosk-primary" disabled={loading} onClick={start} type="button">
              {loading ? "Starting private session…" : "Continue to consent →"}
            </button>
            <Link className="button-secondary kiosk-secondary" href="/">Return to welcome</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
