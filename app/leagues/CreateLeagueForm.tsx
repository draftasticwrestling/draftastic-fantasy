"use client";

import { useActionState, useCallback, useState } from "react";
import { createLeagueAction, type CreateLeagueState } from "./new/actions";
import {
  SEASON_OPTIONS,
  STANDARD_USER_CREATE_SEASON_SLUG,
  getSeasonBySlug,
} from "@/lib/leagueSeasons";

const STANDARD_CREATE_SEASON = getSeasonBySlug(STANDARD_USER_CREATE_SEASON_SLUG);

/** Road to SummerSlam beta: 3–6 factions per league. Site admins: 3–16 (matches createLeague clamp). */
const BETA_MIN_TEAMS = 3;
const BETA_MAX_TEAMS = 6;
const TEAM_COUNTS_BETA = [3, 4, 5, 6] as const;
const TEAM_COUNTS_ADMIN = Array.from({ length: 14 }, (_, i) => i + 3);

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

type FormProps = {
  /** True when LEAGUE_CREATION_ACCESS_CODES is configured (server). */
  requiresAccessCodeEnv?: boolean;
  /** Site admin: full options; can toggle to match standard user flow. */
  isSiteAdmin?: boolean;
};

export function CreateLeagueForm({
  requiresAccessCodeEnv = false,
  isSiteAdmin = false,
}: FormProps) {
  const [state, formAction] = useActionState(createLeagueAction, null);
  const [teamCount, setTeamCount] = useState<number>(4);
  const [leagueType, setLeagueType] = useState<string>("season_overall");
  /** When true, admin sees the same fields/rules as a normal user (and submits enforce_standard_create_rules). */
  const [standardUserPreview, setStandardUserPreview] = useState(false);

  const useStandardRules = !isSiteAdmin || (isSiteAdmin && standardUserPreview);
  const adminFullMode = isSiteAdmin && !standardUserPreview;
  const showAccessCodeField = requiresAccessCodeEnv && useStandardRules;

  const teamCountOptions = adminFullMode ? TEAM_COUNTS_ADMIN : [...TEAM_COUNTS_BETA];

  const handleTeamClick = useCallback((n: number) => {
    setTeamCount(n);
  }, []);

  const handleTypeClick = useCallback(
    (id: string, comingSoon?: boolean) => {
      if (comingSoon && !adminFullMode) return;
      setLeagueType(id);
    },
    [adminFullMode]
  );

  const handleStandardPreviewChange = useCallback((next: boolean) => {
    setStandardUserPreview(next);
    if (next) {
      setLeagueType("season_overall");
      setTeamCount((c) => Math.min(BETA_MAX_TEAMS, Math.max(BETA_MIN_TEAMS, c)));
    }
  }, []);

  return (
    <form action={formAction} className="create-league-form">
      {isSiteAdmin ? (
        <div className="form-group create-league-admin-preview-toggle">
          <label className="create-league-toggle-label">
            <input
              type="checkbox"
              checked={standardUserPreview}
              onChange={(e) => handleStandardPreviewChange(e.target.checked)}
            />
            <span>
              <strong>Standard user view</strong> — mailing-list access code (when enabled) and beta limits (Road to
              SummerSlam season, Total Season Points, 3–6 teams). Turn off for full admin options.
            </span>
          </label>
        </div>
      ) : null}

      {isSiteAdmin && standardUserPreview ? (
        <input type="hidden" name="enforce_standard_create_rules" value="1" />
      ) : null}

      {showAccessCodeField ? (
        <div className="form-group">
          <label htmlFor="league-access-code">Beta access code *</label>
          <input
            id="league-access-code"
            name="access_code"
            type="text"
            required
            autoComplete="off"
            spellCheck={false}
            placeholder="Enter the code from your invite email"
            maxLength={256}
          />
          <p className="form-note" style={{ marginTop: 8 }}>
            Only people on our beta mailing list receive this code. Invited managers can still join your league using
            your league code or invite link as usual.
          </p>
        </div>
      ) : null}

      <div className="form-group">
        {useStandardRules ? (
          <>
            <label id="league-season-locked-label" style={{ display: "block", marginBottom: 8 }}>
              Season *
            </label>
            {STANDARD_CREATE_SEASON ? (
              <p
                className="form-note"
                style={{ marginTop: 0, marginBottom: 0, lineHeight: 1.5 }}
                aria-labelledby="league-season-locked-label"
              >
                <strong>{STANDARD_CREATE_SEASON.name}</strong> — {STANDARD_CREATE_SEASON.windowDescription}
              </p>
            ) : null}
            <input type="hidden" name="season_slug" value={STANDARD_USER_CREATE_SEASON_SLUG} />
          </>
        ) : (
          <>
            <label htmlFor="league-season">Season type *</label>
            <select
              id="league-season"
              name="season_slug"
              required
              defaultValue={STANDARD_USER_CREATE_SEASON_SLUG}
            >
              {SEASON_OPTIONS.map((s) => (
                <option key={s.id} value={s.slug}>
                  {s.name} — {s.windowDescription}
                </option>
              ))}
            </select>
          </>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="league-name">League name *</label>
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
        <div className={`create-league-teams-row${adminFullMode ? " create-league-teams-row--admin" : ""}`}>
          {teamCountOptions.map((n) => (
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
          {LEAGUE_TYPES.map((opt) => {
            const locked = !!(opt.comingSoon && !adminFullMode);
            return (
            <button
              key={opt.id}
              type="button"
              className={`create-league-type-option ${leagueType === opt.id ? "selected" : ""} ${locked ? "coming-soon" : ""}`}
              onClick={() => handleTypeClick(opt.id, opt.comingSoon)}
              aria-pressed={leagueType === opt.id}
              aria-disabled={locked || undefined}
            >
              <strong>{opt.title}</strong>
              {locked && <span className="create-league-type-badge">Coming soon</span>}
              <span className="create-league-type-desc">{opt.description}</span>
            </button>
            );
          })}
        </div>
        <input type="hidden" name="league_type" value={leagueType} />
      </div>

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
