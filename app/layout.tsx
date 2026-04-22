import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import RootShell from "./components/RootShell";
import { getRecentEvents } from "@/lib/eventsRecent";
const GA_MEASUREMENT_ID = "G-NQSQEP66V2";
const ADSENSE_CLIENT_ID = "ca-pub-8084818325632971";

export const metadata: Metadata = {
  title: "Draftastic Pro Wrestling",
  description: "Event results, fantasy leagues, and pro wrestling coverage.",
};

/** Lets `env(safe-area-inset-*)` work on notched phones; helps bottom sheets stay on-screen */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const recentEvents = await getRecentEvents(15);

  return (
    <html lang="en">
      <body>
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script id="gtag-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}');
          `}
        </Script>
        <Script
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`}
          strategy="afterInteractive"
          crossOrigin="anonymous"
        />
        <RootShell recentEvents={recentEvents}>{children}</RootShell>
      </body>
    </html>
  );
}
