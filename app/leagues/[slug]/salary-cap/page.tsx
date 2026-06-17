import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerAuth } from "@/lib/supabase/serverAuth";
import { getLeagueBySlug, getRostersForLeague } from "@/lib/leagues";
import { leagueUsesSalaryCap, SALARY_CAP_BUDGET_DEFAULT } from "@/lib/leagueStructure";
import { buildSalaryCapWrestlerPool } from "@/lib/salaryCapWrestlerPool";
import { leagueOnboardingPath, resolveMemberOnboardingState } from "@/lib/leagueOnboarding";
import { SalaryCapRosterBuilder } from "./SalaryCapRosterBuilder";

type Props = { params: Promise<{ slug: string }> };

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
    .select("user_id, onboarding_completed_at")
    .eq("league_id", league.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) notFound();

  const memberRow = member as { onboarding_completed_at?: string | null };
  const hasCompletedMemberOnboarding = Boolean(memberRow.onboarding_completed_at?.trim());

  const { needsOnboarding } = await resolveMemberOnboardingState(supabase, league.id, league, user.id);
  if (needsOnboarding) {
    redirect(leagueOnboardingPath(slug));
  }

  const leagueRow = league as { salary_cap_budget?: number | null; draft_status?: string | null };
  const budget =
    typeof leagueRow.salary_cap_budget === "number" && leagueRow.salary_cap_budget > 0
      ? leagueRow.salary_cap_budget
      : SALARY_CAP_BUDGET_DEFAULT;

  const poolWithStats = await buildSalaryCapWrestlerPool(supabase, league);
  const poolById = Object.fromEntries(poolWithStats.map((w) => [w.id, w]));
  const stats2026ById = Object.fromEntries(poolWithStats.map((w) => [w.id, w.stats2026 ?? null]));

  const rosters = await getRostersForLeague(league.id);
  const myEntries = rosters[user.id] ?? [];
  const nameById = Object.fromEntries(poolWithStats.map((w) => [w.id, w.name]));
  const imageById = Object.fromEntries(poolWithStats.map((w) => [w.id, w.imageUrl]));

  const costById = Object.fromEntries(poolWithStats.map((p) => [p.id, p.salaryCapCost]));
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
  const isOnboarding = !hasCompletedMemberOnboarding;
  const showFinishInitialRoster = !hasCompletedMemberOnboarding;
  const finishRosterLabel = "Complete setup";
  const rosterSetupComplete = hasCompletedMemberOnboarding;

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
          on multiple factions. When you&apos;re done, use <strong>Complete setup</strong> below to open your faction page.
        </p>
      ) : (
        <p style={{ color: "var(--color-text-muted)", marginBottom: 24, maxWidth: 640 }}>
          Total Season Points scoring with a ${budget} salary cap. Spend your budget on any combination of wrestlers
          ($5–$25 tiers). The same wrestler can be on multiple factions in this league. After the season starts, each
          faction may add and drop up to $25 in wrestler value per week (resets Monday, Pacific Time).
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
        showFinishInitialRoster={showFinishInitialRoster}
        finishRosterLabel={finishRosterLabel}
        rosterSetupComplete={rosterSetupComplete}
      />
    </main>
  );
}
