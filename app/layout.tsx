import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import RootShell from "./components/RootShell";
import { getAdsenseClientCa, isAdsenseScriptEnabled } from "@/lib/adsenseConfig";
import { getRecentEvents } from "@/lib/eventsRecent";

const GA_MEASUREMENT_ID = "G-NQSQEP66V2";

const googleSiteVerification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim();

export const metadata: Metadata = {
  title: "Draftastic Pro Wrestling",
  description: "Event results, fantasy leagues, and pro wrestling coverage.",
  ...(googleSiteVerification
    ? { verification: { google: googleSiteVerification } }
    : {}),
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
        {isAdsenseScriptEnabled() ? (
          <Script
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(getAdsenseClientCa())}`}
            strategy="afterInteractive"
            crossOrigin="anonymous"
          />
        ) : null}
        <RootShell recentEvents={recentEvents}>{children}</RootShell>
      </body>
    </html>
  );
}
