# How It Works — Belt & Event Logo Images

## How wrestler images work today

Wrestler images are **not** scraped from the web. They come from **Supabase**:

- Table: `wrestlers`
- Column: `image_url` (string, nullable)
- The **Pro Wrestling Boxscore** app (same Supabase project) stores these URLs when wrestler profiles are edited. The fantasy app only reads them and renders `<img src={wrestler.image_url} />`.

So the pattern is: **Boxscore (or a sync job) writes image URLs into Supabase → fantasy app reads and displays them.**

---

## Belts and event logos — current state

- **Belt images** (Title Points section): We do **not** have a Supabase table or column for championship/belt images. The `championship_history` table has `title` / `title_name` for reign data but no `image_url`. The Boxscore site’s [champions page](https://www.prowrestlingboxscore.com/champions) is client-rendered (“Loading events…”), so we can’t reliably scrape image URLs from the live page.
- **Event logos** (RAW, SmackDown, WrestleMania, etc.): The `events` table is only queried for `id`, `name`, `date`, `matches`. We don’t currently have an `events.logo_url` (or similar) in use. If the Boxscore app stores event logos in Supabase (e.g. on `events` or a separate `event_assets` table), we could use the same pattern as wrestlers.

---

## Best ways to add images

### Option 1: Supabase (same pattern as wrestlers) — **best if Boxscore has or can add the data**

1. **Belts**
   - In the **Boxscore** Supabase project, add a table or columns that map “title” → image URL (e.g. `championships` with `title_slug`, `image_url`, or add `image_url` to whatever backs the champions page).
   - In the **fantasy app**, query that table (or column) and use the URLs in the How It Works Title Points section. Same as `wrestlers.image_url`: read and render.
2. **Event logos**
   - If **Boxscore** has (or adds) event logo URLs—e.g. `events.logo_url` or an `event_assets` table—the fantasy app can `.select('id, name, date, logo_url')` (or similar) and use them in the Major/Medium/Minor PLE sections.
3. **Who does the work**: Someone with access to the Boxscore codebase (`~/wrestling-boxscore`) and Supabase needs to (a) add the column/table and (b) ensure the Boxscore app (or a script) writes the image URLs there. After that, the fantasy app only needs to read and display.

### Option 2: Static assets in this repo

- Add image files under e.g. `public/belts/` and `public/events/` (or `public/how-it-works/`).
- Create a small **mapping** (e.g. `lib/howItWorksImages.ts`) from logical keys to paths:
  - Belts: `"undisputed-wwe"` → `"/belts/undisputed-wwe.png"`, etc.
  - Events: `"raw"` → `"/events/raw.png"`, `"wrestlemania"` → `"/events/wrestlemania.png"`, etc.
- On the How It Works page, use these paths when rendering; fall back to the current placeholder when a key has no image.
- **Pros**: No dependency on Boxscore or network; fast and stable. **Cons**: You have to obtain and add the image files (and keep rights in mind).

### Option 3: Use Boxscore’s public image URLs (if they exist and are stable)

- If the Boxscore site serves belt/event images at stable, public URLs (e.g. from Supabase Storage or a CDN), you could use those directly in `<img src="…">`.
- Add the image host (e.g. `your-project.supabase.co`) to `next.config.ts` under `images.domains` if you use the Next.js `Image` component; plain `<img>` often works without config.
- **Caveats**: URLs can change; hotlinking can be blocked by referrer or CORS. Prefer Option 1 (Supabase) or Option 2 (static) for anything you control.

---

## Recommended path

1. **Check Boxscore + Supabase**
   - In the **wrestling-boxscore** repo, see how the champions page gets belt data and whether any table has (or can have) an `image_url` (or similar) for titles.
   - Check whether `events` (or another table) has or can have a logo URL per event or per event type.
2. **If yes**  
   - Add the necessary columns/tables and populate them in Boxscore (or a one-off script). In the fantasy app, query those and pass the URLs into the How It Works page. We can wire the existing placeholders to use `image_url` / `logo_url` when present and fall back to the placeholder otherwise.
3. **If no**  
   - Use **Option 2**: add a small mapping and static assets in this repo, and point the How It Works sections at those paths so belts and event logos are under your control and don’t depend on Boxscore’s UI or network.

If you tell me which route you prefer (Supabase vs static assets), I can outline the exact code changes (e.g. new Supabase query + props for the How It Works page, or the mapping file + `public/` layout and usage in the components).
