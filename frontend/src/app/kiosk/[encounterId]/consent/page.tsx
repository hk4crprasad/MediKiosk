"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, recordConsent } from "@/lib/api";

export default function ConsentPage() {
  const { encounterId } = useParams<{ encounterId: string }>();
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setToken(sessionStorage.getItem("medikiosk.kiosk_token")), 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function continueToIntake() {
    if (!token) return;
    setLoading(true); setError("");
    try {
      await recordConsent(encounterId, token, sessionStorage.getItem("medikiosk.language") ?? "en");
      router.push(`/kiosk/${encounterId}/intake`);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "We could not record your consent. Please ask a staff member for help.");
    } finally { setLoading(false); }
  }

  return <main className="page-wrap kiosk-page"><div className="shell"><header className="site-header"><Link className="brand" href="/"><span className="brand-mark"><span>✦</span></span>MediKiosk</Link><span className="nav-link">Touch intake</span></header></div><section className="form-shell kiosk-shell"><div className="panel kiosk-panel"><p className="eyebrow">Step 2 of 3 · consent</p><div className="step-line"><span className="active" /><span className="active" /><span /></div><h1 className="display">Your answers help prepare the consultation.</h1><p className="panel-copy kiosk-copy">By continuing, you agree to record your intake answers for the clinical team. This tool does not diagnose, prescribe, or replace an urgent-care assessment. If you feel severely unwell, alert staff immediately.</p>{!token && <p className="notice error" role="alert">This private session is no longer available in this browser. Please return to the welcome page and start again.</p>}{error && <p className="notice error" role="alert">{error}</p>}<div className="button-row kiosk-action-row"><button className="button-primary kiosk-primary" disabled={!token || loading} onClick={continueToIntake} type="button">{loading ? "Recording consent…" : "I agree — continue →"}</button><Link className="button-secondary kiosk-secondary" href="/kiosk/start">Start over</Link></div></div></section></main>;
}
