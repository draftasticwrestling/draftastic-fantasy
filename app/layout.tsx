import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import Nav from "./components/Nav";
import PageLayout from "./components/PageLayout";
import EventListBar from "./components/EventListBar";
import { getRecentEvents } from "@/lib/eventsRecent";
const GA_MEASUREMENT_ID = "G-NQSQEP66V2";

export const metadata: Metadata = {
  title: "Draftastic Pro Wrestling",
  description: "Event results, fantasy leagues, and pro wrestling coverage.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const pathname = headersList.get("x-draftastic-pathname") ?? "";
  const isInternalAdminShell = pathname.startsWith("/internal-admin");

  const recentEvents = isInternalAdminShell ? [] : await getRecentEvents(15);

  return (
    <html lang="en">
      <head>
        <script
          async
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_MEASUREMENT_ID}');
            `,
          }}
        />
      </head>
      <body>
        {isInternalAdminShell ? (
          children
        ) : (
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
        )}
      </body>
    </html>
  );
}
