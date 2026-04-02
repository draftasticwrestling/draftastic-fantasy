import Link from "next/link";
import WrestlerList from "./WrestlerList";
import { aggregateWrestlerPoints, getPointsForWrestler } from "@/lib/scoring/aggregateWrestlerPoints.js";
import { aggregateWrestlerMatchStats, getMatchStatsForWrestler } from "@/lib/scoring/aggregateWrestlerMatchStats.js";
import {
  computeEndOfMonthBeltPoints,
  FIRST_END_OF_MONTH_POINTS_DATE,
  getCurrentChampionsBySlug,
  getMonthlyBeltForWrestler,
} from "@/lib/scoring/endOfMonthBeltPoints.js";
import { normalizeWrestlerName } from "@/lib/scoring/parsers/participantParser.js";
import { isPersonaOnlySlug, getPersonasForDisplay } from "@/lib/scoring/personaResolution.js";
import { getBeltImageUrlForTitle } from "@/lib/championshipBeltOverlay";
import { sortByChampionshipDisplayOrder } from "@/lib/championshipDisplayOrder";
import { collapseTagTeamChampionsForCard } from "@/lib/championshipCardTagChampions";
import { getChampionshipHistoryDataset } from "@/lib/championshipData";
import type { TitleHistoryItem } from "@/lib/championshipTitleHistory";

/** Allow cached response for 60s to improve repeat visit speed. */
export const revalidate = 60;

function read2kRating(row: Record<string, unknown>, key: string): number | null {
  const v = row[key];
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

export const metadata = {
  title: "Wrestlers — Draftastic Fantasy",
  description:
    "WWE roster in a Pro Wrestling Boxscore–style grid: brands, headshots, and fantasy points. Open any wrestler for their Draftastic profile.",
};

export default async function WrestlersPage() {
  const dataset = await getChampionshipHistoryDataset();

  const { events, reigns, titleHistoryBySlug, wrestlerBySlug, wrestlerByNameKey, wrestlers: wrestlersFromDb } =
    dataset;
  const eventsForAgg = events ?? [];
  const pointsBySlug = aggregateWrestlerPoints(
    eventsForAgg as Parameters<typeof aggregateWrestlerPoints>[0]
  );
  const matchStatsBySlug = aggregateWrestlerMatchStats(
    eventsForAgg as Parameters<typeof aggregateWrestlerMatchStats>[0]
  );
  const endOfMonthBeltPoints = computeEndOfMonthBeltPoints(reigns, FIRST_END_OF_MONTH_POINTS_DATE);
  const currentChampionsBySlug = getCurrentChampionsBySlug(reigns);

  const wrestlers = wrestlersFromDb;
  const wrestlersFiltered = wrestlers.filter((w) => !isPersonaOnlySlug(w.id));
  const rows = wrestlersFiltered.map((w) => {
    const slugKey = w.id;
    const nameKey = w.name ? normalizeWrestlerName(w.name) : "";
    const canonicalKey = nameKey || (slugKey ? normalizeWrestlerName(String(slugKey)) : "") || slugKey;
    const points = getPointsForWrestler(pointsBySlug, slugKey, nameKey);
    const matchStats = getMatchStatsForWrestler(matchStatsBySlug, slugKey, nameKey);
    const extraBelt = getMonthlyBeltForWrestler(endOfMonthBeltPoints, slugKey, nameKey);
    const beltPoints = points.beltPoints + extraBelt;
    const totalPoints = points.rsPoints + points.plePoints + beltPoints;
    const titles =
      currentChampionsBySlug[canonicalKey] ??
      currentChampionsBySlug[slugKey] ??
      (nameKey ? currentChampionsBySlug[nameKey] : null) ??
      [];
    const raw = w as Record<string, unknown>;
    return {
      id: w.id,
      name: w.name ?? null,
      gender: w.gender ?? null,
      brand: w.brand ?? null,
      image_url: (w as { image_url?: string }).image_url ?? null,
      dob: (w as { dob?: string }).dob ?? null,
      nationality: (w as { nationality?: string | null }).nationality ?? null,
      rating_2k26: read2kRating(w as Record<string, unknown>, "2K26 rating"),
      rating_2k25: read2kRating(w as Record<string, unknown>, "2K25 rating"),
      rsPoints: points.rsPoints,
      plePoints: points.plePoints,
      beltPoints,
      totalPoints,
      mw: matchStats.mw,
      win: matchStats.win,
      loss: matchStats.loss,
      nc: matchStats.nc,
      dqw: matchStats.dqw,
      dql: matchStats.dql,
      personaDisplay: getPersonasForDisplay(w.id) ?? null,
      status: (raw.Status ?? raw.status) != null ? String(raw.Status ?? raw.status) : null,
      currentChampionship: titles.length > 0 ? titles.join(", ") : null,
      championBeltImageUrl: titles.length > 0 ? getBeltImageUrlForTitle(titles[0], w.gender) : null,
    };
  });

  const historyCards = sortByChampionshipDisplayOrder(
    [...titleHistoryBySlug.entries()].map(([slug, bucket]) => ({
      slug,
      title: bucket.displayTitle,
      items: [...bucket.items].sort((a, b) => b.wonDate.localeCompare(a.wonDate)),
    }))
  );

  const currentChampionCards = historyCards
    .map((h) => {
      const latest = h.items[0];
      if (!latest) return null;
      const latestWon = latest.wonDate;
      const rawChamps = h.items.filter((x) => x.wonDate === latestWon);
      const { champions: champs, tagTeamName, hasTeamNameRow } = collapseTagTeamChampionsForCard(
        h.title,
        rawChamps,
        {
          wrestlerBySlug,
          wrestlerByNameKey,
        }
      );
      return {
        slug: h.slug,
        title: h.title,
        champs,
        tagTeamName,
        hasTeamNameRow,
        beltImageUrl: getBeltImageUrlForTitle(h.title),
      };
    })
    .filter(Boolean) as {
    slug: string;
    title: string;
    champs: TitleHistoryItem[];
    tagTeamName: string | null;
    hasTeamNameRow: boolean;
    beltImageUrl: string | null;
  }[];

  const error = dataset.error;
  return (
    <>
      <section style={{ marginTop: 24, marginBottom: 28 }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: "8px 16px",
            marginBottom: 14,
          }}
        >
          <h1 style={{ margin: 0, fontSize: 40, letterSpacing: "-0.01em" }}>CURRENT CHAMPIONS</h1>
          <Link
            href="/championship"
            style={{ fontSize: 15, fontWeight: 600, color: "var(--color-blue)", textDecoration: "none" }}
          >
            All championships →
          </Link>
        </div>
        <div className="wrestlers-page-champs-grid">
          {currentChampionCards.map((card) => {
            const slug = card.slug;
            return (
              <article key={card.slug} className="wrestlers-champ-card">
                <h3 className="wrestlers-champ-card__title">{card.title}</h3>
                <div className="wrestlers-champ-card__belt" aria-hidden={!card.beltImageUrl}>
                  {card.beltImageUrl ? (
                    <img src={card.beltImageUrl} alt="" />
                  ) : null}
                </div>
                <div className="wrestlers-champ-card__avatars">
                  {card.champs.map((c) => (
                    <div key={`${card.title}-${c.championSlug || c.champion}`}>
                      {c.imageUrl ? (
                        <img
                          src={c.imageUrl}
                          alt={c.champion}
                          className="wrestlers-champ-card__avatar-img"
                        />
                      ) : (
                        <div className="wrestlers-champ-card__avatar-ph" aria-hidden>
                          ?
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {card.hasTeamNameRow ? (
                  <div
                    className={`wrestlers-champ-card__team-name${
                      card.tagTeamName ? "" : " wrestlers-champ-card__team-name--empty"
                    }`}
                  >
                    {card.tagTeamName ?? "\u00a0"}
                  </div>
                ) : null}
                <div className="wrestlers-champ-card__names">
                  {card.champs.map((c) => c.champion).join(" & ")}
                </div>
                <div className="wrestlers-champ-card__footer">
                  <Link href={`/championship/${encodeURIComponent(slug)}`} className="wrestlers-champ-title-history-pill">
                    Title History
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {error && (
        <p style={{ color: "red" }}>
          Error loading wrestlers: {String((error as Error).message ?? error)}. Check .env (NEXT_PUBLIC_SUPABASE_*).
        </p>
      )}

      {rows.length === 0 && !error && <p>No wrestlers in the database yet.</p>}

      {rows.length > 0 && (
        <section className="wrestlers-boxscore-section" aria-labelledby="wrestlers-roster-heading">
          <h2 id="wrestlers-roster-heading" className="wrestlers-boxscore-section-title">
            WRESTLERS
          </h2>
          <WrestlerList wrestlers={rows} variant="boxscore" defaultSortColumn="name" defaultSortDir="asc" />
        </section>
      )}
    </>
  );
}
