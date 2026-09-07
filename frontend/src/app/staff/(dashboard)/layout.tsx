"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CurrentUser, getMe, logout } from "@/lib/api";
import { DashboardShell, DashboardNavItem } from "@/components/common/dashboard-shell";

const BASE_NAV: DashboardNavItem[] = [
  { href: "/staff/triage", label: "Triage queue" },
  { href: "/staff/kiosk-encounters", label: "Kiosk encounters" },
  { href: "/staff/patients", label: "Registered patients" },
];
const ADMIN_NAV: DashboardNavItem = { href: "/staff/admin/users", label: "Staff admin" };

export default function StaffDashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [checked, setChecked] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      const token = sessionStorage.getItem("medikiosk.staff_token");
      if (!token) {
        router.replace("/staff/login");
        return;
      }
      try {
        setUser(await getMe(token));
      } catch {
        sessionStorage.removeItem("medikiosk.staff_token");
        router.replace("/staff/login");
        return;
      }
      setChecked(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [router]);

  async function signOut() {
    const token = sessionStorage.getItem("medikiosk.staff_token");
    setSigningOut(true);
    if (token) {
      try {
        await logout(token);
      } catch {
        // Continue clearing the local session regardless.
      }
    }
    sessionStorage.removeItem("medikiosk.staff_token");
    router.replace("/staff/login");
  }

  if (!checked || !user) {
    return <main className="page-wrap"><section className="form-shell"><div className="panel"><p className="panel-copy">Opening staff workspace…</p></div></section></main>;
  }

  const navItems = user.role === "admin" ? [...BASE_NAV, ADMIN_NAV] : BASE_NAV;

  return (
    <DashboardShell
      identityLine1={user.email}
      identityLine2={user.role}
      navItems={navItems}
      onSignOut={signOut}
      roleLabel="Staff workspace"
      signingOut={signingOut}
    >
      {children}
    </DashboardShell>
  );
}
