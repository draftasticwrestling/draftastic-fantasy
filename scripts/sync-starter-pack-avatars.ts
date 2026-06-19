/**
 * Sync starter-pack characters from manifest + local asset folders to Supabase.
 *
 * Expected layout:
 *   avatars/starter-pack/manifest.json
 *   avatars/starter-pack/{character-slug}/{slug}-1.png … {slug}-full-5.png
 *
 * Usage:
 *   npm run avatars:sync-starter-pack -- --dry-run
 *   npm run avatars:sync-starter-pack
 *
 * Requires supabase/avatar_packs.sql (+ avatar_character_assets.sql if upgrading).
 */
import "dotenv/config";
import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  AVATAR_ASSET_TYPES,
  AVATAR_PERFORMANCE_TIERS,
  characterAssetFilename,
  characterAssetStoragePath,
  findCharacterAssetFileOnDisk,
  getStarterPackManifest,
  STARTER_AVATAR_PACK_SLUG,
} from "../lib/avatarStarterPackManifest";
import { MANAGER_AVATARS_BUCKET } from "../lib/managerAvatarBucket";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const DEFAULT_ROOT = path.join(process.cwd(), "avatars", "starter-pack");

type Args = {
  dryRun: boolean;
  rootDir: string;
};

function printHelp(): void {
  console.log(`sync-starter-pack-avatars — upload manifest characters + tier assets.

  npm run avatars:sync-starter-pack -- --dry-run
  npm run avatars:sync-starter-pack
  npm run avatars:sync-starter-pack -- --root=./avatars/starter-pack

  Each character folder should include (png):
    {slug}-1.png … {slug}-5.png
    {slug}-full-1.png … {slug}-full-5.png

  Tier 3 square is the picker default until performance tiers ship.`);
}

function parseArgs(argv: string[]): Args {
  let dryRun = false;
  let rootDir = DEFAULT_ROOT;
  for (const a of argv) {
    if (a === "--help" || a === "-h") {
      printHelp();
      process.exit(0);
    }
    if (a === "--dry-run") dryRun = true;
    else if (a.startsWith("--root=")) rootDir = path.resolve(a.slice("--root=".length).trim() || DEFAULT_ROOT);
  }
  return { dryRun, rootDir };
}

function contentTypeForExt(ext: string): string {
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "image/jpeg";
}

type SupabaseStorageClient = {
  storage: {
    from: (bucket: string) => {
      upload: (
        path: string,
        body: Buffer,
        options: { upsert: boolean; contentType: string }
      ) => Promise<{ error: { message: string } | null }>;
    };
  };
};

async function uploadFile(
  supabase: SupabaseStorageClient,
  localPath: string,
  storagePath: string,
  dryRun: boolean
): Promise<boolean> {
  if (dryRun) {
    console.log(`  [dry-run] upload ${localPath} → ${storagePath}`);
    return true;
  }
  const buf = await readFile(localPath);
  const ext = path.extname(localPath).toLowerCase();
  const { error } = await supabase.storage.from(MANAGER_AVATARS_BUCKET).upload(storagePath, buf, {
    upsert: true,
    contentType: contentTypeForExt(ext),
  });
  if (error) {
    console.error(`  upload failed: ${error.message}`);
    return false;
  }
  return true;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const manifest = getStarterPackManifest();
  if (manifest.packSlug !== STARTER_AVATAR_PACK_SLUG) {
    console.error(`Manifest packSlug must be ${STARTER_AVATAR_PACK_SLUG}.`);
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: pack, error: packErr } = await supabase
    .from("avatar_packs")
    .select("id, slug")
    .eq("slug", manifest.packSlug)
    .maybeSingle();

  if (packErr || !pack?.id) {
    console.error(`Pack "${manifest.packSlug}" not found. Run supabase/avatar_packs.sql first.`);
    process.exit(1);
  }

  let charactersUpserted = 0;
  let assetsUploaded = 0;
  let assetsCataloged = 0;
  const missing: string[] = [];

  for (let i = 0; i < manifest.characters.length; i++) {
    const character = manifest.characters[i];
    const charDir = path.join(args.rootDir, character.slug);
    console.log(`\n[${i + 1}/${manifest.characters.length}] ${character.label} (${character.slug})`);

    try {
      await access(charDir);
    } catch {
      console.warn(`  missing folder: ${charDir}`);
      for (const tier of AVATAR_PERFORMANCE_TIERS) {
        for (const assetType of AVATAR_ASSET_TYPES) {
          missing.push(path.join(charDir, characterAssetFilename(character.slug, tier, assetType)));
        }
      }
      continue;
    }

    const characterRow = {
      pack_id: pack.id,
      slug: character.slug,
      label: character.label,
      sort_order: i,
      default_tier: manifest.defaultTier,
      active: true,
    };

    let avatarId: string | null = null;

    if (args.dryRun) {
      console.log("  [dry-run] upsert avatars", characterRow);
      avatarId = `dry-run-${character.slug}`;
      charactersUpserted++;
    } else {
      const { data: upserted, error: charErr } = await supabase
        .from("avatars")
        .upsert(characterRow, { onConflict: "pack_id,slug" })
        .select("id")
        .single();
      if (charErr || !upserted?.id) {
        console.error("  character upsert failed:", charErr?.message ?? "no id");
        continue;
      }
      avatarId = upserted.id as string;
      charactersUpserted++;
    }

    const filesOnDisk = await readdir(charDir);

    for (const tier of AVATAR_PERFORMANCE_TIERS) {
      for (const assetType of AVATAR_ASSET_TYPES) {
        const diskFilename = findCharacterAssetFileOnDisk(filesOnDisk, character.slug, tier, assetType);
        const catalogFilename = characterAssetFilename(character.slug, tier, assetType, "png");
        const storagePath = characterAssetStoragePath(
          manifest.packSlug,
          character.slug,
          tier,
          assetType,
          "png"
        );

        if (!diskFilename) {
          const expected = path.join(charDir, catalogFilename);
          missing.push(expected);
          console.warn(`  missing file: ${catalogFilename}`);
          continue;
        }

        const localPath = path.join(charDir, diskFilename);
        const uploaded = await uploadFile(supabase, localPath, storagePath, args.dryRun);
        if (!uploaded) continue;
        assetsUploaded++;

        const assetRow = {
          avatar_id: avatarId,
          tier,
          asset_type: assetType,
          storage_path: storagePath,
          active: true,
        };

        if (args.dryRun) {
          console.log("  [dry-run] upsert avatar_assets", assetRow);
          assetsCataloged++;
          continue;
        }

        const { error: assetErr } = await supabase.from("avatar_assets").upsert(assetRow, {
          onConflict: "storage_path",
        });
        if (assetErr) {
          console.error(`  asset catalog failed (${catalogFilename}):`, assetErr.message);
          continue;
        }
        assetsCataloged++;
      }
    }
  }

  console.log(
    `\nDone${args.dryRun ? " (dry-run)" : ""}: ${charactersUpserted} character(s), ${assetsUploaded} file(s) uploaded, ${assetsCataloged} asset row(s).`
  );
  if (missing.length > 0) {
    console.log(`\n${missing.length} expected file(s) not found. Add art under avatars/starter-pack/{slug}/`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
