"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  roadToWrestleManiaPrivateCreateClosedNotice,
  type RoadToWrestleManiaCreateStatus,
} from "@/lib/leagueSeasons";

type Props = {
  createStatus: Exclude<RoadToWrestleManiaCreateStatus, "open">;
  /** Button class for the surrounding page (create form or play funnel). */
  buttonClassName: string;
};

/**
 * Shown when a standard user cannot create a private league.
 * Joining still goes through public quick join, then league onboarding.
 */
export function ClosedPrivateCreatePanel({ createStatus, buttonClassName }: Props) {
  const router = useRouter();
  const notice = roadToWrestleManiaPrivateCreateClosedNotice(createStatus);
  const [committed, setCommitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function joinPublicLeague() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/leagues/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_quick_join: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not join the public league.");
        return;
      }
      const next =
        typeof data.redirect_to === "string" && data.redirect_to.startsWith("/")
          ? data.redirect_to
          : data.league_slug
            ? `/leagues/${data.league_slug}/onboarding`
            : "/leagues";
      router.push(next);
      router.refresh();
    } catch {
      setError("Could not join the public league.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="form-group">
      <p className="form-note" style={{ lineHeight: 1.6, marginTop: 0 }}>
        <strong>{notice.headline}</strong> {notice.body}
      </p>
      <p className="form-note" style={{ lineHeight: 1.6 }}>
        Joining places you in the open public league, then faction setup. Your spot counts toward the league
        starting after you finish that setup.
      </p>
      <label className="play-funnel-commit">
        <input
          type="checkbox"
          checked={committed}
          onChange={(event) => setCommitted(event.target.checked)}
        />
        <span>
          I&apos;m ready to set up my faction, build my roster within the fantasy salary cap, and be placed in the
          open public league.
        </span>
      </label>
      <button
        type="button"
        className={buttonClassName}
        style={{ marginTop: 16 }}
        disabled={!committed || loading}
        onClick={() => void joinPublicLeague()}
      >
        {loading ? "Joining…" : "Join the open public league"}
      </button>
      {error ? (
        <p className="play-funnel-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
