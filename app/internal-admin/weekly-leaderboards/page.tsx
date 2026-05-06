import Link from "next/link";
import { getAdminClient } from "@/lib/supabase/admin";
import { LeagueHomeSidebarTop10 } from "@/app/leagues/[slug]/LeagueHomeSidebarTop10";
import { LEAGUE_HOME_TOP10_VISIBLE_FROM_PT } from "@/lib/leagueHomeLeaderboardsGate";
import { loadXpAuditRows } from "@/lib/internalAdmin/loadXpAuditRows";
import styles from "../internal-admin.module.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Weekly leaderboards & XP — Site admin",
};

const SQL_PACK = `-- === Weekly snapshot coverage (by league + week) ===
SELECT
  league_id,
  week_start,
  COUNT(*)::int AS member_rows,
  SUM(CASE WHEN is_weekly_high THEN 1 ELSE 0 END)::int AS weekly_high_flags,
  MIN(updated_at) AS first_row_at,
  MAX(updated_at) AS last_row_at
FROM public.league_weekly_points_snapshot
GROUP BY league_id, week_start
ORDER BY week_start DESC, league_id
LIMIT 80;

-- === Rows for one league + week (replace UUIDs) ===
-- SELECT * FROM public.league_weekly_points_snapshot
-- WHERE league_id = 'YOUR-LEAGUE-UUID' AND week_start = '2026-05-05'
-- ORDER BY points DESC;

-- === Recent weekly-high XP ledger entries ===
SELECT id, user_id, delta, reason, idempotency_key, metadata, created_at
FROM public.user_xp_ledger
WHERE reason = 'weekly_high_score'
ORDER BY created_at DESC
LIMIT 50;

-- === Recent fantasy-points tier XP (per 50 pts combined) ===
SELECT id, user_id, delta, reason, idempotency_key, metadata, created_at
FROM public.user_xp_ledger
WHERE reason = 'fantasy_points_50'
ORDER BY created_at DESC
LIMIT 30;

-- === User totals vs ledger sum (spot-check) ===
-- SELECT s.user_id, s.total_xp AS state_total, COALESCE(SUM(l.delta), 0)::bigint AS ledger_sum
-- FROM public.user_xp_state s
-- LEFT JOIN public.user_xp_ledger l ON l.user_id = s.user_id
-- GROUP BY s.user_id, s.total_xp
-- HAVING s.total_xp <> COALESCE(SUM(l.delta), 0)
-- LIMIT 50;
`;

export default async function WeeklyLeaderboardsAdminPage() {
  const admin = getAdminClient();
  let summaryRows: Array<{
    league_id: string;
    week_start: string;
    member_rows: number;
    weekly_high_flags: number;
    last_row_at: string | null;
  }> = [];
  let recentLedger: Array<{
    user_id: string;
    delta: number;
    reason: string;
    idempotency_key: string;
    created_at: string;
  }> = [];
  let loadError: string | null = null;
  let xpAuditRows: Awaited<ReturnType<typeof loadXpAuditRows>> = [];
  let xpAuditError: string | null = null;

  if (admin) {
    const { data: snap, error: snapErr } = await admin
      .from("league_weekly_points_snapshot")
      .select("league_id, week_start, user_id, points, is_weekly_high, updated_at");
    if (snapErr) {
      loadError = snapErr.message;
    } else {
      const byKey = new Map<
        string,
        { league_id: string; week_start: string; member_rows: number; weekly_high_flags: number; last_row_at: string }
      >();
      for (const r of (snap ?? []) as Array<{
        league_id: string;
        week_start: string;
        is_weekly_high?: boolean;
        updated_at?: string;
      }>) {
        const key = `${r.league_id}:${r.week_start}`;
        const prev = byKey.get(key);
        const updated = r.updated_at ?? "";
        if (!prev) {
          byKey.set(key, {
            league_id: r.league_id,
            week_start: r.week_start,
            member_rows: 1,
            weekly_high_flags: r.is_weekly_high ? 1 : 0,
            last_row_at: updated,
          });
        } else {
          prev.member_rows += 1;
          if (r.is_weekly_high) prev.weekly_high_flags += 1;
          if (updated > prev.last_row_at) prev.last_row_at = updated;
        }
      }
      summaryRows = [...byKey.values()]
        .sort((a, b) => b.week_start.localeCompare(a.week_start) || a.league_id.localeCompare(b.league_id))
        .slice(0, 60);
    }

    const { data: led } = await admin
      .from("user_xp_ledger")
      .select("user_id, delta, reason, idempotency_key, created_at")
      .in("reason", ["weekly_high_score", "fantasy_points_50"])
      .order("created_at", { ascending: false })
      .limit(40);
    recentLedger = (led ?? []) as typeof recentLedger;

    try {
      xpAuditRows = await loadXpAuditRows(admin);
    } catch (e) {
      xpAuditError = e instanceof Error ? e.message : String(e);
    }
  }

  return (
    <div>
      <h1 className={styles.pageTitle}>Weekly leaderboards & XP</h1>
      <p className={styles.intro}>
        Observability for <code>league_weekly_points_snapshot</code>, weekly high-score XP, and the league home Top 10
        (visible to members starting {LEAGUE_HOME_TOP10_VISIBLE_FROM_PT} PT). Cron:{" "}
        <code>GET /api/cron/weekly-xp-leaderboards</code> with <code>x-cron-secret</code>. Add{" "}
        <code>?reprocess=1</code> to recompute even when a full snapshot already exists.
      </p>

      <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 16 }}>
        This page is read-only. To test the job, call{" "}
        <code>GET /api/cron/weekly-xp-leaderboards</code> with <code>x-cron-secret</code> from a controlled environment
        (never load it in a browser that would trigger side effects unintentionally).
      </p>

      <h2 style={{ fontSize: "1.05rem", marginTop: 28 }}>Snapshot coverage (aggregated)</h2>
      {!admin ? (
        <p style={{ color: "var(--color-text-muted)" }}>Set SUPABASE_SERVICE_ROLE_KEY to load snapshot data.</p>
      ) : loadError ? (
        <p style={{ color: "var(--color-red)" }}>{loadError}</p>
      ) : summaryRows.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)" }}>No rows in league_weekly_points_snapshot yet.</p>
      ) : (
        <div style={{ overflowX: "auto", marginTop: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--color-border)" }}>
                <th style={{ padding: "6px 8px" }}>League</th>
                <th style={{ padding: "6px 8px" }}>Week start</th>
                <th style={{ padding: "6px 8px" }}>Rows</th>
                <th style={{ padding: "6px 8px" }}>Weekly highs</th>
                <th style={{ padding: "6px 8px" }}>Updated</th>
              </tr>
            </thead>
            <tbody>
              {summaryRows.map((r) => (
                <tr key={`${r.league_id}-${r.week_start}`} style={{ borderBottom: "1px solid var(--color-border-light)" }}>
                  <td style={{ padding: "6px 8px", fontFamily: "monospace", fontSize: 11 }} title={r.league_id}>
                    {r.league_id.slice(0, 8)}…
                  </td>
                  <td style={{ padding: "6px 8px" }}>{r.week_start}</td>
                  <td style={{ padding: "6px 8px" }}>{r.member_rows}</td>
                  <td style={{ padding: "6px 8px" }}>{r.weekly_high_flags}</td>
                  <td style={{ padding: "6px 8px", color: "var(--color-text-muted)" }}>
                    {r.last_row_at ? new Date(r.last_row_at).toISOString().slice(0, 19) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 style={{ fontSize: "1.05rem", marginTop: 28 }}>Recent XP ledger (weekly high + per-50)</h2>
      {!admin || recentLedger.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)" }}>No recent rows.</p>
      ) : (
        <div style={{ overflowX: "auto", marginTop: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--color-border)" }}>
                <th style={{ padding: "6px 8px" }}>When</th>
                <th style={{ padding: "6px 8px" }}>User</th>
                <th style={{ padding: "6px 8px" }}>Δ</th>
                <th style={{ padding: "6px 8px" }}>Reason</th>
                <th style={{ padding: "6px 8px" }}>Key</th>
              </tr>
            </thead>
            <tbody>
              {recentLedger.map((r, i) => (
                <tr key={`${r.idempotency_key}-${r.created_at}-${i}`} style={{ borderBottom: "1px solid var(--color-border-light)" }}>
                  <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>{r.created_at?.slice(0, 19) ?? "—"}</td>
                  <td style={{ padding: "6px 8px", fontFamily: "monospace", fontSize: 11 }}>{r.user_id.slice(0, 8)}…</td>
                  <td style={{ padding: "6px 8px" }}>{r.delta}</td>
                  <td style={{ padding: "6px 8px" }}>{r.reason}</td>
                  <td style={{ padding: "6px 8px", fontSize: 11, wordBreak: "break-all" }}>{r.idempotency_key}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 style={{ fontSize: "1.05rem", marginTop: 28 }}>User XP totals (audit)</h2>
      <p style={{ fontSize: 13, color: "var(--color-text-muted)", maxWidth: 720 }}>
        One row per profile (sorted by <code>total_xp</code> descending). Totals come from{" "}
        <code>user_xp_state</code>; users who never received XP show 0. Rows without a display name are XP state
        without a matching profile (unusual). Cross-check grants in <code>user_xp_ledger</code> or use the SQL pack
        below.
      </p>
      {!admin ? (
        <p style={{ color: "var(--color-text-muted)" }}>Set SUPABASE_SERVICE_ROLE_KEY to load this list.</p>
      ) : xpAuditError ? (
        <p style={{ color: "var(--color-red)" }}>{xpAuditError}</p>
      ) : xpAuditRows.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)" }}>No profiles found.</p>
      ) : (
        <>
          <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 8 }}>
            {xpAuditRows.length} user{xpAuditRows.length === 1 ? "" : "s"}
          </p>
          <div
            style={{
              overflow: "auto",
              marginTop: 8,
              maxHeight: 480,
              border: "1px solid var(--color-border-light)",
              borderRadius: 8,
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead style={{ position: "sticky", top: 0, background: "var(--color-bg-elevated)", zIndex: 1 }}>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--color-border)" }}>
                  <th style={{ padding: "8px 10px" }}>Total XP</th>
                  <th style={{ padding: "8px 10px" }}>Display name</th>
                  <th style={{ padding: "8px 10px" }}>User id</th>
                  <th style={{ padding: "8px 10px" }}>Streak</th>
                  <th style={{ padding: "8px 10px" }}>Last daily</th>
                  <th style={{ padding: "8px 10px" }}>State updated</th>
                </tr>
              </thead>
              <tbody>
                {xpAuditRows.map((r) => (
                  <tr key={r.userId} style={{ borderBottom: "1px solid var(--color-border-light)" }}>
                    <td style={{ padding: "6px 10px", fontVariantNumeric: "tabular-nums" }}>{r.totalXp}</td>
                    <td style={{ padding: "6px 10px" }}>
                      <Link href={`/internal-admin/users/${encodeURIComponent(r.userId)}`} className="app-link">
                        {r.displayName ?? "—"}
                      </Link>
                    </td>
                    <td
                      style={{
                        padding: "6px 10px",
                        fontFamily: "monospace",
                        fontSize: 11,
                        color: "var(--color-text-muted)",
                      }}
                      title={r.userId}
                    >
                      {r.userId.slice(0, 8)}…
                    </td>
                    <td style={{ padding: "6px 10px", fontVariantNumeric: "tabular-nums" }}>{r.loginStreak}</td>
                    <td style={{ padding: "6px 10px", color: "var(--color-text-muted)" }}>
                      {r.lastDailyLogin ?? "—"}
                    </td>
                    <td style={{ padding: "6px 10px", color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>
                      {r.stateUpdatedAt ? r.stateUpdatedAt.slice(0, 19) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h2 style={{ fontSize: "1.05rem", marginTop: 28 }}>Verification SQL pack</h2>
      <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
        Same statements live in <code>supabase/admin_verify_weekly_leaderboards.sql</code>.
      </p>
      <pre
        style={{
          marginTop: 8,
          padding: 12,
          background: "var(--color-bg-elevated)",
          borderRadius: 8,
          fontSize: 11,
          overflow: "auto",
          maxHeight: 360,
        }}
      >
        {SQL_PACK}
      </pre>

      <h2 style={{ fontSize: "1.05rem", marginTop: 28 }}>League home preview (sidebar placement)</h2>
      <p style={{ fontSize: 13, color: "var(--color-text-muted)", maxWidth: 720 }}>
        On the real league page this card sits in the left column <strong>above Quick Links</strong>, under My Faction.
        Below is mock data for layout review.
      </p>
      <div style={{ maxWidth: 280, marginTop: 12 }}>
        <LeagueHomeSidebarTop10
          leagueSlug="your-league-slug"
          weekStart="2026-05-04"
          weeklyTop10={[
            { userId: "11111111-1111-1111-1111-111111111111", rank: 1, points: 42.5, label: "Solstice Slayers" },
            { userId: "22222222-2222-2222-2222-222222222222", rank: 2, points: 38, label: "Kayfabe King" },
            { userId: "33333333-3333-3333-3333-333333333333", rank: 3, points: 31.25, label: "Steel City Shooters" },
          ]}
          seasonTop10={[
            { userId: "22222222-2222-2222-2222-222222222222", rank: 1, points: 412, label: "Kayfabe King" },
            { userId: "11111111-1111-1111-1111-111111111111", rank: 2, points: 405, label: "Solstice Slayers" },
            { userId: "33333333-3333-3333-3333-333333333333", rank: 3, points: 388, label: "Steel City Shooters" },
          ]}
        />
      </div>
    </div>
  );
}
