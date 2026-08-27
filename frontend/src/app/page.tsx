import Link from "next/link";

const roles = [
  { index: "01 / patient or caregiver", title: "Begin with a clear story.", body: "Guided questions, touch-first controls, and a private encounter that follows one person only.", href: "/kiosk/start", action: "Start a kiosk session" },
  { index: "02 / physician", title: "Review what matters.", body: "See structured history, evidence, document reviews, and a draft that remains yours to verify.", href: "/staff/login", action: "Open clinician workspace" },
  { index: "03 / triage", title: "Act on reviewed rules.", body: "A focused urgent-review queue preserves exactly why a rule was raised and who acknowledged it.", href: "/staff/login", action: "Open triage queue" },
];

export default function Home() {
  return <main className="shell"><header className="site-header"><Link className="brand" href="/"><span className="brand-mark"><span>✦</span></span>MediKiosk</Link><Link className="nav-link" href="/staff/login">Staff sign in ↗</Link></header><section className="hero"><div><p className="eyebrow">Pre-consultation, with a human in the loop</p><h1 className="display">A better beginning to every consultation.</h1><p className="hero-copy">MediKiosk organizes a patient&apos;s story before the doctor enters the room. It keeps the source visible, makes safety rules explicit, and leaves every clinical decision with a person.</p></div><aside className="hero-aside" aria-label="System status"><p className="eyebrow">Today&apos;s system</p><div className="status-row"><span><i className="status-dot" />Guided intake</span><strong>Ready</strong></div><div className="status-row"><span><i className="status-dot" />Safety review</span><strong>Ready</strong></div><div className="status-row"><span><i className="status-dot pending" />Speech &amp; documents</span><strong>Verify</strong></div></aside></section><section className="role-grid" aria-label="Choose a workspace">{roles.map((role) => <Link className="role-card" href={role.href} key={role.index}><p className="role-index">{role.index}</p><h2 className="display">{role.title}</h2><p>{role.body}</p><span className="card-arrow">{role.action} →</span></Link>)}</section></main>;
}
