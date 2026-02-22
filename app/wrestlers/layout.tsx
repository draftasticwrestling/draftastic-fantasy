import Link from "next/link";
import { WrestlersSubNav } from "./WrestlersSubNav";

export default function WrestlersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main
      style={{
        fontFamily: "system-ui, sans-serif",
        padding: 24,
        maxWidth: 1200,
        marginLeft: 0,
        marginRight: "auto",
      }}
    >
      <p style={{ marginBottom: 20 }}>
        <Link href="/" style={{ color: "var(--color-blue)", textDecoration: "none" }}>
          ← Home
        </Link>
      </p>

      <div
        style={{
          background: "var(--color-red)",
          color: "var(--color-text-inverse)",
          padding: "12px 0",
          marginBottom: 0,
          marginLeft: -24,
          marginRight: -24,
          paddingLeft: 24,
          paddingRight: 24,
        }}
      >
        <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700 }}>Wrestlers</h1>
        <p style={{ margin: "4px 0 0", fontSize: 0.9, opacity: 0.95 }}>
          Draft pool and free agents. Add wrestlers to your roster from your league page.
        </p>
      </div>

      <WrestlersSubNav />

      {children}
    </main>
  );
}
