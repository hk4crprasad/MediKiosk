"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, createStaffUser, logout } from "@/lib/api";

type CreatedUser = {
  id: string;
  email: string;
  role: string;
  active: boolean;
};

export default function AdminUsersPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "triage" | "physician">("physician");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [users, setUsers] = useState<CreatedUser[]>([]);

  useEffect(() => {
    const saved = sessionStorage.getItem("medikiosk.staff_token");
    setToken(saved);
  }, []);

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const created = await createStaffUser(token, { email, password, role });
      setUsers((prev) => [created, ...prev]);
      setSuccess(`Staff account created for ${created.email} (${created.role}).`);
      setEmail("");
      setPassword("");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Failed to create staff user.");
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    if (token) {
      try {
        await logout(token);
      } catch {
        // Continue clearing session
      }
    }
    sessionStorage.removeItem("medikiosk.staff_token");
    router.push("/staff/login");
  }

  return (
    <main className="page-wrap">
      <div className="shell">
        <header className="site-header">
          <Link className="brand" href="/"><span className="brand-mark"><span>✦</span></span>MediKiosk</Link>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <Link className="button-secondary" href="/staff/triage">Triage dashboard</Link>
            <button className="button-secondary" onClick={signOut} type="button">Sign out</button>
          </div>
        </header>
      </div>

      <section className="form-shell">
        <div className="panel">
          <p className="eyebrow">Hospital Administration</p>
          <h1 className="display">Staff user management.</h1>
          <p className="panel-copy">Provision access for triage staff, nurses, and hospital physicians.</p>

          {!token && (
            <div>
              <p className="notice error">Sign in with an administrator account to manage staff.</p>
              <div className="button-row"><Link className="button-primary" href="/staff/login">Staff sign in</Link></div>
            </div>
          )}

          {token && (
            <>
              <form onSubmit={handleCreateUser} style={{ marginTop: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                  <div style={{ flex: 2, minWidth: "200px" }}>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.3rem" }}>Staff Email</label>
                    <input
                      type="email"
                      required
                      placeholder="doctor.sharma@hospital.gov.in"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      style={{ width: "100%", padding: "0.6rem", borderRadius: "8px", background: "rgba(0,0,0,0.2)", color: "inherit", border: "1px solid var(--border, #4b5563)" }}
                    />
                  </div>

                  <div style={{ flex: 2, minWidth: "180px" }}>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.3rem" }}>Password</label>
                    <input
                      type="password"
                      required
                      placeholder="Temporary password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      style={{ width: "100%", padding: "0.6rem", borderRadius: "8px", background: "rgba(0,0,0,0.2)", color: "inherit", border: "1px solid var(--border, #4b5563)" }}
                    />
                  </div>

                  <div style={{ flex: 1, minWidth: "140px" }}>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.3rem" }}>Role</label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as "admin" | "triage" | "physician")}
                      style={{ width: "100%", padding: "0.6rem", borderRadius: "8px", background: "rgba(0,0,0,0.2)", color: "inherit", border: "1px solid var(--border, #4b5563)" }}
                    >
                      <option value="physician">Physician (Doctor)</option>
                      <option value="triage">Triage (Nurse / Staff)</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </div>
                </div>

                {success && <p className="notice" style={{ background: "rgba(16, 185, 129, 0.1)", borderColor: "#10b981", color: "#10b981" }}>{success}</p>}
                {error && <p className="notice error" role="alert">{error}</p>}

                <div className="button-row" style={{ marginTop: "0.5rem" }}>
                  <button className="button-primary" disabled={loading} type="submit">
                    {loading ? "Provisioning account…" : "Create staff account →"}
                  </button>
                </div>
              </form>

              {users.length > 0 && (
                <div style={{ marginTop: "2rem" }}>
                  <h2 className="display" style={{ fontSize: "1.2rem" }}>Recently provisioned users</h2>
                  <div className="data-list">
                    {users.map((u) => (
                      <div className="data-card" key={u.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <strong>{u.email}</strong>
                          <p style={{ margin: "0.2rem 0 0" }}><small>ID: {u.id.slice(0, 8)}</small></p>
                        </div>
                        <span className="tag">{u.role}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
