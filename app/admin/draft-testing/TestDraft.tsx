"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { getRosterRulesForLeague } from "@/lib/leagueStructure";

export type WrestlerDraftRow = {
  id: string;
  name: string | null;
  gender: string | null;
  brand: string | null;
  dob: string | null;
  rating_2k26: number | null;
  rating_2k25: number | null;
};

export type PointsBySlug = Record<string, { rsPoints: number; plePoints: number; beltPoints: number }>;

const PICK_CLOCK_SECONDS = 120;

/** Overall rank formula: composite = total points + (2K26 rating × 1.5). Higher = better. */
const RATING_WEIGHT = 1.5;

function calculateAge(dob: string | null | undefined): number | null {
  if (!dob?.trim()) return null;
  const date = new Date(dob);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const m = today.getMonth() - date.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < date.getDate())) age--;
  return age >= 0 ? age : null;
}

function normalizeBrand(brand: string | null | undefined): string {
  if (!brand?.trim()) return "Unassigned";
  const lower = brand.trim().toLowerCase();
  if (lower === "raw") return "Raw";
  if (lower === "smackdown" || lower === "smack down") return "SmackDown";
  return "Unassigned";
}

function normalizeGender(g: string | null | undefined): string {
  if (!g) return "—";
  const lower = String(g).toLowerCase();
  if (lower === "male" || lower === "m") return "M";
  if (lower === "female" || lower === "f") return "F";
  return "—";
}

function shuffle<T>(array: T[]): T[] {
  const out = [...array];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Build draft order: order[i] = team index (0-based) for overall pick i+1. */
function buildDraftOrder(
  style: "snake" | "linear",
  teamCount: number,
  rosterSize: number
): number[] {
  const round1Order = shuffle(Array.from({ length: teamCount }, (_, i) => i));
  const order: number[] = [];
  for (let round = 1; round <= rosterSize; round++) {
    const roundOrder =
      style === "snake" && round % 2 === 0 ? [...round1Order].reverse() : round1Order;
    roundOrder.forEach((teamIndex) => order.push(teamIndex));
  }
  return order;
}

function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const TEAM_COUNTS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

type Phase = "setup" | "drafting" | "complete";

type PointsPeriod = "2026" | "2025" | "all";

type Props = {
  wrestlers: WrestlerDraftRow[];
  pointsByPeriod: { "2026": PointsBySlug; "2025": PointsBySlug; all: PointsBySlug };
};

export function TestDraft({ wrestlers, pointsByPeriod }: Props) {
  const [teamCount, setTeamCount] = useState<number>(4);
  const [draftStyle, setDraftStyle] = useState<"snake" | "linear">("snake");
  const [phase, setPhase] = useState<Phase>("setup");
  const [pointsPeriod, setPointsPeriod] = useState<PointsPeriod>("2026");
  const [draftOrder, setDraftOrder] = useState<number[]>([]);
  const [picksByTeam, setPicksByTeam] = useState<Record<number, string[]>>({});
  const [currentPick, setCurrentPick] = useState(1);
  const [clockSeconds, setClockSeconds] = useState(PICK_CLOCK_SECONDS);

  const rules = getRosterRulesForLeague(teamCount);
  const totalPicks = rules ? teamCount * rules.rosterSize : 0;
  const currentTeamIndex = draftOrder[currentPick - 1] ?? null;

  const draftedIds = new Set<string>();
  Object.values(picksByTeam).forEach((ids) => ids.forEach((id) => draftedIds.add(id)));
  const available = wrestlers.filter((w) => !draftedIds.has(w.id));

  const pointsForPeriod = pointsByPeriod[pointsPeriod];

  /** Available wrestlers sorted by overall rank (composite = total + 2K26 × weight), with rank assigned. */
  const rankedAvailable = useMemo(() => {
    const withStats = available.map((w) => {
      const pts = pointsForPeriod[w.id] ?? { rsPoints: 0, plePoints: 0, beltPoints: 0 };
      const total = pts.rsPoints + pts.plePoints + pts.beltPoints;
      const rating = w.rating_2k26 ?? 0;
      const composite = total + rating * RATING_WEIGHT;
      return { wrestler: w, rs: pts.rsPoints, ple: pts.plePoints, belt: pts.beltPoints, total, composite };
    });
    withStats.sort((a, b) => b.composite - a.composite || (b.wrestler.rating_2k26 ?? 0) - (a.wrestler.rating_2k26 ?? 0) || (a.wrestler.name ?? a.wrestler.id).localeCompare(b.wrestler.name ?? b.wrestler.id));
    return withStats.map((row, i) => ({ ...row, rank: i + 1 }));
  }, [available, pointsForPeriod]);

  useEffect(() => {
    if (phase !== "drafting") return;
    setClockSeconds(PICK_CLOCK_SECONDS);
    const interval = setInterval(() => {
      setClockSeconds((prev) => {
        if (prev <= 0) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, currentPick]);

  const startDraft = useCallback(() => {
    if (!rules) return;
    const order = buildDraftOrder(draftStyle, teamCount, rules.rosterSize);
    setDraftOrder(order);
    setPicksByTeam({});
    setCurrentPick(1);
    setPhase("drafting");
  }, [teamCount, draftStyle, rules]);

  const makePick = useCallback(
    (wrestlerId: string) => {
      if (phase !== "drafting" || currentTeamIndex == null) return;
      setPicksByTeam((prev) => ({
        ...prev,
        [currentTeamIndex]: [...(prev[currentTeamIndex] ?? []), wrestlerId],
      }));
      if (currentPick >= totalPicks) {
        setPhase("complete");
      } else {
        setCurrentPick((p) => p + 1);
      }
    },
    [phase, currentPick, totalPicks, currentTeamIndex]
  );

  const reset = useCallback(() => {
    setPhase("setup");
    setDraftOrder([]);
    setPicksByTeam({});
    setCurrentPick(1);
    setClockSeconds(PICK_CLOCK_SECONDS);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {phase === "setup" && (
        <section
          style={{
            padding: 24,
            background: "var(--color-bg-elevated)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--color-border)",
          }}
        >
          <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: 12 }}>
            Start a test draft
          </h2>
          <p style={{ color: "var(--color-text-muted)", marginBottom: 16 }}>
            Choose number of teams and draft style. You’ll make every pick for every team. A 2-minute clock runs per pick.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 20 }}>
            <div>
              <label htmlFor="test-draft-teams" style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
                Number of teams
              </label>
              <select
                id="test-draft-teams"
                value={teamCount}
                onChange={(e) => setTeamCount(Number(e.target.value))}
                style={{
                  padding: "10px 12px",
                  fontSize: 16,
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius)",
                  minWidth: 80,
                }}
              >
                {TEAM_COUNTS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="test-draft-style" style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
                Draft style
              </label>
              <select
                id="test-draft-style"
                value={draftStyle}
                onChange={(e) => setDraftStyle(e.target.value as "snake" | "linear")}
                style={{
                  padding: "10px 12px",
                  fontSize: 16,
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius)",
                  minWidth: 140,
                }}
              >
                <option value="snake">Snake</option>
                <option value="linear">Standard (linear)</option>
              </select>
            </div>
            {rules && (
              <span style={{ fontSize: 14, color: "var(--color-text-muted)" }}>
                {rules.rosterSize} picks per team · {totalPicks} total
              </span>
            )}
            <button
              type="button"
              onClick={startDraft}
              disabled={!rules}
              style={{
                padding: "10px 20px",
                background: "var(--color-blue)",
                color: "var(--color-text-inverse)",
                border: "none",
                borderRadius: "var(--radius)",
                fontSize: 16,
                fontWeight: 600,
                cursor: rules ? "pointer" : "not-allowed",
                opacity: rules ? 1 : 0.6,
              }}
            >
              Start test draft
            </button>
          </div>
        </section>
      )}

      {phase === "drafting" && (
        <>
          <section
            style={{
              padding: 16,
              background: "var(--color-success-bg)",
              borderRadius: "var(--radius)",
              border: "1px solid var(--color-success-muted)",
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
            }}
          >
            <p style={{ margin: 0, fontWeight: 600, color: "var(--color-text)" }}>
              Pick {currentPick} of {totalPicks} — <strong>Team {currentTeamIndex! + 1}</strong> is on the clock
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div
                style={{
                  fontSize: "1.5rem",
                  fontWeight: 700,
                  fontVariantNumeric: "tabular-nums",
                  color: clockSeconds <= 10 ? "var(--color-red)" : "var(--color-text)",
                }}
                aria-live="polite"
              >
                {formatClock(clockSeconds)}
              </div>
              <button
                type="button"
                onClick={() => setPhase("complete")}
                style={{
                  padding: "8px 16px",
                  background: "var(--color-text-muted)",
                  color: "var(--color-text-inverse)",
                  border: "none",
                  borderRadius: "var(--radius)",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                End draft
              </button>
            </div>
          </section>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            <div>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginBottom: 8 }}>
                <h3 style={{ fontSize: "1rem", margin: 0 }}>Available wrestlers</h3>
                <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Points:</span>
                <select
                  aria-label="Points period"
                  value={pointsPeriod}
                  onChange={(e) => setPointsPeriod(e.target.value as PointsPeriod)}
                  style={{
                    padding: "6px 10px",
                    fontSize: 14,
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius)",
                    background: "var(--color-bg-input)",
                  }}
                >
                  <option value="2026">2026 YTD</option>
                  <option value="2025">2025</option>
                  <option value="all">All-time</option>
                </select>
                <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>Rank = Total + (2K26 × 1.5)</span>
              </div>
              <div
                style={{
                  maxHeight: 420,
                  overflow: "auto",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius)",
                }}
              >
                {rankedAvailable.length === 0 ? (
                  <p style={{ color: "var(--color-text-muted)", margin: 16 }}>None left</p>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead style={{ position: "sticky", top: 0, background: "var(--color-bg-elevated)", zIndex: 1 }}>
                      <tr>
                        <th style={{ padding: "8px 6px", textAlign: "left", borderBottom: "1px solid var(--color-border)" }}>Rank</th>
                        <th style={{ padding: "8px 6px", textAlign: "left", borderBottom: "1px solid var(--color-border)" }}>Name</th>
                        <th style={{ padding: "8px 6px", textAlign: "center", borderBottom: "1px solid var(--color-border)" }}>Gender</th>
                        <th style={{ padding: "8px 6px", textAlign: "center", borderBottom: "1px solid var(--color-border)" }}>Age</th>
                        <th style={{ padding: "8px 6px", textAlign: "center", borderBottom: "1px solid var(--color-border)" }} title="2K26 if available, else 2K25">2K Rating</th>
                        <th style={{ padding: "8px 6px", textAlign: "right", borderBottom: "1px solid var(--color-border)" }} title="Raw/SmackDown">R/S</th>
                        <th style={{ padding: "8px 6px", textAlign: "right", borderBottom: "1px solid var(--color-border)" }}>PLE</th>
                        <th style={{ padding: "8px 6px", textAlign: "right", borderBottom: "1px solid var(--color-border)" }}>Belt</th>
                        <th style={{ padding: "8px 6px", textAlign: "left", borderBottom: "1px solid var(--color-border)" }}>Brand</th>
                        <th style={{ padding: "8px 6px", borderBottom: "1px solid var(--color-border)" }} />
                      </tr>
                    </thead>
                    <tbody>
                      {rankedAvailable.map(({ wrestler: w, rank, rs, ple, belt }) => {
                        const display2k = w.rating_2k26 ?? w.rating_2k25 ?? null;
                        return (
                          <tr key={w.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                            <td style={{ padding: "6px", fontWeight: 600 }}>{rank}</td>
                            <td style={{ padding: "6px", whiteSpace: "nowrap" }}>{w.name ?? w.id}</td>
                            <td style={{ padding: "6px", textAlign: "center" }}>{normalizeGender(w.gender)}</td>
                            <td style={{ padding: "6px", textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{calculateAge(w.dob) ?? "—"}</td>
                            <td style={{ padding: "6px", textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{display2k != null ? display2k : "—"}</td>
                            <td style={{ padding: "6px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{rs}</td>
                            <td style={{ padding: "6px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{ple}</td>
                            <td style={{ padding: "6px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{belt}</td>
                            <td style={{ padding: "6px" }}>{normalizeBrand(w.brand)}</td>
                            <td style={{ padding: "6px" }}>
                              <button
                                type="button"
                                onClick={() => makePick(w.id)}
                                style={{
                                  padding: "4px 10px",
                                  fontSize: 12,
                                  fontWeight: 600,
                                  background: "var(--color-blue)",
                                  color: "var(--color-text-inverse)",
                                  border: "none",
                                  borderRadius: "var(--radius)",
                                  cursor: "pointer",
                                }}
                              >
                                Pick
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div>
              <h3 style={{ fontSize: "1rem", marginBottom: 12 }}>Rosters</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {Array.from({ length: teamCount }, (_, i) => (
                  <div
                    key={i}
                    style={{
                      padding: 12,
                      background: currentTeamIndex === i ? "var(--color-success-bg)" : "var(--color-bg-elevated)",
                      borderRadius: "var(--radius)",
                      border: `1px solid ${currentTeamIndex === i ? "var(--color-success-muted)" : "var(--color-border)"}`,
                    }}
                  >
                    <strong style={{ fontSize: 14 }}>Team {i + 1}</strong>
                    <ul style={{ margin: "8px 0 0", paddingLeft: 20, fontSize: 14, color: "var(--color-text-muted)" }}>
                      {(picksByTeam[i] ?? []).map((id) => {
                        const w = wrestlers.find((x) => x.id === id);
                        return <li key={id}>{w?.name ?? id}</li>;
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {phase === "complete" && (
        <section
          style={{
            padding: 24,
            background: "var(--color-bg-elevated)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--color-border)",
          }}
        >
          <p style={{ fontWeight: 600, color: "var(--color-success-muted)", marginBottom: 16 }}>
            Draft complete.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {Array.from({ length: teamCount }, (_, i) => (
              <div key={i} style={{ padding: 12, background: "var(--color-bg-input)", borderRadius: "var(--radius)" }}>
                <strong>Team {i + 1}</strong>
                <ul style={{ margin: "8px 0 0", paddingLeft: 20, fontSize: 14 }}>
                  {(picksByTeam[i] ?? []).map((id) => {
                    const w = wrestlers.find((x) => x.id === id);
                    return <li key={id}>{w?.name ?? id}</li>;
                  })}
                </ul>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 16,
              padding: "10px 20px",
              background: "var(--color-text-muted)",
              color: "var(--color-text-inverse)",
              border: "none",
              borderRadius: "var(--radius)",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Run another test draft
          </button>
        </section>
      )}
    </div>
  );
}
