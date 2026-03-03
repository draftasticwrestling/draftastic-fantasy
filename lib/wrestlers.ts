import { supabase } from "@/lib/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

function slugLike(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/**
 * Resolve a URL slug to a wrestlers.id. Tries exact match, then normalized match by id or name.
 * Uses the provided client (e.g. singleton) so it can be used from API routes and server components.
 */
export async function findWrestlerIdBySlug(
  slug: string,
  client: SupabaseClient = supabase
): Promise<string | null> {
  const raw = slug?.trim() ?? "";
  const decoded = decodeURIComponent(raw);
  const slugNorm = slugLike(decoded);
  if (!slugNorm) return null;

  const { data: row } = await client
    .from("wrestlers")
    .select("id")
    .eq("id", decoded)
    .maybeSingle();
  if (row?.id) return row.id as string;

  const { data: row2 } = await client
    .from("wrestlers")
    .select("id")
    .eq("id", slugNorm)
    .maybeSingle();
  if (row2?.id) return row2.id as string;

  const { data: rows } = await client.from("wrestlers").select("id, name");
  const list = rows ?? [];
  for (const r of list) {
    const idStr = String(r.id ?? "").trim();
    const nameStr = String(r.name ?? "").trim();
    if (idStr.toLowerCase() === slugNorm || slugLike(idStr) === slugNorm) return idStr || (r.id as string);
    if (nameStr && slugLike(nameStr) === slugNorm) return idStr || (r.id as string);
  }
  return null;
}

/**
 * Fetch full wrestler row by URL slug. Returns null if not found.
 * Uses singleton so it works from API routes and server components.
 */
export async function getWrestlerBySlug(slug: string) {
  const id = await findWrestlerIdBySlug(slug);
  if (!id) return null;
  const { data, error } = await supabase
    .from("wrestlers")
    .select('id, name, gender, brand, image_url, dob, "Status", "2K26 rating", "2K25 rating"')
    .eq("id", id)
    .single();
  if (error || !data) return null;
  return data;
}
