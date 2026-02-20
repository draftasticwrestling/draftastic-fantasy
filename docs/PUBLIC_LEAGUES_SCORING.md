# Private Leagues: Head to Head & Championship Belt Scoring

Private Leagues (MVL) use **wrestler scoring** from events (same as How it works / Boxscore) **plus** the following Head to Head and Championship Belt point system.

---

## Season options

There are three standard season options. Commissioners can choose one when creating a league (or set custom start/end dates).

| Season | Window |
|--------|--------|
| **Road to SummerSlam** | First Raw in May through SummerSlam Night 2 |
| **Road to Survivor Series** | First Raw in August through Survivor Series (late November) |
| **Road to WrestleMania** | First Raw in December through WrestleMania Night 2 |
| **Chamber to Mania** | Elimination Chamber through WrestleMania Night 2 (beta test) |

Defined in `lib/leagueSeasons.ts` (`SEASON_OPTIONS`).

---

## Weekly matchup structure

- **Priority:** When the number of teams is **even**, all matchups are **Head to Head** (two teams per matchup). When the number of teams is **odd**, use **one Triple Threat** (three teams) and the rest Head to Head so that **no owner has a bye week**.

| Teams | Structure |
|-------|-----------|
| 3     | 1 Triple Threat (all 3 compete) |
| 4     | 2 Head to Head |
| 5     | 1 Head to Head + 1 Triple Threat |
| 6     | 3 Head to Head |
| 7     | 2 Head to Head + 1 Triple Threat |
| 8     | 4 Head to Head |
| 9     | 3 Head to Head + 1 Triple Threat |
| 10    | 5 Head to Head |
| 11    | 4 Head to Head + 1 Triple Threat |
| 12    | 6 Head to Head |

- **Formula:** Even N → N/2 H2H matchups. Odd N → 1 Triple Threat (3 teams) + (N−3)/2 H2H matchups (2 teams each). Implemented in `lib/publicLeagueMatchups.ts`.

---

## Head to Head Gameplay

- **Weekly matches:** Each manager competes in one matchup per week (either H2H vs one opponent or Triple Threat vs two opponents).
- **Weekly match scoring:**
  - **Head to Head (2 teams):** Win → **10 points**, Tie → **5 points**.
  - **Triple Threat (3 teams):** Win → **15 points**, Tie → **7.5 points**.
  - (Loss → 0 points from the matchup; wrestler points still count toward total.)
  - Draftastic Championship Belt points (initial win, defense, monthly holder) are unchanged.

---

## Draftastic Championship Belt

- **Initial award:** On **June 1**, the league leader (by total points: belt + head-to-head + overall wrestler scoring) is awarded the **Draftastic Championship Belt**.
- **Initial belt win bonus:** The manager who wins the belt on June 1 receives **5 additional points**.
- **Belt defense:** The belt must be **defended each week** in the Head to Head matchup.
  - **Successful title defense** in that week’s H2H matchup → **4 additional points** for that week.
  - If the champion loses the H2H matchup, the belt changes hands to the opponent.
- **Monthly title holder bonus:** At the **end of each month**, the manager currently holding the Draftastic Championship Belt receives **10 additional points** in title points.

---

## Roster change rules

- **Active wrestlers per event:** Each manager sets a **line-up** (who is active) for each event; only active wrestlers count for scoring. The number of active slots depends on roster size:

| Roster size | Active per event |
|-------------|------------------|
| 15          | 8                |
| 10          | 8                |
| 8           | 6                |
| 6           | 4                |
| 5           | 4                |
| 4           | 4                |

- **Line-up (active roster):** Managers can change who is **active** (which wrestlers count for that event) up to **30 minutes before** the start of each event. After that, the line-up is locked for that event.
- **Free agent signings/drops:** Each manager is eligible for **up to 2** free agent moves (add/drop) **per week**. Moves are **not** allowed during an event.
  - **Open:** From the **end of the last weekly event** (e.g. SmackDown or that week’s PLE) until the next lock.
  - **Lock:** Rosters lock **1 hour before** each event. While locked, no FA moves and no line-up changes for that event.
- Summary: Line-up lock = 30 min before event; full roster lock (FA + line-up) = 1 hour before event. FA window runs from end of last event until 1 hour before the next event; max 2 FA moves per manager per week. Active-per-event and lock constants in `lib/leagueStructure.ts` and `lib/publicLeagueRosterRules.ts`.

---

## Point constants (for implementation)

| Rule                         | Points  |
|-----------------------------|---------|
| H2H match win               | 10      |
| H2H match tie               | 5       |
| Triple Threat win           | 15      |
| Triple Threat tie           | 7.5     |
| Initial belt win (June 1)   | 5       |
| Successful belt defense     | 4       |
| Monthly title holder bonus  | 10      |

These are defined in `lib/publicLeagueScoring.ts` for use when building weekly matchups and belt logic.
