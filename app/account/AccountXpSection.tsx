import { getUserXpForProfile } from "@/lib/xp/getUserXpForProfile";
import { refreshFantasyPointsTiersForUser } from "@/lib/xp/refreshFantasyPointsTiers";
import { XP_LEVELS } from "@/lib/xp/xpLevels";
import XpStatusStrip from "@/app/components/XpStatusStrip";

export async function AccountXpSection({ userId }: { userId: string }) {
  await refreshFantasyPointsTiersForUser(userId);
  const xp = await getUserXpForProfile(userId);
  if (!xp) return null;

  const { totalXp, level } = xp;
  const currentIndex = Math.max(0, XP_LEVELS.findIndex((l) => l.level === level.level));
  const tail = XP_LEVELS.slice(currentIndex, currentIndex + 5);
  const levelsWindow =
    tail.length === 5
      ? tail
      : XP_LEVELS.slice(Math.max(0, XP_LEVELS.length - 5));
  const barMin = levelsWindow[0]?.minXp ?? 0;
  const barMax = levelsWindow[levelsWindow.length - 1]?.minXp ?? barMin;
  const barPct =
    barMax > barMin
      ? Math.max(0, Math.min(100, ((totalXp - barMin) / (barMax - barMin)) * 100))
      : 100;
  const nextLabel =
    level.nextLabel && level.nextMinXp != null
      ? `${level.nextLabel} (${level.nextMinXp.toLocaleString()} XP)`
      : "Max level";

  return (
    <section
      style={{
        marginBottom: 28,
        padding: "16px 18px",
        border: "1px solid var(--color-border)",
        borderRadius: 12,
        background: "var(--color-bg-card)",
      }}
    >
      <h2 style={{ margin: "0 0 8px", fontSize: "1.1rem" }}>Your XP progression</h2>
      <p style={{ margin: "0 0 12px", color: "var(--color-text-muted)", fontSize: 14 }}>
        Earn XP by playing: daily visits, roster moves, trades, leagues, streaks, and big season finishes.
      </p>
      <XpStatusStrip totalXp={totalXp} />
      <div style={{ fontSize: 13, color: "var(--color-text-muted)", margin: "8px 0 10px" }}>
        {level.nextMinXp != null ? `Next up: ${nextLabel}` : "You reached max level."}
      </div>
      <h3 style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 700 }}>5-level roadmap</h3>
      <div
        role="progressbar"
        aria-valuenow={Math.round(barPct)}
        aria-valuemin={0}
        aria-valuemax={100}
        style={{
          height: 10,
          borderRadius: 999,
          background: "var(--color-border)",
          overflow: "hidden",
          marginBottom: 12,
        }}
      >
        <div
          style={{
            width: `${barPct}%`,
            height: "100%",
            background: "linear-gradient(90deg, #1a73e8, #4fc3f7)",
            transition: "width 0.3s ease",
          }}
        />
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {levelsWindow.map((row) => {
          const unlocked = totalXp >= row.minXp;
          const isCurrent = row.level === level.level;
          return (
            <div
              key={row.level}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                padding: "8px 10px",
                borderRadius: 10,
                border: isCurrent
                  ? "1px solid rgba(26,115,232,0.45)"
                  : "1px solid var(--color-border)",
                background: isCurrent
                  ? "rgba(26,115,232,0.08)"
                  : unlocked
                    ? "var(--color-bg)"
                    : "var(--color-bg-elevated)",
              }}
            >
              <span style={{ fontSize: 13, fontWeight: isCurrent ? 700 : 600, opacity: unlocked ? 1 : 0.66 }}>
                Level {row.level} — {row.title}
              </span>
              <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                {unlocked ? "Unlocked" : `${row.minXp.toLocaleString()} XP`}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
