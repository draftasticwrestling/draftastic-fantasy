/**
 * Curated manager avatars in Storage bucket `manager-avatars`.
 * Use slug filenames (e.g. `stone-cold.png`) either at bucket root or under `presets/`.
 * Upload via Dashboard or service role.
 */

const BUCKET = "manager-avatars";

/** Slug-style image filename (not user-id folders). */
const PRESET_FILENAME =
  /^[a-zA-Z0-9][a-zA-Z0-9._-]*\.(png|jpg|jpeg|webp|gif)$/i;

/** Reject UUID-shaped names at bucket root so user folders aren’t mistaken for presets. */
const UUID_LIKE_FILENAME =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\./i;

function isSlugPresetFilename(name: string): boolean {
  if (!PRESET_FILENAME.test(name)) return false;
  if (UUID_LIKE_FILENAME.test(name)) return false;
  return true;
}

function pathPartsAfterBucket(url: string): string[] {
  const seg = `/${BUCKET}/`;
  try {
    const u = new URL(url);
    const idx = u.pathname.indexOf(seg);
    if (idx < 0) return [];
    return u.pathname.slice(idx + seg.length).split("/").filter(Boolean);
  } catch {
    return [];
  }
}

export function managerAvatarPresetPublicUrl(objectPath: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";
  const encoded = objectPath.split("/").map(encodeURIComponent).join("/");
  return `${base}/storage/v1/object/public/${BUCKET}/${encoded}`;
}

/**
 * Valid object keys: `presets/my-slug.png` or root `my-slug.png` (single segment only).
 */
export function isPresetObjectPath(objectPath: string): boolean {
  const parts = objectPath.split("/").filter(Boolean);
  if (parts.length === 2 && parts[0] === "presets") return isSlugPresetFilename(parts[1]);
  if (parts.length === 1) return isSlugPresetFilename(parts[0]);
  return false;
}

/**
 * Accepts public URLs for slug-named preset images (root or under presets/).
 * (Legacy user-upload paths are handled separately in managerAvatarBucket.)
 */
export function isAllowedManagerPresetUrl(url: string, supabaseOrigin: string): boolean {
  const t = url.trim();
  if (!t) return false;
  try {
    const u = new URL(t);
    const base = new URL(supabaseOrigin.replace(/\/$/, ""));
    if (u.origin !== base.origin) return false;
  } catch {
    return false;
  }
  const parts = pathPartsAfterBucket(t);
  if (parts.length === 2 && parts[0] === "presets") return isSlugPresetFilename(parts[1]);
  if (parts.length === 1) return isSlugPresetFilename(parts[0]);
  return false;
}

/** Human label from filename: `stone-cold.png` → "Stone Cold" */
export function presetFilenameToLabel(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "");
  return base
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}
