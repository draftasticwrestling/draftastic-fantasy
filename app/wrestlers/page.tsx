import { WrestlerMatchStatsDisclaimer } from "@/app/components/WrestlerMatchStatsDisclaimer";
import WrestlerList from "./WrestlerList";
import { CurrentChampionsToggle } from "./CurrentChampionsToggle";
import { aggregateWrestlerPoints } from "@/lib/scoring/aggregateWrestlerPoints.js";
import { aggregateWrestlerMatchStats } from "@/lib/scoring/aggregateWrestlerMatchStats.js";
import {
  computeHybridPublicBeltHoldBySlug,
  getCurrentChampionsBySlug,
} from "@/lib/scoring/endOfMonthBeltPoints.js";
import {
  mergeCurrentChampionTitleStrings,
  mergeGetMatchStatsForWrestler,
  mergeGetMonthlyBeltForWrestler,
  mergeGetPointsForWrestler,
} from "@/lib/scoring/draftAliasListMerge";
import { normalizeWrestlerName } from "@/lib/scoring/parsers/participantParser.js";
import { getListPersonaFootnote, isHiddenCanonicalListSlug } from "@/lib/scoring/personaResolution.js";
import { brandByWrestlerSlugFromRows } from "@/lib/wrestlerBrandLookup";
import { getBeltImageUrlForTitle } from "@/lib/championshipBeltOverlay";
import { sortByChampionshipDisplayOrder } from "@/lib/championshipDisplayOrder";
import { collapseTagTeamChampionsForCard } from "@/lib/championshipCardTagChampions";
import { getChampionshipHistoryDataset } from "@/lib/championshipData";
import type { TitleHistoryItem } from "@/lib/championshipTitleHistory";
import { supabase } from "@/lib/supabase";
import { getPwbsChampionshipPage } from "@/lib/pwbsChampionshipSlug.js";
import {
  getTagTeamMemberSlugs,
  isTagTeamTitle,
  parseTagTeamChampionToMemberSlugs,
} from "@/lib/scoring/tagTeamMembers.js";

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
  const dedupeChampionRows = (rows: TitleHistoryItem[]): TitleHistoryItem[] => {
    const byKey = new Map<string, TitleHistoryItem>();
    for (const row of rows) {
      const key =
        normalizeWrestlerName(String(row.championSlug || "").trim()) ||
        normalizeWrestlerName(String(row.champion || "").trim());
      if (!key) continue;
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, row);
        continue;
      }
      // Prefer the row with an image/event metadata if duplicates exist for the same champion + date.
      const score = (r: TitleHistoryItem) =>
        (r.imageUrl ? 2 : 0) + (r.eventWon ? 1 : 0) + (r.eventLost ? 1 : 0) + (r.defeated ? 1 : 0);
      if (score(row) > score(existing)) byKey.set(key, row);
    }
    return [...byKey.values()];
  };

  const dataset = await getChampionshipHistoryDataset();

  const {
    events,
    reigns,
    titleHistoryBySlug,
    wrestlerBySlug,
    wrestlerByNameKey,
    tagTeamMembersBySlug,
    wrestlers: wrestlersFromDb,
  } = dataset;
  const eventsForAgg = events ?? [];
  const brandBySlug = brandByWrestlerSlugFromRows(
    (wrestlersFromDb ?? []).map((w) => ({ id: w.id, brand: w.brand ?? null }))
  );
  const pointsBySlug = aggregateWrestlerPoints(
    eventsForAgg as Parameters<typeof aggregateWrestlerPoints>[0],
    brandBySlug
  );
  const matchStatsBySlug = aggregateWrestlerMatchStats(
    eventsForAgg as Parameters<typeof aggregateWrestlerMatchStats>[0]
  );
  const endOfMonthBeltPoints = computeHybridPublicBeltHoldBySlug(reigns);
  const currentChampionsBySlug = getCurrentChampionsBySlug(reigns);

  const wrestlers = wrestlersFromDb;
  const wrestlersFiltered = wrestlers.filter((w) => !isHiddenCanonicalListSlug(w.id));
  const rows = wrestlersFiltered.map((w) => {
    const slugKey = w.id;
    const nameKey = w.name ? normalizeWrestlerName(w.name) : "";
    const idKey = normalizeWrestlerName(String(slugKey));
    const canonicalKey = nameKey || (slugKey ? normalizeWrestlerName(String(slugKey)) : "") || slugKey;
    const points = mergeGetPointsForWrestler(pointsBySlug, slugKey, nameKey);
    const matchStats = mergeGetMatchStatsForWrestler(matchStatsBySlug, slugKey, nameKey);
    const extraBelt = mergeGetMonthlyBeltForWrestler(endOfMonthBeltPoints, slugKey, nameKey);
    const beltPoints = points.beltPoints + extraBelt;
    const totalPoints = points.rsPoints + points.plePoints + beltPoints;
    const directChamp =
      currentChampionsBySlug[canonicalKey] ?? currentChampionsBySlug[idKey] ?? null;
    const aliasChamp = mergeCurrentChampionTitleStrings(currentChampionsBySlug, slugKey, nameKey);
    const titles: string[] = (() => {
      const seen = new Set<string>();
      const out: string[] = [];
      for (const list of [directChamp, aliasChamp]) {
        if (!list) continue;
        for (const t of list) {
          if (t && !seen.has(t)) {
            seen.add(t);
            out.push(t);
          }
        }
      }
      return out;
    })();
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
      personaDisplay: getListPersonaFootnote(w.id) ?? null,
      status: (raw.Status ?? raw.status) != null ? String(raw.Status ?? raw.status) : null,
      currentChampionship: titles.length > 0 ? titles.join(", ") : null,
      championBeltImageUrl: titles.length > 0 ? getBeltImageUrlForTitle(titles[0], w.gender) : null,
    };
  });

  function expandTagChampRows(rows: TitleHistoryItem[], title: string): TitleHistoryItem[] {
    if (!isTagTeamTitle(title) || rows.length !== 1) return rows;
    const row = rows[0];
    const key = normalizeWrestlerName(row.championSlug || row.champion || "");
    const members = tagTeamMembersBySlug.get(key);
    if (!members || members.length < 2) return rows;
    return members.map((memberSlug) => {
      const w = wrestlerBySlug.get(memberSlug) ?? wrestlerByNameKey.get(memberSlug);
      return {
        ...row,
        championSlug: memberSlug,
        champion: w?.name ?? row.champion,
        imageUrl: w?.image_url ?? row.imageUrl,
      };
    });
  }

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
      const rawChamps = expandTagChampRows(
        dedupeChampionRows(h.items.filter((x) => x.wonDate === latestWon)),
        h.title
      );
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
        hasHistory: true,
      };
    })
    .filter(Boolean) as {
    slug: string;
    title: string;
    champs: TitleHistoryItem[];
    tagTeamName: string | null;
    hasTeamNameRow: boolean;
    beltImageUrl: string | null;
    hasHistory: boolean;
  }[];

  // Include titles that are only present in the `championships` current snapshot table
  // (e.g. newly added titles before full championship_history backfill).
  const existingTitles = new Set(currentChampionCards.map((c) => c.title.trim().toLowerCase()));
  const existingSlugs = new Set(currentChampionCards.map((c) => c.slug.trim().toLowerCase()));
  const { data: championshipRows } = await supabase
    .from("championships")
    .select("id, title_name, current_champion, current_champion_slug");
  const supplementalCards: {
    slug: string;
    title: string;
    champs: TitleHistoryItem[];
    tagTeamName: string | null;
    hasTeamNameRow: boolean;
    beltImageUrl: string | null;
    hasHistory: boolean;
  }[] = [];
  for (const row of (championshipRows ?? []) as {
    id?: string | null;
    title_name?: string | null;
    current_champion?: string | null;
    current_champion_slug?: string | null;
  }[]) {
    const title =
      (row.title_name ?? "").trim() ||
      (row.id ?? "").trim().replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    if (!title) continue;
    if (existingTitles.has(title.toLowerCase())) continue;

    const rawChampion = (row.current_champion ?? "").trim();
    const rawChampionSlug = (row.current_champion_slug ?? "").trim();
    const normalizedSlug = rawChampionSlug ? normalizeWrestlerName(rawChampionSlug) : "";
    const champs: TitleHistoryItem[] = [];
    const isTag = isTagTeamTitle(title);

    if (isTag) {
      const memberSlugs =
        getTagTeamMemberSlugs(normalizedSlug) ??
        parseTagTeamChampionToMemberSlugs(rawChampion || rawChampionSlug || "");
      if (memberSlugs?.length) {
        for (const memberSlug of memberSlugs) {
          const w =
            wrestlerBySlug.get(memberSlug) ??
            wrestlerByNameKey.get(normalizeWrestlerName(memberSlug.replace(/-/g, " ")));
          const championName = (w?.name ?? memberSlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())).trim();
          champs.push({
            champion: championName,
            championSlug: memberSlug,
            wonDate: "",
            lostDate: null,
            imageUrl: w?.image_url ?? null,
            defeated: null,
            defeatedSlug: null,
            eventWon: null,
            eventLost: null,
            daysHeldDb: null,
          });
        }
      }
    }

    if (champs.length === 0) {
      const key = normalizedSlug || normalizeWrestlerName(rawChampion);
      if (!key) continue;
      const w = wrestlerBySlug.get(key) ?? wrestlerByNameKey.get(normalizeWrestlerName(rawChampion));
      const fallbackName = (rawChampion || key.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())).trim();
      champs.push({
        champion: (w?.name ?? fallbackName).trim(),
        championSlug: key,
        wonDate: "",
        lostDate: null,
        imageUrl: w?.image_url ?? null,
        defeated: null,
        defeatedSlug: null,
        eventWon: null,
        eventLost: null,
        daysHeldDb: null,
      });
    }

    const page = getPwbsChampionshipPage(title);
    const fallbackSlug = ((row.id ?? "").trim() || title.toLowerCase().replace(/\s+/g, "-")).trim();
    const cardSlug = (page?.slug ?? fallbackSlug).toLowerCase();
    if (existingSlugs.has(cardSlug)) continue;
    existingSlugs.add(cardSlug);
    supplementalCards.push({
      slug: cardSlug,
      title,
      champs,
      tagTeamName: isTag ? (rawChampion || null) : null,
      hasTeamNameRow: isTag,
      beltImageUrl: getBeltImageUrlForTitle(title),
      hasHistory: false,
    });
  }
  if (supplementalCards.length > 0) {
    currentChampionCards.push(...supplementalCards);
  }

  const isNxtChampionCard = (card: { slug: string; title: string }) => {
    if (/^nxt-/i.test(card.slug)) return true;
    const t = card.title.trim().toLowerCase();
    return t.startsWith("nxt ") || /\bnxt\b/i.test(card.title);
  };
  const NXT_CHAMP_ORDER: string[] = [
    "nxt-championship",
    "nxt-womens-championship",
    "nxt-north-american-championship",
    "nxt-womens-north-american-championship",
    "nxt-tag-team-championship",
    "nxt-mens-speed-championship",
    "nxt-womens-speed-championship",
  ];
  const nxtOrderIndex = new Map(NXT_CHAMP_ORDER.map((slug, i) => [slug, i]));
  const championCardsForToggle = [
    ...currentChampionCards.filter((c) => !isNxtChampionCard(c)),
    ...currentChampionCards
      .filter((c) => isNxtChampionCard(c))
      .sort((a, b) => {
        const ai = nxtOrderIndex.get(a.slug) ?? 999;
        const bi = nxtOrderIndex.get(b.slug) ?? 999;
        if (ai !== bi) return ai - bi;
        return a.title.localeCompare(b.title);
      }),
  ];

  const error = dataset.error;
  return (
    <>
      <section style={{ marginTop: 24, marginBottom: 28 }}>
        <h1 style={{ margin: "0 0 14px", fontSize: 40, letterSpacing: "-0.01em" }}>CURRENT CHAMPIONS</h1>
        <p
          style={{
            margin: "0 0 16px",
            maxWidth: 720,
            fontSize: 14,
            lineHeight: 1.5,
            color: "var(--color-text-muted)",
          }}
        >
          We are still in the process of building out the historical data. Title histories are not complete and may be
          missing data.
        </p>
        <CurrentChampionsToggle cards={championCardsForToggle} />
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
          <WrestlerMatchStatsDisclaimer />
          <WrestlerList wrestlers={rows} variant="boxscore" defaultSortColumn="name" defaultSortDir="asc" />
        </section>
      )}
    </>
  );
}
