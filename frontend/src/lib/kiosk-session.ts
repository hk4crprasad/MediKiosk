"use client";

import { useEffect, useRef, useState } from "react";

const KIOSK_STORAGE_KEYS = ["medikiosk.kiosk_token", "medikiosk.language"] as const;
const DEFAULT_IDLE_TIMEOUT_MS = 180_000;
const IDLE_WARNING_MS = 15_000;

function configuredIdleTimeoutMs(): number {
  const configured = Number(process.env.NEXT_PUBLIC_KIOSK_IDLE_TIMEOUT_MS);
  if (!Number.isFinite(configured) || configured < 30_000) {
    return DEFAULT_IDLE_TIMEOUT_MS;
  }
  return configured;
}

export function clearKioskSession(): void {
  for (const key of KIOSK_STORAGE_KEYS) {
    window.sessionStorage.removeItem(key);
  }
}

type KioskSessionResetOptions = {
  active: boolean;
  onTimeout: () => void;
};

export function useKioskSessionReset({ active, onTimeout }: KioskSessionResetOptions) {
  const [showIdleWarning, setShowIdleWarning] = useState(false);
  const onTimeoutRef = useRef(onTimeout);

  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  useEffect(() => {
    if (!active) {
      const hideWarningTimer = window.setTimeout(() => setShowIdleWarning(false), 0);
      return () => window.clearTimeout(hideWarningTimer);
    }

    const idleTimeoutMs = configuredIdleTimeoutMs();
    const warningDelayMs = Math.max(0, idleTimeoutMs - IDLE_WARNING_MS);
    let warningTimer: number | undefined;
    let resetTimer: number | undefined;

    const reset = () => {
      clearKioskSession();
      onTimeoutRef.current();
    };

    const startTimers = () => {
      window.clearTimeout(warningTimer);
      window.clearTimeout(resetTimer);
      window.setTimeout(() => setShowIdleWarning(false), 0);
      warningTimer = window.setTimeout(() => setShowIdleWarning(true), warningDelayMs);
      resetTimer = window.setTimeout(reset, idleTimeoutMs);
    };

    const noteActivity = () => startTimers();
    const events = ["pointerdown", "touchstart", "keydown", "scroll"] as const;
    events.forEach((event) => window.addEventListener(event, noteActivity, { passive: true }));
    startTimers();

    return () => {
      window.clearTimeout(warningTimer);
      window.clearTimeout(resetTimer);
      events.forEach((event) => window.removeEventListener(event, noteActivity));
    };
  }, [active]);

  return { showIdleWarning };
}
