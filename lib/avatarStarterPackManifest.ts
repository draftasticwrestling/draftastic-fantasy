import manifest from "@/avatars/starter-pack/manifest.json";
import { managerAvatarPresetPublicUrl } from "@/lib/managerAvatarPresets";

export const STARTER_AVATAR_PACK_SLUG = manifest.packSlug;
export const AVATAR_DEFAULT_TIER = manifest.defaultTier;
export const AVATAR_PERFORMANCE_TIERS = manifest.tiers as readonly number[];
export const AVATAR_ASSET_TYPES = manifest.assetTypes as readonly ("square" | "full")[];

export type StarterPackCharacter = {
  slug: string;
  label: string;
};

export type StarterPackManifest = {
  packSlug: string;
  defaultTier: number;
  tiers: number[];
  assetTypes: ("square" | "full")[];
  characters: StarterPackCharacter[];
};

export function getStarterPackManifest(): StarterPackManifest {
  return manifest as StarterPackManifest;
}

/** Object key under manager-avatars for a character performance asset. */
export function characterAssetFilename(
  characterSlug: string,
  tier: number,
  assetType: "square" | "full",
  ext = "png"
): string {
  if (assetType === "full") {
    return `${characterSlug}-full-${tier}.${ext}`;
  }
  return `${characterSlug}-${tier}.${ext}`;
}

export function characterAssetStoragePath(
  packSlug: string,
  characterSlug: string,
  tier: number,
  assetType: "square" | "full",
  ext = "png"
): string {
  const filename = characterAssetFilename(characterSlug, tier, assetType, ext);
  return `packs/${packSlug}/${characterSlug}/${filename}`;
}

export function characterAssetPublicUrl(
  packSlug: string,
  characterSlug: string,
  tier: number,
  assetType: "square" | "full",
  ext = "png"
): string {
  return managerAvatarPresetPublicUrl(
    characterAssetStoragePath(packSlug, characterSlug, tier, assetType, ext)
  );
}

/** Files expected on disk for one starter-pack character (all tiers × square + full). */
export function expectedCharacterAssetFilenames(characterSlug: string): string[] {
  const names: string[] = [];
  for (const tier of AVATAR_PERFORMANCE_TIERS) {
    for (const assetType of AVATAR_ASSET_TYPES) {
      names.push(characterAssetFilename(characterSlug, tier, assetType));
    }
  }
  return names;
}

/** Baseline square image used in the avatar picker until performance tiers are live. */
export function starterPickerAssetFilename(characterSlug: string, ext = "png"): string {
  return characterAssetFilename(characterSlug, AVATAR_DEFAULT_TIER, "square", ext);
}

const ASSET_FILE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif"] as const;

/** Stem for a tier asset without extension, e.g. mika-moonshot-3 or mika-moonshot-full-3. */
export function characterAssetStem(
  characterSlug: string,
  tier: number,
  assetType: "square" | "full"
): string {
  return assetType === "full" ? `${characterSlug}-full-${tier}` : `${characterSlug}-${tier}`;
}

/** Match a repo filename to a tier asset (case-insensitive stem + extension). */
export function findCharacterAssetFileOnDisk(
  files: string[],
  characterSlug: string,
  tier: number,
  assetType: "square" | "full"
): string | null {
  const stem = characterAssetStem(characterSlug, tier, assetType).toLowerCase();
  for (const file of files) {
    const dot = file.lastIndexOf(".");
    if (dot < 0) continue;
    const name = file.slice(0, dot).toLowerCase();
    const ext = file.slice(dot + 1).toLowerCase();
    if (name === stem && (ASSET_FILE_EXTENSIONS as readonly string[]).includes(ext)) {
      return file;
    }
  }
  return null;
}
