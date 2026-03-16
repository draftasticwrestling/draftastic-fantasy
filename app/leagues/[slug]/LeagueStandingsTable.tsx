import Link from "next/link";
import type { ReactNode } from "react";
import type { LeagueMember } from "@/lib/leagues";

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
  leagueSlug: string;
  /** Optional extra content per row (e.g. Remove button). Same length as members. */
  rowExtras?: (ReactNode | null)[];
};

export function LeagueStandingsTable({
  members,
  pointsByUserId,
  leagueSlug,
  rowExtras = [],
}: Props) {
  return (
    <section style={{ ...sectionStyle, marginTop: 0 }}>
      <header style={headerStyle}>
        <h2 style={headerTitleStyle}>Teams</h2>
        <span style={headerPointsStyle}>Total points</span>
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
          const teamLabel =
            (m.team_name?.trim() || m.display_name?.trim() || "Unknown").trim() || "Unknown";
          const pts = pointsByUserId[m.user_id] ?? 0;
          const isLeader = idx === 0;
          const extra = rowExtras[idx] ?? null;
          return (
            <li
              key={m.id}
              style={{
                borderBottom: "1px solid rgba(255,255,255,0.08)",
                background: isLeader ? "rgba(248,113,113,0.06)" : "transparent",
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
                    gap: 12,
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
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: 15,
                        textTransform: "uppercase",
                        letterSpacing: 0.6,
                        whiteSpace: "nowrap",
                        textOverflow: "ellipsis",
                        overflow: "hidden",
                      }}
                    >
                      {teamLabel}
                    </div>
                  </div>
                </Link>
                <span style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: 18,
                      color: "#f97373",
                    }}
                  >
                    {pts}
                    <span style={{ fontSize: 11, marginLeft: 4, opacity: 0.8 }}>pts</span>
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
