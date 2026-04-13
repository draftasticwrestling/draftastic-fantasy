import Link from "next/link";
import { factionDisplayName } from "@/lib/factionName";

type PickRow = { overall_pick: number; user_id: string; wrestler_id: string; wrestler_name: string | null };
type OrderRow = { overall_pick: number; user_id: string };
type Member = { user_id: string; display_name?: string | null; team_name?: string | null };

type Props = {
  leagueSlug: string;
  order: OrderRow[];
  picksHistory: PickRow[];
  members: Member[];
  draftStatus: "in_progress" | "completed";
  currentPickSlot: number | null;
  totalPicks: number;
  /** When false (live/linear/snake), copy avoids "auto-draft" wording for the final board. */
  isAutopickLeague?: boolean;
};

/**
 * Minimal auto-draft UI: order + pick names only. No wrestler pool, filters, or manual Pick buttons.
 */
export function AutopickDraftBoardView({
  leagueSlug,
  order,
  picksHistory,
  members,
  draftStatus,
  currentPickSlot,
  totalPicks,
  isAutopickLeague = true,
}: Props) {
  const memberByUserId = Object.fromEntries(members.map((m) => [m.user_id, m]));
  const pickBySlot = Object.fromEntries(picksHistory.map((p) => [p.overall_pick, p]));
  const inProgress = draftStatus === "in_progress";
  const resultsTitle = isAutopickLeague ? "Auto-draft results" : "Final draft board";
  const progressTitle = isAutopickLeague ? "Auto-draft in progress" : "Draft in progress";

  return (
    <section aria-labelledby="autopick-board-heading" style={{ marginTop: 8 }}>
      <h2 id="autopick-board-heading" style={{ fontSize: "1.15rem", marginBottom: 8, color: "var(--color-text)" }}>
        {inProgress ? progressTitle : resultsTitle}
      </h2>
      {inProgress && isAutopickLeague && (
        <p style={{ color: "var(--color-text-muted)", fontSize: 14, marginBottom: 16, lineHeight: 1.65 }}>
          Picks run on the server. This board updates as each pick is saved. You can close this tab—your league cron (if enabled) can finish the draft—or watch the board update here.
        </p>
      )}
      {!inProgress && (
        <div style={{ marginBottom: 16 }}>
          <p style={{ color: "var(--color-success-muted)", fontWeight: 600, marginBottom: 8 }}>Draft complete.</p>
          <p style={{ color: "var(--color-text-muted)", fontSize: 14, lineHeight: 1.65, margin: 0 }}>
            Each row is one scheduled pick slot. <strong style={{ color: "var(--color-text)" }}>No pick logged</strong> means that slot had no saved pick (e.g. skipped or pool exhausted)—compare to your faction rosters below.
          </p>
        </div>
      )}
      {inProgress && currentPickSlot != null && (
        <p style={{ fontSize: 14, marginBottom: 14, color: "var(--color-text-muted)" }}>
          Current slot: <strong style={{ color: "var(--color-text)" }}>pick {currentPickSlot}</strong> of {totalPicks}
        </p>
      )}
      <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 10, color: "var(--color-text)" }}>Draft board</h3>
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius)",
          overflow: "hidden",
          background: "var(--color-bg-surface)",
        }}
      >
        {order.map((o) => {
          const managerName = factionDisplayName(memberByUserId[o.user_id], "Unknown");
          const row = pickBySlot[o.overall_pick];
          const label =
            row?.wrestler_name?.trim() ||
            (row?.wrestler_id ? `Wrestler ${String(row.wrestler_id).slice(0, 8)}…` : null);
          const emptySlot = !row;
          return (
            <li
              key={o.overall_pick}
              style={{
                padding: "12px 14px",
                borderBottom: "1px solid var(--color-border)",
                fontSize: 14,
                display: "grid",
                gridTemplateColumns: "minmax(0,1fr) minmax(0,1.25fr)",
                gap: 12,
                alignItems: "center",
              }}
            >
              <span style={{ color: "var(--color-text-muted)", fontWeight: 600 }}>
                #{o.overall_pick} · {managerName}
              </span>
              <span
                style={{
                  color: emptySlot ? "var(--color-text-dim)" : "var(--color-text)",
                  fontWeight: emptySlot ? 400 : 500,
                  fontStyle: emptySlot ? "italic" : undefined,
                }}
              >
                {emptySlot ? "No pick logged" : label}
              </span>
            </li>
          );
        })}
      </ul>
      <p style={{ marginTop: 16, fontSize: 13, color: "var(--color-text-muted)" }}>
        <Link href={`/leagues/${leagueSlug}/draft-history`} className="app-link">
          Full draft log →
        </Link>
        {" · "}
        <Link href={`/leagues/${leagueSlug}`} className="app-link">
          League hub →
        </Link>
      </p>
    </section>
  );
}
