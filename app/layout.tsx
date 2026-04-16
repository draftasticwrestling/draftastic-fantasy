import type { Metadata } from "next";
import "./globals.css";
import RootShell from "./components/RootShell";
import { getRecentEvents } from "@/lib/eventsRecent";
const GA_MEASUREMENT_ID = "G-NQSQEP66V2";
const ADSENSE_CLIENT_ID = "ca-pub-8084818325632971";

export const metadata: Metadata = {
  title: "Draftastic Pro Wrestling",
  description: "Event results, fantasy leagues, and pro wrestling coverage.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const recentEvents = await getRecentEvents(15);

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
        <script
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`}
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <RootShell recentEvents={recentEvents}>{children}</RootShell>
      </body>
    </html>
  );
}
