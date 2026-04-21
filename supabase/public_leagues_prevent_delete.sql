-- Prevent commissioners from deleting public leagues.
-- Keeps private-league delete behavior unchanged.

drop policy if exists "Commissioner can delete league" on public.leagues;

create policy "Commissioner can delete league"
  on public.leagues for delete
  to authenticated
  using (
    commissioner_id = auth.uid()
    and coalesce(visibility_type, 'private') <> 'public'
  );

