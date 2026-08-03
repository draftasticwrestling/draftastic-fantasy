import Image from "next/image";
import Link from "next/link";
import { getAdminClient } from "@/lib/supabase/admin";
import { getHubRtssChampions } from "@/lib/hubRtssChampions";
import { ROAD_TO_SUMMERSLAM_BANNER_SRC } from "@/lib/leagueStructure";

function formatPts(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const r = Math.round(n * 100) / 100;
  if (Number.isInteger(r)) return String(r);
  return r.toFixed(2).replace(/\.?0+$/, "");
}

export default async function HubRtssChampions() {
  if (!getAdminClient()) return null;
  const data = await getHubRtssChampions();
  if (!data.available) return null;

  return (
    <section className="hub-col-side hub-rtss-champions-card" aria-label="Road to SummerSlam 2026 Champions">
      <h2 className="hub-col-title">Road to SummerSlam 2026 Champions</h2>
      <div className="hub-rtss-champions-belt">
        <Image
          src={ROAD_TO_SUMMERSLAM_BANNER_SRC}
          alt="Road to SummerSlam"
          width={560}
          height={120}
          sizes="(max-width: 900px) 100vw, 280px"
          className="hub-rtss-champions-belt-img"
          priority={false}
        />
      </div>
      {data.champions.length === 0 ? (
        <p className="hub-leaderboards-empty hub-rtss-champions-empty">
          Champions will appear when the season wraps.
        </p>
      ) : (
        <ul className="hub-rtss-champions-list">
          {data.champions.map((row) => (
            <li key={`${row.leagueId}-${row.userId}`} className="hub-rtss-champions-row">
              <div className="hub-rtss-champions-main">
                <span className="hub-rtss-champions-name">{row.displayName}</span>
                <Link href={`/leagues/${encodeURIComponent(row.leagueSlug)}`} className="hub-rtss-champions-league">
                  {row.leagueName}
                </Link>
                <span
                  className={`hub-rtss-champions-vis hub-rtss-champions-vis--${row.visibility}`}
                >
                  {row.visibility === "public" ? "Public" : "Private"}
                </span>
              </div>
              <span className="hub-rtss-champions-pts">{formatPts(row.points)} pts</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
