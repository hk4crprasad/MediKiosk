"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getHealth } from "@/lib/api";

const roles = [
  { index: "01 / patient or caregiver", title: "Begin with a clear story.", body: "Guided questions, touch/voice controls, and a private encounter that follows one person only.", href: "/kiosk/start", action: "Start a kiosk session" },
  { index: "02 / registered patient", title: "Keep your own record.", body: "Register once, upload prior reports and prescriptions, and build a personal history a doctor can review later.", href: "/patient/login", action: "Open patient portal" },
  { index: "03 / physician", title: "Review what matters.", body: "See structured history, evidence, document reviews, and a draft that remains yours to verify.", href: "/staff/login", action: "Open clinician workspace" },
  { index: "04 / triage", title: "Act on reviewed rules.", body: "A focused urgent-review queue preserves exactly why a rule was raised and who acknowledged it.", href: "/staff/login", action: "Open triage queue" },
];

export default function Home() {
  const [apiHealth, setApiHealth] = useState<string>("Checking…");

  useEffect(() => {
    getHealth()
      .then((res) => setApiHealth(res.status === "ok" ? "Online & Healthy" : "Degraded"))
      .catch(() => setApiHealth("Connecting…"));
  }, []);

  return (
    <main className="shell">
      <header className="site-header">
        <Link className="brand" href="/"><span className="brand-mark"><span>✦</span></span>MediKiosk</Link>
        <Link className="nav-link" href="/staff/login">Staff sign in ↗</Link>
      </header>
      <section className="hero">
        <div>
          <p className="eyebrow">SIH 2026 · Pre-consultation AI Platform</p>
          <h1 className="display">A better beginning to every consultation.</h1>
          <p className="hero-copy">
            MediKiosk organizes a patient&apos;s story before the doctor enters the room. It keeps the source visible, makes safety rules explicit, and leaves every clinical decision with a licensed physician.
          </p>
        </div>
        <aside className="hero-aside" aria-label="System status">
          <p className="eyebrow">Live system connectivity</p>
          <div className="status-row"><span><i className="status-dot" />FastAPI Core Engine</span><strong>{apiHealth}</strong></div>
          <div className="status-row"><span><i className="status-dot" />Deterministic Triage</span><strong>Ready</strong></div>
          <div className="status-row"><span><i className="status-dot" />Azure Blob &amp; OpenAI Vision</span><strong>Connected</strong></div>
        </aside>
      </section>
      <section className="role-grid" aria-label="Choose a workspace">
        {roles.map((role) => (
          <Link className="role-card" href={role.href} key={role.index}>
            <p className="role-index">{role.index}</p>
            <h2 className="display">{role.title}</h2>
            <p>{role.body}</p>
            <span className="card-arrow">{role.action} →</span>
          </Link>
        ))}
      </section>
    </main>
  );
}
