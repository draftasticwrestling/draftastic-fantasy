import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import Nav from "./components/Nav";
import PageLayout from "./components/PageLayout";

const GA_MEASUREMENT_ID = "G-NQSQEP66V2";

const LANDING_DOMAIN = "draftasticprowrestling.com";

export const metadata: Metadata = {
  title: "Draftastic Fantasy",
  description: "Pro wrestling fantasy leagues",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const host = headersList.get("host") ?? "";
  const isLandingDomain = host.toLowerCase().includes(LANDING_DOMAIN);

  if (isLandingDomain) {
    return (
      <html lang="en">
        <head>
          {/* Google tag (gtag.js) - draftasticprowrestling.com */}
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
        <body>{children}</body>
      </html>
    );
  }

  return (
    <html lang="en">
      <head>
        {/* Google tag (gtag.js) - all pages */}
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
        <Nav />
        <PageLayout>{children}</PageLayout>
      </body>
    </html>
  );
}
