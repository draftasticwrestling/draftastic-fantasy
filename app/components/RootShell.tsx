"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import EventListBar from "./EventListBar";
import Nav from "./Nav";
import PageLayout from "./PageLayout";
import LoginNudges from "./LoginNudges";
import type { RecentEvent } from "@/lib/eventsRecent";

type RootShellProps = {
  children: React.ReactNode;
  recentEvents: RecentEvent[];
};

export default function RootShell({ children, recentEvents }: RootShellProps) {
  const pathname = usePathname() ?? "";
  const isInternalAdminShell = pathname.startsWith("/internal-admin");

  useEffect(() => {
    if (typeof window === "undefined" || isInternalAdminShell) return;

    const SESSION_KEY = "draftastic_logged_in_session_last_seen_ms";
    const now = Date.now();
    const lastSeenMs = Number(window.localStorage.getItem(SESSION_KEY) ?? "0");
    const newSession = !Number.isFinite(lastSeenMs) || now - lastSeenMs > 30 * 60 * 1000;
    window.localStorage.setItem(SESSION_KEY, String(now));

    fetch("/api/engagement/page-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      keepalive: true,
      body: JSON.stringify({ path: pathname, newSession }),
    }).catch(() => {});
  }, [pathname, isInternalAdminShell]);

  if (isInternalAdminShell) return <>{children}</>;

  return (
    <>
      <EventListBar events={recentEvents} />
      <div className="nav-sticky-wrap">
        <Nav />
      </div>
      <div className="site-main">
        <PageLayout>{children}</PageLayout>
      </div>
      <LoginNudges />
      <footer className="site-footer">
        <p className="site-footer-copy">© 2026 Draftastic Wrestling. All rights reserved.</p>
        <p className="site-footer-disclaimer">
          WWE, Raw, SmackDown, and all related logos and trademarks are the property of World Wrestling Entertainment, Inc. This site is not affiliated with or endorsed by WWE.
        </p>
      </footer>
    </>
  );
}
