# Public League Test and Rollout Notes

## Phase 1 Verification Checklist

- Create private league: custom name preserved, custom team-count rules still apply.
- Create public league: name is auto-generated (`R2Summer N`), `max_teams` forced to 6.
- Public creator is commissioner and member count starts at 1.
- Quick Join picks the oldest open public league and adds member.
- Quick Join stops at 6/6 and marks league as `full`.
- Public leagues with 1-2 members remain `awaiting_minimum`.
- Scheduled draft logic blocks public leagues with fewer than 3 members.
- Public leagues with 3-6 members can draft and transition to `active`.
- Existing private leagues cannot convert in-place; dashboard guidance is visible.

## Concurrency Focus (manual + SQL validation)

- Simulate two parallel quick-join requests against the same open public league:
  - Expect one request to get final seat and set status to `full`.
  - Expect the other request to return “No open public leagues available right now.”
- Confirm no duplicate memberships for a single user (`unique (league_id, user_id)`).
- Confirm public sequence uniqueness under concurrent public league creation.

## Operations / Rollout

- Apply SQL migrations in this order:
  1. `supabase/leagues.sql`
  2. `supabase/leagues_league_type_max_teams.sql`
  3. `supabase/leagues_join_code.sql`
  4. `supabase/leagues_public_visibility.sql`
- Monitor API logs for:
  - `/api/leagues/join` quick-join errors
  - draft cron skips due to `awaiting_minimum`
- Initial support macro:
  - “Existing private leagues are unchanged. To play public, create a new public league from Create League.”

## Phase 2 Backlog (deferred)

- Public league browse/list page:
  - Timezone display
  - Filled spots (`x/6`)
  - status badges
- Optional “Quick Join + List” hybrid UX.
- Admin moderation queue for profile display names/catchphrases across public leagues.
