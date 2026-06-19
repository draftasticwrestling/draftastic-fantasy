import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  AVATAR_DEFAULT_TIER,
  characterAssetPublicUrl,
  STARTER_AVATAR_PACK_SLUG,
} from "@/lib/avatarStarterPackManifest";
import { managerAvatarPresetPublicUrl } from "@/lib/managerAvatarPresets";

export { STARTER_AVATAR_PACK_SLUG, AVATAR_DEFAULT_TIER };

export type AvatarPackRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_default: boolean;
  unlock_type: string;
};

export type AvatarCharacterRow = {
  id: string;
  pack_id: string;
  slug: string;
  label: string;
  sort_order: number;
  active: boolean;
  default_tier: number;
};

export type AvatarAssetRow = {
  id: string;
  avatar_id: string;
  tier: number;
  asset_type: "square" | "full";
  storage_path: string;
  active: boolean;
};

/** Character + baseline square URL for the avatar picker. */
export type AvailableAvatar = AvatarCharacterRow & {
  pack_slug: string;
  pack_name: string;
  display_url: string;
  display_tier: number;
  display_asset_type: "square";
};

export function avatarStoragePublicUrl(storagePath: string): string {
  return managerAvatarPresetPublicUrl(storagePath.trim());
}

async function unlockedPackIdsForUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<string[]> {
  const { data: unlockRows, error: unlockErr } = await supabase
    .from("user_avatar_pack_unlocks")
    .select("pack_id")
    .eq("user_id", userId);

  if (unlockErr || !unlockRows?.length) return [];
  return [...new Set(unlockRows.map((r) => (r as { pack_id: string }).pack_id))];
}

/** Characters in unlocked packs with baseline square display URL (tier 3 by default). */
export async function getAvailableAvatarsForUser(userId: string): Promise<AvailableAvatar[]> {
  const supabase = await createClient();
  const packIds = await unlockedPackIdsForUser(supabase, userId);
  if (packIds.length === 0) return [];

  const { data: packs, error: packsErr } = await supabase
    .from("avatar_packs")
    .select("id, slug, name")
    .in("id", packIds);

  if (packsErr || !packs?.length) return [];

  const packById = new Map(
    packs.map((p) => [
      (p as { id: string }).id,
      p as { id: string; slug: string; name: string },
    ])
  );

  const { data: characters, error: charactersErr } = await supabase
    .from("avatars")
    .select("id, pack_id, slug, label, sort_order, active, default_tier")
    .in("pack_id", packIds)
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });

  if (charactersErr || !characters?.length) return [];

  const characterIds = (characters as AvatarCharacterRow[]).map((c) => c.id);
  const { data: assets, error: assetsErr } = await supabase
    .from("avatar_assets")
    .select("id, avatar_id, tier, asset_type, storage_path, active")
    .in("avatar_id", characterIds)
    .eq("asset_type", "square")
    .eq("active", true);

  if (assetsErr) return [];

  const assetByCharacterTier = new Map<string, AvatarAssetRow>();
  for (const row of assets ?? []) {
    const asset = row as AvatarAssetRow;
    assetByCharacterTier.set(`${asset.avatar_id}:${asset.tier}`, asset);
  }

  const results: AvailableAvatar[] = [];
  for (const row of characters as AvatarCharacterRow[]) {
    const pack = packById.get(row.pack_id);
    if (!pack) continue;
    const tier = row.default_tier ?? AVATAR_DEFAULT_TIER;
    const asset = assetByCharacterTier.get(`${row.id}:${tier}`);
    if (!asset) continue;
    results.push({
      ...row,
      pack_slug: pack.slug,
      pack_name: pack.name,
      display_url: avatarStoragePublicUrl(asset.storage_path),
      display_tier: tier,
      display_asset_type: "square",
    });
  }

  return results;
}

export async function getAvatarCharacterById(avatarId: string): Promise<AvatarCharacterRow | null> {
  const admin = getAdminClient();
  if (!admin) return null;
  const { data, error } = await admin
    .from("avatars")
    .select("id, pack_id, slug, label, sort_order, active, default_tier")
    .eq("id", avatarId)
    .eq("active", true)
    .maybeSingle();
  if (error || !data) return null;
  return data as AvatarCharacterRow;
}

export async function getAvatarDisplayAsset(
  avatarId: string,
  opts?: { tier?: number; assetType?: "square" | "full" }
): Promise<AvatarAssetRow | null> {
  const admin = getAdminClient();
  if (!admin) return null;

  const character = await getAvatarCharacterById(avatarId);
  if (!character) return null;

  const tier = opts?.tier ?? character.default_tier ?? AVATAR_DEFAULT_TIER;
  const assetType = opts?.assetType ?? "square";

  const { data, error } = await admin
    .from("avatar_assets")
    .select("id, avatar_id, tier, asset_type, storage_path, active")
    .eq("avatar_id", avatarId)
    .eq("tier", tier)
    .eq("asset_type", assetType)
    .eq("active", true)
    .maybeSingle();

  if (error || !data) return null;
  return data as AvatarAssetRow;
}

export async function getAvatarDisplayUrl(
  avatarId: string,
  opts?: { tier?: number; assetType?: "square" | "full" }
): Promise<string | null> {
  const asset = await getAvatarDisplayAsset(avatarId, opts);
  if (!asset) return null;
  return avatarStoragePublicUrl(asset.storage_path);
}

/** True when the user may use this catalog character (server-side entitlement check). */
export async function userMayUseAvatar(userId: string, avatarId: string): Promise<boolean> {
  const admin = getAdminClient();
  if (!admin) return false;

  const { data: character, error: characterErr } = await admin
    .from("avatars")
    .select("id, pack_id, active")
    .eq("id", avatarId)
    .maybeSingle();

  if (characterErr || !character?.id || !(character as { active?: boolean }).active) return false;

  const { data: unlock, error: unlockErr } = await admin
    .from("user_avatar_pack_unlocks")
    .select("pack_id")
    .eq("user_id", userId)
    .eq("pack_id", (character as { pack_id: string }).pack_id)
    .maybeSingle();

  return !unlockErr && Boolean(unlock);
}

/** Match a stored public URL to a catalog character the user is allowed to use. */
export async function resolveAllowedAvatarFromUrl(
  userId: string,
  avatarUrl: string
): Promise<AvatarCharacterRow | null> {
  const trimmed = avatarUrl.trim();
  if (!trimmed) return null;

  const available = await getAvailableAvatarsForUser(userId);
  const normalized = trimmed.replace(/\/$/, "");
  const match = available.find((a) => a.display_url.replace(/\/$/, "") === normalized);
  return match ?? null;
}

/** @deprecated Use getAvatarCharacterById */
export async function getAvatarById(avatarId: string): Promise<AvatarCharacterRow | null> {
  return getAvatarCharacterById(avatarId);
}
