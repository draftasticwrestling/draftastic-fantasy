/**
 * First image URL from article Markdown (![](url)) or raw HTML <img src>.
 */
export function firstArticleImageUrl(body: string | null | undefined): string | null {
  const urls = listArticleImageUrls(body);
  return urls[0] ?? null;
}

/** All image URLs from Markdown and HTML <img>, in document order (deduped). */
export function listArticleImageUrls(body: string | null | undefined): string[] {
  if (!body?.trim()) return [];
  type Hit = { index: number; url: string };
  const hits: Hit[] = [];
  const mdRe = /!\[[^\]]*\]\(\s*<?([^)]+)>?\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = mdRe.exec(body)) !== null) {
    const u = normalizeImgUrl(m[1].trim());
    if (u) hits.push({ index: m.index, url: u });
  }
  const htmlRe = /<img[^>]+\bsrc=["']([^"']+)["']/gi;
  while ((m = htmlRe.exec(body)) !== null) {
    const u = normalizeImgUrl(m[1]);
    if (u) hits.push({ index: m.index, url: u });
  }
  hits.sort((a, b) => a.index - b.index);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const h of hits) {
    if (!seen.has(h.url)) {
      seen.add(h.url);
      out.push(h.url);
    }
  }
  return out;
}

/**
 * Thumbnail for News list + hub cards: explicit `thumbnail_image_url` when it appears in body,
 * otherwise first image in body (same order as listArticleImageUrls).
 */
export function articleFeedThumbnailUrl(article: {
  body: string;
  thumbnail_image_url?: string | null;
}): string | null {
  const urls = listArticleImageUrls(article.body);
  const pref = article.thumbnail_image_url?.trim();
  if (pref && urls.includes(pref)) return pref;
  return urls[0] ?? null;
}

function normalizeImgUrl(raw: string): string | null {
  const t = raw.trim().replace(/^<|>$/g, "");
  if (!t || t.startsWith("data:")) return null;
  return t;
}
