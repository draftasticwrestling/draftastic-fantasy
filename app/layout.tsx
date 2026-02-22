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
        <Nav />
        <PageLayout>{children}</PageLayout>
      </body>
    </html>
  );
}
