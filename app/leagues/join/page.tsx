import Link from "next/link";
import { redirect } from "next/navigation";
import { getLeagueInvitePreview, leagueInviteOnboardingPath } from "@/lib/leagueInvitePreview";
import { buildPlayPath } from "@/lib/playFunnel";

type Props = { searchParams: Promise<{ token?: string; code?: string }> };

/** Invite tokens open league onboarding. Codes still use the play funnel. */
export default async function JoinLeaguePage({ searchParams }: Props) {
  const { token, code } = await searchParams;
  const trimmed = token?.trim() ?? "";
  if (!trimmed) {
    redirect(buildPlayPath({ step: code ? "join-private" : "join", code }));
  }

  const preview = await getLeagueInvitePreview(trimmed);
  if (!preview) {
    return (
      <main className="app-page league-onboarding-page">
        <div className="league-onboarding-card">
          <h1 className="league-onboarding-title">Invite link not found</h1>
          <p className="league-onboarding-sub">
            This invitation link is not valid. Ask the league GM for a new one.
          </p>
          <p className="league-onboarding-sub">
            <Link href="/leagues">Back to leagues</Link>
          </p>
        </div>
      </main>
    );
  }

  redirect(leagueInviteOnboardingPath(preview.leagueSlug, trimmed));
}
