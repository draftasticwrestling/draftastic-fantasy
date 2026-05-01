/**
 * Curated manager avatars in Storage bucket `manager-avatars`.
 * Objects are square assets named `name-sq.ext` at bucket root or under `presets/`.
 * The picker only lists those files. resolveManagerPresetDisplayUrl still rewrites stored URLs that
 * omit `-sq` (older profile/league rows) so they hit the remaining object after non-sq files were removed.
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

function presetBasenameEndsWithSq(filename: string): boolean {
  const dot = filename.lastIndexOf(".");
  const base = dot > 0 ? filename.slice(0, dot) : filename;
  return base.toLowerCase().endsWith("-sq");
}

/**
 * Curated assets shown in the picker: slug presets whose basename ends with `-sq` before the extension.
 * Hides legacy non-square files when both `name.png` and `name-sq.png` exist in the bucket.
 */
export function isSqPresetObjectPath(objectPath: string): boolean {
  if (!isPresetObjectPath(objectPath)) return false;
  const parts = objectPath.split("/").filter(Boolean);
  const filename = parts.length === 2 ? parts[1] : parts[0];
  return filename ? presetBasenameEndsWithSq(filename) : false;
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

/**
 * Public URL to load for a stored preset URL: if the path is root or `presets/` slug image
 * without a `-sq` suffix before the extension, rewrite to the `name-sq.ext` object (curated square assets).
 */
export function resolveManagerPresetDisplayUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  const parts = pathPartsAfterBucket(trimmed);
  let objectPath: string | null = null;
  if (parts.length === 1 && isSlugPresetFilename(parts[0])) {
    const fn = parts[0];
    const dot = fn.lastIndexOf(".");
    if (dot > 0) {
      const base = fn.slice(0, dot);
      const ext = fn.slice(dot);
      if (!base.toLowerCase().endsWith("-sq")) {
        const next = `${base}-sq${ext}`;
        if (isSlugPresetFilename(next)) objectPath = next;
      }
    }
  } else if (parts.length === 2 && parts[0] === "presets" && isSlugPresetFilename(parts[1])) {
    const fn = parts[1];
    const dot = fn.lastIndexOf(".");
    if (dot > 0) {
      const base = fn.slice(0, dot);
      const ext = fn.slice(dot);
      if (!base.toLowerCase().endsWith("-sq")) {
        const next = `${base}-sq${ext}`;
        if (isSlugPresetFilename(next)) objectPath = `presets/${next}`;
      }
    }
  }
  return objectPath ? managerAvatarPresetPublicUrl(objectPath) : trimmed;
}

/** Human label from filename: `stone-cold.png` → "Stone Cold"; strips trailing `-sq` from basename. */
export function presetFilenameToLabel(filename: string): string {
  let base = filename.replace(/\.[^.]+$/, "");
  if (base.toLowerCase().endsWith("-sq")) base = base.slice(0, -3);
  return base
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}
