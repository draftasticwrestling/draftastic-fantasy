import Link from "next/link";

export default function WrestlerNotFound() {
  return (
    <div style={{ padding: 24, maxWidth: 560, margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: 8 }}>Wrestler not found</h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: 20 }}>
        That wrestler isn’t in the draft pool or the link may be wrong.
      </p>
      <Link href="/wrestlers" style={{ color: "var(--color-blue)", textDecoration: "none", fontWeight: 600 }}>
        ← Back to Wrestlers
      </Link>
    </div>
  );
}
