"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RosterCardGrid, type RosterCardWrestler } from "./RosterCardGrid";

type ViewMode = "list" | "cards" | "matches";

type UpcomingMatch = {
  key: string;
  eventName: string;
  eventDateLabel: string;
  eventHref: string;
  wrestlerName: string;
  matchLabel: string;
  isChampionship: boolean;
  isSpecialStipulation: boolean;
  matchPoints?: number | null;
};

const STORAGE_PREFIX = "draftastic_faction_simple_view:";

type Props = {
  leagueSlug: string;
  leagueName: string;
  teamUserId: string;
  isOwnFaction: boolean;
  factionOptions?: Array<{ userId: string; label: string }>;
  teamLabel: string;
  totalPoints: number;
  rosterSize: number;
  rosterCap: number;
  minFemale: number;
  minMale: number;
  wrestlers: RosterCardWrestler[];
  tradeLockedWrestlerIds: string[];
  upcomingMatches: UpcomingMatch[];
  /** From server searchParams — optional `layout=list|cards|matches` */
  initialLayout?: ViewMode | null;
};

export function FactionSimpleRoster({
  leagueSlug,
  leagueName,
  teamUserId,
  isOwnFaction,
  factionOptions = [],
  teamLabel,
  totalPoints,
  rosterSize,
  rosterCap,
  minFemale,
  minMale,
  wrestlers,
  tradeLockedWrestlerIds,
  upcomingMatches,
  initialLayout,
}: Props) {
  const router = useRouter();
  const storageKey = `${STORAGE_PREFIX}${leagueSlug}`;
  const scoreboardHref = `/leagues/${leagueSlug}/team/${encodeURIComponent(teamUserId)}/scoreboard`;
  const factionLogHref = `/leagues/${leagueSlug}/transactions`;

  const [mode, setMode] = useState<ViewMode>(() => {
    if (initialLayout) return initialLayout;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw === "list" || raw === "cards" || raw === "matches") return raw;
    } catch {
      /* ignore */
    }
    return "list";
  });

  const replaceUrlLayout = useCallback(
    (next: ViewMode) => {
      if (typeof window === "undefined") return;
      try {
        const u = new URL(window.location.href);
        u.searchParams.set("view", "simple");
        u.searchParams.set("layout", next);
        window.history.replaceState(null, "", `${u.pathname}${u.search}${u.hash}`);
      } catch {
        /* ignore */
      }
    },
    []
  );

  const setModeAndPersist = useCallback(
    (next: ViewMode) => {
      setMode(next);
      try {
        localStorage.setItem(storageKey, next);
      } catch {
        /* ignore */
      }
      replaceUrlLayout(next);
    },
    [replaceUrlLayout, storageKey]
  );

  const sorted = useMemo(() => {
    return [...wrestlers].sort((a, b) => (b.totalPoints ?? 0) - (a.totalPoints ?? 0));
  }, [wrestlers]);

  return (
    <div>
      <div style={{ marginBottom: 10 }}>
        <label
          htmlFor="simple-faction-switcher"
          style={{
            display: "block",
            fontSize: 11,
            color: "#6b7280",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            fontWeight: 700,
            marginBottom: 4,
          }}
        >
          Faction
        </label>
        <select
          id="simple-faction-switcher"
          value={teamUserId}
          onChange={(e) => {
            const nextUserId = e.target.value;
            if (!nextUserId) return;
            router.push(
              `/leagues/${leagueSlug}/team/${encodeURIComponent(nextUserId)}?view=simple&layout=${mode}`
            );
          }}
          style={{
            width: "100%",
            maxWidth: 320,
            minHeight: 38,
            border: "1px solid #d1d5db",
            borderRadius: 8,
            padding: "8px 10px",
            fontSize: 14,
            fontWeight: 600,
            background: "#fff",
            color: "#111827",
          }}
        >
          {factionOptions.map((f) => (
            <option key={f.userId} value={f.userId}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div>
          <h1 style={{ fontSize: "1.35rem", margin: 0, lineHeight: 1.2 }}>{teamLabel}</h1>
          <p style={{ margin: "6px 0 0", fontSize: 14, color: "#555" }}>
            <strong style={{ color: "#111" }}>{totalPoints}</strong> season points · {rosterSize} / {rosterCap}{" "}
            wrestlers (min {minFemale} female, min {minMale} male)
          </p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <div
            role="group"
            aria-label="Roster layout"
            style={{
              display: "inline-flex",
              borderRadius: 10,
              border: "1px solid #e0e0e0",
              overflow: "hidden",
              background: "#f5f5f5",
            }}
          >
            <button
              type="button"
              onClick={() => setModeAndPersist("list")}
              style={{
                border: "none",
                margin: 0,
                padding: "8px 12px",
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                cursor: "pointer",
                background: mode === "list" ? "#111" : "transparent",
                color: mode === "list" ? "#fff" : "#333",
              }}
            >
              List
            </button>
            <button
              type="button"
              onClick={() => setModeAndPersist("cards")}
              style={{
                border: "none",
                margin: 0,
                padding: "8px 12px",
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                cursor: "pointer",
                background: mode === "cards" ? "#111" : "transparent",
                color: mode === "cards" ? "#fff" : "#333",
              }}
            >
              Cards
            </button>
            <button
              type="button"
              onClick={() => setModeAndPersist("matches")}
              style={{
                border: "none",
                margin: 0,
                padding: "8px 12px",
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                cursor: "pointer",
                background: mode === "matches" ? "#111" : "transparent",
                color: mode === "matches" ? "#fff" : "#333",
              }}
            >
              Matches
            </button>
          </div>
          <Link
            href={scoreboardHref}
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#1a73e8",
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            Faction Scoreboard →
          </Link>
        </div>
      </div>

      {mode === "matches" ? (
        upcomingMatches.length > 0 ? (
          <div style={{ display: "grid", gap: 10 }}>
            {upcomingMatches.map((m) => (
              <article
                key={m.key}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                  padding: "10px 12px",
                  background: "#fff",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                  <strong style={{ fontSize: 13, color: "#111827" }}>{m.eventName}</strong>
                  <span style={{ fontSize: 12, color: "#6b7280" }}>{m.eventDateLabel || "Upcoming"}</span>
                </div>
                <p style={{ margin: "6px 0 0", fontSize: 14, color: "#111827" }}>
                  <strong>{m.wrestlerName}</strong> · {m.matchLabel}
                </p>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6, flexWrap: "wrap" }}>
                  {m.isChampionship ? (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                        color: "#92400e",
                        background: "#fef3c7",
                        border: "1px solid #fcd34d",
                        borderRadius: 999,
                        padding: "2px 8px",
                      }}
                    >
                      Title
                    </span>
                  ) : null}
                  {m.isSpecialStipulation ? (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                        color: "#1e40af",
                        background: "#dbeafe",
                        border: "1px solid #93c5fd",
                        borderRadius: 999,
                        padding: "2px 8px",
                      }}
                    >
                      Stipulation
                    </span>
                  ) : null}
                  {m.matchPoints !== undefined ? (
                    <span style={{ marginLeft: "auto", fontWeight: 800, fontSize: 13, color: "#111827" }}>
                      {m.matchPoints === null ? "Points: -" : `Points: ${m.matchPoints >= 0 ? "+" : ""}${m.matchPoints}`}
                    </span>
                  ) : null}
                </div>
                <div style={{ marginTop: 6 }}>
                  <Link href={m.eventHref} style={{ fontSize: 12, color: "#1a73e8", textDecoration: "none", fontWeight: 700 }}>
                    Event details →
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p style={{ color: "#666", fontSize: 14, margin: 0 }}>
            No upcoming matches found for this faction right now.
          </p>
        )
      ) : sorted.length === 0 ? (
        <p style={{ color: "#666", fontSize: 14, margin: 0 }}>
          No wrestlers on your roster yet. Add wrestlers via the draft or free agent signings.
        </p>
      ) : mode === "cards" ? (
        <RosterCardGrid
          wrestlers={sorted}
          leagueSlug={leagueSlug}
          teamUserId={teamUserId}
          useFactionActionsPage
          showDrop={isOwnFaction}
          showTrade={isOwnFaction}
          isOwnTeam={isOwnFaction}
          tradeLockedWrestlerIds={isOwnFaction ? tradeLockedWrestlerIds : []}
        />
      ) : (
        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, minWidth: 360 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#666", fontSize: 12, textTransform: "uppercase" }}>
                <th style={{ padding: "8px 6px", borderBottom: "1px solid #eee" }}>Wrestler</th>
                <th style={{ padding: "8px 6px", borderBottom: "1px solid #eee", width: 72 }}>R/S</th>
                <th style={{ padding: "8px 6px", borderBottom: "1px solid #eee", width: 72 }}>PLE</th>
                <th style={{ padding: "8px 6px", borderBottom: "1px solid #eee", width: 72 }}>Belt</th>
                <th style={{ padding: "8px 6px", borderBottom: "1px solid #eee", width: 84 }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((w) => {
                const href = `/wrestlers/${encodeURIComponent(w.id)}?league=${encodeURIComponent(leagueSlug)}&from=team`;
                return (
                  <tr key={w.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                    <td style={{ padding: "10px 6px", fontWeight: 700 }}>
                      <Link href={href} style={{ color: "#111", textDecoration: "none" }}>
                        {w.name ?? w.id}
                      </Link>
                    </td>
                    <td style={{ padding: "10px 6px", color: "#333" }}>{w.rsPoints}</td>
                    <td style={{ padding: "10px 6px", color: "#333" }}>{w.plePoints}</td>
                    <td style={{ padding: "10px 6px", color: "#333" }}>{w.beltPoints}</td>
                    <td style={{ padding: "10px 6px", fontWeight: 800 }}>{w.totalPoints}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 18 }}>
        <Link
          href={factionLogHref}
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "#1a73e8",
            textDecoration: "none",
          }}
        >
          See faction log →
        </Link>
      </div>
    </div>
  );
}
