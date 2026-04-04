/* Stat corrections (user-visible) + admin audit log. Run in Supabase SQL editor. */

create table if not exists public.event_score_corrections (
  id uuid primary key default gen_random_uuid(),
  league_id uuid null references public.leagues (id) on delete cascade,
  event_id text not null,
  title text not null,
  body_markdown text not null default '',
  visible_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now()
);

comment on table public.event_score_corrections is
  'Published explanations when event scoring changes. league_id null = all leagues; else only that league''s members.';

create index if not exists idx_event_score_corrections_visible
  on public.event_score_corrections (visible_at desc);

create index if not exists idx_event_score_corrections_league_visible
  on public.event_score_corrections (league_id, visible_at desc);

create index if not exists idx_event_score_corrections_event
  on public.event_score_corrections (event_id);

alter table public.event_score_corrections enable row level security;

drop policy if exists "event_score_corrections_select_member_or_global" on public.event_score_corrections;

/* League members (and global rows) can read published corrections. */
create policy "event_score_corrections_select_member_or_global"
  on public.event_score_corrections for select
  to authenticated
  using (
    visible_at <= (timezone('utc', now()))
    and (
      league_id is null
      or public.current_user_is_league_member(league_id)
    )
  );

/* Site admin UI uses service role (bypasses RLS) to list all rows including scheduled. */

/* No insert/update/delete for authenticated — app uses service role for writes. */

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  payload_json jsonb null,
  created_at timestamptz not null default now()
);

comment on table public.admin_audit_log is 'Append-only audit of privileged admin actions (written from server with service role).';

create index if not exists idx_admin_audit_log_created_at on public.admin_audit_log (created_at desc);
create index if not exists idx_admin_audit_log_entity on public.admin_audit_log (entity_type, entity_id);

alter table public.admin_audit_log enable row level security;
/* Intentionally no policies: anon/authenticated cannot read; service role bypasses RLS. */
