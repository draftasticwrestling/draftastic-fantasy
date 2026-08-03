"use client";

import { useActionState, useRef, type FormEvent } from "react";
import { startDraftWithStateAction } from "./actions";

export function BeginDraftForm({
  leagueSlug,
  draftDateYmd,
  showDateHint,
  memberCount,
  maxTeams,
  minTeams,
}: {
  leagueSlug: string;
  draftDateYmd: string | null;
  showDateHint: boolean;
  memberCount: number;
  maxTeams: number | null;
  minTeams: number;
}) {
  const [state, formAction] = useActionState(startDraftWithStateAction, null as { error?: string } | null);
  const confirmShortRef = useRef<HTMLInputElement>(null);

  const belowMin = memberCount < minTeams;
  const waitingOn =
    maxTeams != null && memberCount < maxTeams ? maxTeams - memberCount : 0;
  const isShort = waitingOn > 0;

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    if (belowMin) {
      e.preventDefault();
      return;
    }
    if (confirmShortRef.current) confirmShortRef.current.value = "";
    if (!isShort) return;
    const ok = window.confirm(
      `You are still waiting on ${waitingOn} team${waitingOn === 1 ? "" : "s"} to join. ` +
        `Do you want to start the draft with the ${memberCount} team${memberCount === 1 ? "" : "s"} you have now? ` +
        `Once the draft starts, no new teams can join the league.`
    );
    if (!ok) {
      e.preventDefault();
      return;
    }
    if (confirmShortRef.current) confirmShortRef.current.value = "1";
  }

  let displayError = state?.error ?? null;

  return (
    <form action={formAction} onSubmit={handleSubmit} style={{ marginBottom: 16 }}>
      <input type="hidden" name="league_slug" value={leagueSlug} />
      <input ref={confirmShortRef} type="hidden" name="confirm_short_roster" value="" />
      <button type="submit" className="app-button" disabled={belowMin}>
        Begin Draft
      </button>
      {belowMin ? (
        <p style={{ marginTop: 8, fontSize: 13, color: "#b91c1c" }}>
          You need at least {minTeams} teams to begin the draft. You currently have {memberCount}
          {maxTeams != null ? ` of ${maxTeams}` : ""}.
        </p>
      ) : isShort ? (
        <p style={{ marginTop: 8, fontSize: 13, color: "var(--color-text-muted)" }}>
          League is {memberCount} of {maxTeams} teams. Starting now will lock the league at {memberCount} teams
          (no new teams can join after the draft begins).
        </p>
      ) : null}
      {showDateHint ? (
        <p style={{ marginTop: 8, fontSize: 13, color: "var(--color-text-muted)" }}>
          Available on or after your league&apos;s draft date
          {draftDateYmd ? ` (${draftDateYmd})` : " (set one in League Settings)"}.
        </p>
      ) : null}
      {displayError ? (
        <p style={{ marginTop: 8, fontSize: 13, color: "#b91c1c" }}>{displayError}</p>
      ) : null}
    </form>
  );
}
