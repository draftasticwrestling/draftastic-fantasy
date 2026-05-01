# Auto-pick draft flow

This doc describes how the auto-pick draft works so the feature can be verified and maintained.

## Draft types

- **Offline** – Commissioner runs the draft outside the app and enters results.
- **Live** – Owners pick in real time on the draft page (timer, manual picks).
- **Auto-pick** – Draft runs on its own at the scheduled time; no one needs to be logged in. Picks are made from each owner’s preferences (or defaults).

## Foundation pieces for auto-pick

### 1. Draft order (who picks when)

- **Randomize one hour before draft time** (`draft_order_method = random_one_hour_before`):  
  The cron API (`/api/cron/run-scheduled-drafts`), when invoked, handles leagues in the **50–70 minutes before draft** window and generates the draft order with the **service role** so every team gets the correct pick slots (no RLS rewriting `user_id`). **Netlify’s 15‑minute schedule for this job is currently disabled** in `netlify/functions/run-scheduled-drafts.ts` when no scheduled drafts are in use; call the endpoint manually or restore the `schedule` export to turn automation back on.
- **Manual by GM** (`draft_order_method = manual_by_gm`):  
  Commissioner sets round 1 order; the app builds the full snake/linear order. Order is written with the **service role** when the commissioner clicks Generate/Set order.
- **Restarting the draft** does **not** change the order: `restartDraft` clears picks and rosters but **keeps** `league_draft_order`. The same order is used when the draft is started again.

### 2. When the draft runs (no user required)

- **Cron API**: `GET /api/cron/run-scheduled-drafts` (see `netlify/functions/run-scheduled-drafts.ts`). The Netlify **schedule** is optional; when enabled it calls this every 15 minutes. With the schedule removed, trigger manually (Netlify function test or authenticated GET) before you rely on unattended autopick.
- For each league where:
  - `draft_type = autopick`
  - `draft_status = not_started`
  - draft time has **passed**
  - `league_draft_order` has at least one row  
  the API calls `runFullAutopickDraftAtScheduledTime(leagueId)`.
- That function uses the **service role** only: it reads draft order and state with admin, then runs `runAutoPickIfExpired(leagueId, { skipTimer: true })` in a loop until the draft is completed. So the entire draft runs server-side; no one needs to have the draft page open.

### 3. Making each pick

- `runAutoPickIfExpired` uses:
  - **Admin** to read current pick from `league_draft_order` and league state.
  - **Admin** to load all rosters (`getRostersForLeagueAdmin`) so “drafted” and “current team roster” are correct for every team.
- `performOneAutoPick` assigns the pick to `current.user_id` (from admin), inserts **`league_draft_picks` first** (to claim the slot under concurrency), then `league_rosters`, then advances `draft_current_pick`.
- **Roster mins (e.g. 4F / 4M for RTS 4-team)** – `requiredGenderForNextPick` decides if the next pick must be F or M. That value is passed into `getTopAvailableWrestlerForUser` so the **priority list** skips IDs of the wrong gender (previously the first undrafted priority ID was taken even when a female was required). Strategy pools also widen to all available of the required gender when the “top half” tier has none.
- **Speed** – For `draft_type = autopick`, the server does **not** wait on the 5s “time per pick” (that interval is for UI only). In one request it can run many picks in a row (batched, up to a cap) until the draft completes or the batch limit is hit. Wall-clock time is mostly Supabase round-trips and scoring/preference queries—typically seconds for a full league, not minutes, when nothing is blocking the request (e.g. serverless timeout).
- **Background-only** – Cron (`run-scheduled-drafts`) also advances leagues that are already `in_progress` autopick, so the draft can finish with **no one on the draft page**. Results appear in **draft history**, **My Team / Roster**, and the draft page whenever someone loads them.
- **Stuck draft / page hang** – If a pick row exists for the current overall slot but `leagues.draft_current_pick` was never advanced (e.g. a failed update after insert), autopick used to loop on duplicate-key errors until the request timed out. `healStaleDraftCursorChain` runs at the start of `runAutoPickIfExpired` to advance the cursor when the pick is already recorded. The draft page uses a **smaller per-request pick cap** than cron so a single navigation is less likely to hit serverless timeouts.
- **Draft page load / “network error”** – For `autopick` + `in_progress`, the app no longer runs the full autopick batch inside the initial RSC render (that could take long enough for the browser to abort the flight request). It runs **`repairDraftAutopickCursor` only** on the server, then **`AutopickClientRunner`** calls the server action `runAutopickTickAction` in bursts after paint. Live (non-autopick) drafts still run `runAutoPickIfExpired` on the server as before.
- **Draft page UI** – While `autopick` + `in_progress`, the draft page shows **`AutopickDraftBoardView`** (order + pick names only) instead of the live-draft wrestler table, filters, and Pick buttons. Wrestler pool and event points queries are skipped on that load to keep the page fast. After completion, the full **`LeagueDraftRoom`** returns (with rosters and pool) on the next visit.

### 4. Required environment variables

- **SUPABASE_SERVICE_ROLE_KEY** – Must be set in Netlify (and in `.env` locally). Used to:
  - Write draft order so all teams get correct slots.
  - Run the full autopick from cron (no user session).
  - Read/write rosters and picks so every team is updated.
- **CRON_SECRET** – Set in Netlify; passed as `x-cron-secret` when the scheduled function calls the API. Required for `/api/cron/run-scheduled-drafts`.

### 5. After the draft

- **Draft history** – `league_draft_picks` stores who picked which wrestler at which overall pick.
- **Rosters** – `league_rosters` is populated as picks are made.
- **`draft_status`** – When the last pick is written, autopick sets **`ready_for_review`** (not `completed`).
- **Member visibility** – `getRostersForLeague` returns **no rows** for non–site-admins while `draft_status === 'ready_for_review'`, so members see **empty rosters** until an admin approves. Site admins still see full rosters (internal tools, POV links).
- **Admin approval** – Internal Admin → **Leagues** → open league → **Draft review & approve**. Approve sets `draft_status` to **`completed`** and revalidates league paths. Optional review note; if roster rules warnings are present, a note is required before approve.
- **Draft page** – After approval, members see rosters on My Team / Roster and the draft page reflects completion.

### 6. Morning / ops workflow (one draft at a time)

1. **Prepare** – Autopick league, `draft_status = not_started`, pick order exists (`league_draft_order` non-empty). For **manual-by-GM** order, the commissioner must set order first; the admin “Run autopick now” button will not randomize for you.
2. **Trigger** – **Internal Admin → league → “Run autopick now”** (no draft clock required), **or** call `GET /api/cron/run-scheduled-drafts` with `x-cron-secret: CRON_SECRET` after scheduled time / beta window rules.
3. **Concurrency** – While **any** league has autopick **`in_progress`**, the cron job **does not start a second** `not_started` draft; it still advances the in-progress league (up to the existing per-tick pick cap). After that league reaches **`ready_for_review`** or **`completed`**, the next due league can start on a later cron tick. The admin button is blocked the same way if another autopick is `in_progress`.
4. **Review** – Confirm roster rules in admin league page; **Approve draft** when satisfied.
5. **Env** – `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`; do not set `DISABLE_AUTOPICK_DRAFT` in production when running autopicks.

## Quick checklist for “only one team drafting”

1. **Draft order** – Was it generated with the service role? (Cron at 1hr before, or commissioner “Generate draft order” with `SUPABASE_SERVICE_ROLE_KEY` set.) If the order was created with only the user client, RLS can force every row to the same `user_id`.
2. **Cron** – Is the scheduled function enabled and calling the API with `CRON_SECRET`? Is `SUPABASE_SERVICE_ROLE_KEY` set in Netlify?
3. **Restart** – After fixing order, use “Restart draft” (which keeps the order), then either wait for draft time or trigger the draft (e.g. run the cron or visit the draft page so `runFullAutopickDraftAtScheduledTime` can run if the time has passed).
