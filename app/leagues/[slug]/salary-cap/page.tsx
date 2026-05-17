import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerAuth } from "@/lib/supabase/serverAuth";
import { getLeagueBySlug, getRostersForLeague } from "@/lib/leagues";
import { leagueIncludesNxt, leagueUsesSalaryCap, SALARY_CAP_BUDGET_DEFAULT } from "@/lib/leagueStructure";
import { isMainBrandWrestlerRosterForLeague } from "@/lib/wrestlerRosterFromBrand";
import { isHiddenCanonicalListSlug } from "@/lib/scoring/personaResolution.js";
import { isValidSalaryCapCost } from "@/lib/salaryCap";
import { loadSalaryCap2026StatsByWrestlerId } from "@/lib/salaryCap2026Stats";
import { loadWrestlerCurrentChampionshipContext } from "@/lib/wrestlerCurrentChampionships";
import { SalaryCapRosterBuilder } from "./SalaryCapRosterBuilder";

type Props = { params: Promise<{ slug: string }> };

function read2kRating(row: Record<string, unknown>, key: string): number | null {
  const v = row[key];
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  return {
    title: league
      ? `Salary cap roster — ${league.name} — Draftastic Fantasy`
      : "Salary cap roster — Draftastic Fantasy",
  };
}

export default async function LeagueSalaryCapPage({ params }: Props) {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) notFound();
  if (!leagueUsesSalaryCap(league.league_type)) {
    redirect(`/leagues/${slug}/draft`);
  }

  const { supabase, user } = await getServerAuth();
  if (!user) redirect(`/auth/sign-in?next=${encodeURIComponent(`/leagues/${slug}/salary-cap`)}`);

  const { data: member } = await supabase
    .from("league_members")
    .select("user_id")
    .eq("league_id", league.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) notFound();

  const leagueRow = league as { salary_cap_budget?: number | null; draft_status?: string | null };
  const budget =
    typeof leagueRow.salary_cap_budget === "number" && leagueRow.salary_cap_budget > 0
      ? leagueRow.salary_cap_budget
      : SALARY_CAP_BUDGET_DEFAULT;

  const poolOpts = { includeNxt: leagueIncludesNxt(league) };
  const [wrestlersResult, championshipContext] = await Promise.all([
    supabase
      .from("wrestlers")
      .select('id, name, brand, image_url, gender, "Status", "2K26 rating", "2K25 rating", salary_cap_cost')
      .order("name", { ascending: true }),
    loadWrestlerCurrentChampionshipContext(supabase),
  ]);
  const wrestlersRaw = wrestlersResult.data;

  const pool = (wrestlersRaw ?? [])
    .filter((w) => {
      const row = w as { id: string; brand?: string | null; salary_cap_cost?: number | null };
      if (isHiddenCanonicalListSlug(row.id)) return false;
      if (!isMainBrandWrestlerRosterForLeague(row.brand, poolOpts)) return false;
      return typeof row.salary_cap_cost === "number" && isValidSalaryCapCost(row.salary_cap_cost);
    })
    .map((w) => {
      const row = w as {
        id: string;
        name: string | null;
        brand?: string | null;
        salary_cap_cost: number;
        image_url?: string | null;
        gender?: string | null;
        Status?: string | null;
        "2K26 rating"?: unknown;
        "2K25 rating"?: unknown;
      };
      const raw = row as Record<string, unknown>;
      const name = row.name ?? row.id;
      const champ = championshipContext.resolve({
        id: row.id,
        name,
        gender: row.gender ?? null,
      });
      return {
        id: row.id,
        name,
        salaryCapCost: row.salary_cap_cost,
        brand: row.brand,
        imageUrl: row.image_url ?? null,
        gender: row.gender ?? null,
        status: (raw.Status ?? raw.status) != null ? String(raw.Status ?? raw.status) : null,
        rating2k26: read2kRating(raw, "2K26 rating"),
        rating2k25: read2kRating(raw, "2K25 rating"),
        currentChampionship: champ.displayLine,
        championBeltImageUrl: champ.beltImageUrl,
      };
    });

  const stats2026ById = await loadSalaryCap2026StatsByWrestlerId(
    supabase,
    pool.map((w) => ({ id: w.id, name: w.name }))
  );

  const poolWithStats = pool.map((w) => ({
    ...w,
    stats2026: stats2026ById[w.id] ?? null,
  }));
  const poolById = Object.fromEntries(poolWithStats.map((w) => [w.id, w]));

  const rosters = await getRostersForLeague(league.id);
  const myEntries = rosters[user.id] ?? [];
  const nameById = Object.fromEntries(pool.map((w) => [w.id, w.name]));
  const imageById = Object.fromEntries(pool.map((w) => [w.id, w.imageUrl]));

  const costById = Object.fromEntries(pool.map((p) => [p.id, p.salaryCapCost]));
  const roster = myEntries.map((e) => {
    const p = poolById[e.wrestler_id];
    return {
      wrestlerId: e.wrestler_id,
      name: nameById[e.wrestler_id] ?? e.wrestler_id,
      salaryCapCost: costById[e.wrestler_id] ?? 0,
      imageUrl: imageById[e.wrestler_id] ?? null,
      stats2026: stats2026ById[e.wrestler_id] ?? null,
      brand: p?.brand ?? null,
      status: p?.status ?? null,
      currentChampionship: p?.currentChampionship ?? null,
      championBeltImageUrl: p?.championBeltImageUrl ?? null,
    };
  });

  let spent = 0;
  for (const r of roster) {
    if (r.salaryCapCost > 0) spent += r.salaryCapCost;
  }

  const draftStatus = leagueRow.draft_status ?? null;
  const isCommissioner = league.commissioner_id === user.id;
  const isOnboarding = myEntries.length === 0;

  return (
    <main className="app-page salary-cap-page" style={{ maxWidth: 1100 }}>
      <p style={{ marginBottom: 16 }}>
        <Link href={`/leagues/${slug}?skip_salary_cap=1`} className="app-link">
          ← {league.name}
        </Link>
      </p>
      <h1 style={{ marginTop: 0, marginBottom: 8 }}>Build your salary cap roster</h1>
      {isOnboarding ? (
        <p
          style={{
            marginBottom: 20,
            padding: "12px 14px",
            borderRadius: 8,
            background: "var(--color-bg-elevated)",
            border: "1px solid var(--color-border)",
            maxWidth: 640,
          }}
        >
          Welcome to <strong>{league.name}</strong>. Pick wrestlers within your ${budget} budget — the same star can be
          on multiple factions. When you&apos;re done, return to the league home anytime to invite managers or check
          standings.
        </p>
      ) : (
        <p style={{ color: "var(--color-text-muted)", marginBottom: 24, maxWidth: 640 }}>
          Total Season Points scoring with a ${budget} salary cap. Spend your budget on any combination of wrestlers
          ($5–$25 tiers). The same wrestler can be on multiple factions in this league.
        </p>
      )}

      <SalaryCapRosterBuilder
        leagueSlug={slug}
        budget={budget}
        spent={spent}
        roster={roster}
        pool={poolWithStats}
        isCommissioner={isCommissioner}
        draftStatus={draftStatus}
      />
    </main>
  );
}
