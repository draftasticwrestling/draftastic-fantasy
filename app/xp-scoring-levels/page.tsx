import Link from "next/link";
import { XP_LEVELS } from "@/lib/xp/xpLevels";
import { XP_AMOUNTS } from "@/lib/xp/xpReasons";

const XP_GRANT_ROWS: Array<{ key: keyof typeof XP_AMOUNTS; label: string; notes?: string }> = [
  {
    key: "league_started",
    label: "Start a league",
    notes: "When your league reaches 3 factions (you plus 2 others who join)",
  },
  { key: "league_joined", label: "Join a league" },
  { key: "free_agent_move", label: "Complete a free agent move" },
  { key: "trade_executed", label: "Complete a trade" },
  { key: "daily_login", label: "Daily login" },
  { key: "login_streak_3", label: "3-day login streak" },
  { key: "login_streak_10", label: "10-day login streak" },
  { key: "login_streak_30", label: "30-day login streak" },
  {
    key: "fantasy_points_per_50",
    label: "Fantasy scoring milestone",
    notes: "Granted per 50 fantasy points",
  },
  { key: "weekly_high_score", label: "Weekly high score (when applicable)" },
  { key: "league_second_3", label: "League placement: 2nd place (3-team league)" },
  { key: "league_second_4", label: "League placement: 2nd place (4-team league)" },
  { key: "league_second_5", label: "League placement: 2nd place (5-team league)" },
  { key: "league_second_6", label: "League placement: 2nd place (6-team league)" },
  { key: "league_win_3", label: "League winner (3-team league)" },
  { key: "league_win_4", label: "League winner (4-team league)" },
  { key: "league_win_5", label: "League winner (5-team league)" },
  { key: "league_win_6", label: "League winner (6-team league)" },
];

export const metadata = {
  title: "XP Scoring & Levels — Draftastic Fantasy",
  description: "XP actions, grant values, and full level threshold table.",
};

export default function XpScoringLevelsPage() {
  return (
    <main className="app-page" style={{ maxWidth: 980, fontSize: 16, lineHeight: 1.55 }}>
      <p style={{ marginBottom: 24 }}>
        <Link href="/faq">← Back to FAQ</Link>
      </p>

      <h1 style={{ marginBottom: 8 }}>XP Scoring &amp; Level Descriptions</h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: 18 }}>
        XP measures account progression across gameplay and engagement. Level is based on cumulative total XP.
      </p>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ marginBottom: 10 }}>XP Grant Values</h2>
        <div style={{ overflowX: "auto", border: "1px solid var(--color-border)", borderRadius: 10 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
            <thead>
              <tr style={{ background: "var(--color-bg-elevated)" }}>
                <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid var(--color-border)" }}>
                  Action
                </th>
                <th style={{ textAlign: "right", padding: "10px 12px", borderBottom: "1px solid var(--color-border)" }}>
                  XP
                </th>
                <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid var(--color-border)" }}>
                  Notes
                </th>
              </tr>
            </thead>
            <tbody>
              {XP_GRANT_ROWS.map((row) => (
                <tr key={row.key}>
                  <td style={{ padding: "9px 12px", borderBottom: "1px solid var(--color-border)" }}>{row.label}</td>
                  <td
                    style={{
                      padding: "9px 12px",
                      borderBottom: "1px solid var(--color-border)",
                      textAlign: "right",
                      fontWeight: 700,
                    }}
                  >
                    +{XP_AMOUNTS[row.key]}
                  </td>
                  <td style={{ padding: "9px 12px", borderBottom: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}>
                    {row.notes ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 style={{ marginBottom: 10 }}>Level Thresholds</h2>
        <div style={{ overflowX: "auto", border: "1px solid var(--color-border)", borderRadius: 10 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
            <thead>
              <tr style={{ background: "var(--color-bg-elevated)" }}>
                <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid var(--color-border)" }}>
                  Level
                </th>
                <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid var(--color-border)" }}>
                  Title
                </th>
                <th style={{ textAlign: "right", padding: "10px 12px", borderBottom: "1px solid var(--color-border)" }}>
                  Min XP
                </th>
              </tr>
            </thead>
            <tbody>
              {XP_LEVELS.map((level) => (
                <tr key={level.level}>
                  <td style={{ padding: "9px 12px", borderBottom: "1px solid var(--color-border)", fontWeight: 700 }}>
                    {level.level}
                  </td>
                  <td style={{ padding: "9px 12px", borderBottom: "1px solid var(--color-border)" }}>{level.title}</td>
                  <td style={{ padding: "9px 12px", borderBottom: "1px solid var(--color-border)", textAlign: "right" }}>
                    {level.minXp.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
