"use client";

import { usePathname } from "next/navigation";
import EventListBar from "./EventListBar";
import Nav from "./Nav";
import PageLayout from "./PageLayout";
import type { RecentEvent } from "@/lib/eventsRecent";

type RootShellProps = {
  children: React.ReactNode;
  recentEvents: RecentEvent[];
};

export default function RootShell({ children, recentEvents }: RootShellProps) {
  const pathname = usePathname() ?? "";
  const isInternalAdminShell = pathname.startsWith("/internal-admin");

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
      <footer className="site-footer">
        <p className="site-footer-copy">© 2026 Draftastic Wrestling. All rights reserved.</p>
        <p className="site-footer-disclaimer">
          WWE, Raw, SmackDown, and all related logos and trademarks are the property of World Wrestling Entertainment, Inc. This site is not affiliated with or endorsed by WWE.
        </p>
      </footer>
    </>
  );
}
