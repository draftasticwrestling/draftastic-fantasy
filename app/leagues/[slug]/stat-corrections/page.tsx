import Link from "next/link";
import { notFound } from "next/navigation";
import { getLeagueBySlug } from "@/lib/leagues";
import {
  autolinkWrestlersInMarkdown,
  getCachedWrestlerAutolinkEntries,
} from "@/lib/articleWrestlerAutolink";
import {
  listEventScoreCorrectionsForLeaguePage,
  statCorrectionEventResultsPath,
} from "@/lib/eventScoreCorrections";
import { ArticleMarkdown } from "@/app/components/articles/ArticleMarkdown";

export const metadata = {
  title: "Stat Corrections — Draftastic Fantasy",
  description: "Published notes when event scoring or boxscore data affects this league.",
};

export default async function StatCorrectionsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) notFound();

  const rows = await listEventScoreCorrectionsForLeaguePage(league.id);
  const autolinkEntries = await getCachedWrestlerAutolinkEntries();

  return (
    <main className="app-page" style={{ maxWidth: 720, paddingTop: 10 }}>
      <p style={{ marginBottom: 14 }}>
        <Link href={`/leagues/${encodeURIComponent(slug)}`} className="app-link">
          ← League
        </Link>
      </p>
      <h1 style={{ fontSize: "1.5rem", marginBottom: 8 }}>Stat corrections</h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: 28, lineHeight: 1.55 }}>
        When main-event results or match data are updated after scores were calculated, we post a short explanation here
        so your league knows why points may have changed.
      </p>

      {rows.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)" }}>No published corrections yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 28 }}>
          {rows.map((r) => {
            const eventPath = statCorrectionEventResultsPath(r.event_id);
            return (
              <li
                key={r.id}
                style={{
                  paddingBottom: 24,
                  borderBottom: "1px solid var(--color-border)",
                }}
              >
                <h2 style={{ fontSize: "1.15rem", margin: "0 0 6px" }}>{r.title}</h2>
                <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: "0 0 12px" }}>
                  Event:{" "}
                  {eventPath ? (
                    <Link href={eventPath} className="app-link">
                      {r.event_id}
                    </Link>
                  ) : (
                    <span style={{ color: "var(--color-text)" }}>Platform / scoring (not tied to one event)</span>
                  )}
                  {" · "}
                  Posted {r.visible_at?.slice(0, 10) ?? ""}
                  {r.league_id == null ? " · All leagues" : ""}
                </p>
                <ArticleMarkdown
                  markdown={
                    r.body_markdown?.trim()
                      ? autolinkWrestlersInMarkdown(r.body_markdown, autolinkEntries)
                      : "_No details._"
                  }
                />
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
