"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { DocumentUploadSection } from "@/components/kiosk/document-upload-section";
import { QuestionAudioButton } from "@/components/kiosk/question-audio-button";
import { VoiceRecordButton } from "@/components/kiosk/voice-record-button";
import {
  ApiError,
  Fact,
  getEncounter,
  getFacts,
  getNextQuestion,
  KioskLanguage,
  listConsents,
  Question,
  revokeConsent,
  submitAnswer,
  submitIntake,
} from "@/lib/api";
import { clearKioskSession, useKioskSessionReset } from "@/lib/kiosk-session";

const SUBMISSION_RESET_SECONDS = 8;

function choiceLabel(value: string, labels: Record<string, string> = {}) {
  return labels[value] ?? value
    .replace("_c", "°C")
    .replaceAll("_to_", " to ")
    .replaceAll("_or_", " or ")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function IntakePage() {
  const { encounterId } = useParams<{ encounterId: string }>();
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [language, setLanguage] = useState<KioskLanguage>("en");
  const [question, setQuestion] = useState<Question | null | undefined>(undefined);
  const [answer, setAnswer] = useState("");
  const [additionalInput, setAdditionalInput] = useState("");
  const [facts, setFacts] = useState<Fact[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submissionSecondsLeft, setSubmissionSecondsLeft] = useState(SUBMISSION_RESET_SECONDS);
  const [error, setError] = useState("");
  const hindi = language === "hi";
  const text = (english: string, hindiText: string) => (hindi ? hindiText : english);

  const resetToStart = useCallback(() => {
    clearKioskSession();
    router.replace("/kiosk/start");
  }, [router]);
  const { showIdleWarning } = useKioskSessionReset({ active: Boolean(token) && !submitted, onTimeout: resetToStart });

  const loadQuestion = useCallback(async (activeToken: string) => {
    setLoading(true);
    setError("");
    try {
      await getEncounter(encounterId, activeToken).catch(() => null);
      const next = await getNextQuestion(encounterId, activeToken);
      setQuestion(next);
      setAnswer("");
      setAdditionalInput("");
      if (!next) setFacts(await getFacts(encounterId, activeToken));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "We could not load the next question.");
    } finally {
      setLoading(false);
    }
  }, [encounterId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const savedToken = sessionStorage.getItem("medikiosk.kiosk_token");
      const savedLanguage: KioskLanguage = sessionStorage.getItem("medikiosk.language") === "hi" ? "hi" : "en";
      setToken(savedToken);
      setLanguage(savedLanguage);
      if (savedToken) void loadQuestion(savedToken); else setLoading(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadQuestion]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    if (!submitted) return;
    const interval = window.setInterval(() => {
      setSubmissionSecondsLeft((seconds) => Math.max(0, seconds - 1));
    }, 1_000);
    const resetTimer = window.setTimeout(resetToStart, SUBMISSION_RESET_SECONDS * 1_000);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(resetTimer);
    };
  }, [resetToStart, submitted]);

  function handleVoiceTranscript(transcript: string) {
    setAdditionalInput(transcript);
    if (!question) return;
    const normalisedTranscript = transcript.toLowerCase();
    const matched = question.choices.find((choice) => {
      const displayed = choiceLabel(choice, question.choice_labels).toLowerCase();
      const raw = choice.replaceAll("_", " ").toLowerCase();
      return normalisedTranscript.includes(displayed) || normalisedTranscript.includes(raw) || normalisedTranscript.includes(choice);
    });
    if (matched) setAnswer(matched);
  }

  async function handleRevokeConsent() {
    if (!token) return;
    const confirmation = text(
      "End this kiosk session and revoke consent? This removes access from this device. Information already recorded for clinical or audit purposes is not deleted here.",
      "क्या आप इस कियोस्क सत्र को समाप्त कर सहमति वापस लेना चाहते हैं? इससे इस डिवाइस का एक्सेस हट जाएगा। क्लिनिकल या ऑडिट के लिए पहले से दर्ज जानकारी यहाँ से हटाई नहीं जाएगी।",
    );
    if (!window.confirm(confirmation)) return;
    setSaving(true);
    try {
      const consents = await listConsents(encounterId, token);
      const active = consents.find((consent) => consent.granted && !consent.revoked_at);
      if (active) await revokeConsent(encounterId, active.id, token);
      resetToStart();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : text("We could not end this session. Please ask a staff member for help.", "यह सत्र समाप्त नहीं हो सका। कृपया कर्मचारी से सहायता लें।"));
    } finally {
      setSaving(false);
    }
  }

  async function continueIntake() {
    if (!token || !question || !answer) return;
    setSaving(true);
    setError("");
    try {
      await submitAnswer(encounterId, token, question, answer, language, additionalInput);
      await loadQuestion(token);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : text("We could not save that answer.", "यह उत्तर सहेजा नहीं जा सका।"));
    } finally {
      setSaving(false);
    }
  }

  async function finishIntake() {
    if (!token) return;
    setSaving(true);
    setError("");
    try {
      await submitIntake(encounterId, token);
      setSubmissionSecondsLeft(SUBMISSION_RESET_SECONDS);
      setSubmitted(true);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : text("We could not send your intake.", "आपका इंटेक भेजा नहीं जा सका।"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page-wrap kiosk-page">
      <div className="shell"><header className="site-header"><Link className="brand" href="/"><span className="brand-mark"><span>✦</span></span>MediKiosk</Link><span className="nav-link">{text("Private touch intake", "निजी टच इंटेक")}</span></header></div>
      <section className="form-shell kiosk-shell">
        <div className="panel kiosk-panel">
          <p className="eyebrow">{text("Step 3 of 3 · guided intake", "चरण 3 / 3 · निर्देशित इंटेक")}</p>
          <div className="step-line"><span className="active" /><span className="active" /><span className="active" /></div>

          {!token && !loading && <><h1 className="display">{text("This session has expired.", "यह सत्र समाप्त हो गया है।")}</h1><p className="notice error">{text("Please begin a new private session on this device.", "कृपया इस डिवाइस पर नया निजी सत्र शुरू करें।")}</p><div className="button-row"><Link className="button-primary kiosk-primary" href="/kiosk/start">{text("Begin again", "फिर से शुरू करें")}</Link></div></>}
          {token && loading && <><h1 className="display">{text("Preparing your next question…", "अगला प्रश्न तैयार हो रहा है…")}</h1><p className="panel-copy">{text("Please keep this screen open.", "कृपया यह स्क्रीन खुली रखें।")}</p></>}
          {showIdleWarning && <p className="notice" role="status">{text("For privacy, this session will reset in 15 seconds. Tap anywhere to continue.", "गोपनीयता के लिए यह सत्र 15 सेकंड में रीसेट हो जाएगा। जारी रखने के लिए कहीं भी टैप करें।")}</p>}

          {token && !loading && question && <>
            <div className="kiosk-question-header">
              <p className="kiosk-question-count">{text("Tap or speak an answer", "टैप करें या जवाब बोलें")}</p>
              <div className="kiosk-audio-actions"><QuestionAudioButton encounterId={encounterId} language={language} questionKey={question.key} token={token} /><VoiceRecordButton encounterId={encounterId} language={language} onTranscript={handleVoiceTranscript} token={token} /></div>
            </div>
            <h1 className="display kiosk-question">{question.prompt}</h1>
            <p className="panel-copy kiosk-copy">{text("Choose the option that fits best. Your clinical team will review the information with you.", "जो विकल्प सबसे सही हो उसे चुनें। आपकी क्लिनिकल टीम इस जानकारी की समीक्षा करेगी।")}</p>
            <div aria-label={text("Answer choices", "उत्तर विकल्प")} className="kiosk-choice-grid">
              {question.choices.map((option) => <button aria-pressed={answer === option} className={`choice kiosk-choice ${answer === option ? "selected" : ""}`} key={option} onClick={() => setAnswer(option)} type="button"><strong>{choiceLabel(option, question.choice_labels)}</strong></button>)}
            </div>
            <div className="additional-input">
              <label htmlFor="additionalInput">{text("Optional spoken or caregiver note", "वैकल्पिक बोला गया या देखभालकर्ता का नोट")}</label>
              <p>{text("This note helps the clinician review context. A touch choice above is still required and is the only value used as your answer.", "यह नोट चिकित्सक को संदर्भ समझने में मदद करता है। ऊपर दिया गया टच विकल्प फिर भी आवश्यक है और वही आपके उत्तर के रूप में उपयोग होगा।")}</p>
              <textarea id="additionalInput" onChange={(event) => setAdditionalInput(event.target.value)} placeholder={text("Spoken words appear here. Typing is optional.", "बोले गए शब्द यहाँ दिखाई देंगे। टाइप करना वैकल्पिक है।")} value={additionalInput} />
            </div>
            <div className="button-row kiosk-action-row"><button className="button-primary kiosk-primary" disabled={saving || !answer} onClick={continueIntake} type="button">{saving ? text("Saving…", "सहेजा जा रहा है…") : text("Save and continue →", "सहेजें और आगे बढ़ें →")}</button><button className="button-secondary kiosk-danger" disabled={saving} onClick={handleRevokeConsent} type="button">🔒 {text("End session & revoke consent", "सत्र समाप्त करें और सहमति वापस लें")}</button></div>
          </>}

          {token && !loading && question === null && !submitted && <>
            <h1 className="display">{text("Review before sending.", "भेजने से पहले समीक्षा करें।")}</h1>
            <p className="panel-copy kiosk-copy">{text("Your responses create a pre-consultation record. They do not provide a diagnosis.", "आपके उत्तर परामर्श-पूर्व रिकॉर्ड बनाते हैं। ये निदान नहीं देते।")}</p>
            <div className="data-list">{facts.length ? facts.map((fact) => <div className="data-card" key={fact.id}><strong>{fact.display_label ?? fact.fact_type.replaceAll("_", " ")}</strong><p>{fact.display_value ?? String(fact.value.value ?? text("Recorded", "दर्ज"))}</p></div>) : <p className="notice">{text("No answers were recorded for this pathway.", "इस प्रवाह के लिए कोई उत्तर दर्ज नहीं हुआ।")}</p>}</div>
            <DocumentUploadSection encounterId={encounterId} language={language} token={token} />
            <div className="button-row kiosk-action-row"><button className="button-primary kiosk-primary" disabled={saving} onClick={finishIntake} type="button">{saving ? text("Sending…", "भेजा जा रहा है…") : text("Send to clinical team →", "क्लिनिकल टीम को भेजें →")}</button><button className="button-secondary kiosk-danger" disabled={saving} onClick={handleRevokeConsent} type="button">🔒 {text("End session & revoke consent", "सत्र समाप्त करें और सहमति वापस लें")}</button></div>
          </>}

          {token && !loading && submitted && <>
            <div className="submission-complete"><span>✓</span><div><p className="eyebrow">{text("Secure hand-off complete", "सुरक्षित हस्तांतरण पूरा")}</p><h1 className="display">{text("Your intake is with the clinical team.", "आपका इंटेक क्लिनिकल टीम के पास है।")}</h1></div></div>
            <p className="panel-copy kiosk-copy">{text("For privacy, this kiosk will reset in", "गोपनीयता के लिए यह कियोस्क रीसेट होगा:")} <strong>{submissionSecondsLeft}</strong> {text("seconds. Please stay nearby if you need urgent help.", "सेकंड में। यदि आपको तुरंत सहायता चाहिए तो पास ही रहें और कर्मचारी को बताएँ।")}</p>
            <div className="button-row kiosk-action-row"><button className="button-secondary kiosk-secondary" onClick={resetToStart} type="button">{text("Reset now", "अभी रीसेट करें")}</button></div>
          </>}
          {error && <p className="notice error" role="alert">{error}</p>}
        </div>
      </section>
    </main>
  );
}
