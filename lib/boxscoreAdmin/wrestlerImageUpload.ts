import type { SupabaseClient } from "@supabase/supabase-js";

/** Headshots: `{slug}.{ext}` — matches the site-wide fallback convention. */
const HEADSHOT_BUCKET = "wrestler-images";

/**
 * Full-body art: `{slug}-full.{ext}` in the dedicated bucket that
 * `getWrestlerFullImageUrl` (profile page, roster cards) reads from.
 */
const FULL_BODY_BUCKET = "wrestler-images-full";

function fileExt(file: File): string {
  return file.name.split(".").pop()?.toLowerCase() ?? "";
}

export async function uploadWrestlerHeadshotAdmin(
  admin: SupabaseClient,
  file: File,
  wrestlerSlug: string
): Promise<string> {
  const ext = fileExt(file);
  if (ext !== "png" && ext !== "webp") {
    throw new Error("Headshot must be a .png or .webp file.");
  }
  const path = `${wrestlerSlug}.${ext}`;
  const body = Buffer.from(await file.arrayBuffer());
  const { error } = await admin.storage.from(HEADSHOT_BUCKET).upload(path, body, {
    contentType: file.type || `image/${ext}`,
    upsert: true,
    cacheControl: "3600",
  });
  if (error) throw error;
  const { data } = admin.storage.from(HEADSHOT_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadWrestlerFullBodyAdmin(
  admin: SupabaseClient,
  file: File,
  wrestlerSlug: string
): Promise<string> {
  const ext = fileExt(file);
  if (ext !== "png" && ext !== "webp") {
    throw new Error("Full-body image must be a .png or .webp file.");
  }
  const path = `${wrestlerSlug}-full.${ext}`;
  const body = Buffer.from(await file.arrayBuffer());
  const { error } = await admin.storage.from(FULL_BODY_BUCKET).upload(path, body, {
    contentType: file.type || `image/${ext}`,
    upsert: true,
    cacheControl: "3600",
  });
  if (error) throw error;
  const { data } = admin.storage.from(FULL_BODY_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
