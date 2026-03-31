import { supabase } from "@/lib/supabase";

const BUCKET = "wrestler-images";

function normalizeWrestlerImagesObjectPath(raw: string): string {
  return String(raw)
    .trim()
    .replace(/^\/+/, "")
    .replace(/\/+/g, "/");
}

function collapseWrestlerImagesDoubleSlash(url: string): string {
  return url.replace(/\/wrestler-images\/\/+/g, "/wrestler-images/");
}

export function rewriteWrestlerStorageUrl(url: string): string {
  const trimmed = url.trim();
  const m = trimmed.match(/\/storage\/v1\/object\/public\/wrestler-images\/([^?#]+)/);
  if (!m) return collapseWrestlerImagesDoubleSlash(trimmed);
  const path = normalizeWrestlerImagesObjectPath(decodeURIComponent(m[1]));
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return collapseWrestlerImagesDoubleSlash(data.publicUrl);
}

export function getPublicWrestlerImageUrl(wrestlerId: string, ext: string): string {
  const id = String(wrestlerId || "").replace(/^\/+/, "");
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(`${id}.${ext}`);
  return collapseWrestlerImagesDoubleSlash(data.publicUrl);
}

export type WrestlerRow = Record<string, unknown> & {
  id?: string;
  image_url?: string | null;
  full_body_image_url?: string | null;
};

export function normalizeWrestlerImageFields(w: WrestlerRow): WrestlerRow {
  if (!w) return w;
  const next: WrestlerRow = { ...w };
  if (next.image_url && String(next.image_url).trim()) {
    next.image_url = rewriteWrestlerStorageUrl(String(next.image_url));
  } else if (next.id) {
    next.image_url = getPublicWrestlerImageUrl(String(next.id), "png");
  }
  if (next.full_body_image_url && String(next.full_body_image_url).trim()) {
    next.full_body_image_url = rewriteWrestlerStorageUrl(String(next.full_body_image_url));
  }
  if (next.image_url) next.image_url = collapseWrestlerImagesDoubleSlash(String(next.image_url));
  if (next.full_body_image_url) {
    next.full_body_image_url = collapseWrestlerImagesDoubleSlash(String(next.full_body_image_url));
  }
  return next;
}

export function buildWrestlerMap(rows: WrestlerRow[]): Record<string, WrestlerRow> {
  const map: Record<string, WrestlerRow> = {};
  for (const row of rows) {
    const id = row.id != null ? String(row.id).trim() : "";
    if (id) map[id] = normalizeWrestlerImageFields(row);
  }
  return map;
}
