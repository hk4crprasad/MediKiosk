"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { acknowledgeFlag, ApiError, getTriageQueue, TriageQueueItem } from "@/lib/api";

export default function TriagePage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [items, setItems] = useState<TriageQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState("");
  const loadQueue = useCallback(async (activeToken: string) => {
    setLoading(true); setError("");
    try { setItems(await getTriageQueue(activeToken)); }
    catch (caught) { setError(caught instanceof ApiError && caught.status === 401 ? "Your staff session has expired. Please sign in again." : "The triage queue could not be loaded."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = sessionStorage.getItem("medikiosk.staff_token");
      setToken(saved);
      if (saved) void loadQueue(saved); else setLoading(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadQueue]);
  async function acknowledge(item: TriageQueueItem) { if (!token) return; setWorking(item.red_flag.id); try { await acknowledgeFlag(item.red_flag.id, token); await loadQueue(token); } catch (caught) { setError(caught instanceof ApiError ? caught.message : "The flag could not be acknowledged."); } finally { setWorking(null); } }
  function signOut() { sessionStorage.removeItem("medikiosk.staff_token"); router.push("/staff/login"); }
  return <main className="page-wrap"><div className="shell"><header className="site-header"><Link className="brand" href="/"><span className="brand-mark"><span>✦</span></span>MediKiosk</Link><button className="button-secondary" onClick={signOut} type="button">Sign out</button></header></div><section className="form-shell"><div className="panel"><div className="split-title"><div><p className="eyebrow">Clinical priority queue</p><h1 className="display">Triage signals.</h1></div><small>{items.length} active</small></div><p className="panel-copy">Review safety flags promptly. Acknowledging a flag records the staff action; it does not remove the clinical evidence.</p>{!token && <><p className="notice error">Sign in to view the clinical queue.</p><div className="button-row"><Link className="button-primary" href="/staff/login">Staff sign in</Link></div></>}{token && loading && <p className="notice">Loading current triage signals…</p>}{token && !loading && !error && items.length === 0 && <p className="notice">No active red flags are waiting for review.</p>}{token && !loading && items.length > 0 && <div className="data-list">{items.map((item) => <article className="data-card" key={item.red_flag.id}><span className="tag urgent">{item.red_flag.severity} · safety flag</span><strong>{item.patient_display_name ?? "Unlabelled patient"}</strong><p>{item.red_flag.reason}</p><p><small>Encounter {item.encounter_id.slice(0, 8)} · {item.encounter_status}</small></p><div className="button-row"><Link className="button-secondary" href={`/staff/encounters/${item.encounter_id}`}>Open record</Link><button className="button-primary" disabled={working === item.red_flag.id} onClick={() => acknowledge(item)} type="button">{working === item.red_flag.id ? "Recording…" : "Acknowledge"}</button></div></article>)}</div>}{error && <p className="notice error" role="alert">{error}</p>}</div></section></main>;
}
