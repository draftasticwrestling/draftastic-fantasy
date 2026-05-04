import type { LeagueTransactionStats } from "@/lib/leagueTransactionStats";

type Props = {
  stats: LeagueTransactionStats | null;
};

export function LeagueTransactionStatsSection({ stats }: Props) {
  return (
    <section aria-labelledby="league-transactions-heading" style={{ marginBottom: 32 }}>
      <h2 id="league-transactions-heading" style={{ fontSize: "1.25rem", marginBottom: 8 }}>
        League transactions
      </h2>
      <p style={{ color: "var(--color-text-muted)", marginBottom: 14, fontSize: 14, lineHeight: 1.5 }}>
        Totals from the roster activity log (drops and free-agent adds) and completed trades. Proposal-only moves
        that never hit the log may not appear here.
      </p>
      {stats == null ? (
        <p style={{ color: "var(--color-text-muted)" }}>Could not load transaction counts.</p>
      ) : (
        <dl
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            gap: "8px 20px",
            margin: 0,
            maxWidth: 420,
            fontSize: 15,
          }}
        >
          <dt style={{ color: "var(--color-text-muted)" }}>Free agent signings</dt>
          <dd style={{ margin: 0, fontWeight: 600 }}>{stats.faSignings}</dd>
          <dt style={{ color: "var(--color-text-muted)" }}>Drops</dt>
          <dd style={{ margin: 0, fontWeight: 600 }}>{stats.drops}</dd>
          <dt style={{ color: "var(--color-text-muted)" }}>Completed trades</dt>
          <dd style={{ margin: 0, fontWeight: 600 }}>{stats.completedTrades}</dd>
          <dt style={{ color: "var(--color-text-muted)" }}>Roster log events (FA + drops)</dt>
          <dd style={{ margin: 0, fontWeight: 600 }}>{stats.faSignings + stats.drops}</dd>
        </dl>
      )}
    </section>
  );
}
