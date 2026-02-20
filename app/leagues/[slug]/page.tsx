import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLeagueBySlug, getLeagueMembers, getRostersForLeague } from "@/lib/leagues";
import { getRosterRulesForLeague } from "@/lib/leagueStructure";
import { getSeasonBySlug } from "@/lib/leagueSeasons";
import { InviteButton } from "../InviteButton";
import { RostersSection } from "./RostersSection";
import { updateDraftDateAction } from "./actions";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) return { title: "Private League — Draftastic Fantasy" };
  return {
    title: `${league.name} — Draftastic Fantasy`,
    description: `Private League (MVL): ${league.name} — season-only rosters`,
  };
}

export default async function LeagueDetailPage({ params }: Props) {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) notFound();

  const [members, rosters, wrestlersResult] = await Promise.all([
    getLeagueMembers(league.id),
    getRostersForLeague(league.id),
    (async () => {
      const supabase = await createClient();
      const { data } = await supabase
        .from("wrestlers")
        .select("id, name, gender")
        .order("name", { ascending: true });
      return (data ?? []) as { id: string; name: string | null; gender: string | null }[];
    })(),
  ]);

  return (
    <main
      style={{
        fontFamily: "system-ui, sans-serif",
        padding: 24,
        maxWidth: 640,
        margin: "0 auto",
        fontSize: 16,
        lineHeight: 1.5,
      }}
    >
      <p style={{ marginBottom: 24 }}>
        <Link href="/leagues" style={{ color: "#1a73e8", textDecoration: "none" }}>
          ← My leagues
        </Link>
      </p>
      <h1 style={{ marginBottom: 8, fontSize: "1.5rem" }}>{league.name}</h1>
      {(league.start_date || league.end_date) && (
        <p style={{ color: "#555", marginBottom: 8 }}>
          {league.start_date && league.end_date
            ? `${league.start_date} – ${league.end_date}`
            : league.start_date || league.end_date}
        </p>
      )}
      {league.season_slug && (
        <p style={{ color: "#555", marginBottom: 8, fontSize: 14 }}>
          Season: {getSeasonBySlug(league.season_slug)?.name ?? league.season_slug}
          {league.draft_date && ` · Draft: ${league.draft_date} (points from first event after draft)`}
        </p>
      )}
      <p style={{ marginBottom: 16, fontSize: 14, color: "#666" }}>
        {league.role === "commissioner" ? "You are the commissioner." : "Member."}
      </p>

      {league.role === "commissioner" && (
        <div style={{ marginBottom: 24 }}>
          <InviteButton leagueId={league.id} leagueName={league.name} />
        </div>
      )}

      <section
        style={{
          marginBottom: 24,
          padding: 16,
          background: "#f8f8f8",
          borderRadius: 8,
          border: "1px solid #e8e8e8",
        }}
      >
        <h2 style={{ fontSize: "1.1rem", marginBottom: 12 }}>Draft</h2>
        <p style={{ fontSize: 14, color: "#666", marginBottom: 12 }}>
          Draft status: <strong>{league.draft_status === "in_progress" ? "In progress" : league.draft_status === "completed" ? "Completed" : "Not started"}</strong>
          {league.draft_style && league.draft_status === "not_started" && (
            <> · Type: {league.draft_style === "linear" ? "Linear" : "Snake"}</>
          )}
        </p>
        <p style={{ fontSize: 14, color: "#666", marginBottom: 12 }}>
          {league.draft_date ? (
            <>Draft date: <strong>{league.draft_date}</strong> (points from first event after this date)</>
          ) : (
            "Draft date not set."
          )}
        </p>
        {league.role === "commissioner" && (
          <>
            <form
              action={async (formData: FormData) => {
                await updateDraftDateAction(slug, formData);
              }}
              style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end", marginBottom: 16 }}
            >
              <div>
                <label htmlFor="draft-date" style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
                  Draft date
                </label>
                <input
                  id="draft-date"
                  type="date"
                  name="draft_date"
                  defaultValue={league.draft_date ?? ""}
                  style={{
                    padding: "8px 12px",
                    fontSize: 14,
                    border: "1px solid #ccc",
                    borderRadius: 6,
                  }}
                />
              </div>
              <button
                type="submit"
                style={{
                  padding: "8px 16px",
                  background: "#333",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Save draft date
              </button>
            </form>
            <p style={{ fontSize: 14, color: "#666", marginBottom: 12 }}>
              Set draft type (snake or linear) and generate a randomized draft order. Then run the live draft pick-by-pick.
            </p>
            <Link
              href={`/leagues/${slug}/draft`}
              style={{
                display: "inline-block",
                padding: "10px 20px",
                background: "#1a73e8",
                color: "#fff",
                textDecoration: "none",
                borderRadius: 8,
                fontSize: 16,
                fontWeight: 600,
              }}
            >
              Open draft
            </Link>
          </>
        )}
        {league.role !== "commissioner" && (
          <Link href={`/leagues/${slug}/draft`} style={{ color: "#1a73e8" }}>
            View draft
          </Link>
        )}
      </section>

      <h2 style={{ fontSize: "1.1rem", marginBottom: 12 }}>Members</h2>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {members.map((m) => (
          <li
            key={m.id}
            style={{
              padding: "10px 0",
              borderBottom: "1px solid #eee",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span style={{ fontWeight: 500 }}>
              {m.display_name?.trim() || "Unknown"}
            </span>
            <span style={{ fontSize: 14, color: "#666" }}>
              {m.role === "commissioner" ? "(Commissioner)" : ""}
            </span>
          </li>
        ))}
      </ul>

      <RostersSection
        leagueId={league.id}
        leagueSlug={slug}
        members={members}
        rosters={rosters}
        wrestlers={wrestlersResult}
        isCommissioner={league.role === "commissioner"}
        rosterRules={getRosterRulesForLeague(members.length)}
        teamCount={members.length}
      />
    </main>
  );
}
