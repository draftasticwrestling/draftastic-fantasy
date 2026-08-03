import Image from "next/image";
import Link from "next/link";
import { getAdminClient } from "@/lib/supabase/admin";
import { listUserChampionshipWins } from "@/lib/leagueSeasonPlacements";

function formatPts(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const r = Math.round(n * 100) / 100;
  if (Number.isInteger(r)) return String(r);
  return r.toFixed(2).replace(/\.?0+$/, "");
}

function seasonLabel(seasonKey: string, seasonSlug: string | null): string {
  if (seasonKey === "road-to-summerslam-2026") return "Road to SummerSlam 2026";
  if (seasonSlug === "road-to-summerslam") return "Road to SummerSlam";
  if (seasonSlug === "road-to-war-games") return "Road to War Games";
  if (seasonSlug === "chamber-to-mania") return "Chamber to Mania";
  if (seasonSlug === "road-to-wrestlemania") return "Road to WrestleMania";
  if (seasonKey.endsWith("-2026") && seasonSlug) {
    return seasonSlug
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ") + " 2026";
  }
  return seasonKey.replace(/-/g, " ");
}

export async function AccountChampionshipBelts({ userId }: { userId: string }) {
  const admin = getAdminClient();
  if (!admin) return null;

  let wins: Awaited<ReturnType<typeof listUserChampionshipWins>> = [];
  try {
    wins = await listUserChampionshipWins(admin, userId);
  } catch {
    wins = [];
  }

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
      <h2 style={{ margin: "0 0 8px", fontSize: "1.1rem" }}>Championship Belts</h2>
      <p style={{ margin: "0 0 14px", color: "var(--color-text-muted)", fontSize: 14 }}>
        League championships you&apos;ve won. Each belt commemorates a season title.
      </p>
      {wins.length === 0 ? (
        <p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: 14 }}>
          No league championships yet.
        </p>
      ) : (
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "grid",
            gap: 14,
          }}
        >
          {wins.map((win) => (
            <li
              key={`${win.leagueId}-${win.seasonKey}`}
              style={{
                display: "grid",
                gap: 10,
                padding: "12px 12px 14px",
                border: "1px solid var(--color-border)",
                borderRadius: 10,
                background: "var(--color-bg, #fff)",
              }}
            >
              <Image
                src={win.beltSrc}
                alt={win.beltAlt}
                width={560}
                height={120}
                sizes="(max-width: 480px) 100vw, 420px"
                style={{ display: "block", width: "100%", height: "auto" }}
              />
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                  {seasonLabel(win.seasonKey, win.seasonSlug)}
                </div>
                <div style={{ fontSize: 14, marginBottom: 2 }}>
                  <Link
                    href={`/leagues/${encodeURIComponent(win.leagueSlug)}`}
                    style={{ color: "#1a73e8", textDecoration: "none", fontWeight: 600 }}
                  >
                    {win.leagueName}
                  </Link>
                  <span style={{ color: "var(--color-text-muted)", marginLeft: 8 }}>
                    {win.visibility === "public" ? "Public" : "Private"}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
                  Season points: {formatPts(win.points)}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
