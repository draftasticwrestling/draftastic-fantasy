import Link from "next/link";
import { ManagerAvatar } from "@/app/components/ManagerAvatar";
import { factionStandingsLabel, truncateFactionDisplay } from "@/lib/factionName";
import type { LeagueMember } from "@/lib/leagues";
import { resolvedManagerAvatarUrl } from "@/lib/managerAvatarBucket";
import type { XpDisplay } from "@/lib/xp/getXpDisplayByUserIds";

type Props = {
  members: LeagueMember[];
  pointsByUserId: Record<string, number>;
  leagueSlug: string;
  currentUserId?: string | null;
  xpByUserId?: Record<string, XpDisplay>;
};

export function LeagueMobileStandingsTable({
  members,
  pointsByUserId,
  leagueSlug,
  currentUserId = null,
  xpByUserId,
}: Props) {
  const base = `/leagues/${encodeURIComponent(leagueSlug)}`;

  return (
    <div className="league-home-mobile-standings-wrap">
      <table
        className="league-home-mobile-standings"
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 10,
          lineHeight: 1.2,
          tableLayout: "fixed",
        }}
      >
        <thead>
          <tr style={{ background: "var(--color-bg-elevated)" }}>
            <th
              scope="col"
              className="league-home-mobile-th"
              style={{ width: "78%", textAlign: "left", padding: "6px 6px", borderBottom: "1px solid var(--color-border)" }}
            >
              Team
            </th>
            <th
              scope="col"
              className="league-home-mobile-th"
              style={{ width: "22%", textAlign: "right", padding: "6px 6px", borderBottom: "1px solid var(--color-border)" }}
            >
              Total Pts
            </th>
          </tr>
        </thead>
        <tbody>
          {members.map((m, idx) => {
            const nameLine = factionStandingsLabel(m);
            const ownerLine = `Manager · ${truncateFactionDisplay(m.display_name?.trim() || "—")}`;
            const xpLabel = xpByUserId?.[m.user_id]?.label;
            const catchphrase = m.manager_catchphrase?.trim() ?? "";
            const pts = pointsByUserId[m.user_id] ?? 0;
            const isSelf = currentUserId != null && m.user_id === currentUserId;
            const hasCustom = !!m.team_name?.trim();
            return (
              <tr
                key={m.id}
                style={{
                  background: isSelf
                    ? "var(--color-blue-bg, rgba(30, 64, 120, 0.18))"
                    : idx % 2 === 0
                      ? "var(--color-bg-surface)"
                      : "var(--color-bg-elevated)",
                }}
              >
                <td style={{ padding: "6px 6px", borderBottom: "1px solid var(--color-border)", minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                    <span
                      className="league-home-mobile-rk"
                      style={{ fontSize: 9, fontWeight: 700, color: "var(--color-text-muted)", minWidth: 14 }}
                    >
                      {idx + 1}
                    </span>
                    <span
                      style={{
                        display: "block",
                        flexShrink: 0,
                        borderRadius: 6,
                        overflow: "hidden",
                        border: "1px solid var(--color-border)",
                        background: "var(--color-bg-elevated)",
                        lineHeight: 0,
                      }}
                    >
                      <ManagerAvatar
                        avatarUrl={resolvedManagerAvatarUrl(m)}
                        fallbackLetter={(nameLine.trim().charAt(0) || "?").toUpperCase()}
                        size={20}
                        radius={6}
                        alt=""
                        variant="standings"
                      />
                    </span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <Link
                        href={`${base}/team/${encodeURIComponent(m.user_id)}`}
                        className="app-link"
                        style={{
                          display: "block",
                          fontWeight: 600,
                          fontSize: 11,
                          textDecoration: "none",
                          lineHeight: 1.25,
                        }}
                      >
                        <span
                          style={{
                            display: "inline",
                            textTransform: hasCustom ? "uppercase" : "none",
                          }}
                        >
                          {nameLine}
                        </span>
                        {catchphrase ? (
                          <span
                            style={{
                              fontStyle: "italic",
                              fontWeight: 500,
                              color: "var(--color-amber-600, #d97706)",
                              marginLeft: 4,
                            }}
                          >
                            “{catchphrase}”
                          </span>
                        ) : null}
                      </Link>
                      <span
                        className="league-home-mobile-owner"
                        style={{
                          display: "block",
                          fontSize: 8,
                          color: "var(--color-text-muted)",
                          marginTop: 1,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {ownerLine}
                        {xpLabel ? (
                          <>
                            {" · "}
                            <span style={{ color: "var(--color-link, #2563eb)" }}>{xpLabel}</span>
                          </>
                        ) : null}
                      </span>
                    </div>
                  </div>
                </td>
                <td
                  style={{
                    padding: "6px 6px",
                    borderBottom: "1px solid var(--color-border)",
                    textAlign: "right",
                    fontWeight: 700,
                    color: "var(--color-text)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {pts}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
