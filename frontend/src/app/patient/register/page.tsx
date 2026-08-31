"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";
import { ApiError, registerPatient } from "@/lib/api";

export default function PatientRegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [sex, setSex] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await registerPatient({
        email,
        password,
        displayName: displayName.trim() || undefined,
        birthYear: birthYear ? Number.parseInt(birthYear, 10) : undefined,
        sex: sex || undefined,
      });
      sessionStorage.setItem("medikiosk.patient_token", result.access_token);
      router.push("/patient/dashboard");
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.status === 409
          ? "An account with this email already exists. Try signing in instead."
          : "We could not create your account. Please check your details and try again."
      );
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
          <h1 className="display">Create your account.</h1>
          <p className="panel-copy">
            Register once to upload your prior prescriptions, lab reports, and discharge summaries, and keep a
            personal history a doctor can review before your next visit.
          </p>
          <form onSubmit={register}>
            <div className="field-grid">
              <div className="field full">
                <label htmlFor="email">Email address</label>
                <input autoComplete="email" id="email" onChange={(e) => setEmail(e.target.value)} required type="email" value={email} />
              </div>
              <div className="field full">
                <label htmlFor="password">Password</label>
                <input autoComplete="new-password" id="password" minLength={8} onChange={(e) => setPassword(e.target.value)} required type="password" value={password} />
              </div>
              <div className="field">
                <label htmlFor="displayName">Full name (optional)</label>
                <input id="displayName" onChange={(e) => setDisplayName(e.target.value)} type="text" value={displayName} />
              </div>
              <div className="field">
                <label htmlFor="birthYear">Birth year (optional)</label>
                <input id="birthYear" onChange={(e) => setBirthYear(e.target.value)} type="number" value={birthYear} />
              </div>
              <div className="field full">
                <label htmlFor="sex">Sex (optional)</label>
                <select id="sex" onChange={(e) => setSex(e.target.value)} value={sex}>
                  <option value="">Prefer not to say</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            {error && <p className="notice error" role="alert">{error}</p>}
            <div className="button-row">
              <button className="button-primary" disabled={loading} type="submit">
                {loading ? "Creating account…" : "Create account →"}
              </button>
              <Link className="button-secondary" href="/patient/login">Already have an account?</Link>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
