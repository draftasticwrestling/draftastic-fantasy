"use client";

import { useRouter, usePathname } from "next/navigation";

type WeekOption = { weekStart: string; weekEnd: string; label: string; weekNumber: number };

type Props = {
  weeks: WeekOption[];
  selectedWeekStart: string;
  slug: string;
};

export function MatchupWeekSelector({ weeks, selectedWeekStart, slug }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="matchup-week-selector">
      <label htmlFor="matchup-week" style={{ fontSize: 12, color: "var(--color-text-muted)", marginRight: 8 }}>
        Week
      </label>
      <select
        id="matchup-week"
        value={selectedWeekStart}
        onChange={(e) => {
          const week = e.target.value;
          if (week) router.push(`${pathname}?week=${encodeURIComponent(week)}`);
        }}
        style={{
          padding: "8px 12px",
          fontSize: 14,
          fontWeight: 600,
          color: "var(--color-blue)",
          background: "var(--color-bg-input)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-sm)",
          cursor: "pointer",
          minWidth: 220,
        }}
      >
        {weeks.map((w) => (
          <option key={w.weekStart} value={w.weekStart}>
            Matchup {w.weekNumber} ({w.label})
          </option>
        ))}
      </select>
    </div>
  );
}
