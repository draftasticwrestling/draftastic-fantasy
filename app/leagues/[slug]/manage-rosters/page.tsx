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
  if (!league) return { title: "Manage Rosters — Draftastic Fantasy" };
  return {
    title: `Manage Rosters — ${league.name} — Draftastic Fantasy`,
    description: "Manually add or remove wrestlers from any team roster (offline draft, corrections).",
  };
}

export default async function ManageRostersPage({
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
        Manage Rosters
      </h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: 24, maxWidth: 560 }}>
        As the General Manager, you can manually add or remove wrestlers from any team&apos;s roster. Use this after an offline draft to enter results, or to fix drafting errors. Team owners cannot edit rosters directly; they submit add/drop requests that you approve or decline on Pending Transactions.
      </p>
      <p style={{ color: "var(--color-text-muted)", fontStyle: "italic" }}>
        This page is not ready yet. Check back later.
      </p>
    </main>
  );
}
