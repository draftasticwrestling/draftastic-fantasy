# Starter pack avatars

Curated **10 characters** for the free starter pack. Definition lives in `manifest.json`.

## Character folders

Create one folder per character slug with **10 PNG files** each:

```
avatars/starter-pack/
  manifest.json
  mika-moonshot/
    mika-moonshot-1.png          # square — performing terribly
    mika-moonshot-2.png          # square — below expectations
    mika-moonshot-3.png          # square — baseline (picker default)
    mika-moonshot-4.png          # square — above expectations
    mika-moonshot-5.png          # square — leading the pack
    mika-moonshot-full-1.png     # full body, same tiers
    …
    mika-moonshot-full-5.png
  cruise-azul/
    …
```

Tier **3 square** is used in the picker until performance-based tier switching ships.

## Upload + catalog

1. Run `supabase/avatar_packs.sql` (if not already).
2. If you ran the old per-file schema, also run `supabase/avatar_character_assets.sql`.
3. Add image files under each character folder.
4. Sync:

```bash
npm run avatars:sync-starter-pack -- --dry-run
npm run avatars:sync-starter-pack
```

Storage destination: `manager-avatars/packs/starter-pack/{character-slug}/`
