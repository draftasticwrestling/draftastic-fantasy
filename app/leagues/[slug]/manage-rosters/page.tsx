import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerAuth } from "@/lib/supabase/serverAuth";
import { getLeagueBySlug, getLeagueMembers, getRostersForLeague } from "@/lib/leagues";
import { getRosterRulesForLeague } from "@/lib/leagueStructure";
import { isDraftableWrestler, normalizeWrestlerRowFromApi } from "@/lib/leagueDraft";
import { RostersSection } from "../RostersSection";

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
    description: "Manually add or remove wrestlers from any faction roster (offline draft, corrections).",
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
  const members = await getLeagueMembers(league.id);
  const rosters = await getRostersForLeague(league.id);
  const rosterRules = getRosterRulesForLeague(members.length, league.season_slug ?? null);

  const { supabase } = await getServerAuth();
  const { data: result } = await supabase
    .from("wrestlers")
    .select('id, name, gender, status, "Status", brand, classification, "Classification"')
    .order("name", { ascending: true });

  const rawRows = (result ?? []) as Record<string, unknown>[];
  const wrestlers = rawRows
    .map((r) => {
      const id = String(r.id ?? r.Id ?? "");
      const name = String(r.name ?? r.Name ?? r.id ?? r.Id ?? "");
      const norm = normalizeWrestlerRowFromApi(r);
      const rawGender = r.gender ?? r.Gender;
      const gender = rawGender != null && String(rawGender).trim() !== "" ? String(rawGender) : null;
      return { ...r, id, name, gender, ...norm };
    })
    .filter((w) => w.id && isDraftableWrestler(w))
    .map((w) => ({ id: w.id, name: w.name ?? w.id, gender: w.gender ?? null }));

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
        As the GM, you can manually add or remove wrestlers from any faction&apos;s roster. Use this after an offline draft to enter results, or to fix drafting errors. Managers cannot edit rosters directly; they submit add/drop requests that you approve or decline on Pending Transactions.
      </p>
      <div className="lm-card">
        <RostersSection
          leagueId={league.id}
          leagueSlug={slug}
          members={members}
          rosters={rosters}
          wrestlers={wrestlers}
          isCommissioner={league.role === "commissioner"}
          rosterRules={rosterRules}
          teamCount={members.length}
        />
      </div>
    </main>
  );
}
