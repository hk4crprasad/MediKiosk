"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";
import { ApiError, login } from "@/lib/api";

export default function StaffLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError("");
    try { const result = await login(email, password); sessionStorage.setItem("medikiosk.staff_token", result.access_token); router.push("/staff/triage"); }
    catch (caught) { setError(caught instanceof ApiError ? "Those staff credentials were not accepted." : "We could not sign you in. Please try again."); }
    finally { setLoading(false); }
  }
  return <main className="page-wrap"><div className="shell"><header className="site-header"><Link className="brand" href="/"><span className="brand-mark"><span>✦</span></span>MediKiosk</Link><span className="nav-link">Staff workspace</span></header></div><section className="form-shell"><div className="panel"><p className="eyebrow">Clinical access only</p><h1 className="display">Open the care workspace.</h1><p className="panel-copy">Use your staff account to review triage signals and clinician-ready encounter records.</p><form onSubmit={signIn}><div className="field-grid"><div className="field full"><label htmlFor="email">Staff email</label><input autoComplete="email" id="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} /></div><div className="field full"><label htmlFor="password">Password</label><input autoComplete="current-password" id="password" onChange={(event) => setPassword(event.target.value)} required type="password" value={password} /></div></div>{error && <p className="notice error" role="alert">{error}</p>}<div className="button-row"><button className="button-primary" disabled={loading} type="submit">{loading ? "Signing in…" : "Enter workspace →"}</button><Link className="button-secondary" href="/">Return to welcome</Link></div></form></div></section></main>;
}
