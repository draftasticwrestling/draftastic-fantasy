"use client";

import { useActionState, useCallback, useState } from "react";
import { createLeagueAction, type CreateLeagueState } from "./new/actions";
import {
  SEASON_OPTIONS,
  STANDARD_USER_CREATE_SEASON_SLUG,
  PUBLIC_SALARY_CAP_SEASON_WEEKS,
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
  {
    id: "salary_cap",
    title: "Salary Cap — Total Season Points",
    description:
      "Site admin testing: $100 budget per faction, wrestlers priced $5–$25. Same season scoring as Total Season Points; wrestlers are not exclusive across factions.",
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
  const [visibilityType, setVisibilityType] = useState<"private" | "public">("private");
  /** When true, admin sees the same fields/rules as a normal user (and submits enforce_standard_create_rules). */
  const [standardUserPreview, setStandardUserPreview] = useState(false);

  const useStandardRules = !isSiteAdmin || (isSiteAdmin && standardUserPreview);
  const adminFullMode = isSiteAdmin && !standardUserPreview;
  const showAccessCodeField = requiresAccessCodeEnv && useStandardRules && visibilityType === "private";

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
        {visibilityType === "public" ? (
          <>
            <label style={{ display: "block", marginBottom: 8 }}>Season</label>
            <p className="form-note" style={{ marginTop: 0, marginBottom: 0, lineHeight: 1.5 }}>
              <strong>Public League — {PUBLIC_SALARY_CAP_SEASON_WEEKS} weeks</strong> — Build your $100 roster
              after joining. Open enrollment until the next Monday RAW start (5:00 PM PT), or longer if fewer than three
              factions have joined. Scoring runs for {PUBLIC_SALARY_CAP_SEASON_WEEKS} Monday–Sunday weeks from that RAW.
              Wrestler prices are locked for your league&apos;s season when it is created.
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
              Salary Cap — Total Season Points. Open enrollment until Monday RAW (5 PM PT); no team cap. You become GM
              when you create the league. Build your $100 roster. Scoring starts that Monday once at least three
              factions have joined (otherwise enrollment rolls another week) for {PUBLIC_SALARY_CAP_SEASON_WEEKS} weeks.
            </span>
          </button>
        </div>
        <input type="hidden" name="visibility_type" value={visibilityType} />
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
        {visibilityType === "public" ? (
          <p className="form-note" style={{ marginTop: 8 }}>
            Public leagues use a standard generated name (for example, Public League 12).
          </p>
        ) : null}
      </div>

      {visibilityType === "public" ? (
        <div className="form-group">
          <label>League format</label>
          <p className="form-note" style={{ marginTop: 0, marginBottom: 0, lineHeight: 1.55 }}>
            Public leagues use <strong>Salary Cap — Total Season Points</strong>. After joining, build your roster from
            the shared pool ($100 budget, wrestlers $5–$25). NXT is included. Anyone can join until the next Monday RAW
            at 5:00 PM PT once at least three factions are in the league — if not, enrollment stays open another week,
            then scoring runs for {PUBLIC_SALARY_CAP_SEASON_WEEKS} weeks.
          </p>
          <input type="hidden" name="league_type" value="salary_cap" />
          <input type="hidden" name="season_slug" value="public-salary-cap" />
        </div>
      ) : (
        <>
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
            const locked = !!(
              opt.comingSoon &&
              (!adminFullMode || (opt.id !== "head_to_head" && opt.id !== "salary_cap"))
            );
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
        </>
      )}

      {adminFullMode && leagueType === "head_to_head" ? (
        <div className="form-group">
          <label className="create-league-toggle-label" style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            <input type="checkbox" name="include_nxt" value="1" />
            <span>
              <strong>Include NXT</strong> — NXT wrestlers, weekly NXT shows, and NXT titles count in this league
              (site-admin testing only; Head-to-Head required).
            </span>
          </label>
        </div>
      ) : null}

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
