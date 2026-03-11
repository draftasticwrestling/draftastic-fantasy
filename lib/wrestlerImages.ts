/**
 * URLs for wrestler images stored in Supabase.
 * Full-body images follow the filename pattern: [wrestler-slug]-full.png
 *
 * Option A: Set NEXT_PUBLIC_WRESTLER_FULL_IMAGE_BASE to the full base URL
 * (including bucket), e.g. https://xxx.supabase.co/storage/v1/object/public/wrestler-images
 * We append /${slug}-full.png
 *
 * Option B: Set NEXT_PUBLIC_SUPABASE_WRESTLER_FULL_BUCKET to your bucket name
 * (default "wrestler-images-full") if it differs.
 */

const SUPABASE_STORAGE_PUBLIC =
  "https://qvbqxietcmweltxoonvh.supabase.co/storage/v1/object/public";

const WRESTLERS_FULL_BUCKET =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_SUPABASE_WRESTLER_FULL_BUCKET
    ? process.env.NEXT_PUBLIC_SUPABASE_WRESTLER_FULL_BUCKET.trim()
    : "wrestler-images-full";

function getBaseUrl(): string {
  const base = typeof process !== "undefined" && process.env.NEXT_PUBLIC_WRESTLER_FULL_IMAGE_BASE
    ? process.env.NEXT_PUBLIC_WRESTLER_FULL_IMAGE_BASE.trim()
    : "";
  if (base) return base.replace(/\/$/, "");
  return `${SUPABASE_STORAGE_PUBLIC}/${WRESTLERS_FULL_BUCKET}`;
}

/**
 * Returns the Supabase public URL for a wrestler's full-body image.
 * Filename convention: [slug]-full.png
 */
export function getWrestlerFullImageUrl(slugOrId: string): string {
  const slug = String(slugOrId ?? "").trim();
  if (!slug) return "";
  return `${getBaseUrl()}/${slug}-full.png`;
}
