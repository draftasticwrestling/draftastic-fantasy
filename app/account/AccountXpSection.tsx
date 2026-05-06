import { getUserXpForProfile } from "@/lib/xp/getUserXpForProfile";
import { refreshFantasyPointsTiersForUser } from "@/lib/xp/refreshFantasyPointsTiers";

export async function AccountXpSection({ userId }: { userId: string }) {
  await refreshFantasyPointsTiersForUser(userId);
  const xp = await getUserXpForProfile(userId);
  if (!xp) return null;

  const { totalXp, level } = xp;
  const pct = level.nextMinXp != null ? Math.round(level.progressToNext * 100) : 100;
  const nextLabel =
    level.nextTitle && level.nextMinXp != null
      ? `${level.nextTitle} (${level.nextMinXp.toLocaleString()} XP)`
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
      <h2 style={{ margin: "0 0 8px", fontSize: "1.1rem" }}>Your XP &amp; title</h2>
      <p style={{ margin: "0 0 12px", color: "var(--color-text-muted)", fontSize: 14 }}>
        Earn XP by playing: daily visits, roster moves, trades, leagues, streaks, and big season finishes. Run the{" "}
        <code style={{ fontSize: 13 }}>supabase/user_xp.sql</code> migration if this stays at zero after actions.
      </p>
      <div style={{ fontWeight: 700, fontSize: "1.05rem", marginBottom: 4 }}>{level.title}</div>
      <div style={{ fontSize: 14, color: "var(--color-text-muted)", marginBottom: 10 }}>
        {totalXp.toLocaleString()} total XP
        {level.nextMinXp != null ? (
          <>
            {" "}
            · Next: {nextLabel}
          </>
        ) : null}
      </div>
      {level.nextMinXp != null ? (
        <div
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          style={{
            height: 10,
            borderRadius: 999,
            background: "var(--color-border)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              background: "linear-gradient(90deg, #1a73e8, #4fc3f7)",
              transition: "width 0.3s ease",
            }}
          />
        </div>
      ) : null}
    </section>
  );
}
