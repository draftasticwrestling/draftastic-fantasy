"use client";

import { useActionState, useCallback, useMemo, useState } from "react";
import { createLeagueAction, type CreateLeagueState } from "./new/actions";
import {
  CREATE_SEASON_OPTIONS,
  STANDARD_USER_CREATE_SEASON_SLUG,
  PUBLIC_SALARY_CAP_SEASON_WEEKS,
  getSeasonBySlug,
} from "@/lib/leagueSeasons";

const STANDARD_CREATE_SEASON = getSeasonBySlug(STANDARD_USER_CREATE_SEASON_SLUG);

/** Site admins may create 3–16 teams for testing. */
const TEAM_COUNTS_ADMIN = Array.from({ length: 14 }, (_, i) => i + 3);

/** Road to War Games team-count limits by format. */
const FORMAT_TEAM_RANGE: Record<string, { min: number; max: number }> = {
  season_overall: { min: 3, max: 6 },
  head_to_head: { min: 4, max: 8 },
};

function teamRangeFor(leagueType: string): { min: number; max: number } {
  return FORMAT_TEAM_RANGE[leagueType] ?? { min: 3, max: 6 };
}

function teamCountsFor(leagueType: string): number[] {
  const { min, max } = teamRangeFor(leagueType);
  return Array.from({ length: max - min + 1 }, (_, i) => min + i);
}

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
      "Compete against your whole league all season (3–6 factions). The faction with the most overall points wins the Road to War Games championship.",
  },
  {
    id: "head_to_head",
    title: "Head-to-Head",
    description:
      "Weekly matchups and a playoff bracket with win-loss records (4–8 factions). The final is Survivor Series: War Games week.",
  },
  {
    id: "combo",
    title: "Combo League (H2H + Total Season Points)",
    description:
      "Earn extra season points for winning your weekly matchup, but the final winner is your roster's cumulative overall points.",
    comingSoon: true,
  },
  {
    id: "legacy",
    title: "Legacy",
    description:
      "Draft your wrestlers and sign them to long-term contracts, then build your dynasty over multiple seasons.",
    comingSoon: true,
  },
  {
    id: "salary_cap",
    title: "Salary Cap",
    description:
      "Build your roster against a shared budget instead of an exclusive draft. Coming to private leagues later.",
    comingSoon: true,
  },
];

type FormProps = {
  /** Site admin: full options; can toggle to match standard user flow. */
  isSiteAdmin?: boolean;
  /** Road to War Games league creation is still open (before the Oct 19 cutoff). */
  createOpen?: boolean;
};

export function CreateLeagueForm({ isSiteAdmin = false, createOpen = true }: FormProps) {
  const [state, formAction] = useActionState(createLeagueAction, null);
  const [teamCount, setTeamCount] = useState<number>(4);
  const [leagueType, setLeagueType] = useState<string>("season_overall");
  const [visibilityType, setVisibilityType] = useState<"private" | "public">("private");
  /** When true, admin sees the same fields/rules as a normal user. */
  const [standardUserPreview, setStandardUserPreview] = useState(false);

  const useStandardRules = !isSiteAdmin || (isSiteAdmin && standardUserPreview);
  const adminFullMode = isSiteAdmin && !standardUserPreview;

  const teamCountOptions = useMemo(
    () => (adminFullMode ? TEAM_COUNTS_ADMIN : teamCountsFor(leagueType)),
    [adminFullMode, leagueType]
  );

  const clampTeamCount = useCallback((n: number, type: string, admin: boolean) => {
    if (admin) return Math.min(16, Math.max(3, n));
    const { min, max } = teamRangeFor(type);
    return Math.min(max, Math.max(min, n));
  }, []);

  const handleTeamClick = useCallback((n: number) => {
    setTeamCount(n);
  }, []);

  const handleTypeClick = useCallback(
    (id: string, comingSoon?: boolean) => {
      if (comingSoon) return;
      setLeagueType(id);
      setTeamCount((c) => clampTeamCount(c, id, adminFullMode));
    },
    [adminFullMode, clampTeamCount]
  );

  const handleStandardPreviewChange = useCallback(
    (next: boolean) => {
      setStandardUserPreview(next);
      if (next) {
        setVisibilityType("private");
        setLeagueType("season_overall");
        setTeamCount((c) => clampTeamCount(c, "season_overall", false));
      }
    },
    [clampTeamCount]
  );

  const handleVisibilityClick = useCallback(
    (next: "private" | "public") => {
      setVisibilityType(next);
      if (next === "public") {
        setLeagueType("salary_cap");
      } else if (useStandardRules) {
        setLeagueType("season_overall");
      }
    },
    [useStandardRules]
  );

  if (useStandardRules && !createOpen) {
    return (
      <div className="form-group">
        <p className="form-note" style={{ lineHeight: 1.6 }}>
          <strong>Road to War Games league creation is closed.</strong> New leagues can be created up to six
          weeks before Survivor Series: War Games. The season returns after WrestleMania 2027.
        </p>
      </div>
    );
  }

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
              <strong>Standard user view</strong> — Road to War Games season, Total Season Points (3–6) or
              Head-to-Head (4–8), NXT included. Turn off for full admin options.
            </span>
          </label>
        </div>
      ) : null}

      {isSiteAdmin && standardUserPreview ? (
        <input type="hidden" name="enforce_standard_create_rules" value="1" />
      ) : null}

      <div className="form-group">
        {visibilityType === "public" ? (
          <>
            <label style={{ display: "block", marginBottom: 8 }}>Season</label>
            <p className="form-note" style={{ marginTop: 0, marginBottom: 0, lineHeight: 1.5 }}>
              <strong>Public League — {PUBLIC_SALARY_CAP_SEASON_WEEKS} weeks</strong> — Build your $100 roster
              after joining. Open enrollment until the next Monday RAW start (5:00 PM PT), or longer if fewer than three
              factions have joined.
            </p>
          </>
        ) : useStandardRules ? (
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
                <strong>{STANDARD_CREATE_SEASON.name}</strong> — {STANDARD_CREATE_SEASON.windowDescription}. NXT
                rosters and events are included.
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
              {CREATE_SEASON_OPTIONS.map((s) => (
                <option key={s.id} value={s.slug}>
                  {s.name} — {s.windowDescription}
                </option>
              ))}
            </select>
          </>
        )}
      </div>

      <div className="form-group">
        {adminFullMode ? (
          <>
            <label>League Visibility *</label>
            <div className="create-league-type-grid" style={{ marginBottom: 12 }}>
              <button
                type="button"
                className={`create-league-type-option ${visibilityType === "private" ? "selected" : ""}`}
                onClick={() => handleVisibilityClick("private")}
                aria-pressed={visibilityType === "private"}
              >
                <strong>Private League</strong>
                <span className="create-league-type-desc">Invite-only with code or invite link from your GM.</span>
              </button>
              <button
                type="button"
                className={`create-league-type-option ${visibilityType === "public" ? "selected" : ""}`}
                onClick={() => handleVisibilityClick("public")}
                aria-pressed={visibilityType === "public"}
              >
                <strong>Public League</strong>
                <span className="create-league-type-desc">
                  Site admin only. Salary Cap — Total Season Points with open enrollment.
                </span>
              </button>
            </div>
          </>
        ) : (
          <p className="form-note" style={{ marginTop: 0, marginBottom: 0, lineHeight: 1.5 }}>
            This form creates a <strong>private league</strong> for friends. To join a public league, use{" "}
            <strong>Play Now</strong> from the home page.
          </p>
        )}
        <input type="hidden" name="visibility_type" value={adminFullMode ? visibilityType : "private"} />
      </div>

      <div className="form-group">
        <label htmlFor="league-name">{visibilityType === "public" ? "League name" : "League name *"}</label>
        <input
          id="league-name"
          name="name"
          type="text"
          required={visibilityType !== "public"}
          placeholder={visibilityType === "public" ? "Auto-generated for public leagues" : "My 2026 League"}
          maxLength={120}
          disabled={visibilityType === "public"}
        />
      </div>

      {visibilityType === "public" ? (
        <div className="form-group">
          <label>League format</label>
          <p className="form-note" style={{ marginTop: 0, marginBottom: 0, lineHeight: 1.55 }}>
            Public leagues use <strong>Salary Cap — Total Season Points</strong>. NXT is included.
          </p>
          <input type="hidden" name="league_type" value="salary_cap" />
          <input type="hidden" name="season_slug" value="public-salary-cap" />
        </div>
      ) : (
        <>
          <div className="form-group">
            <label>League Format *</label>
            <div className="create-league-type-grid">
              {LEAGUE_TYPES.filter((opt) => !(opt.comingSoon && !adminFullMode)).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`create-league-type-option ${leagueType === opt.id ? "selected" : ""}`}
                  onClick={() => handleTypeClick(opt.id)}
                  aria-pressed={leagueType === opt.id}
                >
                  <strong>{opt.title}</strong>
                  <span className="create-league-type-desc">{opt.description}</span>
                </button>
              ))}
            </div>
            {!adminFullMode ? (
              <>
                <div className="create-league-type-divider" role="separator" aria-hidden="true" />
                <div className="create-league-type-grid create-league-type-grid--coming-soon">
                  {LEAGUE_TYPES.filter((opt) => opt.comingSoon).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      className="create-league-type-option coming-soon"
                      aria-disabled="true"
                      disabled
                      tabIndex={-1}
                    >
                      <strong>{opt.title}</strong>
                      <span className="create-league-type-badge">Coming soon</span>
                      <span className="create-league-type-desc">{opt.description}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : null}
            <input type="hidden" name="league_type" value={leagueType} />
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
            {!adminFullMode ? (
              <p className="form-note" style={{ marginTop: 8 }}>
                {leagueType === "head_to_head"
                  ? "Head-to-Head leagues are 4–8 factions. Your league size locks to the number of factions that draft."
                  : "Total Season Points leagues are 3–6 factions. Your league size locks to the number of factions that draft."}
              </p>
            ) : null}
            <input type="hidden" name="team_count" value={teamCount} />
          </div>
        </>
      )}

      {/* NXT is always included — roster sizes assume the full Raw/SmackDown/NXT pool. */}
      <input type="hidden" name="include_nxt" value="1" />

      {state?.error && (
        <p style={{ margin: "0 0 16px", color: "var(--color-red)", fontSize: 14 }}>{state.error}</p>
      )}

      <button type="submit" className="create-league-submit">
        Create League
      </button>
    </form>
  );
}
