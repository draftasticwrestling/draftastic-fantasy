-- Extended transactional email preferences (run after profiles_timezone_notifications.sql).

alter table public.profiles
  add column if not exists notify_trade_accepted boolean not null default true,
  add column if not exists notify_trade_finalized boolean not null default true,
  add column if not exists notify_gm_trade_approval boolean not null default true,
  add column if not exists notify_event_scores boolean not null default true;

comment on column public.profiles.notify_trade_accepted is
  'Email when another owner accepts or declines a trade you proposed.';
comment on column public.profiles.notify_trade_finalized is
  'Email when the league GM approves or declines a trade you are part of.';
comment on column public.profiles.notify_gm_trade_approval is
  'Email league GM when a trade is accepted by both owners and needs commissioner approval.';
comment on column public.profiles.notify_event_scores is
  'Email when fantasy scores are published for a completed WWE event.';
