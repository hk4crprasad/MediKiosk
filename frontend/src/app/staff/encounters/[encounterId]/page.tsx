"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ApiError, ClinicianEncounter, getClinicianEncounter } from "@/lib/api";

export default function StaffEncounterPage() {
  const { encounterId } = useParams<{ encounterId: string }>();
  const [record, setRecord] = useState<ClinicianEncounter | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const loadRecord = useCallback(async () => {
    const token = sessionStorage.getItem("medikiosk.staff_token");
    if (!token) { setError("Sign in to review this encounter."); setLoading(false); return; }
    setLoading(true); setError("");
    try { setRecord(await getClinicianEncounter(encounterId, token)); }
    catch (caught) { setError(caught instanceof ApiError ? caught.message : "The encounter record could not be loaded."); }
    finally { setLoading(false); }
  }, [encounterId]);
  useEffect(() => {
    const timer = window.setTimeout(() => { void loadRecord(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadRecord]);
  return <main className="page-wrap"><div className="shell"><header className="site-header"><Link className="brand" href="/"><span className="brand-mark"><span>✦</span></span>MediKiosk</Link><Link className="button-secondary" href="/staff/triage">Back to triage</Link></header></div><section className="form-shell"><div className="panel"><p className="eyebrow">Clinician encounter review</p>{loading && <><h1 className="display">Opening clinical record…</h1><p className="panel-copy">Loading documented intake facts and safety signals.</p></>}{!loading && error && <><h1 className="display">Record unavailable.</h1><p className="notice error" role="alert">{error}</p><div className="button-row"><Link className="button-primary" href="/staff/login">Staff sign in</Link></div></>}{!loading && record && <><div className="split-title"><h1 className="display">Encounter review.</h1><small>{record.encounter.status}</small></div><p className="panel-copy">Pathway: {record.encounter.pathway_version}. This is a clinician-facing record; review source evidence and verify before relying on it.</p><h2 className="display">Safety signals</h2><div className="data-list">{record.red_flags.length ? record.red_flags.map((flag) => <div className="data-card" key={flag.id}><span className="tag urgent">{flag.severity}</span><strong>{flag.reason}</strong><p>{flag.acknowledged_at ? "Acknowledged" : "Awaiting acknowledgement"}</p></div>) : <p className="notice">No recorded red flags for this encounter.</p>}</div><h2 className="display">Recorded intake facts</h2><div className="data-list">{record.facts.length ? record.facts.map((fact) => <div className="data-card" key={fact.id}><strong>{fact.fact_type.replaceAll("_", " ")}</strong><p>{String(fact.value.value ?? "Recorded")} · {fact.verification_status.replaceAll("_", " ")}</p></div>) : <p className="notice">No intake facts recorded.</p>}</div><h2 className="display">Documents</h2><div className="data-list">{record.documents.length ? record.documents.map((document) => <div className="data-card" key={document.id}><strong>{document.original_filename}</strong><p>{document.status}</p></div>) : <p className="notice">No uploaded documents in this encounter.</p>}</div></>}</div></section></main>;
}
