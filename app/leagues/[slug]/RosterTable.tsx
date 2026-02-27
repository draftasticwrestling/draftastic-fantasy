import Link from "next/link";
import type { LeagueRosterEntry } from "@/lib/leagues";

const BORDER = "#e0e0e0";
const HEADER_BG = "#f0f2f5";
const ROW_ALT = "#f8f9fa";

type Props = {
  entries: LeagueRosterEntry[];
  wrestlerName: (wrestlerId: string) => string;
  leagueSlug?: string;
  /** Optional points per wrestler_id for PTS column */
  pointsByWrestlerId?: Record<string, number>;
  /** Optional image URL per wrestler_id (shows avatar in PLAYER column when set) */
  wrestlerImageUrl?: Record<string, string | null | undefined>;
  /** Commissioner: show Remove button */
  showRemove?: boolean;
  leagueId?: string;
  userId?: string;
  removeAction?: (formData: FormData) => void;
  /** When viewing another team's roster: show Trade button (links to propose trade with this owner) */
  showTradeButton?: boolean;
  /** User ID of the roster owner (for trade link proposeTradeTo) */
  tradeTargetUserId?: string;
  /** Max slots to show (empty rows if roster smaller) */
  maxSlots?: number;
};

export function RosterTable({
  entries,
  wrestlerName,
  leagueSlug,
  pointsByWrestlerId,
  wrestlerImageUrl,
  showRemove,
  leagueId,
  userId,
  removeAction,
  showTradeButton,
  tradeTargetUserId,
  maxSlots,
}: Props) {
  const size = maxSlots ?? Math.max(entries.length, 1);
  const rows: (LeagueRosterEntry | null)[] = [];
  for (let i = 0; i < size; i++) {
    rows.push(entries[i] ?? null);
  }

  return (
    <div className="roster-table-wrap">
      <table className="roster-table">
        <thead>
          <tr>
            <th className="roster-th roster-th-slot">SLOT</th>
            <th className="roster-th roster-th-player">PLAYER</th>
            <th className="roster-th roster-th-acq">ACQ</th>
            {pointsByWrestlerId && <th className="roster-th roster-th-pts">PTS</th>}
            {showRemove && removeAction && <th className="roster-th roster-th-action">ACTION</th>}
            {showTradeButton && leagueSlug && tradeTargetUserId && (
              <th className="roster-th roster-th-trade">TRADE</th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((entry, index) => (
            <tr key={entry ? entry.wrestler_id : `empty-${index}`} className="roster-tr">
              <td className="roster-td roster-td-slot">{index + 1}</td>
              <td className="roster-td roster-td-player">
                {entry ? (
                  <span className="roster-player-cell">
                    {wrestlerImageUrl?.[entry.wrestler_id] ? (
                      <img
                        src={wrestlerImageUrl[entry.wrestler_id]!}
                        alt=""
                        className="roster-player-avatar"
                        width={32}
                        height={32}
                      />
                    ) : null}
                    {leagueSlug ? (
                      <Link href={`/wrestlers/${encodeURIComponent(entry.wrestler_id)}`} className="roster-player-link">
                        {wrestlerName(entry.wrestler_id)}
                      </Link>
                    ) : (
                      wrestlerName(entry.wrestler_id)
                    )}
                  </span>
                ) : (
                  <span className="roster-empty">Empty</span>
                )}
              </td>
              <td className="roster-td roster-td-acq">
                {entry?.contract?.trim() ?? "—"}
              </td>
              {pointsByWrestlerId && (
                <td className="roster-td roster-td-pts">
                  {entry && typeof pointsByWrestlerId[entry.wrestler_id] === "number"
                    ? pointsByWrestlerId[entry.wrestler_id]
                    : "—"}
                </td>
              )}
              {showRemove && removeAction && (
                <td className="roster-td roster-td-action">
                  {entry && leagueId && userId ? (
                    <form action={removeAction} style={{ margin: 0 }}>
                      <input type="hidden" name="leagueSlug" value={leagueSlug} />
                      <input type="hidden" name="leagueId" value={leagueId} />
                      <input type="hidden" name="userId" value={userId} />
                      <input type="hidden" name="wrestlerId" value={entry.wrestler_id} />
                      <button type="submit" className="roster-remove-btn">
                        Remove
                      </button>
                    </form>
                  ) : (
                    "—"
                  )}
                </td>
              )}
              {showTradeButton && leagueSlug && tradeTargetUserId && (
                <td className="roster-td roster-td-trade">
                  {entry ? (
                    <Link
                      href={`/leagues/${encodeURIComponent(leagueSlug)}/team?proposeTradeTo=${encodeURIComponent(tradeTargetUserId)}`}
                      className="roster-trade-link"
                      title="Propose trade with this team"
                    >
                      Trade
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
