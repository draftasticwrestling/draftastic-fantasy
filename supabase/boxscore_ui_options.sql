-- Admin-managed dropdown labels merged with code defaults in /internal-admin/boxscore (PWBS-style editors).

create table if not exists public.boxscore_ui_options (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('event_type', 'stipulation', 'special_winner')),
  label text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (category, label)
);

create index if not exists boxscore_ui_options_category_sort_idx
  on public.boxscore_ui_options (category, sort_order asc, created_at asc);

comment on table public.boxscore_ui_options is 'Extra dropdown options merged with lib defaults for boxscore admin.';

alter table public.events add column if not exists event_type text;

comment on column public.events.event_type is 'Optional catalog label (RAW, SmackDown, PLE name, etc.); scoring still uses classifyEventType(name, id).';

alter table public.boxscore_ui_options enable row level security;
