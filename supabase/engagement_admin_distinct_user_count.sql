-- Exact distinct logged-in users for site-admin engagement windows (service role / RPC only).

create or replace function public.engagement_distinct_user_count(
  p_event_name text default null,
  p_season_slug text default null,
  p_season_scoped boolean default true,
  p_start timestamptz default null,
  p_end timestamptz default null
)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(distinct user_id)::bigint
  from public.engagement_events
  where user_id is not null
    and (p_event_name is null or event_name = p_event_name)
    and (
      (p_season_scoped and season_slug = p_season_slug)
      or (not p_season_scoped and season_slug is null)
    )
    and (p_start is null or occurred_at >= p_start)
    and (p_end is null or occurred_at < p_end);
$$;

comment on function public.engagement_distinct_user_count is
  'Distinct user_id for engagement admin KPIs. p_season_scoped=true filters season_slug=p_season_slug; false requires season_slug is null (article/results).';

revoke all on function public.engagement_distinct_user_count(text, text, boolean, timestamptz, timestamptz) from public;
grant execute on function public.engagement_distinct_user_count(text, text, boolean, timestamptz, timestamptz) to service_role;
