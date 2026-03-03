# Pro Wrestling Boxscore — Data Source for Draftastic Fantasy

## Summary

**You don’t need to scrape the website.** The Boxscore app (in `~/wrestling-boxscore`) stores all data in **Supabase**. The fantasy app should **read from the same Supabase project** and **reuse the existing scoring and event-classification logic** from the Boxscore repo. This doc describes where data lives, the shapes you need, and how to integrate.

---

## Where the data lives

| What | Where |
|------|--------|
| Events & matches | **Supabase** table `events` (matches are a JSONB array on each row) |
| Wrestlers | **Supabase** table `wrestlers` |
| Event type (Raw, SmackDown, PLE, etc.) | **Derived** from event name in code (no column); use `eventClassifier.js` |
| Fantasy points | **Calculated** in code; use `pointsCalculator.js` + `participantParser.js` |

The live site (prowrestlingboxscore.com) is a Vite + React app that loads events and wrestlers from Supabase on startup. There is no separate “API” to scrape; the fantasy app should talk to Supabase directly (read-only for `events` and `wrestlers` is enough).

---

## Boxscore codebase location

- **Path:** `/Users/thisguytoph/wrestling-boxscore`
- **App:** Vite + React, `src/App.jsx` (routes, fetches from Supabase)
- **Scraper/calculators:** `scraper/` — used for processing Supabase data (not for scraping the web)

---

## Supabase tables used for fantasy

### `events`

- **Columns (relevant):** `id`, `name`, `date`, `location`, `matches`, `status`
- **`matches`:** Array of match objects. Typical shape:

```js
{
  order: 1,
  participants: "sami-zayn vs. bronson-reed",
  result: "sami-zayn def. bronson-reed",
  method: "Pinfall",
  time: "12:34",
  stipulation: "None",
  title: "Men's IC Championship",
  titleOutcome: "Successful Defense",
  status: "completed"
}
```

- **War Games matches** (e.g. Survivor Series) can include `warGamesData` from the Boxscore UI:
  - `warGamesData.entryOrder`: array of `{ entryNumber: 1–10, wrestler: slug }` (order of entry; entries 1–5 and 6–10 get 5/4/3/2/1 points each).
  - `warGamesData.pinSubmissionWinner`: slug of wrestler who got the pin/submission.
  - `warGamesData.pinWinnerName`: display name (fallback for matching).
  - Fantasy scoring uses this to award War Games entry-order and pinfall points.

- **Royal Rumble matches** — Winner and Iron Man/Woman are parsed clearly from Boxscore data:
  - **Winner** (for +30): (1) `match.result` when it reads "X won the Royal Rumble"; (2) explicit `match.winner`, `match.winnerWrestler`, or `match.winnerName`; (3) from `match.statistics` / `match.royalRumbleStatistics` text when it contains a line like "Winner: Liv Morgan".
  - **Iron Man/Iron Woman** (+12): (1) `match.ironMan`, `match.ironManWrestler`, `match.royalRumbleIronMan` (at match root); (2) same keys inside `match.royalRumbleData`; (3) parsed from statistics text: "Ironman/Ironwoman: Charlotte Flair - 59:49" or "Iron Man: Name - 40:58".
  - **Most Eliminations** (+12): (1) `match.mostEliminations`, `match.mostEliminationsWrestler`; (2) same inside `royalRumbleData`; (3) parsed from statistics text: "Most Eliminations: Lash Legend - 5" or "Oba Femi & Roman Reigns - 5" for ties.
  - **Inside `royalRumbleData`** (optional): `eliminations` array, `entryOrder`, `timeInRingMinutes`; explicit `ironMan`/`ironManWrestler`, `mostEliminations`/`mostEliminationsWrestler` as above.

- **Event results URL on site:** `https://prowrestlingboxscore.com/event/{event.id}` (for reference only; fantasy app will use Supabase, not this URL).

### `wrestlers`

- **Columns (relevant):** `id` (slug, e.g. `sami-zayn`), `name`, and any you use for gender/brand. Fantasy draft pool can be built from this table (filter by promotion/brand as needed).
- **Status (column):** The `wrestlers` table uses a **`Status`** column (capital S). On [prowrestlingboxscore.com/wrestlers](https://prowrestlingboxscore.com/wrestlers), injured wrestlers show a red **INJ** under their name; that value is stored in `Status`. The fantasy app excludes wrestlers whose `Status` (case-insensitive) is **Inactive**, **Injured**, **INJ**, **Retired**, **Released**, or **Suspended** from all wrestler pool tables and from **auto-draft**. Wrestlers with `status` null or any other value are shown. Use `.or("status.is.null,status.neq.Inactive")` on wrestler queries where supported; the app also filters in code by the full status list.
- **Non-draftable (brand):** Announcers, managers, GMs, front office, celebrity guests, and alumni should not be draftable. The fantasy app treats `brand` values that normalize to **Front Office** (e.g. "Announcers", "Managers", "GM", "Head of Creative", "Commentary", "Commentator", "Authority", "Executive", "Staff", "Broadcast"), **Celebrity Guests**, or **Alumni** (including "Legend", "Legends", "Hall of Fame") as non-draftable: they are excluded from auto-draft and from the Draft Testing pool. Keep in-ring talent on brands like Raw, SmackDown, NXT, or Unassigned so they appear in draft pools.
- **Classification (draft pool):** The draft pool and auto-draft **only** include wrestlers with **`classification` = `Active`** (case-insensitive). Wrestlers with any other classification (e.g. Non-wrestlers, Alumni) or with null/empty classification are excluded. Set `classification` to **`Active`** in the Boxscore app for every full-time, in-ring talent who should be draftable.
- **Part-time / status:** Wrestlers with `status` (case-insensitive) **Part-time**, **Part time**, **Inactive**, **Injured**, **Retired**, **Released**, or **Suspended** are excluded from the draft pool and auto-draft.
- **Auto-draft “significant points”:** Auto-draft only selects from wrestlers who have scored points in the chosen period and who are in the **top 50%** of available wrestlers by that period’s points (for the selected metric: total, R/S, PLE, or Belt). Wrestlers with no points or in the bottom half are never auto-picked when higher scorers are available.
- **Draft blocklist:** An optional blocklist in `lib/draftBlocklist.ts` provides a backup exclusion list; the primary rules are `classification`, status, and brand.
- **Why someone “slips through”:** The app only excludes based on the values **actually stored** in the `wrestlers` table. It does not infer injury or alumni from names. So:
  - **Inactive / alumni (e.g. Braun Strowman):** Set `classification` = **`Alumni`** (or **`Non-wrestlers`**) and/or `status` = **`Inactive`**. If both are null or something else (e.g. "Active"), the wrestler will appear in the draft pool.
  - **Injured:** Set **`Status`** = **`Injured`** or **`INJ`** (as on Boxscore’s red INJ label). Comparison is case-insensitive. If `Status` is null or any other value, the wrestler will appear.
  - **Alumni via brand:** If you use `brand` to indicate alumni, set it to a value that normalizes to **Alumni** (e.g. "Alumni", "Legend", "Legends", "Hall of Fame"). If `brand` is Raw/SmackDown/NXT/Unassigned or null, the wrestler won’t be excluded by brand.
  - To fix: In Supabase (or your Boxscore sync), set the correct `classification` and `status` for each wrestler so the app can filter them without a blocklist.
- **2K ratings:** When available, the Boxscore app stores WWE 2K game ratings on wrestler profiles. The fantasy app reads columns **"2K26 rating"** and **"2K25 rating"** (numeric, nullable; names include a space) from this table and displays them (2K26 if present, else 2K25) on wrestler profiles, draft testing, and wrestler lists. Ensure the Boxscore app writes these columns when 2K rating data is added to profiles on prowrestlingboxscore.com.

### Monthly championship data (end-of-month belt points)

**Canonical display:** [prowrestlingboxscore.com/championships](https://prowrestlingboxscore.com/championships) — the Boxscore site’s championships page is the intended source of truth for who held which title when.

**How the fantasy app gets it today:** We do **not** pull from that URL. We use two sources in Supabase:

1. **`championship_history` table (primary)**  
   If the Supabase project has a **`championship_history`** table (one row per reign, with fields like `champion_slug`/`champion_id`, `title`/`title_name`, `won_date`/`start_date`, `lost_date`/`end_date`) and it has rows, we use it for monthly belt points. That table can be populated by the Boxscore app (e.g. from prowrestlingboxscore.com/championships) or by a separate sync job; the fantasy app only reads it. This is the most stable and reliable source.

2. **Inferred from events (fallback)**  
   When `championship_history` is empty or missing, we build title reigns from the **`events`** table: for each completed event we look at `matches` for title changes, parse winners (and expand teams into individuals), and derive who held which title on which date.

To use prowrestlingboxscore.com/championships as the source of truth, sync that page (or its backing API) into **`championship_history`**; the fantasy app will then use it automatically.

---

## Event type (Major / Medium / Minor PLE, Raw, SmackDown)

Event type is **not** stored in the DB; it’s derived from the event **name** in the Boxscore repo:

- **File:** `wrestling-boxscore/scraper/src/parsers/eventClassifier.js`
- **Function:** `classifyEventType(eventName)` → returns constants like `EVENT_TYPES.RAW`, `EVENT_TYPES.SMACKDOWN`, `EVENT_TYPES.WRESTLEMANIA_NIGHT_1`, etc.
- **PLE category:** `getPLECategory(eventType)` → `'major' | 'medium' | 'minor' | 'weekly'`

The fantasy app should use this same logic (copy the file or depend on the Boxscore package) so that scoring and event-type filters stay in sync with Boxscore.

---

## Fantasy points (scoring)

Scoring is already implemented in the Boxscore repo:

- **File:** `wrestling-boxscore/scraper/src/calculators/pointsCalculator.js`
- **Function:** `calculateMatchPoints(match, event, allMatches, wrestlerName)`  
  - Returns `{ matchPoints, titlePoints, specialPoints, mainEventPoints, battleRoyalPoints, total, breakdown }`
  - Handles DQ (half points), No Contest (appearance only), title win (+5), title defense (+4 / +2 for DQ), main event bonuses, and event-specific rules (WrestleMania, SummerSlam, Royal Rumble, MITB, etc.)
- **Participant parsing:** `wrestling-boxscore/scraper/src/parsers/participantParser.js`  
  - `extractMatchParticipants(match)` → `{ participants, winners, losers, unclear, hasResult, isTagTeam }`  
  - Participants/winners are derived from `match.participants` and `match.result` (slugs/names).

The fantasy app should **reuse** this calculator (and classifier) so that “official” points match what you’ve been using. Options:

1. **Copy** the relevant files into the fantasy app (`eventClassifier.js`, `pointsCalculator.js`, `participantParser.js`, and any dependencies like `matches.js` extractors and `logger`).
2. **Monorepo / shared package:** Move these into a shared package used by both Boxscore and Draftastic Fantasy.
3. **Submodule or path dependency:** Fantasy app depends on `wrestling-boxscore` and imports from `scraper/src/...`.

---

## What the fantasy app needs to do

1. **Connect to Supabase** (same project as Boxscore) with a key that can at least **read** `events` and `wrestlers`. Use the same `VITE_SUPABASE_URL` and a key with read access (anon key is fine if RLS allows it).
2. **Fetch events** (e.g. for a season date range) and **wrestlers**; build the draft pool from `wrestlers` (and optionally filter by brand/promotion).
3. **Classify each event** with `classifyEventType(event.name)`.
4. **For each event, for each match,** call `calculateMatchPoints(match, event, event.matches, wrestlerName)` for every wrestler on every fantasy roster that appears in that match (match wrestlers to roster by name/slug using the same participant parsing).
5. **Aggregate** points per team per event/season and store in the fantasy app’s own DB (leagues, rosters, scoring results).

---

## Files to reuse from wrestling-boxscore

| Purpose | Path in wrestling-boxscore |
|--------|-----------------------------|
| Event type from name | `scraper/src/parsers/eventClassifier.js` |
| Points per match per wrestler | `scraper/src/calculators/pointsCalculator.js` |
| Participants/winners from match | `scraper/src/parsers/participantParser.js` |
| Match helpers (main event, title, DQ, etc.) | `scraper/src/extractors/matches.js` |
| Fetch events from Supabase | `scraper/src/extractors/events.js` (optional; fantasy app can query Supabase directly) |
| Logger (if needed) | `scraper/src/utils/logger.js` |

Dependencies of the scraper (e.g. `dateUtils.js`) may be needed if you use the events extractor; for fantasy you might only need the calculator, classifier, participant parser, and match extractor.

---

## Next steps

1. **Fantasy app:** Add Supabase client; read `events` and `wrestlers` (read-only).
2. **Port or link** `eventClassifier.js`, `pointsCalculator.js`, `participantParser.js`, and `scraper/src/extractors/matches.js` (and any shared utils) into the fantasy app.
3. **Define season boundaries** (e.g. first May event → WrestleMania end) and filter events by date; run the calculator for each match and aggregate by roster.
4. Optionally add a **small API** in the Boxscore repo (e.g. Netlify function) that returns events + matches + classified type if you prefer the fantasy app not to hold Supabase credentials (then the fantasy app would call that API instead of Supabase directly).
