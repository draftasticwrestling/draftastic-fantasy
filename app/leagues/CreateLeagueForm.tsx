"use client";

import { useFormState } from "react-dom";
import { useCallback, useState } from "react";
import { createLeagueAction, type CreateLeagueState } from "./new/actions";
import { SEASON_OPTIONS } from "@/lib/leagueSeasons";

/** Default season for new leagues (first option in SEASON_OPTIONS is Road to SummerSlam). */
const DEFAULT_SEASON_SLUG = "road-to-summerslam";

const currentYear = new Date().getFullYear();
const SEASON_YEARS = [currentYear, currentYear + 1];
/** Road to SummerSlam beta: 3–6 factions per league. */
const TEAM_COUNTS = [3, 4, 5, 6] as const;

const LEAGUE_TYPES: Array<{
  id: string;
  title: string;
  description: string;
  comingSoon?: boolean;
}> = [
  {
    id: "season_overall",
    title: "Total Season Points",
    description:
      "Compete against your whole league all season. The faction with the most overall points wins the Road to SummerSlam championship.",
  },
  {
    id: "head_to_head",
    title: "Head-to-Head",
    description:
      "Weekly matchups and playoffs with win-loss records. Coming after the Total Season Points beta.",
    comingSoon: true,
  },
  {
    id: "combo",
    title: "Combo League (H2H+Total Season Points)",
    description:
      "Earn extra season points for winning your weekly matchup, but the final winner is determined by your roster's cumulative overall points—not your win-loss record.",
    comingSoon: true,
  },
  {
    id: "legacy",
    title: "Legacy",
    description:
      "Draft your wrestlers and sign them to long-term contracts. Then go to work building your dynasty! This one is for die hard fans that want to play the long game.",
    comingSoon: true,
  },
];

export function CreateLeagueForm() {
  const [state, formAction] = useFormState(createLeagueAction, null);
  const [teamCount, setTeamCount] = useState<number>(4);
  const [leagueType, setLeagueType] = useState<string>("season_overall");

  const handleTeamClick = useCallback((n: number) => {
    setTeamCount(n);
  }, []);

  const handleTypeClick = useCallback((id: string, comingSoon?: boolean) => {
    if (comingSoon) return;
    setLeagueType(id);
  }, []);

  return (
    <form action={formAction} className="create-league-form">
      <div className="form-group">
        <label htmlFor="league-name">League Name *</label>
        <input
          id="league-name"
          name="name"
          type="text"
          required
          placeholder="My 2026 League"
          maxLength={120}
        />
      </div>

      <div className="form-group">
        <label>Number of Teams *</label>
        <div className="create-league-teams-row">
          {TEAM_COUNTS.map((n) => (
            <button
              key={n}
              type="button"
              className={`create-league-teams-option ${teamCount === n ? "selected" : ""}`}
              onClick={() => handleTeamClick(n)}
              aria-pressed={teamCount === n}
            >
              {n}
            </button>
          ))}
        </div>
        <input type="hidden" name="team_count" value={teamCount} />
      </div>

      <div className="form-group">
        <label>League Format *</label>
        <div className="create-league-type-grid">
          {LEAGUE_TYPES.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`create-league-type-option ${leagueType === opt.id ? "selected" : ""} ${opt.comingSoon ? "coming-soon" : ""}`}
              onClick={() => handleTypeClick(opt.id, opt.comingSoon)}
              aria-pressed={leagueType === opt.id}
              aria-disabled={opt.comingSoon ?? undefined}
            >
              <strong>{opt.title}</strong>
              {opt.comingSoon && <span className="create-league-type-badge">Coming soon</span>}
              <span className="create-league-type-desc">{opt.description}</span>
            </button>
          ))}
        </div>
        <input type="hidden" name="league_type" value={leagueType} />
      </div>

      <div className="form-group">
        <label htmlFor="league-season">Season *</label>
        <select id="league-season" name="season_slug" required defaultValue={DEFAULT_SEASON_SLUG}>
          {SEASON_OPTIONS.map((s) => (
            <option key={s.id} value={s.slug}>
              {s.name} — {s.windowDescription}
            </option>
          ))}
        </select>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="league-year">Season Year *</label>
          <select id="league-year" name="season_year" required>
            {SEASON_YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="league-draft">Draft Date (optional)</label>
          <input id="league-draft" name="draft_date" type="date" />
        </div>
      </div>
      <p className="form-note">
        If the league starts after the season has begun, set the draft date. Points will count from the first event after the draft.
      </p>

      {state?.error && (
        <p style={{ margin: "0 0 16px", color: "var(--color-red)", fontSize: 14 }}>
          {state.error}
        </p>
      )}

      <button type="submit" className="create-league-submit">
        Create League
      </button>
    </form>
  );
}
