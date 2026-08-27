"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, createEncounter, Pathway } from "@/lib/api";

const pathways: Array<{ value: Pathway; label: string; note: string }> = [
  { value: "chest-discomfort-v1", label: "Chest discomfort", note: "Pain, pressure, tightness, or discomfort in the chest." },
  { value: "fever-v1", label: "Fever", note: "Feeling feverish or a measured high temperature." },
  { value: "headache-v1", label: "Headache", note: "Pain, pressure, or discomfort in the head." },
  { value: "abdominal-pain-v1", label: "Abdominal pain", note: "Pain or discomfort in the stomach or belly." },
  { value: "ayush-dashavidha-v1", label: "AYUSH consultation", note: "Dashavidha and lifestyle context for an AYUSH consultation." },
];

export function StartEncounterForm() {
  const router = useRouter();
  const [pathway, setPathway] = useState<Pathway>("chest-discomfort-v1");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function start() {
    setLoading(true); setError("");
    try {
      const result = await createEncounter({ language: "en", pathway });
      sessionStorage.setItem("medikiosk.kiosk_token", result.kiosk_session_token);
      sessionStorage.setItem("medikiosk.language", "en");
      router.push(`/kiosk/${result.encounter.id}/consent`);
    } catch (caught) {
      const issue = caught instanceof ApiError ? `${caught.message}${caught.requestId ? ` (Request ID: ${caught.requestId})` : ""}` : "Unable to begin this encounter. Please ask a staff member for help.";
      setError(issue);
    } finally { setLoading(false); }
  }
  return <main className="page-wrap kiosk-page"><div className="shell"><header className="site-header"><Link className="brand" href="/"><span className="brand-mark"><span>✦</span></span>MediKiosk</Link><span className="nav-link">Touch intake</span></header></div><section className="form-shell kiosk-shell"><div className="panel kiosk-panel"><p className="eyebrow">Step 1 of 3 · touch only</p><div className="step-line"><span className="active" /><span /><span /></div><h1 className="display">What brings you here today?</h1><p className="panel-copy kiosk-copy">Tap one answer. You do not need to type anything. A staff member can help at any time.</p><div aria-label="Choose the reason for today’s visit" className="kiosk-choice-grid">{pathways.map((item) => <button aria-pressed={pathway === item.value} className={`choice kiosk-choice ${pathway === item.value ? "selected" : ""}`} key={item.value} onClick={() => setPathway(item.value)} type="button"><strong>{item.label}</strong><small>{item.note}</small></button>)}</div>{error && <p className="notice error" role="alert">{error}</p>}<div className="button-row kiosk-action-row"><button className="button-primary kiosk-primary" disabled={loading} onClick={start} type="button">{loading ? "Starting private session…" : "Continue →"}</button><Link className="button-secondary kiosk-secondary" href="/">Return to welcome</Link></div></div></section></main>;
}
