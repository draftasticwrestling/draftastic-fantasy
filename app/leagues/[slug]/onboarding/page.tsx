import { getLeagueBySlug, getLeagueMembers } from "@/lib/leagues";
import { getServerAuth } from "@/lib/supabase/serverAuth";
import { assertOnboardingRequired } from "./actions";
import { leagueIncludesNxt } from "@/lib/leagueStructure";
import { LeagueOnboardingWizard } from "./LeagueOnboardingWizard";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ error?: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  return {
    title: league
      ? `Set up your faction — ${league.name} — Draftastic Fantasy`
      : "League setup — Draftastic Fantasy",
  };
}

export default async function LeagueOnboardingPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { error: errorParam } = searchParams ? await searchParams : {};
  const { league } = await assertOnboardingRequired(slug);

  const { supabase, user } = await getServerAuth();
  const members = await getLeagueMembers(league.id);
  const member = members.find((m) => m.user_id === user!.id);

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url")
    .eq("id", user!.id)
    .maybeSingle();

  const isSalaryCap = league.league_type === "salary_cap";
  const draftType = league.draft_type ?? "autopick";

  return (
    <main className="app-page league-onboarding-page">
      <LeagueOnboardingWizard
        leagueSlug={slug}
        leagueName={league.name}
        isSalaryCap={isSalaryCap}
        draftType={draftType}
        includeNxt={leagueIncludesNxt(league)}
        initialTeamName={member?.team_name?.trim() ?? ""}
        initialCatchphrase={member?.manager_catchphrase?.trim() ?? ""}
        initialLeagueAvatarUrl={member?.manager_avatar_url ?? null}
        profileAvatarUrl={(profile as { avatar_url?: string | null } | null)?.avatar_url ?? null}
        displayName={
          member?.display_name?.trim() ||
          (profile as { display_name?: string | null } | null)?.display_name?.trim() ||
          "Manager"
        }
        initialError={errorParam ? decodeURIComponent(errorParam) : null}
      />
    </main>
  );
}
