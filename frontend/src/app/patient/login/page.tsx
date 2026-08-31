"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";
import { ApiError, loginPatient } from "@/lib/api";

export default function PatientLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await loginPatient(email, password);
      sessionStorage.setItem("medikiosk.patient_token", result.access_token);
      router.push("/patient/dashboard");
    } catch (caught) {
      setError(caught instanceof ApiError ? "Those credentials were not accepted." : "We could not sign you in. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page-wrap patient-page">
      <div className="shell">
        <header className="site-header">
          <Link className="brand" href="/"><span className="brand-mark"><span>✦</span></span>MediKiosk</Link>
          <span className="nav-link">Patient portal</span>
        </header>
      </div>
      <section className="form-shell">
        <div className="panel">
          <p className="eyebrow">Your own medical record archive</p>
          <h1 className="display">Welcome back.</h1>
          <p className="panel-copy">Sign in to view your uploaded reports and your AI-generated history overview.</p>
          <form onSubmit={signIn}>
            <div className="field-grid">
              <div className="field full">
                <label htmlFor="email">Email address</label>
                <input autoComplete="email" id="email" onChange={(e) => setEmail(e.target.value)} required type="email" value={email} />
              </div>
              <div className="field full">
                <label htmlFor="password">Password</label>
                <input autoComplete="current-password" id="password" onChange={(e) => setPassword(e.target.value)} required type="password" value={password} />
              </div>
            </div>
            {error && <p className="notice error" role="alert">{error}</p>}
            <div className="button-row">
              <button className="button-primary" disabled={loading} type="submit">
                {loading ? "Signing in…" : "Sign in →"}
              </button>
              <Link className="button-secondary" href="/patient/register">Create an account</Link>
              <Link className="button-secondary" href="/">Return to welcome</Link>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
