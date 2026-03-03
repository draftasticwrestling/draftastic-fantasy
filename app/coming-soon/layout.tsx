import type { Metadata } from "next";
import Link from "next/link";
import "./layout.css";

export const metadata: Metadata = {
  title: "Coming Soon — Draftastic Pro Wrestling",
  description: "The #1 fantasy pro wrestling game is coming. Join the list for launch updates.",
};

export default function ComingSoonLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="coming-soon-root">
      <header className="coming-soon-header">
        <span className="coming-soon-logo">Draftastic Pro Wrestling</span>
      </header>
      <main className="coming-soon-main">{children}</main>
      <footer className="coming-soon-footer">
        <Link href="https://www.prowrestlingboxscore.com" target="_blank" rel="noopener noreferrer">
          Pro Wrestling Boxscore
        </Link>
      </footer>
    </div>
  );
}
