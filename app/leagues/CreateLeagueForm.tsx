"use client";

import { useFormState } from "react-dom";
import { useCallback, useState } from "react";
import { createLeagueAction, type CreateLeagueState } from "./new/actions";
import { SEASON_OPTIONS } from "@/lib/leagueSeasons";

const currentYear = new Date().getFullYear();
const SEASON_YEARS = [currentYear, currentYear + 1];
const TEAM_COUNTS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

const LEAGUE_TYPES = [
  {
    id: "season_overall",
    title: "Season Overall",
    description:
      "Compete against your whole league all season. The team with the most overall points wins!",
  },
  {
    id: "head_to_head",
    title: "Head-to-Head",
    description:
      "Go head-to-head with a different opponent each week. Score the most points to win your match and earn the belt!",
  },
  {
    id: "legacy",
    title: "Legacy",
    description:
      "Draft your wrestlers and sign them to long-term contracts. Then go to work building your dynasty! This one is for die hard fans that want to play the long game.",
  },
] as const;

export function CreateLeagueForm() {
  const [state, formAction] = useFormState(createLeagueAction, null);
  const [teamCount, setTeamCount] = useState<number>(10);
  const [leagueType, setLeagueType] = useState<string>("head_to_head");

  const handleTeamClick = useCallback((n: number) => {
    setTeamCount(n);
  }, []);

  const handleTypeClick = useCallback((id: string) => {
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
              className={`create-league-type-option ${leagueType === opt.id ? "selected" : ""}`}
              onClick={() => handleTypeClick(opt.id)}
              aria-pressed={leagueType === opt.id}
            >
              <strong>{opt.title}</strong>
              <span>{opt.description}</span>
            </button>
          ))}
        </div>
        <input type="hidden" name="league_type" value={leagueType} />
      </div>

      <div className="form-group">
        <label htmlFor="league-season">Season *</label>
        <select id="league-season" name="season_slug" required>
          <option value="">Select a season</option>
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
