-- Lock each roster stint's salary cap value at acquisition (season roster spend uses this, not live global prices).

alter table public.league_rosters
  add column if not exists salary_cap_cost integer null;

alter table public.league_rosters
  drop constraint if exists league_rosters_salary_cap_cost_check;

alter table public.league_rosters
  add constraint league_rosters_salary_cap_cost_check
  check (salary_cap_cost is null or salary_cap_cost in (5, 10, 15, 20, 25));

comment on column public.league_rosters.salary_cap_cost is
  'Salary cap value locked when this wrestler joined the roster. Season spend sums active rows; pool prices use league_wrestler_salary_snapshots.';
