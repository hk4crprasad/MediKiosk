"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { EncounterListItem, getAllEncounters, getTriageQueue, TriageQueueItem } from "@/lib/api";

export default function OPDDisplayPage() {
  const [encounters, setEncounters] = useState<EncounterListItem[]>([]);
  const [urgentQueue, setUrgentQueue] = useState<TriageQueueItem[]>([]);
  const [time, setTime] = useState<string>("");
  const [callingToken, setCallingToken] = useState<string | null>(null);

  // Live Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const loadData = useCallback(async () => {
    const token = typeof window !== "undefined" ? sessionStorage.getItem("medikiosk.staff_token") : null;
    if (!token) return;
    try {
      const [all, urgent] = await Promise.all([
        getAllEncounters(token).catch(() => []),
        getTriageQueue(token).catch(() => []),
      ]);
      setEncounters(all);
      setUrgentQueue(urgent);
    } catch {
      // Keep existing data on polling hiccups
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Audio Announcement Simulation
  function announceToken(tokenNum: string, room: string) {
    setCallingToken(tokenNum);
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const text = `Attention please. Token ${tokenNum}, please proceed to ${room}. ध्यान दें, टोकन ${tokenNum}, कृपया ${room} में जाएँ।`;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.88;
      utterance.lang = "hi-IN";
      window.speechSynthesis.speak(utterance);
    }
    setTimeout(() => setCallingToken(null), 4000);
  }

  // Active callers (top 2 encounters)
  const activeCalling = encounters.slice(0, 2);
  const waitingList = encounters.slice(2, 8);

  return (
    <div style={{ minHeight: "100vh", background: "#0b131e", color: "#f8fafc", fontFamily: "system-ui, -apple-system, sans-serif", padding: "1.5rem" }}>
      {/* Top TV Header */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #1e293b", paddingBottom: "1.2rem", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div style={{ width: "3rem", height: "3rem", borderRadius: "10px", background: "linear-gradient(135deg, #0b746d, #10b981)", display: "grid", placeItems: "center", fontSize: "1.6rem" }}>
            ✦
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: "1.8rem", fontWeight: 800, letterSpacing: "-0.02em", color: "#ffffff" }}>
              Apex AYUSH & General Hospital OPD
            </h1>
            <p style={{ margin: 0, fontSize: "1rem", color: "#94a3b8" }}>
              Live Patient Queue & Room Calling Display · AIIMS / AIIA Network
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "2rem" }}>
          <div style={{ textAlign: "right" }}>
            <span style={{ display: "block", fontSize: "2rem", fontWeight: 800, fontFamily: "monospace", color: "#38bdf8" }}>
              {time || "12:00:00"}
            </span>
            <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>
              {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}
            </span>
          </div>
          <Link href="/staff/triage" style={{ background: "#1e293b", border: "1px solid #334155", color: "#94a3b8", padding: "0.5rem 1rem", borderRadius: "8px", fontSize: "0.85rem", textDecoration: "none" }}>
            ← Staff Desk
          </Link>
        </div>
      </header>

      {/* Main Split Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: "1.5rem", marginBottom: "1.5rem" }}>
        {/* Left Column: Now Calling */}
        <section style={{ background: "#131d2a", border: "2px solid #1e293b", borderRadius: "16px", padding: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h2 style={{ margin: 0, fontSize: "1.4rem", color: "#10b981", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              🔊 Now Calling / वर्तमान रोगी
            </h2>
            <span style={{ background: "rgba(16, 185, 129, 0.2)", color: "#10b981", padding: "0.3rem 0.8rem", borderRadius: "99px", fontSize: "0.85rem", fontWeight: 700 }}>
              Live Consulting
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {activeCalling.length > 0 ? (
              activeCalling.map((item, idx) => {
                const tokenNum = `OPD-${item.encounter_id.slice(0, 4).toUpperCase()}`;
                const roomName = idx === 0 ? "Room 12 (AYUSH OPD)" : "Room 14 (General Medicine)";
                const isCurrentCalling = callingToken === tokenNum;

                return (
                  <div
                    key={item.encounter_id}
                    style={{
                      background: isCurrentCalling ? "rgba(16, 185, 129, 0.15)" : "#1a2636",
                      border: isCurrentCalling ? "2px solid #10b981" : "1px solid #2d3b4e",
                      borderRadius: "14px",
                      padding: "1.5rem",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      transition: "all 0.3s ease",
                    }}
                  >
                    <div>
                      <span style={{ fontSize: "0.9rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        Token Number
                      </span>
                      <h3 style={{ margin: "0.2rem 0", fontSize: "2.8rem", fontWeight: 900, color: "#ffffff", letterSpacing: "-0.03em" }}>
                        #{tokenNum}
                      </h3>
                      <p style={{ margin: 0, fontSize: "1.1rem", color: "#e2e8f0" }}>
                        Patient: <strong>{item.patient_display_name || "Patient in Consultation"}</strong>
                      </p>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <span style={{ display: "inline-block", background: "#0b746d", color: "#ffffff", padding: "0.4rem 1rem", borderRadius: "8px", fontSize: "1.1rem", fontWeight: 800, marginBottom: "0.5rem" }}>
                        → {roomName}
                      </span>
                      <button
                        type="button"
                        onClick={() => announceToken(tokenNum, roomName)}
                        style={{ display: "block", width: "100%", background: "#1e293b", border: "1px solid #334155", color: "#38bdf8", padding: "0.4rem 0.8rem", borderRadius: "6px", fontSize: "0.85rem", cursor: "pointer", fontWeight: 700 }}
                      >
                        🔔 Chime & Call
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ textAlign: "center", padding: "3rem", color: "#64748b" }}>
                <p style={{ fontSize: "1.3rem", margin: 0 }}>No active consultations called yet.</p>
                <small>Patients will appear as they complete the MediKiosk intake.</small>
              </div>
            )}
          </div>
        </section>

        {/* Right Column: Upcoming Queue */}
        <section style={{ background: "#131d2a", border: "2px solid #1e293b", borderRadius: "16px", padding: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h2 style={{ margin: 0, fontSize: "1.4rem", color: "#38bdf8", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              ⏳ Next in Queue / प्रतीक्षा सूची
            </h2>
            <span style={{ background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8", padding: "0.3rem 0.8rem", borderRadius: "99px", fontSize: "0.85rem", fontWeight: 700 }}>
              {waitingList.length} Waiting
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {waitingList.length > 0 ? (
              waitingList.map((item, idx) => (
                <div
                  key={item.encounter_id}
                  style={{
                    background: "#182230",
                    border: "1px solid #283547",
                    borderRadius: "10px",
                    padding: "0.85rem 1.2rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                    <span style={{ width: "2rem", height: "2rem", borderRadius: "50%", background: "#243347", display: "grid", placeItems: "center", fontSize: "0.9rem", fontWeight: 800, color: "#94a3b8" }}>
                      {idx + 1}
                    </span>
                    <div>
                      <strong style={{ fontSize: "1.15rem", color: "#ffffff", display: "block" }}>
                        #OPD-{item.encounter_id.slice(0, 4).toUpperCase()}
                      </strong>
                      <small style={{ color: "#94a3b8" }}>
                        {item.patient_display_name || "Registered Patient"} · {item.pathway_version.replace("-v1", "")}
                      </small>
                    </div>
                  </div>

                  <span style={{ color: "#38bdf8", fontSize: "0.9rem", fontWeight: 600 }}>
                    Est. {idx * 5 + 5} mins
                  </span>
                </div>
              ))
            ) : (
              <div style={{ textAlign: "center", padding: "3rem", color: "#64748b" }}>
                <p style={{ margin: 0 }}>Queue is currently clear.</p>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Bottom Emergency Priority Banner */}
      {urgentQueue.length > 0 && (
        <footer style={{ background: "rgba(239, 68, 68, 0.15)", border: "2px solid #ef4444", borderRadius: "14px", padding: "1rem 1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <span style={{ fontSize: "1.8rem" }}>🚨</span>
            <div>
              <strong style={{ fontSize: "1.2rem", color: "#f87171", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Emergency Triage Priority Alert ({urgentQueue.length} Active)
              </strong>
              <p style={{ margin: "0.2rem 0 0", fontSize: "0.95rem", color: "#fca5a5" }}>
                Token #OPD-{urgentQueue[0].encounter_id.slice(0, 4).toUpperCase()} flagged for immediate clinical attention: {urgentQueue[0].red_flag.reason}
              </p>
            </div>
          </div>
          <span style={{ background: "#ef4444", color: "#ffffff", padding: "0.4rem 1rem", borderRadius: "8px", fontWeight: 800, fontSize: "0.9rem" }}>
            FAST-TRACK TO TRIAGE ROOM 1
          </span>
        </footer>
      )}
    </div>
  );
}
