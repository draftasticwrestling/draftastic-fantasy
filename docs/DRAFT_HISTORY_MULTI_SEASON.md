# Past Drafts by Year/Season – Implementation Plan

To let users view **past drafts** (e.g. 2026 Road to SummerSlam, 2027 Road to WrestleMania), the app needs to support **multiple draft runs per league**. Right now there is one draft per league (all picks keyed by `league_id`).

---

## 1. Schema changes

### 1.1 New table: `league_draft_runs`

Each row is one draft event for a league (one run per season/year).

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | PK, default gen_random_uuid() |
| `league_id` | uuid | FK → leagues |
| `season_slug` | text | e.g. road-to-summerslam, nullable |
| `season_year` | int | e.g. 2026 |
| `draft_date` | date | nullable |
| `created_at` | timestamptz | default now() |

- Unique on `(league_id, season_slug, season_year)` so each league has at most one run per season.
- Display label: use `getSeasonBySlug(season_slug).name + ' ' + season_year`, or just `season_year` if no season.

### 1.2 `league_draft_picks`

- Add `draft_run_id` uuid NOT NULL FK → league_draft_runs.
- Change primary key from `(league_id, overall_pick)` to `(draft_run_id, overall_pick)`.
- Keep `league_id` on the table for simpler RLS and “all picks for league” queries.

**Migration:** Create runs for every league that already has picks (one run per league, using that league’s `season_slug` / year). Backfill `draft_run_id` on existing picks, then add the column as NOT NULL and switch the PK.

### 1.3 `league_draft_order`

- Add `draft_run_id` uuid NOT NULL FK → league_draft_runs.
- Change primary key from `(league_id, overall_pick)` to `(draft_run_id, overall_pick)`.
- Backfill the same way as picks (one run per league that has order).

### 1.4 `leagues`

- Add `current_draft_run_id` uuid nullable FK → league_draft_runs.
- Meaning: “the draft run that is currently active for this league” (the one that gets new picks and drives draft_status).
- For existing leagues that have a run, set `current_draft_run_id` to that run’s id.

**Optional later:** Move `draft_status`, `draft_current_pick`, `draft_current_pick_started_at` from `leagues` onto `league_draft_runs` so each run carries its own state. For a first version, these can stay on `leagues` and apply to the “current” run only.

### 1.5 `league_draft_user_state` (auto-pick takeover)

- Add `draft_run_id` uuid NOT NULL FK → league_draft_runs.
- Change primary key from `(league_id, user_id)` to `(draft_run_id, user_id)`.
- When starting a new draft run, this table is empty for that run (no need to migrate old rows).

---

## 2. Code changes

### 2.1 Resolve “current run” everywhere

- **Leagues:** When doing anything draft-related, resolve the active run:
  - If `league.current_draft_run_id` is set, use that run.
  - Else (legacy) create a run on first use from league’s `season_slug` / year and set `leagues.current_draft_run_id`, or keep “run-less” behavior by treating `league_id` as the implicit run.
- **Reads:** `getLeagueDraftState`, `getCurrentPick`, `getDraftOrder`, `getDraftPicksHistory` should all take or resolve a `draft_run_id` (or league + optional run). For “current” draft, pass `league.current_draft_run_id` or the latest run for that league.
- **Writes:** `makeDraftPick`, `runAutoPickIfExpired`, `generateDraftOrder`, `startDraft`, `restartDraft`, `clearLastPick` should all operate on the current run: use `league.current_draft_run_id` and then `draft_run_id` for inserts/updates into `league_draft_picks`, `league_draft_order`, and `league_draft_user_state`.

### 2.2 Starting a new draft (new season)

- Commissioner action: “Start new draft” or “New season”.
- Create a new row in `league_draft_runs` (league_id, season_slug, season_year, draft_date).
- Set `leagues.current_draft_run_id` = new run id.
- Reset draft state: `draft_status = 'not_started'`, `draft_current_pick = null`, clear `league_draft_order` for the new run (and optionally clear `league_rosters` for that league if rosters are per-draft).
- Existing `league_draft_picks` and `league_draft_order` for *previous* runs stay as-is (history).

### 2.3 Draft History page

- **List runs:** Query `league_draft_runs` for the league, order by `season_year` desc, `created_at` desc.
- **Build `draftOptions`:** One option per run, label = “{season_year} {season_name}” or “{season_year}”.
- **Load picks for selected run:** `getDraftPicksHistory(leagueId, draftRunId)` (or equivalent) so the table shows picks for that run only.
- Keep “View: Full draft | By team” as-is; it just filters the current run’s picks.

---

## 3. Order of work

1. **Migration 1 – Add runs and backfill**
   - Create `league_draft_runs`, insert one run per league that has picks or order.
   - Add `current_draft_run_id` to `leagues` and set it for those leagues.
   - Add `draft_run_id` to `league_draft_picks` and `league_draft_order`; backfill; set NOT NULL; change PKs.
   - Add `draft_run_id` to `league_draft_user_state`; change PK; backfill or clear for existing rows (e.g. one run per league that has state).

2. **Code – Use run id for current draft**
   - In `lib/leagueDraft.ts` (and any callers), resolve `current_draft_run_id` from the league and use it for all reads/writes to picks, order, and user state.
   - Ensure `getDraftPicksHistory` can accept an optional `draftRunId` and filter by it.

3. **Code – Draft History page**
   - Fetch all runs for the league; pass them as `draftOptions`.
   - When user selects a run, pass that run’s id and load picks for that run only.

4. **Optional – “Start new draft” flow**
   - UI for commissioner to start a new draft (new season/year).
   - Creates new run, sets `current_draft_run_id`, resets order/state (and optionally rosters).

5. **Optional – Move draft state onto runs**
   - Add `draft_status`, `draft_current_pick`, `draft_current_pick_started_at` to `league_draft_runs`.
   - Copy from leagues to the current run and read from run everywhere; then drop columns from leagues.

---

## 4. Summary

- **New:** `league_draft_runs` (one row per draft event per league, keyed by season/year).
- **Picks and order:** Scoped by `draft_run_id`; PKs become `(draft_run_id, overall_pick)`.
- **Leagues:** `current_draft_run_id` points at the active run; all “current” draft logic uses that run.
- **Draft History:** Lists runs for the league; user picks a year/season (run); page shows that run’s picks with existing “Full draft | By team” behavior.

Once this is in place, “past drafts” are simply older `league_draft_runs` for the same league, and the existing Draft History UI can show them via the draft selector.
