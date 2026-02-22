import type { Metadata } from "next";
import "./globals.css";
import Nav from "./components/Nav";
import PageLayout from "./components/PageLayout";

export const metadata: Metadata = {
  title: "Draftastic Fantasy",
  description: "Pro wrestling fantasy leagues",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="banner-wrap">
          <img
            src="/banner.png"
            alt="Draftastic Pro Wrestling Fantasy"
            className="banner-img"
          />
        </div>
        <Nav />
        <PageLayout>{children}</PageLayout>
      </body>
    </html>
  );
}
