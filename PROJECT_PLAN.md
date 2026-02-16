# Draftastic Fantasy — Pro Wrestling Fantasy App

## Vision

A fantasy sports platform for pro wrestling (WWE-first), modeled after [Yahoo Fantasy Football](https://football.fantasysports.yahoo.com/). Users register, create leagues with friends, set a draft date, draft wrestler rosters, and compete based on real results. Wrestler and event data is sourced from **Pro Wrestling Boxscore** (www.prowrestlingboxscore.com).

---

## Core Rules (from your league)

- **Roster:** 8–15 wrestlers (draft 12 to start). Minimum 4 male, 4 female.
- **Contracts:** 4× three-year, 4× two-year, 4× one-year (assigned at draft).
- **Season:** First event in May → end of WrestleMania.
- **Scoring:** Match wins (full pts; DQ = half), main event bonus, title defense (+4), title win (+5), appearance, Slammys/WWE2K, championship-held-at-month-end.
- **Events:** Major PLE, Medium PLE, Minor PLE, Raw/Smackdown (see “Points” tab for full breakdown).
- **Draft:** After WrestleMania, must finish by first May event. 6 rounds; order by weighted lottery (previous season finish).

---

## High-Level Phases

| Phase | Focus |
|-------|--------|
| **0** | Data & foundation — understand Boxscore data, define schemas, pick stack |
| **1** | Auth, users, leagues — sign up, create/join leagues, league settings |
| **2** | Wrestlers & events — wrestler pool, event types, scoring engine |
| **3** | Draft — draft lobby, draft order, live draft (snake), contract assignment |
| **4** | Rosters & scoring — rosters per team, pull results from Boxscore, apply scoring |
| **5** | Standings & UX — leaderboards, history, notifications, polish |

---

## Detailed To-Do List

### Phase 0 — Data & foundation

- [ ] **0.1** Document how to get data from Pro Wrestling Boxscore (APIs, scraping, or export). Identify: wrestlers, events, matches, winners, titles, main event, event type (Major/Medium/Minor PLE, Raw/Smackdown).  
  → **Strategy:** Scrape prowrestlingboxscore.com (see [docs/BOXSCORE_DATA.md](docs/BOXSCORE_DATA.md)). Event list and required fields documented; results-page URL/structure still to be confirmed.
- [ ] **0.2** Define canonical data models: `Wrestler`, `Event`, `Match`, `Title`, `EventType`, and how they map to Boxscore.
- [ ] **0.3** Choose tech stack (e.g. Next.js/React + Node API, or similar; DB e.g. Postgres).
- [ ] **0.4** Set up repo, env, and basic app shell (front end + API).
- [ ] **0.5** Implement a minimal “data pipeline”: fetch or ingest one event’s results from Boxscore and store in your DB (proof of concept).

### Phase 1 — Users & leagues

- [ ] **1.1** User registration and login (email/password or OAuth).
- [ ] **1.2** User profile (display name, optional avatar).
- [ ] **1.3** Create league: name, draft date/time, roster/contract rules (or use defaults from your sheet).
- [ ] **1.4** Invite/join league (invite link or code, accept invite).
- [ ] **1.5** League settings: number of teams, draft order rule (e.g. weighted lottery), trade deadline (if applicable).
- [ ] **1.6** League “home” page: members, draft date, status (pre-draft / drafting / in-season / ended).

### Phase 2 — Wrestlers & events

- [ ] **2.1** Wrestler pool: list of wrestlers eligible for draft (WWE main roster at minimum; later NXT, etc.). Store: name, gender, promotion, status.
- [ ] **2.2** Event catalog: list of events for the season with type (Major PLE, Medium PLE, Minor PLE, Raw, Smackdown) and date.
- [ ] **2.3** Sync or import event results from Boxscore (per event or batch) into `Match`/`Event` tables.
- [ ] **2.4** Scoring engine: given a match + event type + context (main event?, title?, result type), compute points per wrestler (win/loss/DQ/no contest, title win/defense, appearance).
- [ ] **2.5** Admin or script to “run” scoring for an event and attach points to rosters (so we know which team owns which wrestler).

### Phase 3 — Draft

- [ ] **3.1** Draft configuration: draft order (e.g. weighted lottery), number of rounds (e.g. 6), contract lengths per round (e.g. 1–2: 3yr, 3–4: 2yr, 5–6: 1yr).
- [ ] **3.2** Draft lobby: page where all league members can join; countdown to draft start; “Start draft” when ready.
- [ ] **3.3** Live draft: snake (or linear) order, pick a wrestler from available pool, assign contract length by round; timer optional.
- [ ] **3.4** Persist picks: each pick → roster entry (wrestler + team + contract length + year).
- [ ] **3.5** Post-draft: rosters visible to all in league; “Draft recap” view.

### Phase 4 — Rosters & scoring

- [ ] **4.1** Roster view per team: 12 (or 8–15) wrestlers with contract years remaining.
- [ ] **4.2** Link Boxscore match results to wrestlers and then to team rosters (who owns whom).
- [ ] **4.3** Run scoring for each event (cron or manual “Process event”); store points per wrestler per event, and aggregate per team.
- [ ] **4.4** Handle edge cases: DQ (half points), no contest (appearance only), main event vs featured match, title win vs defense, monthly championship bonus.
- [ ] **4.5** Optional: trades (if in scope for v1, define trade rules and deadline).

### Phase 5 — Standings & UX

- [ ] **5.1** League standings: total points per team, sort by rank; show per-event breakdown (optional).
- [ ] **5.2** “Match center” or “Recent events”: list of events with results and points awarded.
- [ ] **5.3** Season history: past seasons, final standings, draft order for next year (for weighted lottery).
- [ ] **5.4** Notifications: draft reminder, “Draft starting in 1 hour,” weekly “Your team’s points” (email or in-app).
- [ ] **5.5** Responsive UI (mobile-friendly) and basic accessibility.
- [ ] **5.6** Copy and flows inspired by Yahoo Fantasy (e.g. “My Teams”, “League”, “Draft”, “Standings”).

### Later / expansion

- [ ] Multiple promotions (NXT, TNA, AEW, etc.) and filters (WWE-only for v1).
- [ ] Waiver wire / free agents (if you add that rule).
- [ ] Payout tracking (optional; sensitive — keep minimal or manual).
- [ ] Public leagues and discovery.

---

## Recommended Starting Point

**Start with Phase 0, in this order:**

1. **0.1 – 0.2 (Data)**  
   - Inspect Pro Wrestling Boxscore: how do you get event results and wrestler names (API, CSV, or scraping)?  
   - Write a short doc (e.g. `docs/BOXSCORE_DATA.md`) that describes:  
     - Where data lives (URLs, feeds, exports).  
     - Fields you need: event name/date/type, match card, participants, winner, title on the line, main event flag, result type (pin, DQ, no contest, etc.).  
   - Define your internal models (`Wrestler`, `Event`, `Match`, etc.) and map Boxscore → your schema.  
   This unblocks everything else (scoring, draft pool, sync).

2. **0.3 – 0.4 (Stack + shell)**  
   - Pick stack (e.g. Next.js 14+ with App Router, Postgres, Prisma or Drizzle).  
   - Create the repo: app shell, DB connection, one “health” API route and one simple page.  
   So you have a running app and a place to add auth and leagues.

3. **0.5 (First data pipeline)**  
   - Build a minimal script or API that:  
     - Fetches (or reads from export) one real event from Boxscore.  
     - Saves events + matches + wrestlers into your DB.  
   - Validate that you can represent one full event (matches, winners, main event, title) in your schema.  
   After this, you can implement the scoring engine (Phase 2.4) against real-shaped data.

4. **Then** move to **Phase 1 (auth + leagues)** so users can create leagues and you can later attach drafts and rosters to those leagues.

---

## Summary

| Priority | Task |
|----------|------|
| 1 | Document Boxscore data access and define Wrestler/Event/Match (and related) models. |
| 2 | Choose stack and create app + DB shell. |
| 3 | Build minimal ingest for one Boxscore event. |
| 4 | Add auth and league CRUD (create, join, settings). |
| 5 | Implement scoring engine and then draft + rosters. |

If you tell me your preferred stack (e.g. Next.js + Postgres) and how you currently get data from Pro Wrestling Boxscore (API, CSV, manual), I can turn Phase 0 into concrete steps and starter code (e.g. schema, one ingest script, and one league API) in this repo.
