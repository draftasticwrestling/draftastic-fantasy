/** Supabase Storage bucket for news article body images (public read). */
export const ARTICLE_IMAGES_BUCKET = "article-images";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export function isAllowedArticleImageMime(mime: string): boolean {
  return ALLOWED_MIME.has(mime.toLowerCase());
}

export function extensionForImageMime(mime: string): "jpg" | "png" | "webp" | "gif" {
  const m = mime.toLowerCase();
  if (m === "image/png") return "png";
  if (m === "image/webp") return "webp";
  if (m === "image/gif") return "gif";
  return "jpg";
}
