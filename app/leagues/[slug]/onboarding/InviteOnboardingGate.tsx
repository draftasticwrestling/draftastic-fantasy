import Link from "next/link";
import { redirect } from "next/navigation";
import { InviteAgreeStep } from "@/app/leagues/[slug]/onboarding/InviteAgreeStep";
import {
  BEAT_THE_FOUNDERS_INELIGIBLE_MESSAGE,
  isBeatTheFoundersLeagueSlug,
} from "@/lib/beatTheFoundersLeague";
import { canUserJoinBeatTheFounders } from "@/lib/beatTheFoundersQualifiers";
import { getLeagueInvitePreview } from "@/lib/leagueInvitePreview";
import { leagueUsesMemberOnboarding } from "@/lib/leagueOnboarding";
import { leagueUsesSalaryCap } from "@/lib/leagueStructure";
import { getServerAuth } from "@/lib/supabase/serverAuth";

type Props = {
  slug: string;
  token: string;
};

function InviteMessage({ title, body }: { title: string; body: string }) {
  return (
    <main className="app-page league-onboarding-page">
      <div className="league-onboarding-card">
        <h1 className="league-onboarding-title">{title}</h1>
        <p className="league-onboarding-sub">{body}</p>
        <p className="league-onboarding-sub">
          <Link href="/leagues">Back to leagues</Link>
        </p>
      </div>
    </main>
  );
}

/** Invite links land here before the member is in the league. Agreeing joins, then setup continues. */
export async function InviteOnboardingGate({ slug, token }: Props) {
  const here = `/leagues/${encodeURIComponent(slug)}/onboarding?invite=${encodeURIComponent(token)}`;
  const { supabase, user } = await getServerAuth();
  if (!user) {
    redirect(`/auth/sign-in?next=${encodeURIComponent(here)}`);
  }

  const preview = await getLeagueInvitePreview(token);
  if (!preview) {
    return (
      <InviteMessage
        title="Invite link not found"
        body="This invitation link is not valid. Ask the league GM for a new one."
      />
    );
  }
  if (preview.leagueSlug !== slug) {
    redirect(`/leagues/${encodeURIComponent(preview.leagueSlug)}/onboarding?invite=${encodeURIComponent(token)}`);
  }
  if (preview.expired) {
    return (
      <InviteMessage
        title="Invite link expired"
        body={`${preview.leagueName} is no longer accepting this invitation. Ask the league GM for a new link.`}
      />
    );
  }

  const { data: member } = await supabase
    .from("league_members")
    .select("user_id")
    .eq("league_id", preview.leagueId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (member) {
    redirect(`/leagues/${encodeURIComponent(slug)}/onboarding`);
  }

  if (isBeatTheFoundersLeagueSlug(preview.leagueSlug) && !(await canUserJoinBeatTheFounders(user.id))) {
    return <InviteMessage title="Not eligible" body={BEAT_THE_FOUNDERS_INELIGIBLE_MESSAGE} />;
  }

  const league = {
    league_type: preview.leagueType,
    season_slug: preview.seasonSlug,
  };

  return (
    <main className="app-page league-onboarding-page">
      <InviteAgreeStep
        token={preview.token}
        leagueName={preview.leagueName}
        leagueSlug={preview.leagueSlug}
        isSalaryCap={leagueUsesSalaryCap(preview.leagueType)}
        continuesToOnboarding={leagueUsesMemberOnboarding(league)}
        rulesHref={isBeatTheFoundersLeagueSlug(preview.leagueSlug) ? "/beat-the-founders/rules" : null}
      />
    </main>
  );
}
