-- Optional timeline of title changes (one row per change), synced from Boxscore when available.
-- The app reads this in parallel with championship_history; if the table was missing, Postgres logged
-- "relation championship_changes does not exist" on every page load. An empty table is valid: all
-- queries return [] and scoring/UI fall back to other sources.

create table if not exists public.championship_changes (
  id bigint generated always as identity primary key,
  championship_type text not null,
  champion text,
  champion_slug text,
  date date not null
);

create index if not exists championship_changes_date_idx on public.championship_changes (date asc);
create index if not exists championship_changes_type_idx on public.championship_changes (championship_type);

comment on table public.championship_changes is 'Title change rows (championship_type, champion, date). Populated from Boxscore sync when configured; may stay empty.';

alter table public.championship_changes enable row level security;

-- Read-only for clients (same pattern as other public read tables).
drop policy if exists "championship_changes_select_anon" on public.championship_changes;
create policy "championship_changes_select_anon"
  on public.championship_changes
  for select
  to anon
  using (true);

drop policy if exists "championship_changes_select_authenticated" on public.championship_changes;
create policy "championship_changes_select_authenticated"
  on public.championship_changes
  for select
  to authenticated
  using (true);

-- Service role bypasses RLS for writes from backend/sync jobs.

grant select on table public.championship_changes to anon, authenticated;
grant all on table public.championship_changes to service_role;
