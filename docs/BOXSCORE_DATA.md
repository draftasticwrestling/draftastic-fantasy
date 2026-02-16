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
