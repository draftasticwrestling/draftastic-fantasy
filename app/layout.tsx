import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import RootShell from "./components/RootShell";
import { SeoSiteJsonLd } from "./components/SeoSiteJsonLd";
import { getAdsenseClientCa, isAdsenseScriptEnabled } from "@/lib/adsenseConfig";
import { getRecentEvents } from "@/lib/eventsRecent";
import {
  SEO_DEFAULT_DESCRIPTION,
  SEO_DEFAULT_KEYWORDS,
  SEO_DEFAULT_OG_IMAGE_PATH,
  SEO_SITE_NAME,
} from "@/lib/seoDefaults";
import { getSitePublicOrigin } from "@/lib/sitePublicOrigin";

const GA_MEASUREMENT_ID = "G-NQSQEP66V2";

const googleSiteVerification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim();

const siteOrigin = getSitePublicOrigin();

export const metadata: Metadata = {
  metadataBase: new URL(`${siteOrigin}/`),
  title: {
    default: SEO_SITE_NAME,
    template: `%s · ${SEO_SITE_NAME}`,
  },
  description: SEO_DEFAULT_DESCRIPTION,
  applicationName: SEO_SITE_NAME,
  keywords: [...SEO_DEFAULT_KEYWORDS],
  authors: [{ name: SEO_SITE_NAME, url: siteOrigin }],
  creator: SEO_SITE_NAME,
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteOrigin,
    siteName: SEO_SITE_NAME,
    title: SEO_SITE_NAME,
    description: SEO_DEFAULT_DESCRIPTION,
    images: [
      {
        url: SEO_DEFAULT_OG_IMAGE_PATH,
        alt: `${SEO_SITE_NAME} — fantasy wrestling and event results`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SEO_SITE_NAME,
    description: SEO_DEFAULT_DESCRIPTION,
    images: [SEO_DEFAULT_OG_IMAGE_PATH],
  },
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
        <SeoSiteJsonLd />
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
