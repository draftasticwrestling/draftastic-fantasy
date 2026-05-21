-- Salary cap: $5 for wrestlers with no value and for all NXT roster talent.
-- Run after supabase/leagues_salary_cap.sql (and optional seed_salary_cap_wrestler_values.sql).
-- Safe to re-run.

-- Anyone still without a tier (null or invalid).
update public.wrestlers
set salary_cap_cost = 5
where salary_cap_cost is null
   or salary_cap_cost not in (5, 10, 15, 20, 25);

-- NXT brand (matches app bucket: exact "NXT" or brand text containing "nxt").
update public.wrestlers
set salary_cap_cost = 5
where brand is not null
  and (
    lower(trim(brand)) = 'nxt'
    or lower(brand) like '%nxt%'
  );
