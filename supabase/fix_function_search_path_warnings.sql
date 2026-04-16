/* Fix Supabase Security Advisor: Function Search Path Mutable warnings. */
do $$
declare
  fn_name text;
  fn_oid oid;
  target_functions constant text[] := array[
    'set_articles_updated_at',
    'backfill_championship_history',
    'title_to_type',
    'title_to_championship_id',
    'extract_winner_from_result',
    'extract_loser_from_result',
    'find_wrestler_slug',
    'process_championship_changes'
  ];
begin
  foreach fn_name in array target_functions loop
    for fn_oid in
      select p.oid
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = fn_name
    loop
      execute format('alter function %s set search_path = public, pg_temp', fn_oid::regprocedure);
    end loop;
  end loop;
end
$$;
