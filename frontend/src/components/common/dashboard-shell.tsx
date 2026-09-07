"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export type DashboardNavItem = {
  href: string;
  label: string;
};

type DashboardShellProps = {
  roleLabel: string;
  navItems: DashboardNavItem[];
  identityLine1: string;
  identityLine2?: string;
  onSignOut: () => void;
  signingOut?: boolean;
  /** Extra class on the shell root — e.g. "patient-page" for the larger, higher-contrast
   * type sizing that applies there (see globals.css). */
  className?: string;
  children: React.ReactNode;
};

/** Persistent sidebar shell for the staff and patient-portal apps. Never used by the
 * kiosk or the OPD TV board — both are intentionally full-bleed and chrome-free. */
export function DashboardShell({
  roleLabel,
  navItems,
  identityLine1,
  identityLine2,
  onSignOut,
  signingOut,
  className,
  children,
}: DashboardShellProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className={`dashboard-shell ${className ?? ""}`}>
      <div aria-hidden="true" className={`dashboard-backdrop ${menuOpen ? "open" : ""}`} onClick={() => setMenuOpen(false)} />
      <aside className={`dashboard-sidebar ${menuOpen ? "open" : ""}`}>
        <Link className="brand" href="/"><span className="brand-mark"><span>✦</span></span>MediKiosk</Link>
        <p className="dashboard-role-label">{roleLabel}</p>
        <nav aria-label={roleLabel} className="dashboard-nav">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
            return (
              <Link className={isActive ? "active" : ""} href={item.href} key={item.href} onClick={() => setMenuOpen(false)}>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="dashboard-identity">
          <strong>{identityLine1}</strong>
          {identityLine2 && <span>{identityLine2}</span>}
          <button className="button-secondary" disabled={signingOut} onClick={onSignOut} type="button">
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </aside>
      <div className="dashboard-main">
        <button className="dashboard-menu-toggle button-secondary" onClick={() => setMenuOpen(true)} type="button">
          ☰ Menu
        </button>
        {children}
      </div>
    </div>
  );
}
