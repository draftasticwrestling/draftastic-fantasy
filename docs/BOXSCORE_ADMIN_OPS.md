# Boxscore admin operations (Draftastic)

Official home for **event results** and **championship / title history** data entry. Same Supabase database as [prowrestlingboxscore.com](https://prowrestlingboxscore.com); public pages on both sites read the same tables.

**Who can edit:** Site admins only (`profiles.is_site_admin`), via [Site admin → Boxscore admin](/internal-admin/boxscore).

---

## Daily workflows (PWBS parity)

### Post a completed show

1. Go to **Boxscore admin → Events & card → Add event** (`/internal-admin/boxscore/events/new`).
2. Enter event metadata (name, date, location, broadcast time, preview/recap).
3. Build the card with match builders (standard, gauntlet, War Games, etc.) or add promos.
4. Set status to **completed** and save.
5. Verify on **Event results** (`/event-results/{show}-{date}`) — fantasy scoring updates automatically.

### Update an existing show

1. **Events & card** → search (filter **Live** if needed) → **Edit**.
2. Edit matches inline; use **Save changes**.
3. Site admins see an **Edit this event** bar on public event-results pages.

### Live show

1. **Events** → filter **Live** (`/internal-admin/boxscore/events?status=live`) → **Edit event**.
2. On each match, use **Edit** → set **Match Status** to **Live (in progress)** and add commentary as the show airs.
3. When finished, set event status to **completed**.

### Title change (after the show)

Match saves **do not** update championships (same as PWBS).

1. **Champions & title history** (`/internal-admin/boxscore/championships`).
2. Select the title in the left list.
3. Choose **Title change** (not Historical reign).
4. Fill champion, date won, event — prior open reign is closed automatically.
5. Current champion on `championships` syncs from history (or click **Sync current champion from history**).

### Backfill old reigns

Use **Historical reign** when adding rows that should **not** change who holds the belt today.

### Tag partner substitution (injury / lineup change)

When one tag partner is replaced but the **team keeps the belt** (not a match loss):

1. **Champions & title history** → select the tag title (e.g. Raw Tag Team Championship).
2. If the open reign still uses the generic team slug (`the-vision`), click **Edit** on that row and set **Champion slug** to the explicit member pair (e.g. `logan-paul-and-austin-theory`) so historical belt scoring stays tied to that lineup.
3. Click **+ Add reign** → **Partner Substitution** (not Title Change).
4. Fill in the **new** lineup:
   - **Champion:** `The Vision (Austin Theory & Bron Breakker)` (or `Austin Theory & Bron Breakker`)
   - **Champion slug:** `austin-theory-and-bron-breakker` (or `the-vision` for the current lineup only)
   - **Date won:** today’s date (substitution date)
   - **Event won:** `Partner substitution` (prefilled)
   - Leave **Defeated** blank
5. Save. The prior reign is closed with **Date lost** = that same date and **Event lost** = `Partner substitution` — not a show name.

**Why two rows:** Fantasy weekly belt hold uses reign date ranges. Logan Paul & Austin Theory keep credit through last week; Austin Theory & Bron Breakker start earning from this week’s Sunday once that week’s shows are complete. The public title page shows **Partner substitution** instead of implying the prior team lost the belt in a match.

**Also update:** Tag teams & stables (swap the injured member) and optionally add a title fact noting the injury.

---

## URL cheat sheet

| Task | PWBS (legacy) | Draftastic (use this) |
|------|---------------|------------------------|
| Add event | `/add-event` | `/internal-admin/boxscore/events/new` |
| Edit event | `/edit-event/{slug}` | `/internal-admin/boxscore/events/{id}/edit` |
| Live shows | Edit event → Edit match (status live) | `/internal-admin/boxscore/events?status=live` |
| Title history | `/championship/{id}` | `/internal-admin/boxscore/championships` |
| Wrestlers | `/wrestlers` | `/internal-admin/boxscore/wrestlers` |
| Tag teams | Tag teams view | `/internal-admin/boxscore/tag-teams-stables` |
| Dropdown labels | `options.js` | `/internal-admin/boxscore/options` |
| Public results | `/events/{slug}` | `/event-results/{slug}` |
| Public titles | `/championship/{id}` | `/championship/{id}` |

---

## Tables (shared with PWBS)

| Table | Purpose |
|-------|---------|
| `events` | Show metadata + `matches` JSON |
| `wrestlers` | Roster, images, ratings |
| `championships` | Current champion snapshot per title |
| `championship_history` | Reign-by-reign history |
| `tag_teams`, `tag_team_members` | Tag team metadata |

---

## Migration notes

- **No iframe embed** — tools are native in Draftastic site admin.
- PWBS can remain available during transition; avoid editing the same live event on both sites at once.
- If a column is missing (e.g. `broadcast_start_ts`), run the SQL migrations in `supabase/` referenced from `docs/BOXSCORE_DATA.md`.
- Technical file mapping: `docs/PWBS_ADMIN_SOURCE_MAP.md`.

---

## Support

- Read-only JSON inspection: `/internal-admin/events/{eventId}`
- Stat correction notices for leagues: `/internal-admin/stat-corrections`
