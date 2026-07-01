import Link from "next/link";
import { redirect } from "next/navigation";
import { PlayFunnel } from "@/app/play/PlayFunnel";
import {
  PLAY_PATH,
  authPathForPlay,
  buildPlayPath,
  getProfileLeagueReadiness,
  type PlayFunnelStep,
} from "@/lib/playFunnel";
import { getLeaguesForUser } from "@/lib/leagues";
import { getProfile } from "@/lib/profiles";
import { getServerAuth } from "@/lib/supabase/serverAuth";

type Props = {
  searchParams: Promise<{
    step?: string;
    token?: string;
    code?: string;
    phase?: string;
  }>;
};

const VALID_STEPS = new Set<PlayFunnelStep>([
  "choose",
  "join",
  "join-public",
  "join-private",
  "create",
]);

function parseStep(raw: string | undefined): PlayFunnelStep {
  if (raw && VALID_STEPS.has(raw as PlayFunnelStep)) return raw as PlayFunnelStep;
  return "choose";
}

export const metadata = {
  title: "Play — Draftastic Fantasy",
  description: "Sign in and join or create a fantasy pro wrestling league",
};

export default async function PlayPage({ searchParams }: Props) {
  const { step: stepRaw, token, code, phase } = await searchParams;
  const { user } = await getServerAuth();

  const qs = new URLSearchParams();
  if (stepRaw) qs.set("step", stepRaw);
  if (token) qs.set("token", token);
  if (code) qs.set("code", code);
  if (phase) qs.set("phase", phase);
  const returnPath = qs.toString() ? `${PLAY_PATH}?${qs.toString()}` : PLAY_PATH;

  if (!user) {
    redirect(authPathForPlay(returnPath, "sign-in"));
  }

  const step = token ? "join" : parseStep(stepRaw);
  const profile = await getProfile(user.id);
  const leagues = await getLeaguesForUser();
  const profileReadiness = getProfileLeagueReadiness(
    profile,
    buildPlayPath({ step: "join-public", phase: "2" })
  );

  return (
    <main className="play-funnel-page">
      <p className="play-funnel-back">
        <Link href="/">← Home</Link>
      </p>
      <PlayFunnel
        step={step}
        token={token}
        initialCode={code ?? ""}
        profileReadiness={profileReadiness}
        hasLeagues={leagues.length > 0}
        initialPublicPhase={
          phase === "3" ? 3 : phase === "2" ? 2 : 1
        }
      />
    </main>
  );
}
