import { notFound, redirect } from "next/navigation";
import { getServerAuth } from "@/lib/supabase/serverAuth";
import { getIsSiteAdmin } from "@/lib/auth/siteAdmin";
import { getLeagueBySlug, getLeagueMembersWithAdminFallback } from "@/lib/leagues";
import { factionDisplayName } from "@/lib/factionName";
import { getTeamScoringAudit } from "@/lib/teamScoring";

type Props = {
  params: Promise<{ slug: string; userId: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props) {
  try {
    const { slug, userId } = await params;
    const league = await getLeagueBySlug(slug);
    if (!league) return { title: "Former roster — Draftastic Fantasy" };
    const members = await getLeagueMembersWithAdminFallback(league.id);
    const m = members.find((x) => x.user_id === userId);
    const name = factionDisplayName(m, "Faction");
    return {
      title: `Full former roster log — ${name} — ${league.name} — Draftastic Fantasy`,
      description: `Complete history of past roster stints for ${name}, including zero-point stays.`,
    };
  } catch {
    return { title: "Former roster — Draftastic Fantasy" };
  }
}

export default async function TeamFormerRosterPage({ params }: Props) {
  const { slug, userId } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) notFound();

  const { supabase, user } = await getServerAuth();
  if (!user) {
    const next = `/leagues/${encodeURIComponent(slug)}/team/${encodeURIComponent(userId)}/former-roster`;
    redirect(`/auth/sign-in?next=${encodeURIComponent(next)}`);
  }

  const members = await getLeagueMembersWithAdminFallback(league.id);
  const isMember = members.some((m) => m.user_id === user.id);
  const isSiteAdminViewer = await getIsSiteAdmin();
  if (!isMember && !isSiteAdminViewer) notFound();

  const teamMember = members.find((m) => m.user_id === userId);
  if (!teamMember) notFound();

  const teamLabel = factionDisplayName(teamMember, "Faction");

  const audit = await getTeamScoringAudit(league.id, userId);
  const formerStints = audit.formerStints;

  const wrestlerIds = [...new Set(formerStints.map((s) => s.wrestlerId))];
  const { data: wrestlers } = wrestlerIds.length
    ? await supabase.from("wrestlers").select("id, name").in("id", wrestlerIds)
    : { data: [] as Array<{ id: string; name: string | null }> };
  const wrestlerNamesMap = Object.fromEntries((wrestlers ?? []).map((w) => [w.id, w.name ?? w.id]));

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ margin: "0 0 8px", fontSize: "1.5rem" }}>Full log — Former {teamLabel}</h1>
      <p style={{ margin: "0 0 20px", fontSize: 14, color: "#666" }}>
        Every past roster stint for this faction, including adds and drops with no fantasy points during the stay.
      </p>

      {formerStints.length === 0 ? (
        <p style={{ color: "#6b7280", fontSize: 14 }}>No former roster history yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {formerStints.map((stint) => (
            <li
              key={`${stint.wrestlerId}-${stint.acquiredAt}-${stint.releasedAt}`}
              style={{
                padding: "10px 0",
                borderBottom: "1px solid #eee",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div>
                <div style={{ fontWeight: 700, color: "#1f2937" }}>
                  {wrestlerNamesMap[stint.wrestlerId] ?? stint.wrestlerId}
                </div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>
                  {stint.acquiredAt} - {stint.releasedAt}
                </div>
              </div>
              <div style={{ fontWeight: 700, color: "#111827" }}>{stint.points.total} pts</div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
