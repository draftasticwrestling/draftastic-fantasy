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
- `performOneAutoPick` assigns the pick to `current.user_id` (from admin), inserts into `league_rosters` and `league_draft_picks` with admin, then advances `draft_current_pick`. So each team gets the correct picks in order.

### 4. Required environment variables

- **SUPABASE_SERVICE_ROLE_KEY** – Must be set in Netlify (and in `.env` locally). Used to:
  - Write draft order so all teams get correct slots.
  - Run the full autopick from cron (no user session).
  - Read/write rosters and picks so every team is updated.
- **CRON_SECRET** – Set in Netlify; passed as `x-cron-secret` when the scheduled function calls the API. Required for `/api/cron/run-scheduled-drafts`.

### 5. After the draft

- **Draft history** – `league_draft_picks` stores who picked which wrestler at which overall pick.
- **Rosters** – `league_rosters` is populated as picks are made. Owners see their roster on My Team / Roster.
- **Draft page** – Shows “Draft complete” and rosters on the right; draft history is available on the draft history page.

## Quick checklist for “only one team drafting”

1. **Draft order** – Was it generated with the service role? (Cron at 1hr before, or commissioner “Generate draft order” with `SUPABASE_SERVICE_ROLE_KEY` set.) If the order was created with only the user client, RLS can force every row to the same `user_id`.
2. **Cron** – Is the scheduled function enabled and calling the API with `CRON_SECRET`? Is `SUPABASE_SERVICE_ROLE_KEY` set in Netlify?
3. **Restart** – After fixing order, use “Restart draft” (which keeps the order), then either wait for draft time or trigger the draft (e.g. run the cron or visit the draft page so `runFullAutopickDraftAtScheduledTime` can run if the time has passed).
