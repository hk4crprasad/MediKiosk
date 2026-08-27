"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, recordConsent } from "@/lib/api";

const CONSENT_TEXT_EN =
  "By continuing, you agree to record your intake answers for the clinical team under the Digital Personal Data Protection Act. This tool does not diagnose, prescribe, or replace an urgent assessment. If you feel severely unwell, please alert staff immediately.";

const CONSENT_TEXT_HI =
  "आगे बढ़कर, आप डिजिटल पर्सनल डेटा प्रोटेक्शन एक्ट के तहत अपनी स्वास्थ्य जानकारी क्लिनिकल टीम के साथ साझा करने की सहमति देते हैं। यह सॉफ्टवेयर कोई स्वचालित निदान या दवा नहीं देता है। यदि आपकी तबीयत अधिक खराब है, तो तुरंत अस्पताल कर्मचारियों को सूचित करें।";

export default function ConsentPage() {
  const { encounterId } = useParams<{ encounterId: string }>();
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [language, setLanguage] = useState("en");
  const [speaking, setSpeaking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setToken(sessionStorage.getItem("medikiosk.kiosk_token"));
      setLanguage(sessionStorage.getItem("medikiosk.language") ?? "en");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function playConsentAudio() {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const textToSpeak = language === "hi" ? CONSENT_TEXT_HI : CONSENT_TEXT_EN;
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = language === "hi" ? "hi-IN" : "en-US";
    utterance.rate = 0.95;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }

  function stopConsentAudio() {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }

  async function continueToIntake() {
    if (!token) return;
    stopConsentAudio();
    setLoading(true);
    setError("");
    try {
      await recordConsent(encounterId, token, language);
      router.push(`/kiosk/${encounterId}/intake`);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "We could not record your consent. Please ask a staff member for help.");
    } finally {
      setLoading(false);
    }
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p className="eyebrow" style={{ margin: 0 }}>Step 2 of 3 · DPDP consent</p>
            <button
              className="button-secondary kiosk-audio"
              onClick={speaking ? stopConsentAudio : playConsentAudio}
              type="button"
              style={{ fontSize: "0.85rem", padding: "0.35rem 0.75rem" }}
            >
              {speaking ? "⏹ Stop audio" : "◖ Listen to consent aloud"}
            </button>
          </div>

          <div className="step-line"><span className="active" /><span className="active" /><span /></div>

          <h1 className="display" style={{ marginTop: "1rem" }}>
            {language === "hi" ? "आपकी सहमति और गोपनीयता" : "Your answers help prepare the consultation."}
          </h1>

          <p className="panel-copy kiosk-copy">
            {language === "hi" ? CONSENT_TEXT_HI : CONSENT_TEXT_EN}
          </p>

          {/* DPDP Act 2023 Safety & Privacy Guarantees */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem", margin: "1.5rem 0" }}>
            <div style={{ padding: "0.85rem", borderRadius: "8px", border: "1px solid var(--border, #2a3342)", background: "rgba(255,255,255,0.02)" }}>
              <strong style={{ fontSize: "0.9rem", display: "block", color: "#60a5fa" }}>🔒 DPDP Act 2023 Compliant</strong>
              <p style={{ margin: "0.2rem 0 0", fontSize: "0.8rem", opacity: 0.85 }}>Your health information is captured strictly for this outpatient visit and processed securely.</p>
            </div>
            <div style={{ padding: "0.85rem", borderRadius: "8px", border: "1px solid var(--border, #2a3342)", background: "rgba(255,255,255,0.02)" }}>
              <strong style={{ fontSize: "0.9rem", display: "block", color: "#34d399" }}>👨‍⚕️ Clinician-Verified Only</strong>
              <p style={{ margin: "0.2rem 0 0", fontSize: "0.8rem", opacity: 0.85 }}>AI assists with formatting; only a licensed hospital physician makes clinical decisions and prescriptions.</p>
            </div>
            <div style={{ padding: "0.85rem", borderRadius: "8px", border: "1px solid var(--border, #2a3342)", background: "rgba(255,255,255,0.02)" }}>
              <strong style={{ fontSize: "0.9rem", display: "block", color: "#f59e0b" }}>⏱️ Ephemeral Session</strong>
              <p style={{ margin: "0.2rem 0 0", fontSize: "0.8rem", opacity: 0.85 }}>This kiosk screen clears automatically after submission to protect your privacy from the next patient.</p>
            </div>
          </div>

          {!token && (
            <p className="notice error" role="alert">
              This private session is no longer available in this browser. Please return to the welcome page and start again.
            </p>
          )}

          {error && <p className="notice error" role="alert">{error}</p>}

          <div className="button-row kiosk-action-row" style={{ marginTop: "2rem" }}>
            <button className="button-primary kiosk-primary" disabled={!token || loading} onClick={continueToIntake} type="button">
              {loading ? "Recording consent…" : language === "hi" ? "मैं सहमत हूँ — आगे बढ़ें →" : "I agree — begin intake →"}
            </button>
            <Link className="button-secondary kiosk-secondary" href="/kiosk/start">Start over</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
