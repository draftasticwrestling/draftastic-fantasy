import Link from "next/link";

export const metadata = {
  title: "News — Draftastic",
  description: "Fantasy wrestling commentary and articles.",
};

export default function NewsPage() {
  return (
    <main className="app-page" style={{ maxWidth: 640 }}>
      <p style={{ marginBottom: 16 }}>
        <Link href="/" className="app-link">← Home</Link>
      </p>
      <h1 style={{ fontSize: "1.5rem", marginBottom: 12 }}>News</h1>
      <p style={{ color: "var(--color-text-muted)", lineHeight: 1.6 }}>
        Article publishing is coming soon. Editors will post fantasy-focused wrestling commentary here once the admin tools and database are wired up.
      </p>
      <p style={{ marginTop: 20 }}>
        <Link href="/event-results" className="app-link">Event results →</Link>
      </p>
    </main>
  );
}
