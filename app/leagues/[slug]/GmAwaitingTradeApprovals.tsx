import type { TradeProposal } from "@/lib/leagueOwner";
import type { LeagueMember } from "@/lib/leagues";
import { factionDisplayName } from "@/lib/factionName";
import { formatRecipientRosterCutsLine } from "@/lib/tradeDisplay";
import { TradeGmActions } from "./proposals/TradeGmActions";

export const GM_TRADE_REVIEW_WINDOW_MS = 48 * 60 * 60 * 1000;

type VoteTotals = Record<string, { up: number; down: number }>;

type Props = {
  leagueSlug: string;
  trades: TradeProposal[];
  memberByUserId: Record<string, LeagueMember | undefined>;
  wrestlerNames: Record<string, string>;
  voteTotals?: VoteTotals;
  variant?: "league-home" | "gm-tools";
};

function tradeSummaryLine(
  p: TradeProposal,
  memberByUserId: Record<string, LeagueMember | undefined>,
  wrestlerNames: Record<string, string>
) {
  const dropIds = (p.to_user_drop_ids ?? []).map((x) => String(x).trim()).filter(Boolean);
  const toName = factionDisplayName(memberByUserId[p.to_user_id], "Unknown");
  const cutsLine =
    dropIds.length > 0
      ? formatRecipientRosterCutsLine(
          toName,
          dropIds.map((id) => wrestlerNames[id] ?? id)
        )
      : null;

  return (
    <>
      {factionDisplayName(memberByUserId[p.from_user_id], "Unknown")} ↔{" "}
      {factionDisplayName(memberByUserId[p.to_user_id], "Unknown")}:{" "}
      {p.items
        .filter((i) => i.direction === "give")
        .map((i) => wrestlerNames[i.wrestler_id] ?? i.wrestler_id)
        .join(", ")}{" "}
      for{" "}
      {p.items
        .filter((i) => i.direction === "receive")
        .map((i) => wrestlerNames[i.wrestler_id] ?? i.wrestler_id)
        .join(", ")}
      {cutsLine ? (
        <span
          style={{
            display: "block",
            marginTop: 4,
            fontSize: 12,
            color: "var(--color-text-muted)",
          }}
        >
          {cutsLine}
        </span>
      ) : null}
    </>
  );
}

function TradeApprovalRow({
  p,
  leagueSlug,
  memberByUserId,
  wrestlerNames,
  voteTotals,
}: {
  p: TradeProposal;
  leagueSlug: string;
  memberByUserId: Record<string, LeagueMember | undefined>;
  wrestlerNames: Record<string, string>;
  voteTotals: VoteTotals;
}) {
  const acceptedAt = p.accepted_at;
  const acceptedMs = acceptedAt ? Date.parse(acceptedAt) : NaN;
  const endsInMs = Number.isFinite(acceptedMs)
    ? acceptedMs + GM_TRADE_REVIEW_WINDOW_MS - Date.now()
    : NaN;
  const hoursLeft = Number.isFinite(endsInMs)
    ? Math.max(0, Math.ceil(endsInMs / (60 * 60 * 1000)))
    : null;

  return (
    <li
      style={{
        padding: "12px 0",
        borderBottom: "1px solid var(--color-border-light)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <span style={{ flex: 1, minWidth: 260, fontSize: 14, color: "var(--color-text)" }}>
          {tradeSummaryLine(p, memberByUserId, wrestlerNames)}
          {hoursLeft != null ? (
            <span
              style={{
                display: "block",
                marginTop: 4,
                fontSize: 12,
                color: "var(--color-warning)",
                fontWeight: 600,
              }}
            >
              Review ends in {hoursLeft}h
            </span>
          ) : null}
        </span>
        <TradeGmActions leagueSlug={leagueSlug} proposalId={p.id} />
      </div>
      <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
        League vote: <strong>{(voteTotals[p.id] ?? { up: 0 }).up}</strong> 👍 /{" "}
        <strong>{(voteTotals[p.id] ?? { down: 0 }).down}</strong> 👎
      </span>
    </li>
  );
}

export function GmAwaitingTradeApprovals({
  leagueSlug,
  trades,
  memberByUserId,
  wrestlerNames,
  voteTotals = {},
  variant = "league-home",
}: Props) {
  if (trades.length === 0) return null;

  const intro = (
    <p
      className={variant === "league-home" ? "lm-league-meta" : undefined}
      style={
        variant === "gm-tools"
          ? { color: "var(--color-text-muted)", marginTop: 0, marginBottom: 12, maxWidth: 560, lineHeight: 1.5 }
          : { marginTop: 0, marginBottom: 12 }
      }
    >
      Both managers have agreed. Approve or reject within 48 hours — if you take no action, the trade
      completes automatically. League votes in Recent Activity are advisory.
    </p>
  );

  const list = (
    <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
      {trades.map((p) => (
        <TradeApprovalRow
          key={p.id}
          p={p}
          leagueSlug={leagueSlug}
          memberByUserId={memberByUserId}
          wrestlerNames={wrestlerNames}
          voteTotals={voteTotals}
        />
      ))}
    </ul>
  );

  if (variant === "gm-tools") {
    return (
      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: "1.1rem", marginBottom: 8, color: "var(--color-text)" }}>
          Trades awaiting your approval
        </h2>
        {intro}
        {list}
      </section>
    );
  }

  return (
    <div
      className="lm-card"
      style={{
        marginBottom: 24,
        padding: 16,
        borderRadius: 16,
        background: "linear-gradient(180deg, rgba(245,158,11,0.16) 0%, rgba(245,158,11,0.06) 100%)",
        border: "1px solid rgba(245,158,11,0.4)",
      }}
    >
      <h2 className="lm-card-title" style={{ marginBottom: 8 }}>
        Trades awaiting your approval
      </h2>
      {intro}
      {list}
    </div>
  );
}

/** Voting window + disabled reason for a trade awaiting GM approval. */
export function getTradeVoteState(
  p: { id: string; from_user_id: string; to_user_id: string; accepted_at?: string | null },
  currentUserId: string | null
): { inWindow: boolean; disabledReason: string | null } {
  const acceptedAt = p.accepted_at;
  const acceptedMs = acceptedAt ? Date.parse(acceptedAt) : NaN;
  const endsInMs = Number.isFinite(acceptedMs)
    ? acceptedMs + GM_TRADE_REVIEW_WINDOW_MS - Date.now()
    : NaN;
  const inWindow = Number.isFinite(endsInMs) ? endsInMs > 0 : false;
  const disabledReason = !currentUserId
    ? "Sign in to vote."
    : currentUserId === p.from_user_id || currentUserId === p.to_user_id
      ? "Trade parties can't vote."
      : !inWindow
        ? "Voting window has ended."
        : null;
  return { inWindow, disabledReason };
}
