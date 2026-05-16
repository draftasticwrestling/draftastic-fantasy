"use client";

import { useId, useState } from "react";
import { MatchupMobileH2hLineup, type MatchupMobileRosterRow } from "./MatchupMobileH2h";

/** Mobile-only: expand/collapse wrestler lineup (masthead is separate on the page). */
export function MatchupMobileH2hCollapsible({
  matchupKey,
  maxSlots,
  rowsLeft,
  rowsRight,
  leagueSlug,
  wrestlerMeta,
}: {
  matchupKey: string;
  maxSlots: number;
  rowsLeft: MatchupMobileRosterRow[];
  rowsRight: MatchupMobileRosterRow[];
  leagueSlug: string;
  wrestlerMeta: Record<string, { image_url?: string | null; brand?: string | null }>;
}) {
  const [open, setOpen] = useState(false);
  const reactId = useId();
  const safeKey = matchupKey.replace(/\s+/g, "-");
  const regionId = `matchup-h2h-rosters-${safeKey}-${reactId}`;
  const triggerId = `matchup-h2h-trigger-${safeKey}-${reactId}`;

  return (
    <div className="matchup-mobile-h2h-collapsible">
      <button
        type="button"
        id={triggerId}
        className="matchup-mobile-h2h-collapsible__trigger matchup-mobile-h2h-collapsible__trigger--lineup-toggle"
        aria-expanded={open}
        aria-controls={regionId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="matchup-mobile-h2h-collapsible__affordance" aria-hidden>
          <span className="matchup-mobile-h2h-collapsible__affordance-label">
            {open ? "Hide lineups" : "View lineups"}
          </span>
          <span className="matchup-mobile-h2h-collapsible__affordance-chev">{open ? "▲" : "▼"}</span>
        </span>
      </button>
      <div
        id={regionId}
        role="region"
        aria-labelledby={triggerId}
        hidden={!open}
        className="matchup-mobile-h2h-collapsible__rosters"
      >
        {open ? (
          <MatchupMobileH2hLineup
            maxSlots={maxSlots}
            rowsLeft={rowsLeft}
            rowsRight={rowsRight}
            leagueSlug={leagueSlug}
            wrestlerMeta={wrestlerMeta}
          />
        ) : null}
      </div>
    </div>
  );
}
