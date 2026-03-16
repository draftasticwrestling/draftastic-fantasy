# Draft verification: how to confirm the draft is operational

Use this to verify the draft flow works end-to-end so you can be sure the system is ready for a real draft.

## Prerequisites (one-time)

- [ ] **League is full** – All spots filled (e.g. 4/4 or 8/8 members).
- [ ] **Netlify (production):**  
  - `SUPABASE_SERVICE_ROLE_KEY` is set (same project as `NEXT_PUBLIC_SUPABASE_URL`).  
  - For scheduled autopick: `CRON_SECRET` is set and the scheduled function is enabled.
- [ ] **Local:** `.env` has `SUPABASE_SERVICE_ROLE_KEY` (and optionally `CRON_SECRET` for testing cron).

## Commissioner: check “Draft readiness” on the Draft page

When you open the **Draft** tab as commissioner, you should see a **Draft readiness** box at the top (commissioner only). Use it to confirm:

- **Service role** – Must show ✓. If it shows ✗, autopick and draft-order generation will fail; set `SUPABASE_SERVICE_ROLE_KEY` in Netlify (or `.env` locally) and redeploy / restart.
- **Draft order** – After you generate or set order, this should show ✓ and the number of picks. If it shows “No order” and you expect one, use “Generate draft order” or “Set draft order” on the same page.
- **Draft status** – `not_started` → `in_progress` → `completed` as the draft runs.

If all three look correct, the draft is configured correctly for your league.

---

## Quick test (about 10 minutes): manual-style draft

Goal: run a short draft with **Live** type and **manual** picks so you can see picks and rosters update.

1. **League settings**
   - Draft type: **Live**.
   - Draft order: **Manually set by GM** (or Randomized one hour before).
   - Set draft date/time to today and a time a few minutes from now (or in the past so “Begin draft” is available immediately).
   - Save.

2. **Draft tab**
   - As commissioner, open the Draft tab.
   - Check **Draft readiness**: Service role ✓, Draft order and status as expected.
   - If there’s no order: click **Set draft order** (or **Generate draft order** for random), complete the flow, then return to the Draft tab.
   - Click **Begin draft**.

3. **Make picks**
   - As the manager who has pick 1, choose a wrestler and click **Pick**.
   - Confirm: the pick appears in the draft list and on that team’s roster.
   - Repeat for the next manager (or switch user if testing alone) until a few picks are done.

4. **Success criteria**
   - Each pick shows in the draft list with the correct team.
   - Each team’s roster (e.g. My Team or the roster panel) updates after their pick.
   - No “draft_run_id” or service-role errors.

If this works, the core draft pipeline (order, start, picks, rosters) is operational.

---

## Quick test: autopick (no cron)

Goal: confirm autopick runs when **you** start the draft (scheduled time in the past or “Begin draft” used).

1. **League settings**
   - Draft type: **Autopick**.
   - Draft order: **Randomized one hour before draft time** (or manual).
   - Draft date/time: today, time already in the past (e.g. 1 hour ago) so “Begin draft” is available.
   - Save.

2. **Draft tab**
   - Open Draft. **Draft readiness** should show Service role ✓.
   - If **Draft order** is “No order”: use **Generate new draft order** (or **Generate draft order** if no order exists), then you should see an order and **Begin draft**.
   - Click **Begin draft**.

3. **What should happen**
   - The draft should advance automatically (about every 5 seconds per pick).
   - Picks appear in the draft list and rosters fill. You can refresh or wait on the page.
   - If you see “Auto-pick failed” or a service-role error, `SUPABASE_SERVICE_ROLE_KEY` is missing or wrong in the environment where the app is running.

4. **Success criteria**
   - Draft runs to completion without errors.
   - All teams get the correct number of wrestlers (and correct gender mix if you use roster rules).
   - **Draft readiness** never showed Service role ✗.

---

## Scheduled autopick (cron)

Goal: confirm the draft starts at the **scheduled time** without anyone on the draft page.

1. **Setup**
   - Draft type: **Autopick**.
   - Draft order: **Randomized one hour before draft time**.
   - Set draft date/time to **about 1 hour from now** (so cron can generate order in the 50–70 minute window).
   - Ensure league is full. Save.

2. **Before draft time**
   - Netlify Scheduled Function should hit `GET /api/cron/run-scheduled-drafts` every 10 minutes with `x-cron-secret: <CRON_SECRET>`.
   - In the window 50–70 minutes before draft time, cron creates the draft order.
   - You can confirm by opening the Draft tab and checking **Draft readiness**: Draft order should show ✓ and number of picks.

3. **At / after draft time**
   - Cron runs again; it finds the league (autopick, `not_started`, time passed, order exists) and runs the full draft.
   - No one needs to be on the site. After a few minutes, open the Draft tab: status should be **completed** and rosters filled.

4. **If it doesn’t run**
   - Check **Draft readiness** (Service role ✓, order ✓).
   - In Netlify: env vars `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET`; scheduled function enabled and not failing.
   - See `docs/AUTOPICK_DRAFT_FLOW.md` for cron and env details.

---

## Summary

- Use the **Draft readiness** box (Draft tab, as commissioner) to confirm service role and draft order before starting.
- Run the **manual-style test** to validate picks and rosters.
- Run the **autopick test** (with “Begin draft”) to validate autopick and service role.
- Use **scheduled autopick** plus cron when you want a hands-off draft at a set time.

If all three checks (readiness, manual test, autopick test) pass, the draft function is operational for your environment.
