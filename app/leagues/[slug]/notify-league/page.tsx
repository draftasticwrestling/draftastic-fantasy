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
  if (!league) return { title: "Notify League — Draftastic Fantasy" };
  return {
    title: `Notify League — ${league.name} — Draftastic Fantasy`,
    description: "Send announcements to the league (shown on the league page and by email).",
  };
}

export default async function NotifyLeaguePage({
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
        Notify League
      </h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: 24, maxWidth: 560 }}>
        As the General Manager, you can send messages to the whole league. Your message will appear on the League main page and will be emailed to all league members. Use this for draft reminders, deadlines, or other announcements.
      </p>
      <p style={{ color: "var(--color-text-muted)", fontStyle: "italic" }}>
        This page is not ready yet. Check back later.
      </p>
    </main>
  );
}
