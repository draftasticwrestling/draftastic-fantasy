"use client";

import MatchCardUntyped from "@/components/boxscore-port/MatchCard";
import { eventResultsHref } from "@/lib/event-results/eventResultsRoute";
import type { ComponentType } from "react";
import Link from "next/link";
import { useState } from "react";

const GOLD = "#d0ac56";
const PANEL_BG = "#121418";
const PANEL_BORDER = "#2a2d35";
const MUTED = "#9aa0a6";

export type PointsEventRow = {
  eventId: string;
  eventName: string;
  date: string;
  result: string | null;
  title: string | null;
  titleOutcome: string | null;
  total: number;
  personaName: string | null;
};

export type LastFiveMatchItem = {
  eventId: string;
  eventName: string;
  eventDate: string;
  location: string | null;
  eventStatus?: string | null;
  matchIndex: number;
  eventHref: string;
  match: Record<string, unknown>;
};

export type LastFivePayload = {
  outcomes: ("W" | "L" | "D")[];
  items: LastFiveMatchItem[];
};

type EventLike = {
  id?: string;
  name?: string | null;
  date?: string | null;
  location?: string | null;
  status?: string | null;
  matches?: unknown[] | null;
  [key: string]: unknown;
};

type MatchCardProps = {
  match: unknown;
  event: EventLike;
  wrestlerMap: Record<string, Record<string, unknown>>;
  isClickable?: boolean;
  matchIndex?: number;
  events: EventLike[];
  fantasyPointsBySlug?: Record<string, { points: number; isWinner: boolean; breakdown: string[] }> | null;
};

const MatchCard = MatchCardUntyped as ComponentType<MatchCardProps>;

function formatProfileDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = dateStr.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y, m, day] = d.split("-");
    const month = new Date(Number(y), Number(m) - 1, 1).toLocaleString("en-US", { month: "long" });
    return `${month} ${Number(day)}, ${y}`;
  }
  return dateStr;
}

function eventRowForLastFiveItem(item: LastFiveMatchItem, timeline: EventLike[]): EventLike {
  const row = timeline.find((e) => String(e.id ?? "") === item.eventId);
  if (row) return row;
  return {
    id: item.eventId,
    name: item.eventName,
    date: item.eventDate,
    status: item.eventStatus ?? null,
    location: item.location,
    matches: [],
  };
}

export default function WrestlerProfileEventsPanel({
  lastFive,
  pointsRows,
  matchTimelineEvents,
  matchCardWrestlerMap,
}: {
  lastFive: LastFivePayload;
  pointsRows: PointsEventRow[];
  matchTimelineEvents: EventLike[];
  matchCardWrestlerMap: Record<string, Record<string, unknown>>;
}) {
  const [mode, setMode] = useState<"last5" | "points">("last5");

  return (
    <section style={{ marginBottom: 32 }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 14,
        }}
      >
        <h2 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700 }}>Match History</h2>
        <div
          role="tablist"
          aria-label="Match History view"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            padding: 4,
            borderRadius: 10,
            background: "#f0f2f5",
            border: "1px solid #dee2e6",
          }}
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "last5"}
            onClick={() => setMode("last5")}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              background: mode === "last5" ? "#fff" : "transparent",
              color: mode === "last5" ? "#111" : "#555",
              boxShadow: mode === "last5" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
            }}
          >
            Last 5 matches
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "points"}
            onClick={() => setMode("points")}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              background: mode === "points" ? "#fff" : "transparent",
              color: mode === "points" ? "#111" : "#555",
              boxShadow: mode === "points" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
            }}
          >
            Events with points ({pointsRows.length})
          </button>
        </div>
      </div>

      {mode === "last5" ? (
        <div
          style={{
            padding: "18px 20px",
            background: PANEL_BG,
            borderRadius: 8,
            border: `1px solid ${PANEL_BORDER}`,
          }}
        >
          <p style={{ margin: "0 0 12px 0", fontSize: 12, color: MUTED, lineHeight: 1.45 }}>
            Last five are the most recent matches on the full event timeline (completed and live), using the same
            ordering and W/L/D rules as Pro Wrestling Boxscore — not limited to the fantasy points period above.
          </p>
          {lastFive.outcomes.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              <span style={{ fontSize: 13, color: MUTED, marginRight: 4 }}>Recent form</span>
              <div style={{ display: "flex", gap: 4 }} aria-label="Last five match outcomes, newest first">
                {lastFive.outcomes.map((outcome, i) => (
                  <div
                    key={i}
                    title={outcome === "W" ? "Win" : outcome === "D" ? "Draw / no contest" : "Loss"}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 4,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#fff",
                      background: outcome === "W" ? "#2e7d32" : outcome === "D" ? "#f9a825" : "#c62828",
                    }}
                  >
                    {outcome}
                  </div>
                ))}
              </div>
            </div>
          )}

          {lastFive.items.length === 0 ? (
            <p style={{ margin: 0, color: MUTED, fontStyle: "italic" }}>No match history yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {lastFive.items.map((item, idx) => {
                const cardKey = `${item.eventId}-${item.matchIndex}-${idx}`;
                const eventRow = eventRowForLastFiveItem(item, matchTimelineEvents);
                return (
                  <div key={cardKey}>
                    <div style={{ marginBottom: 10, fontSize: 14 }}>
                      <Link
                        href={item.eventHref}
                        style={{ color: GOLD, textDecoration: "none", fontWeight: 600 }}
                      >
                        {item.eventName || "Event"}
                      </Link>
                      <span style={{ color: "#b0b8c4" }}>
                        {" "}
                        — {formatProfileDate(item.eventDate)}
                        {item.location ? ` — ${item.location}` : ""}
                      </span>
                    </div>
                    <MatchCard
                      match={item.match}
                      event={eventRow}
                      wrestlerMap={matchCardWrestlerMap}
                      matchIndex={item.matchIndex}
                      events={matchTimelineEvents}
                      isClickable
                      fantasyPointsBySlug={null}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div style={{ border: "1px solid #ddd", borderRadius: 8, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "#f5f5f5" }}>
                <th style={{ padding: "8px 12px", textAlign: "left", borderBottom: "1px solid #ddd" }}>Date</th>
                <th style={{ padding: "8px 12px", textAlign: "left", borderBottom: "1px solid #ddd" }}>Event</th>
                <th style={{ padding: "8px 12px", textAlign: "left", borderBottom: "1px solid #ddd" }}>Result / Title</th>
                <th style={{ padding: "8px 12px", textAlign: "right", borderBottom: "1px solid #ddd" }}>Pts</th>
              </tr>
            </thead>
            <tbody>
              {pointsRows.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: "16px 12px", color: "#666", textAlign: "center" }}>
                    No matches with points in the league period.
                  </td>
                </tr>
              ) : (
                pointsRows.map((row, i) => (
                  <tr key={row.eventId + i} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>{formatProfileDate(row.date)}</td>
                    <td style={{ padding: "8px 12px" }}>
                      <Link
                        href={eventResultsHref({ id: row.eventId, name: row.eventName, date: row.date })}
                        style={{ color: "#1a73e8", textDecoration: "none" }}
                      >
                        {row.eventName}
                      </Link>
                      {row.personaName && (
                        <span style={{ display: "block", fontSize: 12, color: "#666", fontStyle: "italic" }}>
                          as {row.personaName}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "8px 12px", color: "#333" }}>
                      {row.result ?? "—"}
                      {row.title && row.title !== "None" && (
                        <span style={{ display: "block", fontSize: 12, color: "#666" }}>
                          {row.title}
                          {row.titleOutcome && row.titleOutcome !== "None" ? ` · ${row.titleOutcome}` : ""}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600 }}>{row.total}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
