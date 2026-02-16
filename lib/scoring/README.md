# Scoring (from Pro Wrestling Boxscore)

Copied from `wrestling-boxscore/scraper/src/` for the fantasy pipeline.

- **eventClassifier.js** — Event type from name (Raw, SmackDown, PLEs).
- **participantParser.js** — Parse `participants` / `result` into winners and participants.
- **matches.js** — Helpers: main event, title match, DQ, battle royal, etc.
- **pointsCalculator.js** — `calculateMatchPoints(match, event, allMatches, wrestlerName)`.
- **scoreEvent.js** — Runs the calculator for every participant in every match of one event.

**API:** `GET /api/score-event?eventId=xxx` loads the event from Supabase and returns points per wrestler per match.
