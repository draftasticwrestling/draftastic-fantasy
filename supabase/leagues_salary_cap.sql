-- Salary Cap (Total Season Points) — admin testing league type.
-- Owners build rosters with a fixed budget; wrestlers are not exclusive across factions.

alter table public.wrestlers
  add column if not exists salary_cap_cost integer null;

comment on column public.wrestlers.salary_cap_cost is
  'Salary cap tier for this wrestler: 5, 10, 15, 20, or 25. Used when league_type is salary_cap.';

alter table public.wrestlers
  drop constraint if exists wrestlers_salary_cap_cost_check;

alter table public.wrestlers
  add constraint wrestlers_salary_cap_cost_check
  check (salary_cap_cost is null or salary_cap_cost in (5, 10, 15, 20, 25));

alter table public.leagues
  add column if not exists salary_cap_budget integer not null default 100;

comment on column public.leagues.salary_cap_budget is
  'Per-faction salary cap budget (default $100) when league_type is salary_cap.';

-- Allow salary_cap draft type (self-serve roster build, not snake/linear).
alter table public.leagues
  drop constraint if exists leagues_draft_type_check;

alter table public.leagues
  add constraint leagues_draft_type_check
  check (
    draft_type is null
    or draft_type in ('offline', 'linear', 'snake', 'autopick', 'salary_cap')
  );

comment on column public.leagues.league_type is
  'Format: season_overall, head_to_head, combo, legacy, salary_cap (shared pool, budget roster build).';

-- Fallback: seed tiers from 2K26 rating where unset ("2K26 rating" is stored as text).
-- For official Road to SummerSlam tiers, run supabase/seed_salary_cap_wrestler_values.sql after this.
update public.wrestlers
set salary_cap_cost = case
  when coalesce(nullif(trim("2K26 rating"), '')::numeric, 0) >= 90 then 25
  when coalesce(nullif(trim("2K26 rating"), '')::numeric, 0) >= 85 then 20
  when coalesce(nullif(trim("2K26 rating"), '')::numeric, 0) >= 80 then 15
  when coalesce(nullif(trim("2K26 rating"), '')::numeric, 0) >= 75 then 10
  else 5
end
where salary_cap_cost is null
  and "2K26 rating" is not null
  and trim("2K26 rating") <> '';
