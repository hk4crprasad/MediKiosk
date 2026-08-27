"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { QuestionAudioButton } from "@/components/kiosk/question-audio-button";
import { ApiError, Fact, getFacts, getNextQuestion, Question, submitAnswer, submitIntake } from "@/lib/api";

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
      setToken(saved);
      if (saved) void loadQuestion(saved); else setLoading(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadQuestion]);

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

  return <main className="page-wrap kiosk-page"><div className="shell"><header className="site-header"><Link className="brand" href="/"><span className="brand-mark"><span>✦</span></span>MediKiosk</Link><span className="nav-link">Touch intake</span></header></div><section className="form-shell kiosk-shell"><div className="panel kiosk-panel"><p className="eyebrow">Step 3 of 3 · guided touch intake</p><div className="step-line"><span className="active" /><span className="active" /><span className="active" /></div>{!token && <><h1 className="display">This session has expired.</h1><p className="notice error">Please begin a new private session on this device.</p><div className="button-row"><Link className="button-primary kiosk-primary" href="/kiosk/start">Begin again</Link></div></>}{token && loading && <><h1 className="display">Preparing your next question…</h1><p className="panel-copy">Please keep this screen open.</p></>}{token && !loading && question && <><div className="kiosk-question-header"><p className="kiosk-question-count">One touch answer is required</p><QuestionAudioButton encounterId={encounterId} questionKey={question.key} token={token} /></div><h1 className="display kiosk-question">{question.prompt}</h1><p className="panel-copy kiosk-copy">Tap the answer that fits best. Your clinician will review it with you.</p><div aria-label="Answer choices" className="kiosk-choice-grid">{question.choices.map((option) => <button aria-pressed={answer === option} className={`choice kiosk-choice ${answer === option ? "selected" : ""}`} key={option} onClick={() => setAnswer(option)} type="button">{choiceLabel(option)}</button>)}</div><div className="additional-input"><label htmlFor="additionalInput">Your input (optional)</label><p>This is for a caregiver or staff member to add context for the jury/demo. It does not replace the selected answer or become an AI-verified clinical fact.</p><textarea id="additionalInput" onChange={(event) => setAdditionalInput(event.target.value)} placeholder="Optional extra words — touch answer above is still required" value={additionalInput} /></div><div className="button-row kiosk-action-row"><button className="button-primary kiosk-primary" disabled={saving || !answer} onClick={continueIntake} type="button">{saving ? "Saving…" : "Save touch answer →"}</button></div></>}{token && !loading && question === null && !submitted && <><h1 className="display">Review your intake before sending.</h1><p className="panel-copy kiosk-copy">Your responses create a clinical pre-consultation record. They do not provide a diagnosis.</p><div className="data-list">{facts.length ? facts.map((fact) => <div className="data-card" key={fact.id}><strong>{fact.fact_type.replaceAll("_", " ")}</strong><p>{String(fact.value.value ?? "Recorded")}</p></div>) : <p className="notice">No answers were recorded for this pathway.</p>}</div><div className="button-row kiosk-action-row"><button className="button-primary kiosk-primary" disabled={saving} onClick={finishIntake} type="button">{saving ? "Sending…" : "Send to clinical team →"}</button></div></>}{token && !loading && submitted && <><h1 className="display">Your intake is with the clinical team.</h1><p className="panel-copy kiosk-copy">Please stay nearby and speak to staff immediately if your symptoms worsen or you need urgent help.</p><div className="button-row kiosk-action-row"><button className="button-primary kiosk-primary" onClick={closeSession} type="button">Close private session</button></div></>}{error && <p className="notice error" role="alert">{error}</p>}</div></section></main>;
}
