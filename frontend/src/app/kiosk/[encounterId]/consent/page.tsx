"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ApiError, KioskLanguage, recordConsent } from "@/lib/api";
import { clearKioskSession, useKioskSessionReset } from "@/lib/kiosk-session";

const CONSENT_TEXT_EN = "By continuing, you agree to record your intake answers for the clinical team under the Digital Personal Data Protection Act. This tool does not diagnose, prescribe, or replace an urgent assessment. If you feel severely unwell, please alert staff immediately.";
const CONSENT_TEXT_HI = "आगे बढ़कर, आप डिजिटल पर्सनल डेटा प्रोटेक्शन एक्ट के तहत अपनी स्वास्थ्य जानकारी क्लिनिकल टीम के साथ साझा करने की सहमति देते हैं। यह सॉफ्टवेयर कोई स्वचालित निदान या दवा नहीं देता है। यदि आपकी तबीयत अधिक खराब है, तो तुरंत अस्पताल कर्मचारियों को सूचित करें।";

export default function ConsentPage() {
  const { encounterId } = useParams<{ encounterId: string }>();
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [language, setLanguage] = useState<KioskLanguage>("en");
  const [speaking, setSpeaking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const hindi = language === "hi";
  const text = (english: string, hindiText: string) => (hindi ? hindiText : english);

  const resetToStart = useCallback(() => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
    router.replace("/kiosk/start");
  }, [router]);
  const { showIdleWarning } = useKioskSessionReset({ active: Boolean(token), onTimeout: resetToStart });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setToken(sessionStorage.getItem("medikiosk.kiosk_token"));
      setLanguage(sessionStorage.getItem("medikiosk.language") === "hi" ? "hi" : "en");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  function playConsentAudio() {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(hindi ? CONSENT_TEXT_HI : CONSENT_TEXT_EN);
    utterance.lang = hindi ? "hi-IN" : "en-IN";
    utterance.rate = 0.95;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }

  function stopConsentAudio() {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }

  function startOver() {
    stopConsentAudio();
    clearKioskSession();
    router.replace("/kiosk/start");
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
      setError(caught instanceof ApiError ? caught.message : text("We could not record your consent. Please ask a staff member for help.", "आपकी सहमति दर्ज नहीं हो सकी। कृपया कर्मचारी से सहायता लें।"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page-wrap kiosk-page">
      <div className="shell"><header className="site-header"><Link className="brand" href="/"><span className="brand-mark"><span>✦</span></span>MediKiosk</Link><span className="nav-link">{text("Private touch intake", "निजी टच इंटेक")}</span></header></div>
      <section className="form-shell kiosk-shell">
        <div className="panel kiosk-panel">
          <div className="kiosk-title-row">
            <p className="eyebrow">{text("Step 2 of 3 · consent", "चरण 2 / 3 · सहमति")}</p>
            <button className="button-secondary kiosk-audio" onClick={speaking ? stopConsentAudio : playConsentAudio} type="button">{speaking ? text("⏹ Stop audio", "⏹ ऑडियो रोकें") : text("◖ Listen aloud", "◖ सुनें")}</button>
          </div>
          <div className="step-line"><span className="active" /><span className="active" /><span /></div>
          <h1 className="display">{text("Your consent and privacy.", "आपकी सहमति और गोपनीयता।")}</h1>
          <p className="panel-copy kiosk-copy">{hindi ? CONSENT_TEXT_HI : CONSENT_TEXT_EN}</p>

          <div className="consent-points">
            <div><strong>🔒 {text("Private for this visit", "इस मुलाकात के लिए निजी")}</strong><p>{text("Your answers are used to prepare this outpatient consultation.", "आपके उत्तर इस बाह्य रोगी परामर्श की तैयारी के लिए उपयोग होते हैं।")}</p></div>
            <div><strong>👨‍⚕️ {text("Clinician decides", "निर्णय चिकित्सक का")}</strong><p>{text("AI organizes information; a licensed clinician makes clinical decisions.", "AI जानकारी व्यवस्थित करता है; चिकित्सकीय निर्णय लाइसेंस प्राप्त चिकित्सक लेते हैं।")}</p></div>
            <div><strong>⏱️ {text("Private reset", "निजी रीसेट")}</strong><p>{text("This screen clears after inactivity or submission so the next patient cannot access it.", "निष्क्रियता या सबमिट होने के बाद स्क्रीन साफ़ हो जाती है ताकि अगला मरीज इसे न देख सके।")}</p></div>
          </div>

          {showIdleWarning && <p className="notice" role="status">{text("For privacy, this session will reset in 15 seconds. Tap anywhere to continue.", "गोपनीयता के लिए यह सत्र 15 सेकंड में रीसेट हो जाएगा। जारी रखने के लिए कहीं भी टैप करें।")}</p>}
          {!token && <p className="notice error" role="alert">{text("This private session is no longer available. Please begin again.", "यह निजी सत्र अब उपलब्ध नहीं है। कृपया फिर से शुरू करें।")}</p>}
          {error && <p className="notice error" role="alert">{error}</p>}

          <div className="button-row kiosk-action-row">
            <button className="button-primary kiosk-primary" disabled={!token || loading} onClick={continueToIntake} type="button">{loading ? text("Recording consent…", "सहमति दर्ज हो रही है…") : text("I agree — begin intake →", "मैं सहमत हूँ — इंटेक शुरू करें →")}</button>
            <button className="button-secondary kiosk-secondary" onClick={startOver} type="button">{text("Start over", "फिर से शुरू करें")}</button>
          </div>
        </div>
      </section>
    </main>
  );
}
