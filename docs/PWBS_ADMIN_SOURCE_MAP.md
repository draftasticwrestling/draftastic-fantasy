# PWBS admin → Draftastic internal-admin (source map)

**Status (2026-05):** Event and championship admin tools are **implemented** under `/internal-admin/boxscore/*`. Use `docs/BOXSCORE_ADMIN_OPS.md` for day-to-day workflows.

**PWBS repo (local):** `/Users/thisguytoph/wrestling-boxscore`  
**Stack:** Vite + React Router + `src/supabaseClient.js` (anon key in browser)  
**Draftastic:** `/internal-admin/boxscore/*` with `is_site_admin` + server-side writes (`getAdminClient`) + `admin_audit_log` where appropriate.

## Auth model (important difference)

- **PWBS:** Any **logged-in** user (`useUser()` truthy) can add events, edit matches, delete events, edit wrestlers, etc. (`canEditMatches = !!user`, `canEdit = !!user`). Admin login is magic link at `/admin`.
- **Draftastic:** Restrict to **`profiles.is_site_admin`** (already used for `/internal-admin`). Do not expose boxscore mutations to all authenticated users unless you intentionally align with PWBS.

## React Router routes (PWBS) → Draftastic URL ideas

| PWBS route | Role | Draftastic |
|------------|------|------------|
| `/` | Event list + **+ Add Event** if `user` | Public: `/event-results`; add → `/internal-admin/boxscore/events/new` |
| `/add-event` | `AddEvent` form | `/internal-admin/boxscore/events/new` ✅ |
| `/edit-event/:eventSlug` | `EditEvent` (full card, matches, promos) | `/internal-admin/boxscore/events/[eventId]/edit` ✅ |
| `/events/:eventSlug` | `EventBoxScore` (view + edit matches) | Public: `/event-results/{slug}`; admin bar → edit ✅ |
| `/events/:eventSlug/match/:matchOrder` | Match detail + `MatchEdit` | Public match page + event editor ✅ |
| `/wrestlers` | `WrestlersPage` | `/internal-admin/boxscore/wrestlers` ✅ |
| `/wrestler/:slug` | `WrestlerProfile` | `/internal-admin/boxscore/wrestlers` (list manager) ✅ |
| `/championships` | `ChampionshipsPage` | Public: `/championship`; admin: `/internal-admin/boxscore/championships` ✅ |
| `/championship/:id` | `ChampionshipDetailPage` | Same admin page (title picker + PWBS title-change flow) ✅ |
| `/admin` | `AdminLoginPage` (OTP only) | Draftastic login + `is_site_admin` |

## Where the logic lives (PWBS)

### Monolith: `src/App.jsx` (~7.5k lines)

Contains most wiring:

- **State load:** `fetchEvents()` → `supabase.from('events').select('*')`; wrestlers `select('*')` in same area.
- **CRUD:** `addEvent`, `deleteEvent`, `updateEvent` → `events` insert/update/delete with field allowlists (`id`, `name`, `date`, `location`, `broadcast_start_ts`, `preview`, `recap`, `matches`, `status`, `isLive`, …).
- **UI blocks:** `EventList`, `EventBoxScore`, `AddEvent`, `EditEvent`, routing wrappers, live commentary handlers, tag team / championship sync helpers (grep `.from('tag_teams')`, `.from('championships')`, `.from('tag_team_members')` in this file).

### Extracted components (good port candidates)

| File | Purpose |
|------|---------|
| `src/components/MatchEdit.jsx` | Match editor (non-promo) |
| `src/components/MatchEdit.jsx` (`PromoMatchEdit`) | Promo editor |
| `src/components/VisualMatchBuilder.jsx` | Card builder UI |
| `src/components/GauntletMatchBuilder.jsx` | Gauntlet |
| `src/components/TagTeamGauntletMatchBuilder.jsx` | Tag gauntlet |
| `src/components/TwoOutOfThreeFallsBuilder.jsx` | 2/3 falls |
| `src/components/WarGamesMatchBuilder.jsx` | War Games |
| `src/components/SurvivorSeriesMatchBuilder.jsx` | Survivor Series |
| `src/components/WrestlerAddModal.jsx` / `WrestlerEditModal.jsx` | Wrestler forms |
| `src/components/WrestlersPage.jsx` | Roster table + open modals |
| `src/components/WrestlerProfile.jsx` | Profile + edits |
| `src/components/ChampionshipsPage.jsx` / `ChampionshipDetailPage.jsx` | Title UX |
| `src/components/ChampionshipEditModal.jsx` | Title edits |
| `src/components/TagTeamsView.jsx` / `FactionsView.jsx` | Tag teams & stables |
| `src/components/AdminLoginPage.jsx` | OTP login (replace with Draftastic session) |
| `src/options.js` | Match type, stipulation, method, title dropdowns |

### Supabase + storage helpers

- **`src/supabaseClient.js`:** `createClient` + **`uploadWrestlerImage`**, **`uploadWrestlerFullBodyImage`** → bucket **`wrestler-images`** (paths `{slug}.png|webp`, `{slug}-full.ext`).

### Shared logic (already mirrored in Draftastic fantasy)

- `scraper/src/parsers/eventClassifier.js`, `pointsCalculator.js`, etc. — fantasy app already copies some of this; event **payload shape** should stay aligned with PWBS `matches` JSON.

## Suggested port order

1. **Events** — Reuse `addEvent`/`updateEvent` field lists and `EditEvent` / `AddEvent` flow; wire Next server actions + service role + revalidate fantasy/event-results paths.
2. **Matches / promos** — `MatchEdit`, `PromoMatchBuilder`, `VisualMatchBuilder` (large; consider lazy-loaded client islands in Next).
3. **Live results** — Search `onRealTimeCommentaryUpdate`, `isLive` in `App.jsx` / `MatchPageNew`.
4. **Wrestlers** — Modals + `uploadWrestler*` → Next route handlers for uploads + DB updates.
5. **Championships + tag teams** — Follow `App.jsx` branches for `championships`, `tag_teams`, `tag_team_members`.

## Environment

PWBS uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Draftastic uses `NEXT_PUBLIC_SUPABASE_*` and **`SUPABASE_SERVICE_ROLE_KEY`** for privileged writes — use the **same project** as PWBS for a single source of truth.
