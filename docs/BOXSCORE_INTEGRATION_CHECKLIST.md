# Boxscore → Fantasy integration checklist

Use this when wiring the Draftastic Fantasy app to Pro Wrestling Boxscore data and scoring.

## 1. Supabase access

- [ ] Get from Boxscore project: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (or a key with read access to `events` and `wrestlers`).
- [ ] In the fantasy app, add env vars (e.g. `SUPABASE_URL`, `SUPABASE_ANON_KEY`) and create a Supabase client.
- [ ] Verify you can run: `supabase.from('events').select('id, name, date, matches').order('date', { ascending: false }).limit(5)` and get data.
- [ ] Verify you can run: `supabase.from('wrestlers').select('id, name')` and get data.

## 2. Copy scoring and classification logic

From **`/Users/thisguytoph/wrestling-boxscore`** copy (or link) these into the fantasy app:

| File | Notes |
|------|--------|
| `scraper/src/parsers/eventClassifier.js` | Uses `logger`; either copy `scraper/src/utils/logger.js` or replace with `console` / your logger. |
| `scraper/src/parsers/participantParser.js` | No Supabase dependency. |
| `scraper/src/extractors/matches.js` | Pure helpers (isMainEvent, isTitleMatch, etc.). |
| `scraper/src/calculators/pointsCalculator.js` | Depends on eventClassifier, participantParser, matches. |

If you use the scraper’s `logger`, also copy:

- `scraper/src/utils/logger.js`

Optional (only if you want to use the scraper’s event fetcher):

- `scraper/src/extractors/events.js` (uses Supabase and `eventClassifier`)
- `scraper/src/utils/dateUtils.js`

## 3. Data shapes to rely on

- **Event:** `{ id, name, date, location, matches }`. Use `event.name` for `classifyEventType(event.name)`.
- **Match:** `{ order, participants, result, method, title, titleOutcome, status }`. Pass full `event` and `event.matches` into `calculateMatchPoints(match, event, event.matches, wrestlerName)`.
- **Wrestler name:** Use the same slug/name as in Boxscore (e.g. `sami-zayn`) when calling the points calculator so participant parsing matches.

## 4. Fantasy pipeline (high level)

- [ ] Load events for the season (filter by date).
- [ ] Load wrestlers (draft pool).
- [ ] For each league/roster, store which wrestlers each team has.
- [ ] For each event, for each match, for each wrestler in that match, resolve which team(s) own that wrestler and call `calculateMatchPoints(...)`; add points to that team for that event.
- [ ] Persist points (e.g. per event, per team) in your fantasy DB and aggregate for standings.

## 5. Optional: API instead of direct Supabase

If you prefer the fantasy app not to use Supabase directly, add a read-only API in the Boxscore repo (e.g. Netlify Function or small Node server) that:

- Returns events (with matches) in a date range.
- Returns wrestlers (or draft pool).

Then the fantasy app calls that API and still runs the same `eventClassifier` + `pointsCalculator` logic on the returned data.
