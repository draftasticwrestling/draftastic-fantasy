import Link from "next/link";
import { notFound } from "next/navigation";
import { getLeagueBySlug } from "@/lib/leagues";
import { EditManagerNoteForm } from "../EditManagerNoteForm";

export const metadata = {
  title: "Edit League Manager Note — Draftastic Fantasy",
  description: "Edit the note shown to league members",
};

export const dynamic = "force-dynamic";

export default async function EditManagerNotePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) notFound();
  if (league.role !== "commissioner") notFound();

  return (
    <main className="app-page" style={{ maxWidth: 640, margin: "0 auto" }}>
      <p style={{ marginBottom: 24 }}>
        <Link href={`/leagues/${slug}`} className="app-link" style={{ fontWeight: 600 }}>
          ← {league.name}
        </Link>
      </p>
      <h1 style={{ fontSize: "1.35rem", marginBottom: 8 }}>Edit League Manager Note</h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: 0 }}>
        This note is shown to all league members on the league overview.
      </p>
      <EditManagerNoteForm leagueSlug={slug} initialNote={league.manager_note ?? null} />
    </main>
  );
}
