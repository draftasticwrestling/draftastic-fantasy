# Weekly leaderboards & weekly-high XP — rollout checklist

## Preconditions

1. Apply `supabase/league_weekly_points_snapshot.sql` in Supabase (table + indexes).
2. Confirm `CRON_SECRET` and scheduled function env (`URL` / `DEPLOY_PRIME_URL`) are set on Netlify.
3. Confirm `SUPABASE_SERVICE_ROLE_KEY` is available to the Next.js runtime (cron route uses admin client).

## Behavior summary

- **Cron** (`GET /api/cron/weekly-xp-leaderboards` with `x-cron-secret`):
  - Targets the **previous** Monday-start fantasy week (derived from America/Los_Angeles “today”).
  - Processes only leagues with `is_archived = false` and **`draft_status = 'completed'`** (active post-draft leagues).
  - Skips a league/week if any **live** event falls in that week (wait until shows are finished scoring).
  - Skips recomputation if a full snapshot already exists (`snapshot row count >= current member count`) unless `?reprocess=1`.
  - Writes `league_weekly_points_snapshot` (points, rank, `is_weekly_high`).
  - Awards **weekly high** XP to all tied top scorers **only if the top weekly score is &gt; 0**.
  - Refreshes **per-50 combined fantasy points** XP for users in processed leagues.
- **League home Top 10** (sidebar, above Quick Links): hidden until **2026-05-10** (Pacific calendar date); see `lib/leagueHomeLeaderboardsGate.ts`.
- **Observability**: Site admin → **Weekly leaderboards & XP**; SQL pack: `supabase/admin_verify_weekly_leaderboards.sql`.

## Rollout phases (recommended)

1. Deploy migration + code; **do not** enable Netlify schedule until after a manual test.
2. Manually hit cron once in staging with a known `weekStart` if needed:  
   `GET /api/cron/weekly-xp-leaderboards?weekStart=YYYY-MM-DD` (Monday).
3. Verify snapshot rows and XP ledger (admin page + SQL pack).
4. Enable **one** weekly Netlify scheduled function; confirm compute stays bounded (single weekly invocation).
5. After **2026-05-10 PT**, confirm league home shows Top 10 for members.

## Manual test commands

```bash
curl -sS -H "x-cron-secret: $CRON_SECRET" \
  "https://YOUR_SITE/api/cron/weekly-xp-leaderboards"

# Force recompute even if snapshot row count matches member count:
curl -sS -H "x-cron-secret: $CRON_SECRET" \
  "https://YOUR_SITE/api/cron/weekly-xp-leaderboards?reprocess=1"

# Specific fantasy week (Monday YYYY-MM-DD):
curl -sS -H "x-cron-secret: $CRON_SECRET" \
  "https://YOUR_SITE/api/cron/weekly-xp-leaderboards?weekStart=2026-05-04"
```

## Gotchas

- **DST**: Netlify cron is UTC; confirm the chosen schedule still falls after your Sunday 11:59 PM PT close + buffer year-round (adjust expression seasonally if needed).
- **Season totals on league home** sum **snapshot weekly points**; until backfill runs, season Top 10 may lag true season-to-date from live scoring until enough weeks are snapshotted.
- **Member count changes**: If members join after a snapshot, row count will be low and the job will recompute that league/week on the next run.
