"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { acknowledgeFlag, ApiError, getTriageQueue, TriageQueueItem } from "@/lib/api";

export default function TriagePage() {
  const [items, setItems] = useState<TriageQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    const token = sessionStorage.getItem("medikiosk.staff_token");
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      setItems(await getTriageQueue(token));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The triage queue could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  async function acknowledge(item: TriageQueueItem) {
    const token = sessionStorage.getItem("medikiosk.staff_token");
    if (!token) return;
    setWorking(item.red_flag.id);
    try {
      await acknowledgeFlag(item.red_flag.id, token);
      await loadData();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The flag could not be acknowledged.");
    } finally {
      setWorking(null);
    }
  }

  return (
    <div className="panel">
      <div className="split-title">
        <div><p className="eyebrow">Clinical priority queue</p><h1 className="display">Triage signals.</h1></div>
        <small>{items.length} active</small>
      </div>
      <p className="panel-copy">Review safety flags promptly. Acknowledging a flag records the staff action; it does not remove the clinical evidence.</p>
      {loading && <p className="notice">Loading triage signals…</p>}
      {!loading && items.length === 0 && <p className="notice">No active red flags are waiting for review.</p>}
      {!loading && items.length > 0 && (
        <div className="data-list">
          {items.map((item) => (
            <article className="data-card" key={item.red_flag.id}>
              <span className="tag urgent">{item.red_flag.severity} · safety flag</span>
              <strong>{item.patient_display_name ?? "Unlabelled patient"}</strong>
              <p>{item.red_flag.reason}</p>
              <p><small>Encounter {item.encounter_id.slice(0, 8)} · {item.encounter_status}</small></p>
              <div className="button-row">
                <Link className="button-secondary" href={`/staff/encounters/${item.encounter_id}`}>Open record</Link>
                <button className="button-primary" disabled={working === item.red_flag.id} onClick={() => acknowledge(item)} type="button">
                  {working === item.red_flag.id ? "Recording…" : "Acknowledge"}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {error && <p className="notice error" role="alert">{error}</p>}
    </div>
  );
}
