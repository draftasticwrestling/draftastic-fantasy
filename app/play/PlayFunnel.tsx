"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  PUBLIC_JOIN_STEPS,
  type PlayFunnelStep,
  type ProfileLeagueReadiness,
  buildPlayPath,
} from "@/lib/playFunnel";

type Props = {
  step: PlayFunnelStep;
  token?: string;
  initialCode?: string;
  profileReadiness: ProfileLeagueReadiness;
  hasLeagues: boolean;
  initialPublicPhase?: 1 | 2 | 3;
};

export function PlayFunnel({
  step,
  token,
  initialCode = "",
  profileReadiness,
  hasLeagues,
  initialPublicPhase = 1,
}: Props) {
  const router = useRouter();
  const [publicPhase, setPublicPhase] = useState<1 | 2 | 3>(initialPublicPhase);
  const [publicLoading, setPublicLoading] = useState(false);
  const [privateLoading, setPrivateLoading] = useState(false);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [code, setCode] = useState(initialCode);
  const [committed, setCommitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectAfterJoin = (data: { redirect_to?: string; league_slug?: string }) => {
    router.push(
      typeof data.redirect_to === "string"
        ? data.redirect_to
        : data.league_slug
          ? `/leagues/${data.league_slug}`
          : "/leagues"
    );
    router.refresh();
  };

  const joinWithBody = async (body: Record<string, unknown>, setLoading: (v: boolean) => void) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/leagues/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not join league.");
        return;
      }
      redirectAfterJoin(data);
    } catch {
      setError("Request failed.");
    } finally {
      setLoading(false);
    }
  };

  if (token && step === "join") {
    return (
      <div className="play-funnel">
        <h1>Join your league</h1>
        <p className="play-funnel-lead">You were invited to join a league. Confirm below to continue setup.</p>
        <button
          type="button"
          className="play-funnel-btn play-funnel-btn-primary"
          disabled={tokenLoading}
          onClick={() => joinWithBody({ token }, setTokenLoading)}
        >
          {tokenLoading ? "Joining…" : "Accept invite & continue"}
        </button>
        {error ? <p className="play-funnel-error">{error}</p> : null}
      </div>
    );
  }

  if (step === "choose") {
    return (
      <div className="play-funnel">
        <h1>Play Draftastic Fantasy</h1>
        <p className="play-funnel-lead">
          {hasLeagues
            ? "Join another league or create your own."
            : "You need a league to play. Join a public league or create one for your group."}
        </p>
        <div className="play-funnel-actions">
          <Link href={buildPlayPath({ step: "join" })} className="play-funnel-btn play-funnel-btn-primary">
            Join a League
          </Link>
          <Link href={buildPlayPath({ step: "create" })} className="play-funnel-btn play-funnel-btn-outline">
            Create a League
          </Link>
        </div>
        {hasLeagues ? (
          <p className="play-funnel-foot">
            <Link href="/leagues">← My leagues</Link>
          </p>
        ) : null}
      </div>
    );
  }

  if (step === "create") {
    return (
      <div className="play-funnel">
        <h1>Create a League</h1>
        <p className="play-funnel-lead">
          Set up a private league for friends. Private league creation during beta may require a mailing-list access
          code.
        </p>
        <div className="play-funnel-actions">
          <Link href="/leagues/new" className="play-funnel-btn play-funnel-btn-primary">
            Continue to league setup
          </Link>
          <Link href={buildPlayPath({ step: "choose" })} className="play-funnel-btn play-funnel-btn-outline">
            Back
          </Link>
        </div>
      </div>
    );
  }

  if (step === "join") {
    return (
      <div className="play-funnel">
        <h1>Join a League</h1>
        <p className="play-funnel-lead">Pick how you want to join.</p>
        <div className="play-funnel-card-list">
          <Link href={buildPlayPath({ step: "join-public" })} className="play-funnel-card">
            <strong>Join a Public League</strong>
            <span>
              No code needed. Build your roster and compete in the current open public league. Scoring begins on
              Mondays, after at least three factions finish setup.
            </span>
          </Link>
          <Link href={buildPlayPath({ step: "join-private" })} className="play-funnel-card">
            <strong>Join a Private League</strong>
            <span>Enter the league code from your GM (format like ABCD-2FGH).</span>
          </Link>
        </div>
        <p className="play-funnel-foot">
          <Link href={buildPlayPath({ step: "choose" })}>← Back</Link>
        </p>
      </div>
    );
  }

  if (step === "join-private") {
    return (
      <div className="play-funnel">
        <h1>Join a Private League</h1>
        <p className="play-funnel-lead">Ask your league GM for the join code.</p>
        <input
          id="play-league-code"
          type="text"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="XXXX-XXXX"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="play-funnel-code-input"
        />
        <div className="play-funnel-actions">
          <button
            type="button"
            className="play-funnel-btn play-funnel-btn-primary"
            disabled={privateLoading}
            onClick={() => {
              const trimmed = code.trim();
              if (!trimmed) {
                setError("Enter a league code.");
                return;
              }
              void joinWithBody({ code: trimmed }, setPrivateLoading);
            }}
          >
            {privateLoading ? "Joining…" : "Join with code"}
          </button>
          <Link href={buildPlayPath({ step: "join" })} className="play-funnel-btn play-funnel-btn-outline">
            Back
          </Link>
        </div>
        {error ? <p className="play-funnel-error">{error}</p> : null}
      </div>
    );
  }

  // join-public — multi-step before placement
  if (publicPhase === 1) {
    return (
      <div className="play-funnel">
        <h1>Join a Public League</h1>
        <p className="play-funnel-lead">
          Public leagues are free to join and play. Here&apos;s what happens after you join. You&apos;ll only be placed
          in a league once you confirm on the last step.
        </p>
        <ol className="play-funnel-step-list">
          {PUBLIC_JOIN_STEPS.map((item, i) => (
            <li key={item.title}>
              <span className="play-funnel-step-num">{i + 1}</span>
              <div>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="play-funnel-note">
          Finish before Monday RAW (5 PM PT). If you don&apos;t complete roster setup by then, your spot is released and
          you&apos;ll need to join again.
        </p>
        <div className="play-funnel-actions">
          <button
            type="button"
            className="play-funnel-btn play-funnel-btn-primary"
            onClick={() => setPublicPhase(2)}
          >
            Continue
          </button>
          <Link href={buildPlayPath({ step: "join" })} className="play-funnel-btn play-funnel-btn-outline">
            Back
          </Link>
        </div>
      </div>
    );
  }

  if (publicPhase === 2) {
    return (
      <div className="play-funnel">
        <h1>Before you join</h1>
        {!profileReadiness.ready ? (
          <>
            <p className="play-funnel-lead">Complete your account profile so you can finish faction setup right away.</p>
            <ul className="play-funnel-missing-list">
              {profileReadiness.missingLabels.map((label) => (
                <li key={label}>{label}</li>
              ))}
            </ul>
            <div className="play-funnel-actions">
              {profileReadiness.accountHref ? (
                <Link href={profileReadiness.accountHref} className="play-funnel-btn play-funnel-btn-primary">
                  Complete profile
                </Link>
              ) : null}
              <button
                type="button"
                className="play-funnel-btn play-funnel-btn-outline"
                onClick={() => setPublicPhase(1)}
              >
                Back
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="play-funnel-lead">
              Your account is ready. On the next screen you&apos;ll confirm that you want to join and start faction
              setup.
            </p>
            <div className="play-funnel-actions">
              <button
                type="button"
                className="play-funnel-btn play-funnel-btn-primary"
                onClick={() => setPublicPhase(3)}
              >
                Continue
              </button>
              <button
                type="button"
                className="play-funnel-btn play-funnel-btn-outline"
                onClick={() => setPublicPhase(1)}
              >
                Back
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="play-funnel">
      <h1>Ready to join?</h1>
      <p className="play-funnel-lead">
        You&apos;ll join the current open public league (or start a new one as GM if none is open), then set up your
        faction and roster.
      </p>
      <label className="play-funnel-commit">
        <input
          type="checkbox"
          checked={committed}
          onChange={(e) => setCommitted(e.target.checked)}
        />
        <span>
          I&apos;m ready to set up my faction, build my roster within the fantasy salary cap, and be placed in the
          league. I understand my spot only counts toward league start after I finish setup.
        </span>
      </label>
      <div className="play-funnel-actions">
        <button
          type="button"
          className="play-funnel-btn play-funnel-btn-primary"
          disabled={!committed || publicLoading || !profileReadiness.ready}
          onClick={() => void joinWithBody({ public_quick_join: true }, setPublicLoading)}
        >
          {publicLoading ? "Joining…" : "Join Public League"}
        </button>
        <button
          type="button"
          className="play-funnel-btn play-funnel-btn-outline"
          disabled={publicLoading}
          onClick={() => setPublicPhase(2)}
        >
          Back
        </button>
      </div>
      {!profileReadiness.ready && profileReadiness.accountHref ? (
        <p className="play-funnel-foot">
          <Link href={profileReadiness.accountHref}>Complete your profile first</Link>
        </p>
      ) : null}
      {error ? <p className="play-funnel-error">{error}</p> : null}
    </div>
  );
}
