import Link from "next/link";
import type { ReactNode } from "react";
import { ManagerAvatar } from "@/app/components/ManagerAvatar";
import { factionStandingsLabel, truncateFactionDisplay } from "@/lib/factionName";
import type { LeagueMember } from "@/lib/leagues";
import { resolvedManagerAvatarUrl } from "@/lib/managerAvatarBucket";
import type { XpDisplay } from "@/lib/xp/getXpDisplayByUserIds";

const sectionStyle = {
  borderRadius: 16,
  padding: 20,
  background: "linear-gradient(180deg, #1a1a1a 0%, #0d0d0d 100%)",
  boxShadow: "0 18px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)",
  color: "#f9fafb",
};

const headerStyle = {
  display: "flex" as const,
  alignItems: "baseline" as const,
  justifyContent: "space-between" as const,
  marginBottom: 10,
};

const headerTitleStyle = {
  fontSize: 16,
  textTransform: "uppercase" as const,
  letterSpacing: 3,
  fontWeight: 700,
  color: "rgba(249,250,251,0.9)",
  margin: 0,
};

const headerPointsStyle = {
  fontSize: 12,
  textTransform: "uppercase" as const,
  letterSpacing: 2,
  color: "rgba(248,113,113,0.85)",
};

type Props = {
  members: LeagueMember[];
  pointsByUserId: Record<string, number>;
  recordByUserId?: Record<string, { w: number; l: number; t: number }>;
  showRecordOnly?: boolean;
  leagueSlug: string;
  xpByUserId?: Record<string, XpDisplay>;
  /** Optional extra content per row (e.g. Remove button). Same length as members. */
  rowExtras?: (ReactNode | null)[];
};

export function LeagueStandingsTable({
  members,
  pointsByUserId,
  recordByUserId,
  showRecordOnly = false,
  leagueSlug,
  xpByUserId,
  rowExtras = [],
}: Props) {
  return (
    <section style={{ ...sectionStyle, marginTop: 0 }}>
      <header style={headerStyle}>
        <h2 style={headerTitleStyle}>Factions</h2>
        <span style={headerPointsStyle}>{showRecordOnly ? "Record" : "Total points"}</span>
      </header>
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          borderTop: "1px solid rgba(255,255,255,0.12)",
        }}
      >
        {members.map((m, idx) => {
          const hasCustomTeamName = !!m.team_name?.trim();
          const teamLabel = factionStandingsLabel(m);
          const fallbackInitial =
            (teamLabel.trim().charAt(0) || m.display_name?.trim().charAt(0) || "?").toUpperCase();
          const managerDisplay = truncateFactionDisplay(
            (m.display_name?.trim() || "Unknown").trim() || "Unknown"
          );
          const pts = pointsByUserId[m.user_id] ?? 0;
          const rec = recordByUserId?.[m.user_id] ?? { w: 0, l: 0, t: 0 };
          const isLeader = idx === 0;
          const extra = rowExtras[idx] ?? null;
          const xpLabel = xpByUserId?.[m.user_id]?.label;
          const catchphrase = m.manager_catchphrase?.trim() ?? "";
          const isPendingSetup = m.placement_status === "pending";
          return (
            <li
              key={m.id}
              style={{
                borderBottom: "1px solid rgba(255,255,255,0.08)",
                background: isPendingSetup
                  ? "rgba(251,191,36,0.06)"
                  : isLeader
                    ? "rgba(248,113,113,0.06)"
                    : "transparent",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                  padding: "12px 4px",
                  minWidth: 0,
                }}
              >
                <Link
                  href={`/leagues/${leagueSlug}/team/${encodeURIComponent(m.user_id)}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    minWidth: 0,
                    flex: 1,
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <span
                    style={{
                      minWidth: 26,
                      height: 26,
                      borderRadius: "999px",
                      border: "1px solid rgba(248,250,252,0.2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 13,
                      fontWeight: 700,
                      background: isLeader
                        ? "linear-gradient(145deg,#d4af37,#b8860b)"
                        : "linear-gradient(145deg,#4b5563,#111827)",
                      color: isLeader ? "#111827" : "#e5e7eb",
                      flexShrink: 0,
                    }}
                  >
                    {idx + 1}
                  </span>
                  <span
                    aria-hidden
                    style={{
                      display: "flex",
                      flexShrink: 0,
                      borderRadius: 10,
                      border: "1px solid rgba(248,250,252,0.15)",
                      overflow: "hidden",
                      background: "rgba(255,255,255,0.06)",
                    }}
                  >
                    <ManagerAvatar
                      avatarUrl={resolvedManagerAvatarUrl(m)}
                      fallbackLetter={fallbackInitial}
                      size={36}
                      radius={10}
                      alt=""
                      variant="standings"
                    />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: 15,
                        textTransform: hasCustomTeamName ? "uppercase" : "none",
                        letterSpacing: 0.6,
                        lineHeight: 1.25,
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "baseline",
                        gap: "2px 8px",
                        minWidth: 0,
                      }}
                      title={catchphrase ? `${teamLabel} “${catchphrase}”` : teamLabel}
                    >
                      <span
                        style={{
                          whiteSpace: "nowrap",
                          textOverflow: "ellipsis",
                          overflow: "hidden",
                          minWidth: 0,
                          maxWidth: "100%",
                        }}
                      >
                        {teamLabel}
                      </span>
                      {isPendingSetup ? (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: 0.6,
                            padding: "2px 7px",
                            borderRadius: 4,
                            background: "rgba(251,191,36,0.18)",
                            color: "rgba(251,191,36,0.98)",
                            border: "1px solid rgba(251,191,36,0.35)",
                            flexShrink: 0,
                          }}
                        >
                          Pending setup
                        </span>
                      ) : null}
                      {catchphrase ? (
                        <span
                          style={{
                            fontStyle: "italic",
                            color: "rgba(251,191,36,0.95)",
                            fontWeight: 500,
                          }}
                        >
                          “{catchphrase}”
                        </span>
                      ) : null}
                    </div>
                    <div
                      style={{
                        marginTop: 2,
                        fontSize: 12,
                        color: "rgba(229,231,235,0.85)",
                        whiteSpace: "nowrap",
                        textOverflow: "ellipsis",
                        overflow: "hidden",
                      }}
                      title={
                        xpLabel
                          ? `Manager · ${managerDisplay} · ${xpLabel}`
                          : `Manager · ${managerDisplay}`
                      }
                    >
                      Manager · {managerDisplay}
                      {xpLabel ? (
                        <>
                          {" · "}
                          <span style={{ color: "rgba(147,197,253,0.95)" }}>{xpLabel}</span>
                        </>
                      ) : null}
                    </div>
                  </div>
                </Link>
                <span style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: 18,
                      color: isPendingSetup ? "rgba(251,191,36,0.85)" : "#f97373",
                    }}
                  >
                    {isPendingSetup ? (
                      "—"
                    ) : showRecordOnly ? (
                      `${rec.w}-${rec.l}-${rec.t}`
                    ) : (
                      <>
                        {pts}
                        <span style={{ fontSize: 11, marginLeft: 4, opacity: 0.8 }}>pts</span>
                      </>
                    )}
                  </span>
                  {extra}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
