/* Draft picks: each owner has Season N round picks (#1-#6) + 3 discovery picks.
   current_owner_slug can change when picks are traded. */

create table if not exists draft_picks (
  id uuid primary key default gen_random_uuid(),
  league_slug text not null,
  season int not null,
  pick_type text not null check (pick_type in ('round', 'discovery')),
  round_number int null check (round_number is null or (round_number >= 1 and round_number <= 6)),
  discovery_number int null check (discovery_number is null or (discovery_number >= 1 and discovery_number <= 3)),
  original_owner_slug text not null,
  current_owner_slug text not null,
  contract_years int not null default 1 check (contract_years in (1, 2, 3)),
  created_at timestamptz default now()
);

create unique index if not exists idx_draft_picks_unique_seed
  on draft_picks (league_slug, season, original_owner_slug, pick_type, coalesce(round_number, 0), coalesce(discovery_number, 0));
create index if not exists idx_draft_picks_league_season
  on draft_picks (league_slug, season);
create index if not exists idx_draft_picks_current_owner
  on draft_picks (league_slug, season, current_owner_slug);

comment on table draft_picks is 'Future draft picks per owner (Season 3: rounds 1-6 + 3 discovery). current_owner_slug updates on trade. contract_years: R1-2 and Discovery 1 = 3yr, R3-4 and Discovery 2 = 2yr, R5-6 and Discovery 3 = 1yr.';

/* Add contract_years if table already existed without it. */
alter table draft_picks add column if not exists contract_years int default 1;
update draft_picks set contract_years = case
  when pick_type = 'round' then case when round_number <= 2 then 3 when round_number <= 4 then 2 else 1 end
  else case when discovery_number = 1 then 3 when discovery_number = 2 then 2 else 1 end
end where league_slug = 'example' and season = 3 and (contract_years is null or contract_years = 1);

/* Seed Season 3 picks for example league (6 owners x 9 picks = 54 rows).
   Round 1-2 = 3yr, Round 3-4 = 2yr, Round 5-6 = 1yr. Discovery 1 = 3yr, 2 = 2yr, 3 = 1yr. */
insert into draft_picks (league_slug, season, pick_type, round_number, discovery_number, original_owner_slug, current_owner_slug, contract_years)
select 'example', 3, 'round', r, null, slug, slug, case when r <= 2 then 3 when r <= 4 then 2 else 1 end
from (values ('christopher-cramer'), ('caleb-warren'), ('josh-dill'), ('kenny-walker'), ('kyle-morrow'), ('trevor-jones')) as m(slug)
cross join generate_series(1, 6) as r
where not exists (select 1 from draft_picks where league_slug = 'example' and season = 3 and pick_type = 'round');

insert into draft_picks (league_slug, season, pick_type, round_number, discovery_number, original_owner_slug, current_owner_slug, contract_years)
select 'example', 3, 'discovery', null, d, slug, slug, case when d = 1 then 3 when d = 2 then 2 else 1 end
from (values ('christopher-cramer'), ('caleb-warren'), ('josh-dill'), ('kenny-walker'), ('kyle-morrow'), ('trevor-jones')) as m(slug)
cross join generate_series(1, 3) as d
where not exists (select 1 from draft_picks where league_slug = 'example' and season = 3 and pick_type = 'discovery');
