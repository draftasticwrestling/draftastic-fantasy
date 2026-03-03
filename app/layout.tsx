import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import Nav from "./components/Nav";
import PageLayout from "./components/PageLayout";

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
        <body>{children}</body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body>
        <Nav />
        <PageLayout>{children}</PageLayout>
      </body>
    </html>
  );
}
