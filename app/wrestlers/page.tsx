import { supabase } from "@/lib/supabase";
import Link from "next/link";
import WrestlerList from "./WrestlerList";
import { aggregateWrestlerPoints, getPointsForWrestler } from "@/lib/scoring/aggregateWrestlerPoints.js";
import { aggregateWrestlerMatchStats, getMatchStatsForWrestler } from "@/lib/scoring/aggregateWrestlerMatchStats.js";
import {
  computeEndOfMonthBeltPoints,
  FIRST_END_OF_MONTH_POINTS_DATE,
  getCurrentChampionsBySlug,
  getMonthlyBeltForWrestler,
  inferReignsFromEvents,
  mergeReigns,
} from "@/lib/scoring/endOfMonthBeltPoints.js";
import { normalizeWrestlerName } from "@/lib/scoring/parsers/participantParser.js";
import { isPersonaOnlySlug, getPersonasForDisplay } from "@/lib/scoring/personaResolution.js";
import { getBeltImageUrlForTitle } from "@/lib/championshipBeltOverlay";
import { sortByChampionshipDisplayOrder } from "@/lib/championshipDisplayOrder";

const LEAGUE_START_DATE = "2025-05-02";

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
    "WWE roster from Pro Wrestling Boxscore: brands, belts, match stats, and fantasy points. Draft pool and league free agents.",
};

/** Championship history table (Pro Wrestling Boxscore). One row per title reign. */
type ChampionshipReign = {
  champion_slug?: string | null;
  champion_id?: string | null;
  champion?: string | null;
  champion_name?: string | null;
  title?: string | null;
  title_name?: string | null;
  won_date?: string | null;
  start_date?: string | null;
  lost_date?: string | null;
  end_date?: string | null;
};

type TitleHistoryItem = {
  champion: string;
  championSlug: string;
  wonDate: string;
  lostDate: string | null;
  imageUrl: string | null;
};

function displayDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const s = String(iso).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const [y, m, d] = s.split("-");
  const dt = new Date(Number(y), Number(m) - 1, Number(d));
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function WrestlersPage() {
  const [wrestlersResult, { data: events }, { data: rawReigns }] = await Promise.all([
    (async () => {
      // Column is "Status" (capital S) in DB; avoid .or("status...") and select "Status" only
      const r = await supabase
        .from("wrestlers")
        .select('id, name, gender, brand, image_url, dob, "Status", "2K26 rating", "2K25 rating"')
        .order("name", { ascending: true });
      return r;
    })(),
    supabase
      .from("events")
      .select("id, name, date, matches")
      .eq("status", "completed")
      .gte("date", LEAGUE_START_DATE)
      .order("date", { ascending: true }),
    supabase
      .from("championship_history")
      .select("champion_slug, champion_id, champion, champion_name, title, title_name, won_date, start_date, lost_date, end_date")
      .order("won_date", { ascending: true }),
  ]);
  const tableReigns = (rawReigns ?? []) as ChampionshipReign[];
  const inferredReigns = inferReignsFromEvents(events ?? []);
  const reigns = mergeReigns(tableReigns, inferredReigns) as ChampionshipReign[];

  const pointsBySlug = aggregateWrestlerPoints(events ?? []);
  const matchStatsBySlug = aggregateWrestlerMatchStats(events ?? []);
  const endOfMonthBeltPoints = computeEndOfMonthBeltPoints(reigns, FIRST_END_OF_MONTH_POINTS_DATE);
  const currentChampionsBySlug = getCurrentChampionsBySlug(reigns);

  const wrestlers = wrestlersResult.data ?? [];
  const wrestlerBySlug = new Map<
    string,
    { id: string; name: string | null; image_url: string | null; gender: string | null }
  >();
  const wrestlerByNameKey = new Map<
    string,
    { id: string; name: string | null; image_url: string | null; gender: string | null }
  >();
  for (const w of wrestlers) {
    const item = {
      id: w.id,
      name: w.name ?? null,
      image_url: (w as { image_url?: string }).image_url ?? null,
      gender: w.gender ?? null,
    };
    wrestlerBySlug.set(w.id, item);
    if (w.name) wrestlerByNameKey.set(normalizeWrestlerName(w.name), item);
  }
  const wrestlersFiltered = (wrestlers ?? []).filter((w) => !isPersonaOnlySlug(w.id));
  const rows = wrestlersFiltered.map((w) => {
    const slugKey = w.id;
    const nameKey = w.name ? normalizeWrestlerName(w.name) : "";
    const canonicalKey = nameKey || (slugKey ? normalizeWrestlerName(String(slugKey)) : "") || slugKey;
    // Use slugKey (stable id/slug) first so points match when display name changed (e.g. Natalya → Nattie, slug still natalya)
    const points = getPointsForWrestler(pointsBySlug, slugKey, nameKey);
    const matchStats = getMatchStatsForWrestler(matchStatsBySlug, slugKey, nameKey);
    const extraBelt = getMonthlyBeltForWrestler(endOfMonthBeltPoints, slugKey, nameKey);
    const beltPoints = points.beltPoints + extraBelt;
    const totalPoints = points.rsPoints + points.plePoints + beltPoints;
    const titles =
      currentChampionsBySlug[canonicalKey] ?? currentChampionsBySlug[slugKey] ?? (nameKey ? currentChampionsBySlug[nameKey] : null) ?? [];
    const raw = w as Record<string, unknown>;
    return {
      id: w.id,
      name: w.name ?? null,
      gender: w.gender ?? null,
      brand: w.brand ?? null,
      image_url: (w as { image_url?: string }).image_url ?? null,
      dob: (w as { dob?: string }).dob ?? null,
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

  const titleHistoryByTitle = new Map<string, TitleHistoryItem[]>();
  for (const r of reigns) {
    const title = (r.title ?? r.title_name ?? "").trim();
    if (!title) continue;
    const wonDate = (r.won_date ?? r.start_date ?? "").slice(0, 10);
    if (!wonDate) continue;
    const lostDate = (r.lost_date ?? r.end_date ?? null)?.slice(0, 10) ?? null;
    const rawSlug = (r.champion_slug ?? r.champion_id ?? "").trim();
    const championSlug = normalizeWrestlerName(rawSlug || (r.champion ?? r.champion_name ?? ""));
    const fromSlug = championSlug ? wrestlerBySlug.get(championSlug) : null;
    const fromName = !fromSlug && r.champion ? wrestlerByNameKey.get(normalizeWrestlerName(r.champion)) : null;
    const championName =
      (fromSlug?.name ?? fromName?.name ?? r.champion ?? r.champion_name ?? championSlug).toString();
    const imageUrl = fromSlug?.image_url ?? fromName?.image_url ?? null;
    const list = titleHistoryByTitle.get(title) ?? [];
    list.push({
      champion: championName,
      championSlug,
      wonDate,
      lostDate,
      imageUrl,
    });
    titleHistoryByTitle.set(title, list);
  }

  const historyCards = sortByChampionshipDisplayOrder(
    [...titleHistoryByTitle.entries()].map(([title, items]) => ({
      title,
      items: items.sort((a, b) => b.wonDate.localeCompare(a.wonDate)),
    }))
  );

  const currentChampionCards = historyCards
    .map((h) => {
      const latest = h.items[0];
      if (!latest) return null;
      const latestWon = latest.wonDate;
      const champs = h.items.filter((x) => x.wonDate === latestWon);
      return { title: h.title, champs, beltImageUrl: getBeltImageUrlForTitle(h.title) };
    })
    .filter(Boolean) as { title: string; champs: TitleHistoryItem[]; beltImageUrl: string | null }[];

  const error = wrestlersResult.error;
  return (
    <>
      <section style={{ marginTop: 24, marginBottom: 28 }}>
        <h1 style={{ margin: "0 0 14px 0", fontSize: 40, letterSpacing: "-0.01em" }}>CURRENT CHAMPIONS</h1>
        <div className="wrestlers-page-champs-grid">
          {currentChampionCards.map((card) => {
            const titleAnchor = `title-${encodeURIComponent(card.title.toLowerCase().replace(/\s+/g, "-"))}`;
            return (
              <article
                key={card.title}
                style={{
                  background: "#111317",
                  color: "#f5f5f5",
                  border: "1px solid #2d3138",
                  borderRadius: 4,
                  padding: 14,
                  textAlign: "center",
                }}
              >
                <h3 style={{ margin: "0 0 10px 0", fontSize: 18, color: "#d0ac56" }}>{card.title}</h3>
                {card.beltImageUrl && (
                  <img
                    src={card.beltImageUrl}
                    alt={card.title}
                    style={{ width: "100%", maxWidth: 200, height: 58, objectFit: "contain", marginBottom: 10 }}
                  />
                )}
                <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 10 }}>
                  {card.champs.map((c) => (
                    <div key={`${card.title}-${c.championSlug || c.champion}`}>
                      {c.imageUrl ? (
                        <img
                          src={c.imageUrl}
                          alt={c.champion}
                          style={{ width: 52, height: 52, objectFit: "cover", borderRadius: "50%", border: "2px solid #d0ac56" }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 52,
                            height: 52,
                            borderRadius: "50%",
                            border: "2px solid #d0ac56",
                            display: "grid",
                            placeItems: "center",
                            fontSize: 18,
                          }}
                        >
                          ?
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 21, fontWeight: 700, marginBottom: 10 }}>
                  {card.champs.map((c) => c.champion).join(" & ")}
                </div>
                <Link href={`#${titleAnchor}`} style={{ color: "#d0ac56", fontSize: 12, textDecoration: "none" }}>
                  Title History
                </Link>
              </article>
            );
          })}
        </div>
      </section>

      <section style={{ marginTop: 16, marginBottom: 32 }}>
        <h2 style={{ margin: "0 0 14px 0", fontSize: 40, letterSpacing: "-0.01em" }}>TITLE HISTORY</h2>
        <div className="wrestlers-page-champs-grid">
          {historyCards.map((card) => {
            const beltImageUrl = getBeltImageUrlForTitle(card.title);
            const titleAnchor = `title-${encodeURIComponent(card.title.toLowerCase().replace(/\s+/g, "-"))}`;
            return (
              <article
                key={card.title}
                id={titleAnchor}
                style={{ background: "#111317", color: "#f5f5f5", border: "1px solid #2d3138", borderRadius: 4, padding: 12 }}
              >
                <h3 style={{ margin: "0 0 8px 0", fontSize: 17, color: "#d0ac56" }}>{card.title}</h3>
                {beltImageUrl && (
                  <img
                    src={beltImageUrl}
                    alt={card.title}
                    style={{ width: "100%", maxWidth: 210, height: 52, objectFit: "contain", marginBottom: 8 }}
                  />
                )}
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.4 }}>
                  {card.items.slice(0, 8).map((h) => (
                    <li key={`${card.title}-${h.championSlug}-${h.wonDate}`}>
                      {h.champion} ({displayDate(h.wonDate)}{h.lostDate ? ` - ${displayDate(h.lostDate)}` : " - Present"})
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ margin: "0 0 12px 0", fontSize: 40, letterSpacing: "-0.01em" }}>WRESTLERS</h2>
      </section>

      {error && (
        <p style={{ color: "red" }}>
          Error loading wrestlers: {error.message}. Check .env (NEXT_PUBLIC_SUPABASE_*).
        </p>
      )}

      {rows.length === 0 && !error && (
        <p>No wrestlers in the database yet.</p>
      )}

      {rows.length > 0 && <WrestlerList wrestlers={rows} />}
    </>
  );
}
