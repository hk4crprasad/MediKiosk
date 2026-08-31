"use client";

import { useState } from "react";

type SandboxExchangeMetadata = {
  timestamp: string;
  transactionId: string;
};

export function AbdmExchangeSimulator({
  abhaId,
  encounterId,
  bundleData,
}: {
  abhaId?: string | null;
  encounterId: string;
  bundleData?: Record<string, unknown> | null;
}) {
  const [pushing, setPushing] = useState<boolean>(false);
  const [pushed, setPushed] = useState<boolean>(false);
  const [showPayload, setShowPayload] = useState<boolean>(false);
  const [simulationMetadata, setSimulationMetadata] = useState<SandboxExchangeMetadata | null>(null);

  const activeAbha = abhaId || "91-8472-1928-3011@abdm";

  function handleSimulatePush() {
    setPushing(true);
    setTimeout(() => {
      setPushing(false);
      setPushed(true);
      setSimulationMetadata({
        timestamp: new Date().toISOString(),
        transactionId: `sandbox-${crypto.randomUUID()}`,
      });
    }, 1200);
  }

  return (
    <div style={{ marginTop: "1.25rem", padding: "1.25rem", borderRadius: "12px", border: "1px solid #3b82f6", background: "rgba(59, 130, 246, 0.03)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <div>
          <span className="tag" style={{ background: "rgba(59, 130, 246, 0.15)", color: "var(--info)", fontSize: "0.75rem" }}>
            🇮🇳 Ayushman Bharat Digital Mission (ABDM)
          </span>
          <h3 className="display" style={{ fontSize: "1.2rem", margin: "0.25rem 0 0", color: "#1e3a8a" }}>
            ABDM sandbox handoff preview (M1 · M2 · M3)
          </h3>
        </div>
        <span className={`tag ${pushed ? "" : "urgent"}`} style={{ fontSize: "0.8rem", padding: "0.3rem 0.6rem" }}>
          {pushed ? "✓ Sandbox preview complete" : "Sandbox simulation — no live ABDM gateway exchange"}
        </span>
      </div>

      {/* 3-Step Milestone Stepper */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem", margin: "1rem 0" }}>
        {/* M1 */}
        <div style={{ padding: "0.75rem", borderRadius: "8px", border: "1px solid #93c5fd", background: "rgba(255,255,255,0.8)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong style={{ fontSize: "0.85rem", color: "#1e40af" }}>M1 · Discovery</strong>
            <span style={{ color: "#10b981", fontWeight: 900, fontSize: "0.9rem" }}>✓</span>
          </div>
          <p style={{ margin: "0.2rem 0 0", fontSize: "0.75rem", color: "var(--ink-soft)" }}>
            ABHA ID: <code style={{ color: "#2563eb" }}>{activeAbha}</code> is a local demo reference; no NHA request was made.
          </p>
        </div>

        {/* M2 */}
        <div style={{ padding: "0.75rem", borderRadius: "8px", border: "1px solid #93c5fd", background: "rgba(255,255,255,0.8)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong style={{ fontSize: "0.85rem", color: "#1e40af" }}>M2 · Linking</strong>
            <span style={{ color: "#10b981", fontWeight: 900, fontSize: "0.9rem" }}>✓</span>
          </div>
          <p style={{ margin: "0.2rem 0 0", fontSize: "0.75rem", color: "var(--ink-soft)" }}>
            Local HIP care-context preview for OPD Record #{encounterId.slice(0, 6).toUpperCase()}.
          </p>
        </div>

        {/* M3 */}
        <div style={{ padding: "0.75rem", borderRadius: "8px", border: pushed ? "1px solid #10b981" : "1px solid #f59e0b", background: pushed ? "rgba(16, 185, 129, 0.08)" : "rgba(255,255,255,0.8)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong style={{ fontSize: "0.85rem", color: pushed ? "#065f46" : "#b45309" }}>M3 · Data Exchange</strong>
            <span style={{ color: pushed ? "#10b981" : "#f59e0b", fontWeight: 900, fontSize: "0.9rem" }}>
              {pushed ? "✓" : "⏳"}
            </span>
          </div>
          <p style={{ margin: "0.2rem 0 0", fontSize: "0.75rem", color: "var(--ink-soft)" }}>
            {pushed ? "Local preview marked complete. No FHIR data was sent outside MediKiosk." : "Local FHIR export is ready for a future gateway integration."}
          </p>
        </div>
      </div>

      {/* Action Row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            type="button"
            className="button-primary"
            disabled={pushing || pushed}
            onClick={handleSimulatePush}
            style={{ fontSize: "0.85rem", padding: "0.45rem 0.9rem" }}
          >
            {pushing ? "Preparing local preview…" : pushed ? "✓ Local sandbox preview complete" : "▶ Run sandbox handoff preview"}
          </button>
          <button
            type="button"
            className="button-secondary"
            onClick={() => setShowPayload((s) => !s)}
            style={{ fontSize: "0.85rem", padding: "0.45rem 0.9rem" }}
          >
            {showPayload ? "Hide local preview payload" : "🔍 Inspect local preview payload"}
          </button>
        </div>

        <small style={{ color: "var(--ink-soft)" }}>
          Reference endpoint (not called): <code style={{ fontSize: "0.75rem" }}>dev.abdm.gov.in/gateway/v0.5/health-information/hip/on-request</code>
        </small>
      </div>

      {/* Payload Viewer */}
      {showPayload && (
        <div style={{ marginTop: "1rem" }}>
          <pre style={{ background: "#0f172a", color: "#38bdf8", padding: "1rem", borderRadius: "8px", fontSize: "0.8rem", maxHeight: "220px", overflow: "auto", whiteSpace: "pre-wrap" }}>
            {JSON.stringify(
              {
                requestId: `req-${encounterId.slice(0, 8)}`,
                simulation: true,
                gatewayRequestMade: false,
                timestamp: simulationMetadata?.timestamp ?? "Generated when the local preview runs",
                transactionId: simulationMetadata?.transactionId ?? "Generated when the local preview runs",
                hipId: "IN29100012-APEX-HOSPITAL",
                patient: {
                  id: activeAbha,
                  encounterId: encounterId,
                },
                localBundlePreview: bundleData || {
                  resourceType: "Bundle",
                  type: "collection",
                  entryCount: 4,
                  validation: "local_structural_validation_passed",
                },
              },
              null,
              2
            )}
          </pre>
        </div>
      )}
    </div>
  );
}
