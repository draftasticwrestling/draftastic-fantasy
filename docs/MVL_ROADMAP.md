# MVL Roadmap: The Road to SummerSlam

**League:** The Road to SummerSlam (MVL Example)  
**Window:** May 1, 2026 — August 2, 2026 (Night 2 of SummerSlam)  
**Scoring:** Same point system as main app (see How it works).

---

## To-do list

### 1. User accounts
- [x] Sign up (email/password or Google OAuth)
- [x] Sign in / sign out (Nav shows user + Sign out when logged in)
- [x] Session handling (Supabase Auth + @supabase/ssr cookie-based)
- [x] Forgot password (reset link via email)
- [ ] Profile (display name, optional avatar) — optional next step

### 2. Create a league & invite friends
- [ ] Create a league (name, settings, commissioner)
- [ ] Invite flow (link or email invite)
- [ ] Join league (accept invite, request to join)
- [ ] League membership list and roles (commissioner, owner)

### 3. Drafting system
- [ ] **a) Live draft** — Draft room on the website, real-time picks, turn order, timer (optional)
- [ ] **b) Auto-draft** — Owners submit wrestler rankings; system runs draft automatically
- [ ] **c) Commissioner manual input** — Commissioner enters each owner’s roster after an off-line draft
- [ ] Draft settings (snake/linear, number of rounds, roster slots)

### 4. Drop wrestlers & sign free agents
- [ ] Drop a wrestler (remove from roster, return to free-agent pool)
- [ ] Free-agent pool (view available wrestlers)
- [ ] Add free agent (claim wrestler to roster, optional waiver priority / waivers)
- [ ] Roster limits and position rules (if any)

### 5. Trades between owners
- [ ] Propose trade (select wrestlers/picks to send and receive, select partner)
- [ ] View pending trades (sent / received)
- [ ] Accept / reject trade
- [ ] Trade processing (swap roster assignments, optional commissioner approval)

### 6. Weekly matchups
- [ ] Define matchup schedule (owner vs owner by week)
- [ ] Weekly scoring (points for the week per owner)
- [ ] Matchup results (winner, margin, bonus points for matchup win if desired)
- [ ] Standings (win/loss record, total points, tiebreakers)

---

## Notes
- League structure details (roster size, matchup format, waiver rules, etc.) to be added as provided.
- This doc can be updated with sub-tasks and checkboxes as implementation progresses.
