import type { MetadataRoute } from "next";
import { listPublishedArticles } from "@/lib/articles";
import { getChampionshipHistoryDataset } from "@/lib/championshipData";
import { buildEventResultsSlug } from "@/lib/event-results/eventResultsRoute";
import { absoluteUrl } from "@/lib/sitePublicOrigin";
import { supabase } from "@/lib/supabase";

export const revalidate = 3600;

const STATIC_PATHS: Array<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}> = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/about-us", changeFrequency: "monthly", priority: 0.7 },
  { path: "/how-it-works", changeFrequency: "weekly", priority: 0.85 },
  { path: "/points", changeFrequency: "monthly", priority: 0.75 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
  { path: "/contact-us", changeFrequency: "yearly", priority: 0.4 },
  { path: "/wrestlers", changeFrequency: "daily", priority: 0.85 },
  { path: "/wrestlers/watch", changeFrequency: "weekly", priority: 0.5 },
  { path: "/wrestlers/waiver", changeFrequency: "weekly", priority: 0.5 },
  { path: "/wrestlers/added-dropped", changeFrequency: "weekly", priority: 0.5 },
  { path: "/championship", changeFrequency: "weekly", priority: 0.75 },
  { path: "/news", changeFrequency: "daily", priority: 0.8 },
  { path: "/event-results", changeFrequency: "daily", priority: 0.85 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = STATIC_PATHS.map(({ path, changeFrequency, priority }) => ({
    url: absoluteUrl(path),
    lastModified: now,
    changeFrequency,
    priority,
  }));

  try {
    const [{ data: wrestlerRows }, articles, champs, { data: eventRows }] = await Promise.all([
      supabase.from("wrestlers").select("id").order("name", { ascending: true }).limit(8000),
      listPublishedArticles(500),
      getChampionshipHistoryDataset(),
      supabase
        .from("events")
        .select("id, name, date")
        .eq("status", "completed")
        .not("date", "is", null)
        .order("date", { ascending: false })
        .limit(1500),
    ]);

    for (const w of wrestlerRows ?? []) {
      const id = (w as { id?: string }).id;
      if (!id) continue;
      const updated = (w as { updated_at?: string | null }).updated_at;
      entries.push({
        url: absoluteUrl(`/wrestlers/${encodeURIComponent(id)}`),
        lastModified: updated ? new Date(updated) : now,
        changeFrequency: "weekly",
        priority: 0.65,
      });
    }

    for (const a of articles) {
      entries.push({
        url: absoluteUrl(`/news/${encodeURIComponent(a.slug)}`),
        lastModified: a.updated_at ? new Date(a.updated_at) : a.published_at ? new Date(a.published_at) : now,
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }

    for (const slug of champs.titleHistoryBySlug.keys()) {
      entries.push({
        url: absoluteUrl(`/championship/${encodeURIComponent(slug)}`),
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }

    for (const ev of eventRows ?? []) {
      const slug = buildEventResultsSlug(ev as { name?: string | null; date?: string | null; id?: string | null });
      entries.push({
        url: absoluteUrl(`/event-results/${encodeURIComponent(slug)}`),
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.65,
      });
    }
  } catch {
    /* static entries only if DB unavailable */
  }

  const byUrl = new Map<string, MetadataRoute.Sitemap[number]>();
  for (const e of entries) {
    byUrl.set(e.url, e);
  }
  return [...byUrl.values()];
}
