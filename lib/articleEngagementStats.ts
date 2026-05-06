import "server-only";

export type ArticleEngagementStatsRow = {
  totalViews: number;
  uniqueVisitors: number;
  uniqueSignedInVisitors: number;
  avgDwellSeconds: number | null;
  /** Sessions that reported dwell (≥3s); average is over these only. */
  dwellSampleCount: number;
  viewsFirst24Hours: number;
  viewsFirstWeek: number;
};

export type RawEngagementEvent = {
  event_name: string;
  user_id: string | null;
  occurred_at: string;
  path: string | null;
  metadata: unknown;
};

export function articleSlugFromEngagementRow(row: Pick<RawEngagementEvent, "path" | "metadata">): string | null {
  const meta =
    row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : null;
  const s = meta?.article_slug;
  if (typeof s === "string" && s.trim()) return s.trim();
  const p = row.path?.trim() ?? "";
  const m = p.match(/^\/news\/([^/?#]+)/);
  return m?.[1] ? decodeURIComponent(m[1]) : null;
}

function visitorDedupeKey(row: RawEngagementEvent): string | null {
  if (row.user_id) return `u:${row.user_id}`;
  const meta =
    row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : null;
  const vk = meta?.visitor_key;
  if (typeof vk === "string" && vk.trim()) return `v:${vk.trim()}`;
  return null;
}

/**
 * Aggregate pre-filtered engagement rows for a single article slug.
 * `publishedAtIso` should be the article's first publish time (UTC) for windowed view counts.
 */
export function aggregateArticleEngagementForSlug(
  events: RawEngagementEvent[],
  slug: string,
  publishedAtIso: string | null
): ArticleEngagementStatsRow {
  const normalizedSlug = slug.trim();
  const views = events.filter((e) => {
    if (e.event_name !== "page.news_article_view") return false;
    return articleSlugFromEngagementRow(e) === normalizedSlug;
  });

  const dwellSamples = events.filter((e) => {
    if (e.event_name !== "page.news_article_dwell") return false;
    return articleSlugFromEngagementRow(e) === normalizedSlug;
  });

  const visitorKeys = new Set<string>();
  const signedInVisitors = new Set<string>();
  for (const v of views) {
    const key = visitorDedupeKey(v);
    if (key) visitorKeys.add(key);
    if (v.user_id) signedInVisitors.add(v.user_id);
  }

  const dwellNums: number[] = [];
  for (const d of dwellSamples) {
    const meta =
      d.metadata && typeof d.metadata === "object" && !Array.isArray(d.metadata)
        ? (d.metadata as Record<string, unknown>)
        : null;
    const sec = meta?.dwell_seconds;
    if (typeof sec === "number" && Number.isFinite(sec) && sec >= 0) dwellNums.push(sec);
  }
  const dwellSampleCount = dwellNums.length;
  const avgDwellSeconds =
    dwellSampleCount > 0 ? Math.round(dwellNums.reduce((a, b) => a + b, 0) / dwellSampleCount) : null;

  let viewsFirst24Hours = 0;
  let viewsFirstWeek = 0;
  const pubMs = publishedAtIso ? Date.parse(publishedAtIso) : NaN;
  if (Number.isFinite(pubMs)) {
    const end24 = pubMs + 24 * 60 * 60 * 1000;
    const end7 = pubMs + 7 * 24 * 60 * 60 * 1000;
    for (const v of views) {
      const t = Date.parse(v.occurred_at);
      if (!Number.isFinite(t)) continue;
      if (t >= pubMs && t < end24) viewsFirst24Hours += 1;
      if (t >= pubMs && t < end7) viewsFirstWeek += 1;
    }
  }

  return {
    totalViews: views.length,
    uniqueVisitors: visitorKeys.size,
    uniqueSignedInVisitors: signedInVisitors.size,
    avgDwellSeconds,
    dwellSampleCount,
    viewsFirst24Hours,
    viewsFirstWeek,
  };
}
