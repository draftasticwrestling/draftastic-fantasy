create table if not exists roster_assignments (
  league_slug text not null,
  owner_slug text not null,
  wrestler_id text not null,
  contract text,
  created_at timestamptz default now(),
  primary key (league_slug, owner_slug, wrestler_id)
);

create index if not exists idx_roster_assignments_league_owner
  on roster_assignments (league_slug, owner_slug);

comment on table roster_assignments is 'In-app roster: wrestler assignments to league owners with contract length (e.g. 3 yr, 2 yr, 1 yr).';
