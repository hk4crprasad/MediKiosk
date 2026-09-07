"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CurrentPatient, getPatientMe, logoutPatient } from "@/lib/api";
import { DashboardShell, DashboardNavItem } from "@/components/common/dashboard-shell";

const NAV: DashboardNavItem[] = [{ href: "/patient/dashboard", label: "My dashboard" }];

export default function PatientDashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [account, setAccount] = useState<CurrentPatient | null>(null);
  const [checked, setChecked] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      const token = sessionStorage.getItem("medikiosk.patient_token");
      if (!token) {
        router.replace("/patient/login");
        return;
      }
      try {
        setAccount(await getPatientMe(token));
      } catch {
        sessionStorage.removeItem("medikiosk.patient_token");
        router.replace("/patient/login");
        return;
      }
      setChecked(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [router]);

  async function signOut() {
    const token = sessionStorage.getItem("medikiosk.patient_token");
    setSigningOut(true);
    if (token) {
      try {
        await logoutPatient(token);
      } catch {
        // Continue clearing the local session regardless.
      }
    }
    sessionStorage.removeItem("medikiosk.patient_token");
    router.replace("/patient/login");
  }

  if (!checked || !account) {
    return <main className="page-wrap"><section className="form-shell"><div className="panel"><p className="panel-copy">Opening your dashboard…</p></div></section></main>;
  }

  return (
    <DashboardShell
      className="patient-page"
      identityLine1={account.display_name || account.email}
      identityLine2="Registered patient"
      navItems={NAV}
      onSignOut={signOut}
      roleLabel="Patient portal"
      signingOut={signingOut}
    >
      {children}
    </DashboardShell>
  );
}
