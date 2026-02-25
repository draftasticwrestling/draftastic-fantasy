import Link from "next/link";

type Props = {
  title?: string;
  leagueSlug?: string;
};

export default function UnderConstruction({ title = "Under Construction", leagueSlug }: Props) {
  return (
    <main
      className="app-page"
      style={{
        maxWidth: 560,
        margin: "0 auto",
        padding: "var(--page-padding-y) var(--page-padding-x)",
        textAlign: "center",
      }}
    >
      <h1 style={{ fontSize: "1.5rem", marginBottom: 8 }}>{title}</h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: 24 }}>
        This page is not ready yet. Check back later.
      </p>
      {leagueSlug ? (
        <Link href={`/leagues/${leagueSlug}`} className="app-link" style={{ fontWeight: 600 }}>
          ← Back to league
        </Link>
      ) : (
        <Link href="/" className="app-link" style={{ fontWeight: 600 }}>
          ← Home
        </Link>
      )}
    </main>
  );
}
