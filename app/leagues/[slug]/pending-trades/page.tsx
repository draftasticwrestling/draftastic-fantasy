import Link from "next/link";
import { notFound } from "next/navigation";
import { getLeagueBySlug } from "@/lib/leagues";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) return { title: "Pending Transactions — Draftastic Fantasy" };
  return {
    title: `Pending Transactions — ${league.name} — Draftastic Fantasy`,
    description: "Review and approve or decline pending roster adds, drops, and trades for the league.",
  };
}

export default async function PendingTransactionsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) notFound();

  return (
    <main className="app-page">
      <p style={{ marginBottom: 24 }}>
        <Link href={`/leagues/${slug}`} className="app-link">
          ← {league.name}
        </Link>
      </p>
      <h1 style={{ fontSize: "1.5rem", marginBottom: 8, color: "var(--color-text)" }}>
        Pending Transactions
      </h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: 24, maxWidth: 560 }}>
        As the General Manager, you can see all pending roster adds, drops, and trades for the league here. Accept or decline each request to approve or reject the change.
      </p>
      <p style={{ color: "var(--color-text-muted)", fontStyle: "italic" }}>
        This page is not ready yet. Check back later.
      </p>
    </main>
  );
}
