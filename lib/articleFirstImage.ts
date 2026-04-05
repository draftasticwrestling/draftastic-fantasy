/**
 * First image URL from article Markdown (![](url)) or raw HTML <img src>.
 */
export function firstArticleImageUrl(body: string | null | undefined): string | null {
  if (!body?.trim()) return null;
  const md = body.match(/!\[[^\]]*\]\(\s*<?([^)]+)>?\s*\)/);
  if (md?.[1]) {
    const u = normalizeImgUrl(md[1].trim());
    if (u) return u;
  }
  const html = body.match(/<img[^>]+\bsrc=["']([^"']+)["']/i);
  if (html?.[1]) return normalizeImgUrl(html[1]);
  return null;
}

function normalizeImgUrl(raw: string): string | null {
  const t = raw.trim().replace(/^<|>$/g, "");
  if (!t || t.startsWith("data:")) return null;
  return t;
}
