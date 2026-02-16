import type { Metadata } from "next";
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
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>
        <div style={{ maxHeight: 380, overflow: "hidden" }}>
          <img
            src="/banner.png"
            alt="Draftastic Pro Wrestling Fantasy"
            style={{
              width: "100%",
              display: "block",
              verticalAlign: "top",
              objectFit: "cover",
              maxHeight: 380,
            }}
          />
        </div>
        <Nav />
        <PageLayout>{children}</PageLayout>
      </body>
    </html>
  );
}
