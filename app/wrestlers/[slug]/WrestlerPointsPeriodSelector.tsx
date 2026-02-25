"use client";

import { useRouter, usePathname } from "next/navigation";

export type PointsPeriod = "allTime" | "2025" | "2026" | "sinceStart";

const PERIOD_OPTIONS: { value: PointsPeriod; label: string }[] = [
  { value: "allTime", label: "All-time Points" },
  { value: "2026", label: "2026 points" },
  { value: "2025", label: "2025 points" },
  { value: "sinceStart", label: "Since League Start" },
];

type Props = {
  currentPeriod: PointsPeriod;
  leagueSlug: string | null;
};

export function WrestlerPointsPeriodSelector({ currentPeriod, leagueSlug }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  function handleChange(period: PointsPeriod) {
    const params = new URLSearchParams();
    params.set("period", period);
    if (period === "sinceStart" && leagueSlug) params.set("league", leagueSlug);
    if (period !== "sinceStart" && leagueSlug) params.set("league", leagueSlug); // keep league in URL when switching back
    const q = params.toString();
    router.push(q ? `${pathname}?${q}` : pathname);
  }

  return (
    <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <label htmlFor="wrestler-points-period" style={{ fontSize: 14, fontWeight: 600 }}>
        Points:
      </label>
      <select
        id="wrestler-points-period"
        value={currentPeriod}
        onChange={(e) => handleChange(e.target.value as PointsPeriod)}
        style={{
          padding: "8px 12px",
          fontSize: 14,
          borderRadius: 6,
          border: "1px solid #ccc",
          minWidth: 180,
        }}
      >
        {PERIOD_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {currentPeriod === "sinceStart" && !leagueSlug && (
        <span style={{ fontSize: 13, color: "#666" }}>
          Add <code style={{ background: "#f0f0f0", padding: "2px 6px", borderRadius: 4 }}>?league=your-league-slug</code> to the URL to view since a league&apos;s start.
        </span>
      )}
    </div>
  );
}
