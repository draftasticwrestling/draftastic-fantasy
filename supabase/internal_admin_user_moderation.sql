/* Site-admin user moderation fields and audit trail. */

alter table public.profiles
  add column if not exists is_suspended boolean not null default false,
  add column if not exists suspended_until timestamptz null,
  add column if not exists suspension_reason text null,
  add column if not exists moderation_note text null;

comment on column public.profiles.is_suspended is 'When true, user is blocked from protected app areas.';
comment on column public.profiles.suspended_until is 'Optional end time for temporary suspension.';
comment on column public.profiles.suspension_reason is 'Moderator-provided reason for current/last suspension.';
comment on column public.profiles.moderation_note is 'Internal moderator notes for this account.';

create table if not exists public.admin_moderation_audit (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users on delete restrict,
  target_user_id uuid not null references auth.users on delete cascade,
  action text not null,
  reason text null,
  before_json jsonb null,
  after_json jsonb null,
  created_at timestamptz not null default now()
);

comment on table public.admin_moderation_audit is
  'Immutable audit log for site-admin moderation actions on user accounts and user-generated profile/team content.';

create index if not exists idx_admin_moderation_audit_target_created
  on public.admin_moderation_audit (target_user_id, created_at desc);

create index if not exists idx_admin_moderation_audit_actor_created
  on public.admin_moderation_audit (actor_user_id, created_at desc);
