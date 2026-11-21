-- Rename the Beat the Founders league address.
-- Old links redirect in next.config.ts from /leagues/the-founders-league.

update public.leagues
set slug = 'beat-the-founders-league'
where slug = 'the-founders-league'
  and not exists (
    select 1
    from public.leagues existing
    where existing.slug = 'beat-the-founders-league'
  );

-- Contest format: salary-cap head-to-head, 20-team cap, $40 weekly adds and drops.
update public.leagues
set
  league_type = 'salary_cap_h2h',
  max_teams = 20,
  salary_cap_weekly_budget = 40
where slug = 'beat-the-founders-league'
  and league_type = 'salary_cap';
