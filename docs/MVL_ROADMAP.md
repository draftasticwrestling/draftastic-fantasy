# MVL Roadmap: The Road to SummerSlam

**Standard seasons:** Road to SummerSlam (first Raw in May → SummerSlam Night 2), Road to Survivor Series (first Raw in August → Survivor Series), Road to WrestleMania (first Raw in December → WrestleMania Night 2), Chamber to Mania (Elimination Chamber → WrestleMania Night 2, beta test). See `lib/leagueSeasons.ts` and `docs/PUBLIC_LEAGUES_SCORING.md`.

**Scoring:** Same wrestler/event point system as main app (see How it works), **plus** Head to Head and Draftastic Championship Belt rules — see `docs/PUBLIC_LEAGUES_SCORING.md`.

---

## To-do list

### 1. User accounts
- [x] Sign up (email/password or Google OAuth)
- [x] Sign in / sign out (Nav shows user + Sign out when logged in)
- [x] Session handling (Supabase Auth + @supabase/ssr cookie-based)
- [x] Forgot password (reset link via email)
- [x] Profile (display name; avatar_url column present for later)

### 2. Create a league & invite friends
- [x] Create a league (name, optional start/end dates, commissioner)
- [x] Invite flow (generate invite link with token, 7-day expiry)
- [x] Join league (visit /leagues/join?token=…, sign in if needed, join)
- [x] League membership list and roles (commissioner, owner)
- [ ] Optional: invite by email (send email with link)

### 3. Drafting system
- [ ] **a) Live draft** — Draft room on the website, real-time picks, turn order, timer (optional)
- [ ] **b) Auto-draft** — Owners submit wrestler rankings; system runs draft automatically
- [x] **c) Commissioner manual input** — Commissioner enters each owner’s roster after an off-line draft
- [ ] Draft settings (snake/linear, number of rounds, roster slots)

### 4. Drop wrestlers & sign free agents
- [ ] Drop a wrestler (remove from roster, return to free-agent pool)
- [ ] Free-agent pool (view available wrestlers)
- [ ] Add free agent (claim wrestler to roster); **max 2 FA moves per manager per week**; FA window opens after last weekly event (e.g. SmackDown/PLE), locks 1 hr before each event (see `docs/PUBLIC_LEAGUES_SCORING.md` + `lib/publicLeagueRosterRules.ts`)
- [ ] **Line-up (active roster):** managers can set who is active; locks **30 min** before each event
- [ ] Roster limits and position rules (if any)

### 5. Trades between owners
- [ ] Propose trade (select wrestlers/picks to send and receive, select partner)
- [ ] View pending trades (sent / received)
- [ ] Accept / reject trade
- [ ] Trade processing (swap roster assignments, optional commissioner approval)

### 6. Weekly matchups & Head to Head
- [ ] Define matchup schedule (owner vs owner by week); **structure:** even teams = all H2H; odd teams = 1 Triple Threat + rest H2H (no byes). See `docs/PUBLIC_LEAGUES_SCORING.md` and `lib/publicLeagueMatchups.ts`.
- [ ] Weekly H2H/Triple Threat scoring: **win = 10 pts**, **tie = 5 pts**
- [ ] Matchup results (winner, margin; Triple Threat = one winner, two losers or ties)
- [ ] Standings (win/loss record, total points, tiebreakers)
- [ ] **Draftastic Championship Belt:** awarded June 1 to leader; must defend weekly in H2H; successful defense = +4 pts; initial belt win = +5 pts; monthly holder bonus = +10 pts (see doc + `lib/publicLeagueScoring.ts`)

---

## League structure (Road to SummerSlam MVL)

- **Teams:** Minimum 3, maximum 12. Roster size and gender minimums depend on league size.

| Teams | Roster size | Min female | Min male |
|-------|-------------|------------|----------|
| 3     | 15          | 6          | 6        |
| 4     | 15          | 6          | 6        |
| 5     | 15          | 6          | 6        |
| 6     | 10          | 4          | 4        |
| 7     | 10          | 4          | 4        |
| 8     | 8           | 3          | 3        |
| 9     | 8           | 3          | 3        |
| 10    | 6           | 2          | 2        |
| 11    | 6           | 2          | 2        |
| 12    | 5           | 2          | 2        |

- **Active per event:** Roster size 15 or 10 → 8 active; 8 → 6 active; 6, 5, or 4 → 4 active. See `lib/leagueStructure.ts` (`ACTIVE_PER_EVENT_BY_ROSTER_SIZE`, `getActivePerEvent()`).
- Implemented in `lib/leagueStructure.ts`; league detail page shows current roster rules based on member count.

---

## Notes
- Waiver rules, matchup format, etc. to be added as provided.
- This doc can be updated with sub-tasks and checkboxes as implementation progresses.
