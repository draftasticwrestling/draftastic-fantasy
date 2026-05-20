# Boxscore admin save parity (Draftastic vs PWBS)

Use this checklist to confirm Draftastic internal-admin writes behave like [prowrestlingboxscore.com](https://prowrestlingboxscore.com) (PWBS repo: `wrestling-boxscore`).

**Same database:** `NEXT_PUBLIC_SUPABASE_URL` must be the PWBS project. Tables: `events`, `wrestlers`, `championships`, `championship_history`, `tag_teams`, `tag_team_members`, storage bucket `wrestler-images`.

---

## Save flow summary

| Action | PWBS | Draftastic | Parity |
|--------|------|------------|--------|
| **Add event** | `addEvent` → `events` insert | `insertBoxscoreEventAction` | Yes — same allowlist + `specialWinner` on create |
| **Edit event** | `updateEvent` → `events` update | `updateBoxscoreEventAction` | Yes — same allowlist + BR/RR/EC result regen |
| **Edit event validation** | ≥1 match if completed/live only | Same | Yes |
| **Add event validation** | Each match: participants; gauntlet w/ progression needs result; else method+result; promos skip | Same | Yes |
| **Add/edit match** | Local state → Save Event; EventBoxScore also calls `updateEvent` on Save Match | **Save Match** persists card immediately when editing an existing event; **Save Event** for show fields | Yes (edit existing) |
| **Add/edit promo** | Local state → Save Event | Local state → **Save Event** | Yes (no nested `<form>`) |
| **Live commentary** | `events.update({ matches })` commentary only | `persistEventMatchCommentaryAction` | Yes |
| **Wrestlers** | `wrestlers` + `wrestler-images` | Same | Yes |
| **Championships** | `championships` + `championship_history` | Same + sync helper | Yes |
| **Tag teams** | `tag_teams` + `tag_team_members` | Same | Yes |
| **Dropdown labels** | `options.js` in repo | `boxscore_ui_options` table | Draftastic-only (additive) |

---

## Event row fields (Supabase `events`)

| Field | PWBS insert | PWBS update | Draftastic |
|-------|-------------|-------------|------------|
| `id`, `name`, `date`, `location` | Yes | Yes | Yes |
| `broadcast_start_ts`, `broadcast_start_ts_source` | Yes | Yes | Yes |
| `preview`, `recap`, `matches`, `status` | Yes | Yes | Yes |
| `isLive` | `status === 'live'` | Same | Yes (fallback if column missing) |
| `specialWinner` | If set on **create** | Not in update allowlist | Create only (same as PWBS) |
| `event_type` | — | — | Draftastic extension (optional column) |

---

## Match / promo card (`matches` JSON)

- **Promos:** `matchType: 'Promo'`, `title`, `participants[]`, `notes`, `promoOutcome` — saved inside `matches` (not a separate table).
- **Standard matches:** `participants`, `method`, `result`, `winner`, builders’ nested data (`battleRoyalData`, etc.).
- **Per-match validation** runs in **MatchEdit** when you click **Save Match** (PWBS `handleAddMatch` / edit save).
- **Event Save** does not re-validate every match’s method (PWBS EditEvent behavior).

### Pre-save result regeneration (Edit Event)

PWBS regenerates result strings for Battle Royal, Royal Rumble, and Elimination Chamber before `updateEvent`. Draftastic runs the same logic in `lib/boxscoreAdmin/regenerateSpecialMatchResults.ts` on insert and update.

---

## Operational checklist (tonight’s show)

1. **Edit match** → winner, method, result → **Save Match** (updates card in memory).
2. **Add promo** → type + summary → **Add Promo** (must appear in card list).
3. **Save Event** at bottom (writes full `matches` array to Supabase).
4. Confirm on public `/event-results/...` or PWBS event page.

---

## Intentional differences

| Topic | Notes |
|-------|--------|
| **Auth** | Draftastic: `is_site_admin` + service role. PWBS: any logged-in user. |
| **UI** | Draftastic uses one server `<form>` for Save Event; match/promo editors use `type="button"` (not nested forms). |
| **Options** | `boxscore_ui_options` merges with built-in lists; does not replace PWBS data. |
| **Audit** | Draftastic `admin_audit_log` on some mutations. |

---

## Migrations (run once in Supabase)

- `supabase/boxscore_ui_options.sql` — dropdown options + `events.event_type`
- `supabase/events_special_winner.sql` — event-level special winner on **create**
- `supabase/championship_history_detail_columns.sql` — optional history detail columns

---

## Code references

| PWBS | Draftastic |
|------|------------|
| `App.jsx` `addEvent` / `updateEvent` | `lib/boxscoreAdmin/eventPayload.ts` |
| `App.jsx` `handleSaveEvent` (EditEvent) | `app/internal-admin/boxscore/events/actions.ts` |
| `App.jsx` regenerate BR/RR/EC | `lib/boxscoreAdmin/regenerateSpecialMatchResults.ts` |
| `MatchEdit.jsx` commentary update | `events/commentaryActions.ts` |
| `WrestlerAddModal` / `EditModal` | `boxscore/wrestlers/actions.ts` |
| `championshipWorkflow.js` | `lib/boxscoreAdmin/championshipSync.ts` |
