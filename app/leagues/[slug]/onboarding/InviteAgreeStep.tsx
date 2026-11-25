"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  token: string;
  leagueName: string;
  leagueSlug: string;
  isSalaryCap: boolean;
  continuesToOnboarding: boolean;
  rulesHref: string | null;
};

export function InviteAgreeStep({
  token,
  leagueName,
  leagueSlug,
  isSalaryCap,
  continuesToOnboarding,
  rulesHref,
}: Props) {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextStep = isSalaryCap
    ? "After you agree, you'll name your faction, add an optional catchphrase, pick an avatar, then build your roster."
    : continuesToOnboarding
      ? "After you agree, you'll name your faction and finish league setup."
      : "After you agree, you'll go into the league.";

  async function agreeAndJoin() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/leagues/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not join the league.");
        return;
      }
      const next =
        typeof data.redirect_to === "string" && data.redirect_to.startsWith("/")
          ? data.redirect_to
          : `/leagues/${leagueSlug}/onboarding`;
      router.push(next);
      router.refresh();
    } catch {
      setError("Could not join the league.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="league-onboarding-card">
      <div className="league-onboarding-progress" aria-hidden>
        <div className="league-onboarding-progress__bar" style={{ width: "16%" }} />
      </div>
      <p className="league-onboarding-eyebrow">Welcome to {leagueName}</p>
      <h1 className="league-onboarding-title">Agree to join</h1>
      <p className="league-onboarding-sub">
        {nextStep} These choices apply only in <strong>{leagueName}</strong>.
      </p>
      {rulesHref ? (
        <p className="league-onboarding-sub">
          Read the <Link href={rulesHref}>Beat the Founders contest rules</Link> before you join.
        </p>
      ) : null}
      <label className="play-funnel-commit">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(event) => setAgreed(event.target.checked)}
        />
        <span>I agree to join {leagueName} and set up my faction.</span>
      </label>
      {error ? (
        <p className="league-onboarding-message league-onboarding-message--err" role="alert">
          {error}
        </p>
      ) : null}
      <div className="league-onboarding-actions">
        <button type="button" className="app-button" disabled={!agreed || loading} onClick={() => void agreeAndJoin()}>
          {loading ? "Joining…" : "Agree and set up my faction"}
        </button>
      </div>
    </div>
  );
}
