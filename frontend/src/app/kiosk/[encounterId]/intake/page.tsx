"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { QuestionAudioButton } from "@/components/kiosk/question-audio-button";
import { VoiceRecordButton } from "@/components/kiosk/voice-record-button";
import { DocumentUploadSection } from "@/components/kiosk/document-upload-section";
import {
  ApiError,
  Fact,
  getEncounter,
  getFacts,
  getNextQuestion,
  listConsents,
  Question,
  revokeConsent,
  submitAnswer,
  submitIntake,
} from "@/lib/api";

function choiceLabel(value: string) {
  return value
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
  const [language, setLanguage] = useState<string>("en");
  const [question, setQuestion] = useState<Question | null | undefined>(undefined);
  const [answer, setAnswer] = useState("");
  const [additionalInput, setAdditionalInput] = useState("");
  const [facts, setFacts] = useState<Fact[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const loadQuestion = useCallback(async (activeToken: string) => {
    setLoading(true); setError("");
    try {
      // Validate encounter status
      await getEncounter(encounterId, activeToken).catch(() => null);
      const next = await getNextQuestion(encounterId, activeToken);
      setQuestion(next); setAnswer(""); setAdditionalInput("");
      if (!next) setFacts(await getFacts(encounterId, activeToken));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "We could not load the next question.");
    } finally { setLoading(false); }
  }, [encounterId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = sessionStorage.getItem("medikiosk.kiosk_token");
      const savedLang = sessionStorage.getItem("medikiosk.language") || "en";
      setToken(saved);
      setLanguage(savedLang);
      if (saved) void loadQuestion(saved); else setLoading(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadQuestion]);

  function handleVoiceTranscript(transcript: string) {
    setAdditionalInput(transcript);
    // Intelligent choice matching from speech
    if (question && question.choices) {
      const normTranscript = transcript.toLowerCase();
      const matched = question.choices.find((c) => {
        const label = choiceLabel(c).toLowerCase();
        const raw = c.replaceAll("_", " ").toLowerCase();
        return normTranscript.includes(label) || normTranscript.includes(raw) || normTranscript.includes(c);
      });
      if (matched) {
        setAnswer(matched);
      }
    }
  }

  async function handleRevokeConsent() {
    if (!token) return;
    if (!confirm("Are you sure you want to revoke consent and abort this session? All temporary answers will be cleared.")) return;
    setSaving(true);
    try {
      const consents = await listConsents(encounterId, token);
      const active = consents.find((c) => c.granted);
      if (active) {
        await revokeConsent(encounterId, active.id, token);
      }
      sessionStorage.removeItem("medikiosk.kiosk_token");
      sessionStorage.removeItem("medikiosk.language");
      router.push("/");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Failed to revoke consent.");
    } finally {
      setSaving(false);
    }
  }

  async function continueIntake() {
    if (!token || !question || !answer) return;
    setSaving(true); setError("");
    try { await submitAnswer(encounterId, token, question, answer, additionalInput); await loadQuestion(token); }
    catch (caught) { setError(caught instanceof ApiError ? caught.message : "We could not save that answer."); }
    finally { setSaving(false); }
  }

  async function finishIntake() {
    if (!token) return;
    setSaving(true); setError("");
    try { await submitIntake(encounterId, token); setSubmitted(true); }
    catch (caught) { setError(caught instanceof ApiError ? caught.message : "We could not submit this intake."); }
    finally { setSaving(false); }
  }

  function closeSession() { sessionStorage.removeItem("medikiosk.kiosk_token"); sessionStorage.removeItem("medikiosk.language"); router.push("/"); }

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
          <p className="eyebrow">Step 3 of 3 · multimodal clinical intake</p>
          <div className="step-line"><span className="active" /><span className="active" /><span className="active" /></div>

          {!token && (
            <>
              <h1 className="display">This session has expired.</h1>
              <p className="notice error">Please begin a new private session on this device.</p>
              <div className="button-row"><Link className="button-primary kiosk-primary" href="/kiosk/start">Begin again</Link></div>
            </>
          )}

          {token && loading && (
            <>
              <h1 className="display">Preparing your next question…</h1>
              <p className="panel-copy">Please keep this screen open.</p>
            </>
          )}

          {token && !loading && question && (
            <>
              <div className="kiosk-question-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                <p className="kiosk-question-count" style={{ margin: 0 }}>Tap an answer or speak aloud</p>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <QuestionAudioButton encounterId={encounterId} questionKey={question.key} token={token} />
                  <VoiceRecordButton encounterId={encounterId} token={token} language={language} onTranscript={handleVoiceTranscript} />
                </div>
              </div>

              <h1 className="display kiosk-question">{question.prompt}</h1>
              <p className="panel-copy kiosk-copy">Tap the answer that fits best or speak into the microphone. Your clinician will review it with you.</p>

              <div aria-label="Answer choices" className="kiosk-choice-grid">
                {question.choices.map((option) => (
                  <button
                    aria-pressed={answer === option}
                    className={`choice kiosk-choice ${answer === option ? "selected" : ""}`}
                    key={option}
                    onClick={() => setAnswer(option)}
                    type="button"
                  >
                    <strong>{choiceLabel(option)}</strong>
                  </button>
                ))}
              </div>

              <div className="additional-input">
                <label htmlFor="additionalInput">Spoken or caregiver notes (optional)</label>
                <p>Spoken words will appear here. The touch choice above determines the verified clinical value.</p>
                <textarea
                  id="additionalInput"
                  onChange={(event) => setAdditionalInput(event.target.value)}
                  placeholder="Spoken words will appear here or you can type optional context"
                  value={additionalInput}
                />
              </div>

              <div className="button-row kiosk-action-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <button className="button-primary kiosk-primary" disabled={saving || !answer} onClick={continueIntake} type="button">
                  {saving ? "Saving…" : "Save and continue →"}
                </button>
                <button
                  className="button-secondary"
                  disabled={saving}
                  onClick={handleRevokeConsent}
                  type="button"
                  style={{ fontSize: "0.8rem", color: "#f87171", borderColor: "#7f1d1d" }}
                >
                  🔒 Revoke consent & exit
                </button>
              </div>
            </>
          )}

          {token && !loading && question === null && !submitted && (
            <>
              <h1 className="display">Review your intake before sending.</h1>
              <p className="panel-copy kiosk-copy">Your responses create a clinical pre-consultation record. They do not provide a diagnosis.</p>

              <div className="data-list">
                {facts.length ? (
                  facts.map((fact) => (
                    <div className="data-card" key={fact.id}>
                      <strong>{fact.fact_type.replaceAll("_", " ")}</strong>
                      <p>{String(fact.value.value ?? "Recorded")}</p>
                    </div>
                  ))
                ) : (
                  <p className="notice">No answers were recorded for this pathway.</p>
                )}
              </div>

              {/* Document upload step before submission */}
              <DocumentUploadSection encounterId={encounterId} token={token} />

              <div className="button-row kiosk-action-row" style={{ marginTop: "2rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <button className="button-primary kiosk-primary" disabled={saving} onClick={finishIntake} type="button">
                  {saving ? "Sending…" : "Send to clinical team →"}
                </button>
                <button
                  className="button-secondary"
                  disabled={saving}
                  onClick={handleRevokeConsent}
                  type="button"
                  style={{ fontSize: "0.8rem", color: "#f87171", borderColor: "#7f1d1d" }}
                >
                  🔒 Revoke consent & exit
                </button>
              </div>
            </>
          )}

          {token && !loading && submitted && (
            <>
              <h1 className="display">Your intake is with the clinical team.</h1>
              <p className="panel-copy kiosk-copy">Please stay nearby and speak to staff immediately if your symptoms worsen or you need urgent help.</p>
              <div className="button-row kiosk-action-row">
                <button className="button-primary kiosk-primary" onClick={closeSession} type="button">Close private session</button>
              </div>
            </>
          )}

          {error && <p className="notice error" role="alert">{error}</p>}
        </div>
      </section>
    </main>
  );
}
